const RUNNING = 1 << 0;
const NOTIFIED = 1 << 1;
const OUTDATED = 1 << 2;
const DISPOSED = 1 << 3;
const ERRORED = 1 << 4;
const TRACKING = 1 << 5;

function startBatch() {
    batchDepth++;
}

function endBatch() {
    if (batchDepth > 1) {
        batchDepth--;
        return;
    }
    let error = undefined;
    while (batchedEffect !== undefined) {
        let effect = batchedEffect;
        batchedEffect = undefined;
        batchIteration++;
        while (effect !== undefined) {
            const next = effect.nextEffect;
            effect.nextEffect = undefined;
            effect.flags &= ~NOTIFIED;

            if (!(effect.flags & DISPOSED) && needsToRecompute(effect)) {
                try {
                    effect.invoke();
                } catch (err) {
                    error ??= err;
                }
            }
            effect = next;
        }
    }
    batchIteration = 0;
    batchDepth--;
    if (error !== undefined) {
        throw error;
    }
}

export function batch(callback) {
    if (batchDepth > 0) {
        return callback();
    }
    startBatch();
    try {
        return callback();
    } finally {
        endBatch();
    }
}

let evalContext = undefined;

export function untracked(callback) {
    const prevContext = evalContext;
    evalContext = undefined;
    try {
        return callback();
    } finally {
        evalContext = prevContext;
    }
}

export function tracked(owner, fn) {
    const prevContext = evalContext;
    evalContext = owner;
    try {
        return fn();
    } finally {
        evalContext = prevContext;
    }
}

let batchedEffect = undefined;
let batchDepth = 0;
let batchIteration = 0;

let globalVersion = 0;

function link(target, source) {
    if (target === undefined) {
        return undefined;
    }
    let node = source.node;
    if (node === undefined || node.target !== target) {
        node = {
            version: 0,
            source: source,
            prevSource: target.sources,
            nextSource: undefined,
            target: target,
            prevTarget: undefined,
            nextTarget: undefined,
            rollbackNode: node,
        };
        if (target.sources !== undefined) {
            target.sources.nextSource = node;
        }
        target.sources = node;
        source.node = node;
        if (target.flags & TRACKING) {
            source.subscribe(node);
        }
        return node;
    } else if (node.version === -1) {
        node.version = 0;
        if (node.nextSource !== undefined) {
            node.nextSource.prevSource = node.prevSource;

            if (node.prevSource !== undefined) {
                node.prevSource.nextSource = node.nextSource;
            }

            node.prevSource = target.sources;
            node.nextSource = undefined;

            target.sources.nextSource = node;
            target.sources = node;
        }
        return node;
    }
    return undefined;
}

export class Signal {

    constructor(value) {
        this.__value__ = value;
        this.version = 0;
        this.node = undefined;
        this.targets = undefined;
    }

    refresh() {
        return true;
    }

    subscribe(node) {
        if (this.targets !== node && node.prevTarget === undefined) {
            node.nextTarget = this.targets;
            if (this.targets !== undefined) {
                this.targets.prevTarget = node;
            }
            this.targets = node;
        }
    }

    unsubscribe(node) {
        if (this.targets !== undefined) {
            const prev = node.prevTarget;
            const next = node.nextTarget;
            if (prev !== undefined) {
                prev.nextTarget = next;
                node.prevTarget = undefined;
            }
            if (next !== undefined) {
                next.prevTarget = prev;
                node.nextTarget = undefined;
            }
            if (node === this.targets) {
                this.targets = next;
            }
        }
    }

    sub(callback) {
        return effect(() => {
            const value = this.get();
            const prevContext = evalContext;
            evalContext = undefined;
            try {
                callback(value);
            } finally {
                evalContext = prevContext;
            }
        });
    }

    valueOf() {
        return this.get();
    }

    toString() {
        return this.get() + "";
    }

    toJSON() {
        return this.get();
    }

    peek() {
        const prevContext = evalContext;
        evalContext = undefined;
        try {
            return this.get();
        } finally {
            evalContext = prevContext;
        }
    }

    get() {
        const node = link(evalContext, this);
        if (node !== undefined) {
            node.version = this.version;
        }
        return this.__value__;
    }

    set(value) {
        if (value !== this.__value__) {
            if (batchIteration > 100) {
                throw new Error("Cycle detected");
            }
            this.__value__ = value;
            this.version++;
            globalVersion++;
            startBatch();
            try {
                this.notify();
            } finally {
                endBatch();
            }
        }
    }

    notify() {
        for (let node = this.targets; node !== undefined; node = node.nextTarget) {
            node.target.notify();
        }
    }
}

