// Flags for Computed and Effect.
const RUNNING = 1 << 0
const NOTIFIED = 1 << 1
const OUTDATED = 1 << 2
const HAS_ERROR = 1 << 4

let context = null
let pending = null
let recycling = null

export const signal = init => new Signal(init)

export const computed = callback => new Computed(callback)

export const effect = callback => {
    const e = new Effect(callback)
    try {
        e.init()
    } catch (err) {
        e.dispose()
        throw err
    }
    return e.dispose.bind(e)
}

const BATCH = Symbol()

export const batch = callback => {
    const parent = context
    context = BATCH
    try {
        return callback()
    } finally {
        (context = parent) || commit()
    }
}

export const untracked = callback => {
    const parent = context
    context = null
    try {
        return callback()
    } finally {
        context = parent
    }
}

const link = (target, source) => {
    let t = target
    while (t.nextSource) {
        t = t.nextSource
        if (t.sourceNode === source) return
    }
    if (recycling) {
        let recycled = recycling.node
        recycling = recycling.next
        recycled.version = source.version
        recycled.sourceNode = source
        recycled.nextSource = null
        recycled.targetNode = target
        recycled.nextTarget = source.nextTarget
        t.nextSource = source.nextTarget = recycled
        return
    }
    t.nextSource = source.nextTarget = {
        version: source.version,
        sourceNode: source,
        nextSource: null,
        targetNode: target,
        nextTarget: source.nextTarget
    }
}

const unlink = (target, force) => {
    let s = target
    while ((s = s.nextSource)) {
        let sn = s.sourceNode
        while (sn.nextTarget) {
            if (sn.nextTarget.targetNode === target) {
                if (force) {
                    if (!(sn.nextTarget = sn.nextTarget.nextTarget)) {
                        unlink(sn, force)
                    }
                } else {
                    recycling = {
                        node: sn.nextTarget,
                        next: recycling
                    }
                    sn.nextTarget = sn.nextTarget.nextTarget
                }
                break
            }
            sn = sn.nextTarget
        }
    }
    target.nextSource = null
}

const commit = () => {
    if (pending) {
        context = BATCH
        let effect
        try {
            do {
                effect = pending.effect
                pending = pending.next
                effect.refresh()
            } while (pending)
        } catch (err) {
            while (pending) try {
                effect = pending.effect
                pending = pending.next
                effect.refresh()
            } catch (ignored) {
            }
            throw err
        } finally {
            context = null
        }
    }
    while (recycling) {
        if (!recycling.node.nextTarget) {
            unlink(recycling.node, true)
        }
        recycling = recycling.next
    }
}

export class Signal {

    constructor(init) {
        this.version = 0
        this.value = init
        this.nextTarget = null
    }

    as(name) {
        this.name = name
        return this
    }

    is(value) {
        if (context?.notify) {
            link(context, this)
        }
        return Object.is(this.value, value)
    }

    get() {
        if (context?.notify) {
            link(context, this)
        }
        return this.value
    }

    set(value) {
        if (!Object.is(this.value, value)) {
            ++this.version
            this.value = value
            this.notify()
            context || commit()
        }
    }

    peek() {
        return this.value
    }

    notify() {
        let t = this.nextTarget
        while (t) {
            let n = t.targetNode
            if (!(n.state & NOTIFIED)) {
                n.state |= NOTIFIED
                n.notify()
            }
            t = t.nextTarget
        }
    }

    sub(fn) {
        return effect(() => {
            const value = this.get()
            const parent = context
            context = null
            try {
                fn(value)
            } finally {
                context = parent
            }
        })
    }

    toString() {
        return this.value + ''
    }

    toJSON() {
        return this.value
    }

    valueOf() {
        return this.value
    }
}

const findChanged = target => {
    let s = target.nextSource
    while (s) {
        let n = s.sourceNode
        if ((n.state & NOTIFIED) && n.refresh() || s.version < n.version) {
            return s
        }
        s = s.nextSource
    }
}

const isOutdated = source => {
    return !source || source.version < source.sourceNode
}

export class Computed extends Signal {

    constructor(callback) {
        super(undefined)
        this.version = 0
        this.callback = callback
        this.state = OUTDATED
        this.nextSource = null
    }

    get() {
        if (context?.notify) {
            link(context, this)
        }
        if (this.state & (NOTIFIED | OUTDATED)) {
            this.refresh()
        }
        if (this.state & HAS_ERROR) {
            throw this.value
        }
        return this.value
    }

    set(v) {
        throw new Error('Cannot write to a computed signal')
    }

    peek() {
        if (this.state & (NOTIFIED | OUTDATED)) {
            this.refresh()
        }
        if (this.state & HAS_ERROR) {
            throw this.value
        }
        return this.value
    }

    refresh() {
        this.state &= ~NOTIFIED
        if ((this.state & RUNNING) || this.nextSource && !findChanged(this)) {
            return false
        }
        const parent = context
        context = this
        try {
            this.state |= RUNNING
            unlink(this, false)
            let value = this.value
            this.value = this.callback()
            this.state &= ~HAS_ERROR
            if (this.state & OUTDATED) {
                this.state &= ~OUTDATED
            } else {
                if (!Object.is(value, this.value)) {
                    ++this.version
                    return true
                }
            }
        } catch (err) {
            this.state |= HAS_ERROR
            this.value = err
            return true
        } finally {
            context = parent
            this.state &= ~RUNNING
        }
    }

    toString() {
        return this.value + ''
    }

    toJSON() {
        return this.value
    }

    valueOf() {
        return this.value
    }
}

export class Effect {

    constructor(callback) {
        this.state = 0
        this.callback = callback
        this.cleanup = undefined
        this.nextSource = null
    }

    init() {
        if (this.callback === null) {
            return false
        }
        const parent = context
        context = this
        try {
            this.state |= RUNNING
            unlink(this, false)
            this.cleanup = this.callback()
        } finally {
            (context = parent) || commit()
            this.state &= ~RUNNING
        }
    }

    refresh() {
        this.state &= ~NOTIFIED
        if (this.cleanup) {
            const parent = context
            context = BATCH
            try {
                this.cleanup()
            } catch (err) {
                this.dispose()
                throw err
            } finally {
                this.cleanup = undefined
                context = parent
            }
        }
        if (this.callback === null || this.state & RUNNING && !isOutdated(this.nextSource) || !findChanged(this)) {
            return false
        }
        const parent = context
        context = this
        try {
            this.state |= RUNNING
            unlink(this, false)
            this.cleanup = this.callback()
        } finally {
            (context = parent) || commit()
            this.state &= ~RUNNING
        }
    }

    notify() {
        pending = {
            effect: this,
            next: pending
        }
    }

    dispose() {
        if (this.callback) {
            this.callback = null
            unlink(this, true)
            pending = {
                effect: this,
                next: pending
            }
            context || commit()
        }
    }
}

