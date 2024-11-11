// Flags for Computed and Effect.
export const UNDEFINED = 1 << 0;
export const NOTIFIED = 1 << 1;
export const UPDATING = 1 << 2;
export const ERROR = 1 << 3;
export const STALE = NOTIFIED | UNDEFINED;
export const UPDATED = ~(UPDATING | UNDEFINED);

let context = null;
let pending = null;
let recycling = null;

export function currentContext() {
    return context;
}

export function contextScope() {
    if (context === BATCH) {
        return null;
    }
    return context.scope ??= new Map();
}

export const signal = init => new Signal(init);

export const computed = callback => new Computed(callback);

export function effect(callback) {
    const e = new Effect(callback);
    try {
        e.update();
    } catch (err) {
        e.dispose();
        throw err;
    }
    return e.dispose.bind(e);
}

const BATCH = Symbol();

export function batch(callback) {
    const parent = context;
    context = BATCH;
    try {
        return callback();
    } finally {
        if ((context = parent) === null) commit();
    }
}

export function untracked(callback) {
    const parent = context;
    context = BATCH;
    try {
        return callback();
    } finally {
        context = parent;
    }
}

export function tracked(ctx, callback) {
    const parent = context;
    context = ctx;
    try {
        return callback.call(ctx);
    } finally {
        if ((context = parent) === null) commit();
    }
}

function link(target, source) {
    let t = target;
    while (t.nextSource) {
        t = t.nextSource;
        if (t.sourceNode === source) return;
    }
    if (recycling) {
        let recycled = recycling;
        recycling = recycled.nextTarget;
        recycled.version = source.version;
        recycled.sourceNode = source;
        recycled.nextSource = null;
        recycled.targetNode = target;
        recycled.nextTarget = source.nextTarget;
        t.nextSource = source.nextTarget = recycled;
    } else {
        t.nextSource = source.nextTarget = {
            version: source.version,
            sourceNode: source,
            nextSource: null,
            targetNode: target,
            nextTarget: source.nextTarget
        };
    }
}

const unlink = (target, force) => {
    let s = target;
    while ((s = s.nextSource)) {
        for (let sn = s.sourceNode, nt = sn.nextTarget; nt; nt = (sn = nt).nextTarget) {
            if (nt.targetNode === target) {
                if (force) {
                    (sn.nextTarget = nt.nextTarget) || unlink(sn, force);
                } else {
                    sn.nextTarget = nt.nextTarget;
                    nt.nextTarget = recycling;
                    recycling = nt;
                }
                break;
            }
        }
    }
    target.nextSource = null;
};

const commit = () => {
    if (pending) {
        context = BATCH;
        let effect;
        try {
            do {
                effect = pending;
                pending = effect.nextTarget;
                effect.nextTarget = null;
                effect.update();
            } while (pending);
        } catch (err) {
            while (pending) try {
                effect = pending;
                pending = effect.nextTarget;
                effect.nextTarget = null;
                effect.update();
            } catch (ignored) {
            }
            throw err;
        } finally {
            context = null;
        }
    }
    while (recycling) {
        if (!recycling.nextTarget) {
            unlink(recycling, true);
        }
        recycling = recycling.nextTarget;
    }
};

export class Signal {

    constructor(init) {
        this.version = 0;
        this.__value__ = init;
        this.nextTarget = null;
    }

    as(name) {
        this.name = name;
        return this;
    }

    get() {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return this.__value__;
    }

    set(value) {
        if (!Object.is(this.__value__, value)) {
            ++this.version;
            this.__value__ = value;
            this.notify();
            if (context === null) commit();
        }
    }

    peek() {
        return this.__value__;
    }

    get isLinked() {
        return true;
    }

    is(value) {
        return Object.is(this.__value__, value);
    }

    notify(state = NOTIFIED) {
        let t = this.nextTarget;
        while (t) {
            let n = t.targetNode;
            if (!(n.state & NOTIFIED)) {
                n.state |= state;
                n.notify(state);
            }
            t = t.nextTarget;
        }
    }

    sub(fn) {
        // TODO: refactor this to use Subscriber
        return effect(() => {
            const value = this.get();
            const parent = context;
            context = null;
            try {
                fn(value);
            } finally {
                context = parent;
            }
        });
    }

    toString() {
        return this.__value__ + "";
    }

    toJSON() {
        return this.__value__;
    }

    valueOf() {
        return this.__value__;
    }
}

Object.defineProperty(Signal.prototype, "value", {
    enumerable: true,
    configurable: false,
    get: Signal.prototype.get,
    set: Signal.prototype.set
});