Object.defineProperty(Signal.prototype, "value", {
    get: Signal.prototype.get,
    set: Signal.prototype.set
});

export function signal(value) {
    return new Signal(value);
}

function needsToRecompute(target) {
    for (let node = target.sources; node !== undefined; node = node.nextSource) {
        if (node.source.version !== node.version || !node.source.refresh() || node.source.version !== node.version) {
            return true;
        }
    }
    return false;
}

function prepareSources(target) {
    for (let node = target.sources; node !== undefined; node = node.nextSource) {
        const rollbackNode = node.source.node;
        if (rollbackNode !== undefined) {
            node.rollbackNode = rollbackNode;
        }
        node.source.node = node;
        node.version = -1;

        if (node.nextSource === undefined) {
            target.sources = node;
            break;
        }
    }
}

function cleanupSources(target) {
    let node = target.sources;
    let head = undefined;

    while (node !== undefined) {
        const prev = node.prevSource;

        if (node.version === -1) {
            node.source.unsubscribe(node);
            if (prev !== undefined) {
                prev.nextSource = node.nextSource;
            }
            if (node.nextSource !== undefined) {
                node.nextSource.prevSource = prev;
            }
        } else {
            head = node;
        }

        node.source.node = node.rollbackNode;
        if (node.rollbackNode !== undefined) {
            node.rollbackNode = undefined;
        }

        node = prev;
    }

    target.sources = head;
}

function disposeOwned(owner) {
    if (owner.owned !== undefined) {
        for (const owned of owner.owned) {
            owned.dispose();
        }
        owner.owned = undefined;
    }
}

export class Computed extends Signal {

    constructor(callback) {
        super(undefined);

        this.callback = callback;
        this.sources = undefined;
        this.globalVersion = globalVersion - 1;
        this.flags = OUTDATED;
        this.owned = undefined;
    }

    refresh() {
        this.flags &= ~NOTIFIED;

        if (this.flags & RUNNING) {
            return false;
        }

        if (this.flags & OUTDATED) {
            this.flags &= ~OUTDATED;
        } else if (this.flags & TRACKING) {
            return true;
        }

        if (this.globalVersion === globalVersion) {
            return true;
        }
        this.globalVersion = globalVersion;

        this.flags |= RUNNING;
        if (this.version > 0 && !needsToRecompute(this)) {
            this.flags &= ~RUNNING;
            return true;
        }

        if (this.owned !== undefined) disposeOwned(this);

        const prevContext = evalContext;
        try {
            prepareSources(this);
            evalContext = this;
            const value = this.callback();
            if (this.flags & ERRORED || this.__value__ !== value || this.version === 0) {
                this.__value__ = value;
                this.flags &= ~ERRORED;
                this.version++;
            }
        } catch (err) {
            this.__value__ = err;
            this.flags |= ERRORED;
            this.version++;
        }
        evalContext = prevContext;
        cleanupSources(this);
        this.flags &= ~RUNNING;
        return true;
    }

    subscribe(node) {
        if (this.targets === undefined) {
            this.flags |= OUTDATED | TRACKING;

            for (let node = this.sources; node !== undefined; node = node.nextSource) {
                node.source.subscribe(node);
            }
        }
        super.subscribe(node);
    }

    unsubscribe(node) {
        if (this.targets !== undefined) {
            super.unsubscribe(node);

            if (this.targets === undefined) {
                this.flags &= ~TRACKING;

                for (let node = this.sources; node !== undefined; node = node.nextSource) {
                    node.source.unsubscribe(node);
                }

                if (this.owned !== undefined) disposeOwned(this);
            }
        }
    }

    notify() {
        if (this.flags & NOTIFIED) {
            return;
        }
        this.flags |= OUTDATED | NOTIFIED;
        super.notify();
    }

    get() {
        if (this.flags & RUNNING) {
            throw new Error("Cycle detected");
        }
        const node = link(evalContext, this);
        this.refresh();
        if (node !== undefined) {
            node.version = this.version;
        }
        if (this.flags & ERRORED) {
            throw this.__value__;
        }
        return this.__value__;
    }

    reset(callback) {
        this.callback = callback;
        let changed;
        try {
            changed = untracked(callback) !== this.__value__;
        } catch (e) {
            changed = true;
        }
        if (changed) {
            this.version = 0;
            this.globalVersion = globalVersion - 1;
        }
        startBatch();
        try {
            this.notify();
        } finally {
            endBatch();
        }
    }
}

Object.defineProperty(Computed.prototype, "value", {
    get: Computed.prototype.get
});

export function computed(callback) {
    return new Computed(callback);
}

