// Flags for Computed and Effect.
export const UNDEFINED = 1 << 0;
export const NOTIFIED = 1 << 1;
export const UPDATING = 1 << 2;
export const ERROR = 1 << 3;
export const STALE = NOTIFIED | UNDEFINED;

let context = null;
let pending = null;
let recycling = null;

export const signal = init => new Signal(init);

export const computed = callback => new Computed(callback);

export function effect(callback) {
    const e = new Effect(callback);
    try {
        e.update(true);
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
        (context = parent) || commit();
    }
}

export function untracked(callback) {
    const parent = context;
    context = null;
    try {
        return callback();
    } finally {
        context = parent;
    }
}

export function tracked(callback) {
    const parent = context;
    context = this;
    try {
        return callback();
    } finally {
        context = parent;
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
        this.value = init;
        this.nextTarget = null;
    }

    as(name) {
        this.name = name;
        return this;
    }

    is(value) {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return Object.is(this.value, value);
    }

    get() {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return this.value;
    }

    set(value) {
        if (!Object.is(this.value, value)) {
            ++this.version;
            this.value = value;
            this.notify();
            context || commit();
        }
    }

    peek() {
        return this.value;
    }

    notify() {
        let t = this.nextTarget;
        while (t) {
            let n = t.targetNode;
            if (!(n.state & NOTIFIED)) {
                n.state |= NOTIFIED;
                n.notify();
            }
            t = t.nextTarget;
        }
    }

    sub(fn) {
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
        return this.value + "";
    }

    toJSON() {
        return this.value;
    }

    valueOf() {
        return this.value;
    }
}

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
    return !source || source.version < source.sourceNode;
};

export class Computed extends Signal {

    constructor(callback) {
        super(undefined);
        this.callback = callback;
        this.state = UNDEFINED;
        this.nextSource = null;
    }

    get() {
        if (context && context !== BATCH) {
            link(context, this);
        }
        return this.peek();
    }

    set(v) {
        throw new Error("Cannot write to a computed signal");
    }

    peek() {
        if (this.state & STALE) {
            this.update();
        }
        if (this.state & ERROR) {
            throw this.value;
        }
        return this.value;
    }

    update() {
        this.state &= ~NOTIFIED;
        if (this.state & UPDATING || this.nextSource && !findChanged(this)) {
            return false;
        }
        const parent = context;
        context = this;
        try {
            this.state |= UPDATING;
            unlink(this, false);
            let value = this.value;
            this.value = this.callback();
            this.state &= ~ERROR;
            if (this.state & UNDEFINED) {
                this.state &= ~UNDEFINED;
            } else if (!Object.is(value, this.value)) {
                ++this.version;
                return true;
            }
            return false;
        } catch (err) {
            this.state |= ERROR;
            this.value = err;
            return true;
        } finally {
            context = parent;
            this.state &= ~UPDATING;
        }
    }

    toString() {
        return this.value + "";
    }

    toJSON() {
        return this.value;
    }

    valueOf() {
        return this.value;
    }
}

export class Effect {

    constructor(callback) {
        this.state = 0;
        this.callback = callback;
        this.cleanup = undefined;
        this.nextSource = null;
        this.nextTarget = null;
    }

    update(force) {
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
        if (!this.callback || this.state & UPDATING && !isOutdated(this.nextSource) || !(force || findChanged(this))) {
            return;
        }
        const parent = context;
        context = this;
        try {
            this.state |= UPDATING;
            unlink(this, false);
            this.cleanup = this.callback();
        } finally {
            (context = parent) || commit();
            this.state &= ~UPDATING;
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
            context || commit();
        }
    }
}

let nextUpdate;

const flushUpdates = batch.bind(this, () => {
    const parent = context;
    context = null;
    try {
        while (nextUpdate) {
            nextUpdate.refresh(nextUpdate.signal.peek());
            nextUpdate.state &= ~UPDATING;
            nextUpdate = nextUpdate.nextUpdate;
        }
    } finally {
        (context = parent) || commit();
    }
});

export class RenderEffect {

    constructor(signal, nextEffect) {
        this.state = 0;
        this.signal = signal;
        this.nextSource = null;
        this.nextTarget = null;
        this.nextUpdate = null;
        this.nextEffect = nextEffect;
    }

    track(signal = this.signal) {
        const parent = context;
        context = this;
        try {
            this.nextSource = null;
            return signal.get();
        } finally {
            (context = parent) || commit();
        }
    }

    refresh() {
    }

    update() {
        this.state &= ~NOTIFIED;
        if (!this.signal || this.state & UPDATING || !findChanged(this)) {
            return false;
        }
        this.state |= UPDATING;
        if (!(this.nextUpdate = nextUpdate)) {
            requestAnimationFrame(flushUpdates);
        }
        nextUpdate = this;
        return true;
    }

    notify() {
        this.nextTarget = pending;
        pending = this;
    }

    dispose() {
        let nextEffect = this;
        do {
            if (nextEffect.signal) {
                nextEffect.signal = null;
                unlink(nextEffect, true);
            }
            nextEffect = nextEffect.nextEffect;
        } while (nextEffect);
    }
}
