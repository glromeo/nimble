// Flags for Computed and Effect.
const RUNNING = 1 << 0
const NOTIFIED = 1 << 1
const OUTDATED = 1 << 2
const HAS_ERROR = 1 << 4

let count = 0
let context = null
let pending = null
let unlinking = null

export const signal = init => new Signal(init)

export const computed = callback => new Computed(callback)

export const effect = callback => {
    const e = new Effect(callback)
    try {
        e.refresh(true)
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
        if (!(context = parent)) commit()
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
    t.nextSource = source.nextTarget = {
        link: `target: ${target.name} source: ${source.name}`,
        version: source.version,
        sourceNode: source,
        nextSource: null,
        targetNode: target,
        nextTarget: source.nextTarget
    }
}

const unlink = target => {
    let s = target
    while ((s = s.nextSource)) {
        let sn = s.sourceNode
        while (sn.nextTarget) {
            if (sn.nextTarget.targetNode === target) {
                if (!(sn.nextTarget = sn.nextTarget.nextTarget)) {
                    unlinking = {
                        node: sn,
                        next: unlinking
                    }
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
        try {
            while (pending) {
                const effect = pending.effect
                pending = pending.next
                effect.refresh()
            }
        } catch (err) {
            while (pending) {
                const effect = pending.effect
                pending = pending.next
                try {
                    effect.refresh()
                } catch (ignored) {
                }
            }
            throw err
        } finally {
            context = null
        }
    }
    while (unlinking) {
        if (!unlinking.node.nextTarget) {
            unlink(unlinking.node)
        }
        unlinking = unlinking.next
    }
}

export class Signal {

    constructor(init) {
        this.name = `signal#${count++}`
        this.version = 0
        this.value = init
        this.nextTarget = null
    }

    as(name) {
        this.name = name
        return this
    }

    get val() {
        if (context?.notify) {
            link(context, this)
        }
        return this.value
    }

    set val(value) {
        if (!Object.is(this.value, value)) {
            ++this.version
            this.value = value
            this.notify()
            if (!context) commit()
        }
    }

    get peek() {
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
            const value = this.val
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

    get val() {
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

    set val(v) {
        throw new Error('Cannot write to a computed signal')
    }

    get peek() {
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
            unlink(this)
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

    static count = 0

    constructor(callback) {
        this.state = 0
        this.callback = callback
        this.name = `effect#${Effect.count++}`
        this.cleanup = undefined
        this.nextSource = null
        this.nextTarget = null
    }

    as(name) {
        this.name = name
        return this
    }

    refresh(force) {
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
        if (this.callback === null || this.state & RUNNING && !isOutdated(this.nextSource) || !(force || findChanged(this))) {
            return false
        }
        const parent = context
        context = this
        try {
            this.state |= RUNNING
            unlink(this)
            this.cleanup = this.callback()
        } finally {
            if (!(context = parent)) commit()
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
            unlink(this)
            pending = {
                effect: this,
                next: pending
            }
            if (!context) commit()
        }
    }
}

