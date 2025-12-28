const RUNNING = 1 << 0;
const NOTIFIED = 1 << 1;
const OUTDATED = 1 << 2;
const DISPOSED = 1 << 3;
const ERRORED = 1 << 4;

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
        while (effect  !== undefined) {
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

export function increaseGlobalVersion() {
    globalVersion++;
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
    if (target === undefined || target.notify === undefined) {
        return -1;
    }

    // Initialize arrays if needed
    if (target.sources === undefined) {
        target.sources = [];
        target.versions = [];
        target.sourceSlots = [];
    }
    if (source.targets === undefined) {
        source.targets = [];
        source.targetSlots = [];
    }

    // Check if already linked
    const existingIndex = target.sources.indexOf(source);

    if (existingIndex === -1) {
        // Create new link - always subscribe immediately
        const sourceIndex = target.sources.length;
        const targetIndex = source.targets.length;

        target.sources.push(source);
        target.versions.push(source.version);
        target.sourceSlots.push(targetIndex);

        source.targets.push(target);
        source.targetSlots.push(sourceIndex);

        return sourceIndex;
    } else if (target.versions[existingIndex] === -1) {
        // Reactivate - update version
        target.versions[existingIndex] = source.version;

        // Move to end for cleanup tracking
        if (existingIndex < target.sources.length - 1) {
            const lastIndex = target.sources.length - 1;

            // Swap
            const source = target.sources[existingIndex];
            const version = target.versions[existingIndex];
            const slot = target.sourceSlots[existingIndex];

            target.sources[existingIndex] = target.sources[lastIndex];
            target.versions[existingIndex] = target.versions[lastIndex];
            target.sourceSlots[existingIndex] = target.sourceSlots[lastIndex];

            target.sources[lastIndex] = source;
            target.versions[lastIndex] = version;
            target.sourceSlots[lastIndex] = slot;

            // Update back-reference
            const swappedSource = target.sources[existingIndex];
            const swappedSlot = target.sourceSlots[existingIndex];
            swappedSource.targetSlots[swappedSlot] = existingIndex;
        }

        return target.sources.length - 1;
    }

    return existingIndex;
}

export class Signal {
    constructor(value) {
        this.__value__ = value;
        this.version = 0;
        this.targets = undefined;
        this.targetSlots = undefined;
    }

    refresh() {
        return true;
    }

    unsubscribe(targetIndex) {
        if (this.targets === undefined) return;

        const lastIndex = this.targets.length - 1;

        if (targetIndex < lastIndex) {
            this.targets[targetIndex] = this.targets[lastIndex];
            this.targetSlots[targetIndex] = this.targetSlots[lastIndex];

            const swappedTarget = this.targets[targetIndex];
            const swappedSourceIdx = this.targetSlots[targetIndex];
            swappedTarget.sourceSlots[swappedSourceIdx] = targetIndex;
        }

        this.targets.pop();
        this.targetSlots.pop();

        if (this.targets.length === 0) {
            this.targets = undefined;
            this.targetSlots = undefined;
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
        const sourceIndex = link(evalContext, this);
        if (sourceIndex !== -1) {
            evalContext.versions[sourceIndex] = this.version;
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
        if (this.targets === undefined) return;

        for (let i = 0; i < this.targets.length; i++) {
            this.targets[i].notify();
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
    if (target.sources === undefined) return false;

    for (let i = 0; i < target.sources.length; i++) {
        const source = target.sources[i];
        const version = target.versions[i];

        if (source.version !== version ||
            !source.refresh() ||
            source.version !== version) {
            return true;
        }
    }
    return false;
}

function prepareSources(target) {
    if (target.sources === undefined) return;

    for (let i = 0; i < target.versions.length; i++) {
        target.versions[i] = -1;
    }
}

function cleanupSources(target) {
    if (target.sources === undefined) return;

    let writeIdx = 0;

    for (let readIdx = 0; readIdx < target.sources.length; readIdx++) {
        if (target.versions[readIdx] === -1) {
            target.sources[readIdx].unsubscribe(target.sourceSlots[readIdx]);
        } else {
            if (writeIdx !== readIdx) {
                target.sources[writeIdx] = target.sources[readIdx];
                target.versions[writeIdx] = target.versions[readIdx];
                target.sourceSlots[writeIdx] = target.sourceSlots[readIdx];

                const source = target.sources[writeIdx];
                const targetIdx = target.sourceSlots[writeIdx];
                source.targetSlots[targetIdx] = writeIdx;
            }
            writeIdx++;
        }
    }

    target.sources.length = writeIdx;
    target.versions.length = writeIdx;
    target.sourceSlots.length = writeIdx;

    if (target.sources.length === 0) {
        target.sources = undefined;
        target.versions = undefined;
        target.sourceSlots = undefined;
    }
}

export class Computed extends Signal {
    constructor(callback) {
        super(undefined);

        this.callback = callback;
        this.sources = undefined;
        this.versions = undefined;
        this.sourceSlots = undefined;
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

    unsubscribe(targetIndex) {
        super.unsubscribe(targetIndex);
        if (this.sources !== undefined && this.targets === undefined) {
            for (let i = this.sources.length - 1; i >= 0; i--) {
                this.sources[i].unsubscribe(this.sourceSlots[i]);
            }

            this.sources = undefined;
            this.versions = undefined;
            this.sourceSlots = undefined;

            if (this.owned !== undefined) disposeOwned(this);
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
        const sourceIndex = link(evalContext, this);
        this.refresh();
        if (sourceIndex !== -1) {
            evalContext.versions[sourceIndex] = this.version;
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
    if (effect.sources !== undefined) {
        let i = effect.sources.length;
        while (--i >= 0) {
            effect.sources[i].unsubscribe(effect.sourceSlots[i]);
        }
    }
    effect.callback = undefined;
    effect.sources = undefined;
    effect.versions = undefined;
    effect.sourceSlots = undefined;

    if (effect.owned !== undefined) disposeOwned(effect);
    if (effect.scope !== undefined) effect.scope.dispose();
    if (effect.cleanup !== undefined) cleanupEffect(effect);
}

function disposeOwned(owner) {
    for (const owned of owner.owned) owned.dispose();
    owner.owned = undefined;
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
        this.versions = undefined;
        this.sourceSlots = undefined;
        this.nextEffect = undefined;
        this.flags = 0;
        this.owned = undefined;

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
        if ((this.flags |= DISPOSED) & RUNNING) {
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