export const findChanged = target => {
    let s = target.nextSource;
    while (s) {
        let n = s.sourceNode;
        if (n.state & NOTIFIED && n.update() || s.version < n.version) {
            return s;
        }
        s = s.nextSource;
    }
};

const isOutdated = source => {
    return !source || source.version < source.sourceNode.version;
};

export class Computed extends Signal {

    constructor(callback) {
        super(undefined);
        this.callback = callback;
        this.state = UNDEFINED;
        this.nextSource = null;
    }

    reset(callback) {
        this.callback = callback;
        this.state = UNDEFINED;
        return this.peek();
    }

    rewire(callback) {
        this.callback = typeof callback === "function" ? callback : () => callback;
        this.state = UNDEFINED;
        unlink(this, true);
        this.notify(this.state = STALE);
    }

    is(value) {
        try {
            return Object.is(this.peek(), value);
        } catch (e) {
            return undefined;
        }
    }

    get value() {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return this.peek();
    }

    set value(value) {
        throw new Error("Cannot write to a computed signal");
    }

    get() {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return this.peek();
    }

    set() {
        throw new Error("Cannot write to a computed signal");
    }

    peek() {
        if (this.state & STALE) {
            this.update();
        }
        if (this.state & ERROR) {
            throw this.__value__;
        }
        return this.__value__;
    }

    get isLinked() {
        return this.nextSource !== null;
    }

    update() {
        this.state &= ~NOTIFIED;
        if (this.state & UPDATING || this.nextSource && !(this.state & UNDEFINED || findChanged(this))) {
            return false;
        }
        const parent = context;
        context = this;
        try {
            this.state |= UPDATING;
            unlink(this, false);
            let value = this.__value__;
            this.__value__ = this.callback();
            this.state &= ~ERROR;
            if (this.state & UNDEFINED) {
                this.state &= ~UNDEFINED;
            } else if (!Object.is(value, this.__value__)) {
                ++this.version;
                return true;
            }
            return false;
        } catch (err) {
            this.state |= ERROR;
            this.__value__ = err;
            return true;
        } finally {
            if ((context = parent) === null) commit();
            this.state &= UPDATED;
        }
    }

    toString() {
        return this.__value__ + "";
    }

    toJSON() {
        return this.__value__;
    }

    valueOf() {
        return this.__value__;
    }
}

export class Effect {

    constructor(callback) {
        this.state = UNDEFINED;
        this.callback = callback;
        this.cleanup = undefined;
        this.nextSource = null;
        this.nextTarget = null;
    }

    update() {
        this.state &= ~NOTIFIED;
        if (this.cleanup) {
            const parent = context;
            context = BATCH;
            try {
                this.cleanup();
            } catch (err) {
                this.dispose();
                throw err;
            } finally {
                this.cleanup = undefined;
                context = parent;
            }
        }
        if (!this.callback || this.state & UPDATING && !isOutdated(this.nextSource) || !(this.state & UNDEFINED || findChanged(this))) {
            return;
        }
        const parent = context;
        context = this;
        try {
            this.state |= UPDATING;
            unlink(this, false);
            this.cleanup = this.callback();
        } finally {
            if ((context = parent) === null) commit();
            this.state &= UPDATED;
        }
    }

    notify() {
        this.nextTarget = pending;
        pending = this;
    }

    dispose() {
        if (this.callback) {
            this.callback = null;
            unlink(this, true);
            this.notify();
            if (context === null) commit();
        }
    }
}

export class Subscriber {

    constructor(signal) {
        this.state = 0;
        this.signal = signal;
        this.nextSource = null;
        this.nextTarget = null;
        link(this, signal);
    }

    rewire(source) {
        const value = this.signal.peek();
        if (typeof source === "function") {
            if (this.signal.rewire) {
                this.signal.rewire(source);
            } else {
                unlink(this, false);
                link(this, this.signal = computed(source));
            }
        } else {
            unlink(this, false);
            link(this, this.signal = signal);
        }
        if (!Object.is(value, this.signal.peek())) {
            this.state |= UNDEFINED;
            this.update();
        }
    }

    update() {
        this.state &= ~NOTIFIED;
        if (this.signal && !(this.state & UPDATING) && (this.state & UNDEFINED || findChanged(this))) {
            this.state |= UPDATING;
            return true;
        } else {
            return false;
        }
    }

    done() {
        this.state &= UPDATED;
    }

    notify() {
        this.nextTarget = pending;
        pending = this;
    }

    dispose() {
        if (this.signal) {
            this.signal = null;
            unlink(this, true);
        }
    }
}
