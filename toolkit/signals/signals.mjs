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

function batch(callback) {
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

function untracked(callback) {
    const prevContext = evalContext;
    evalContext = undefined;
    try {
        return callback();
    } finally {
        evalContext = prevContext;
    }
}

let batchedEffect = undefined;
let batchDepth = 0;
let batchIteration = 0;

let globalVersion = 0;

export function increaseGlobalVersion() {
    globalVersion++;
}

function link(target, source) {
    if (target === undefined) {
        return undefined
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

class Signal {

    constructor(value) {
        this.__value__ = value;
        this.version = 0;
        this.node = undefined;
        this.targets = undefined;
    }

    refresh() {
        return true;
    };

    subscribe(node) {
        if (this.targets !== node && node.prevTarget === undefined) {
            node.nextTarget = this.targets;
            if (this.targets !== undefined) {
                this.targets.prevTarget = node;
            }
            this.targets = node;
        }
    };

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
    };

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
    };

    valueOf() {
        return this.get();
    };

    toString() {
        return this.get() + "";
    };

    toJSON() {
        return this.get();
    };

    peek() {
        const prevContext = evalContext;
        evalContext = undefined;
        try {
            return this.get();
        } finally {
            evalContext = prevContext;
        }
    };

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

function signal(value) {
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

class Computed extends Signal {

    constructor(callback) {
        super(undefined);

        this.callback = callback;
        this.sources = undefined;
        this.globalVersion = globalVersion - 1;
        this.flags = OUTDATED;
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
    };

    subscribe(node) {
        if (this.targets === undefined) {
            this.flags |= OUTDATED | TRACKING;

            for (let node = this.sources; node !== undefined; node = node.nextSource) {
                node.source.subscribe(node);
            }
        }
        super.subscribe(node);
    };

    unsubscribe(node) {
        if (this.targets !== undefined) {
            super.unsubscribe(node);

            if (this.targets === undefined) {
                this.flags &= ~TRACKING;

                for (let node = this.sources; node !== undefined; node = node.nextSource) {
                    node.source.unsubscribe(node);
                }
            }
        }
    };

    notify() {
        if (this.flags & NOTIFIED) {
            return;
        }
        this.flags |= OUTDATED | NOTIFIED;
        super.notify();
    };

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
        this.version = 0;
        globalVersion++;
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

function computed(callback) {
    return new Computed(callback);
}

function cleanupEffect(effect) {
    const cleanup = effect.cleanup;
    effect.cleanup = undefined;
    if (typeof cleanup === "function") {
        startBatch();
        const prevContext = evalContext;
        evalContext = undefined;
        try {
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
}

function disposeEffect(effect) {
    for (let node = effect.sources; node !== undefined; node = node.nextSource) {
        node.source.unsubscribe(node);
    }
    effect.callback = undefined;
    effect.sources = undefined;

    cleanupEffect(effect);
}

function endEffect(prevContext) {
    if (evalContext !== this) {
        throw new Error("Out-of-order effect");
    }
    cleanupSources(this);
    evalContext = prevContext;

    this.flags &= ~RUNNING;
    if (this.flags & DISPOSED) {
        disposeEffect(this);
    }
    endBatch();
}

class Effect {

    constructor(callback) {
        this.callback = callback;
        this.cleanup = undefined;
        this.sources = undefined;
        this.nextEffect = undefined;
        this.flags = TRACKING;
    }

    invoke() {
        const finish = this.start();
        try {
            if (this.flags & DISPOSED) return;
            if (this.callback === undefined) return;

            const cleanup = this.callback();
            if (typeof cleanup === "function") {
                this.cleanup = cleanup;
            }
        } finally {
            finish();
        }
    };

    start() {
        if (this.flags & RUNNING) {
            throw new Error("Cycle detected");
        }
        this.flags |= RUNNING;
        this.flags &= ~DISPOSED;
        cleanupEffect(this);
        prepareSources(this);

        startBatch();
        const prevContext = evalContext;
        evalContext = this;
        return endEffect.bind(this, prevContext);
    };

    notify() {
        if (this.flags & NOTIFIED) {
            return;
        }
        this.flags |= NOTIFIED;
        this.nextEffect = batchedEffect;
        batchedEffect = this;
    };

    dispose() {
        this.flags |= DISPOSED;
        if (!(this.flags & RUNNING)) {
            disposeEffect(this);
        }
    };

}

function effect(callback) {
    const effect = new Effect(callback);
    try {
        effect.invoke();
    } catch (err) {
        effect.dispose();
        throw err;
    }
    return effect.dispose.bind(effect);
}

export {signal, computed, effect, batch, untracked, Signal, Computed, Effect};

export function currentContext() {
    return evalContext;
}

const scopes = new WeakMap();

export function contextScope(context = evalContext) {
    if (context === undefined) {
        throw new Error("missing context");
    }
    let map = scopes.get(context);
    if (map === undefined) {
        scopes.set(context, map = new Map());
    }
    return map;
}

export function tracked(ctx, callback) {
    const prevContext = evalContext;
    evalContext = ctx;
    try {
        return callback(ctx);
    } finally {
        evalContext = prevContext;
    }
}

let queuedObserver = undefined;

const notifyObservers = untracked.bind(null, () => {
    let observer = queuedObserver;
    queuedObserver = undefined;
    while (observer !== undefined) {
        const next = observer.nextEffect;
        observer.nextEffect = undefined;
        observer.flags &= ~NOTIFIED;
        if (!(observer.flags & DISPOSED) && needsToRecompute(observer)) {
            observer.flags |= RUNNING;
            observer.flags &= ~DISPOSED;
            try {
                const {callback, signal} = observer;
                if (callback !== undefined) callback(signal.get());
            } catch (err) {
                console.error("observer callback failure", err);
            } finally {
                observer.flags &= ~RUNNING;
                if (observer.flags & DISPOSED) {
                    observer.dispose();
                }
            }
        }
        observer = next;
    }
});

export class Observer {

    constructor(signal, callback) {
        this.signal = signal;
        this.callback = callback;
        this.source = undefined; // there is only one
        this.nextEffect = undefined;
        this.flags = TRACKING;
        link(this, signal);
    }

    invoke() {
        this.flags |= RUNNING;
        this.flags &= ~DISPOSED;

        const prevContext = evalContext;
        evalContext = undefined; // this;
        try {
            if (this.callback !== undefined) this.callback(this.signal.get());
        } finally {
            evalContext = prevContext;

            this.flags &= ~RUNNING;
            if (this.flags & DISPOSED) {
                this.dispose();
            }
        }
    }

    notify() {
        if (this.flags & NOTIFIED) {
            return;
        }
        this.flags |= NOTIFIED;
        if (batchDepth > 1) {
            this.nextEffect = batchedEffect;
            batchedEffect = this;
        } else {
            if ((this.nextEffect = queuedObserver) === undefined) {
                requestAnimationFrame(notifyObservers);
            }
            queuedObserver = this;
        }
    }

    dispose() {
        if ((this.flags |= DISPOSED) & RUNNING) {
            return;
        }
        const node = this.source;
        node.source.unsubscribe(node);
        this.callback = undefined;
    }
}

export function observe(signal, callback) {
    const effect = new Observer(signal, callback);
    return effect.dispose.bind(effect);
}