function cleanupEffect(effect) {
    startBatch();
    const prevContext = evalContext;
    evalContext = undefined;
    try {
        const cleanup = effect.cleanup;
        effect.cleanup = undefined;
        cleanup();
    } catch (err) {
        effect.flags &= ~RUNNING;
        effect.flags |= DISPOSED;
        disposeEffect(effect);
        throw err;
    } finally {
        evalContext = prevContext;
        endBatch();
    }
}

function disposeEffect(effect) {
    for (let node = effect.sources; node !== undefined; node = node.nextSource) {
        node.source.unsubscribe(node);
    }
    effect.callback = undefined;
    effect.sources = undefined;

    if (effect.owned !== undefined) disposeOwned(effect);
    if (effect.scope !== undefined) effect.scope.dispose();
    if (effect.cleanup !== undefined) cleanupEffect(effect);
}

function endEffect(prevContext) {
    if (evalContext !== this) {
        throw new Error("Out-of-order effect");
    }
    cleanupSources(this);

    if (this.scope !== undefined) {
        this.scope.reset();
    }

    evalContext = prevContext;

    this.flags &= ~RUNNING;
    if (this.flags & DISPOSED) {
        disposeEffect(this);
    }
    endBatch();
}

export class Effect {

    constructor(callback) {
        this.callback = callback;
        this.cleanup = undefined;
        this.sources = undefined;
        this.nextEffect = undefined;
        this.flags = TRACKING;
        this.owned = undefined;
        this.scope = undefined;

        if (evalContext !== undefined && !(evalContext.flags & DISPOSED)) {
            if (evalContext.owned === undefined) {
                evalContext.owned = [this];
            } else {
                evalContext.owned.push(this);
            }
        }
    }

    invoke() {
        const finish = this.start();
        try {
            if (this.flags & DISPOSED || this.callback === undefined) return;

            const cleanup = this.callback();
            if (typeof cleanup === "function") {
                this.cleanup = cleanup;
            }
        } finally {
            finish();
        }
    }

    start() {
        if (this.flags & RUNNING) {
            throw new Error("Cycle detected");
        }
        this.flags |= RUNNING;
        this.flags &= ~DISPOSED;

        if (this.owned !== undefined) disposeOwned(this);
        if (this.cleanup !== undefined) cleanupEffect(this);

        prepareSources(this);

        startBatch();
        const prevContext = evalContext;
        evalContext = this;
        return endEffect.bind(this, prevContext);
    }

    notify() {
        if (this.flags & NOTIFIED) {
            return;
        }
        this.flags |= NOTIFIED;
        this.nextEffect = batchedEffect;
        batchedEffect = this;
    }

    dispose() {
        if ((this.flags |= DISPOSED) & RUNNING) { // if running dispose it later...
            return;
        }
        disposeEffect(this);
    }

}

export function effect(callback) {
    const effect = new Effect(callback);
    try {
        effect.invoke();
    } catch (err) {
        effect.dispose();
        throw err;
    }
    return effect.dispose.bind(effect);
}

export function currentContext() {
    return evalContext;
}

export class Observer extends Effect {

    observe(callback) {
        this.callback = callback;
        this.notify();
    }

    onChange(value, prev) {
    }

    onError(err) {
        console.error("unhandled error in mutation callback", err);
    }

    invoke() {
        const finish = this.start();
        try {
            if (this.flags & DISPOSED || this.callback === undefined) return;

            const value = this.callback();
            if (value !== this.value) {
                this.onChange(value, this.value);
                this.value = value;
            }
        } catch (err) {
            this.onError(err, this.value);
        } finally {
            finish();
        }
    }

}

export class Scope {
    constructor() {
        this.live = undefined;
        this.next = undefined;
    }

    get(key) {
        return this.live !== undefined ? this.live[key] : undefined;
    }

    set(key, state) {
        if (this.next === undefined) {
            this.next = {};
        }
        this.next[key] = state;
    }

    reset() {
        if (this.live !== undefined) {
            if (this.next !== undefined) {
                for (const key in this.live) {
                    if (!(key in this.next)) {
                        disposeOwnedIfAny(this.live[key]);
                    }
                }
            } else {
                Object.values(this.live).forEach(disposeOwnedIfAny);
            }
        }

        this.live = this.next;
        this.next = undefined;
    }

    dispose() {
        if (this.live !== undefined) Object.values(this.live).forEach(disposeOwnedIfAny);
        if (this.next !== undefined) Object.values(this.next).forEach(disposeOwnedIfAny);
    }
}

function disposeOwnedIfAny(owner) {
    if (owner.owned !== undefined) {
        for (const owned of owner.owned) {
            owned.dispose();
        }
        owner.owned = undefined;
    }
}
