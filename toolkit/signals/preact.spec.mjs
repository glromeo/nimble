import {batch, computed, effect, Signal, signal, untracked} from './signals.mjs'
import {expect, sinon} from 'mocha-toolkit'

describe('signal', () => {
    it('should return value', () => {
        const v = [1, 2]
        const s = signal(v)
        expect(s.val).to.equal(v)
    })

    it('should inherit from Signal', () => {
        expect(signal(0)).to.be.instanceOf(Signal)
    })

    it('should support .toString()', () => {
        const s = signal(123)
        expect(s.toString()).equal('123')
    })

    it('should support .toJSON()', () => {
        const s = signal(123)
        expect(s.toJSON()).equal(123)
    })

    it('should support JSON.Stringify()', () => {
        const s = signal(123)
        expect(JSON.stringify({s})).equal(JSON.stringify({s: 123}))
    })

    it('should support .valueOf()', () => {
        const s = signal(123)
        expect(s).to.have.property('valueOf')
        expect(s.valueOf).to.be.a('function')
        expect(s.valueOf()).equal(123)
        expect(+s).equal(123)

        const a = signal(1)
        const b = signal(2)
        // @ts-ignore-next-line
        expect(a + b).to.equal(3)
    })

    it('should notify other listeners of changes after one listener is disposed', () => {
        const s = signal(0)
        const spy1 = sinon.spy(() => {
            s.val
        })
        const spy2 = sinon.spy(() => {
            s.val
        })
        const spy3 = sinon.spy(() => {
            s.val
        })

        effect(spy1)
        const dispose = effect(spy2)
        effect(spy3)

        expect(spy1).to.be.calledOnce
        expect(spy2).to.be.calledOnce
        expect(spy3).to.be.calledOnce

        dispose()

        s.val = 1
        expect(spy1).to.be.calledTwice
        expect(spy2).to.be.calledOnce
        expect(spy3).to.be.calledTwice
    })

    describe('.peek', () => {
        it('should get value', () => {
            const s = signal(1)
            expect(s.peek).equal(1)
        })

        it('should get the updated value after a value change', () => {
            const s = signal(1)
            s.val = 2
            expect(s.peek).equal(2)
        })

        it('should not make surrounding effect depend on the signal', () => {
            const s = signal(1)
            const spy = sinon.spy(() => {
                s.peek
            })

            effect(spy)
            expect(spy).to.be.calledOnce

            s.val = 2
            expect(spy).to.be.calledOnce
        })

        it('should not make surrounding computed depend on the signal', () => {
            const s = signal(1)
            const spy = sinon.spy(() => {
                s.peek
            })
            const d = computed(spy)

            d.val
            expect(spy).to.be.calledOnce

            s.val = 2
            d.val
            expect(spy).to.be.calledOnce
        })
    })

    describe('.sub()', () => {
        it('should subscribe to a signal', () => {
            const spy = sinon.spy()
            const a = signal(1)

            a.sub(spy)
            expect(spy).to.be.calledWith(1)
        })

        it('should run the callback when the signal value changes', () => {
            const spy = sinon.spy()
            const a = signal(1)

            a.sub(spy)

            a.val = 2
            expect(spy).to.be.calledWith(2)
        })

        it('should unsubscribe from a signal', () => {
            const spy = sinon.spy()
            const a = signal(1)

            const dispose = a.sub(spy)
            dispose()
            spy.resetHistory()

            a.val = 2
            expect(spy).not.to.be.called
        })

        it('should not start triggering on when a signal accessed in the callback changes', () => {
            const spy = sinon.spy()
            const a = signal(0)
            const b = signal(0)

            a.sub(() => {
                b.val
                spy()
            })
            expect(spy).to.be.calledOnce
            spy.resetHistory()

            b.val++
            expect(spy).not.to.be.called
        })

        it('should not cause surrounding effect to subscribe to changes to a signal accessed in the callback', () => {
            const spy = sinon.spy()
            const a = signal(0)
            const b = signal(0)

            effect(() => {
                a.sub(() => {
                    b.val
                })
                spy()
            })
            expect(spy).to.be.calledOnce
            spy.resetHistory()

            b.val++
            expect(spy).not.to.be.called
        })
    })
})

describe('effect()', () => {
    it('should run the callback immediately', () => {
        const s = signal(123)
        const spy = sinon.spy(() => {
            s.val
        })
        effect(spy)
        expect(spy).to.be.called
    })

    it('should subscribe to signals', () => {
        const s = signal(123)
        const spy = sinon.spy(() => {
            s.val
        })
        effect(spy)
        spy.resetHistory()

        s.val = 42
        expect(spy).to.be.called
    })

    it('should subscribe to multiple signals', () => {
        const a = signal('a')
        const b = signal('b')
        const spy = sinon.spy(() => {
            a.val
            b.val
        })
        effect(spy)
        spy.resetHistory()

        a.val = 'aa'
        b.val = 'bb'
        expect(spy).to.be.calledTwice
    })

    it('should dispose of subscriptions', () => {
        const a = signal('a')
        const b = signal('b')
        const spy = sinon.spy(() => {
            a.val + ' ' + b.val
        })
        const dispose = effect(spy)
        spy.resetHistory()

        dispose()
        expect(spy).not.to.be.called

        a.val = 'aa'
        b.val = 'bb'
        expect(spy).not.to.be.called
    })

    it('should unsubscribe from signal', () => {
        const s = signal(123)
        const spy = sinon.spy(() => {
            s.val
        })
        const unsub = effect(spy)
        spy.resetHistory()

        unsub()
        s.val = 42
        expect(spy).not.to.be.called
    })

    it('should conditionally unsubscribe from signals', () => {
        const a = signal('a')
        const b = signal('b')
        const cond = signal(true)

        const spy = sinon.spy(() => {
            cond.val ? a.val : b.val
        })

        effect(spy)
        expect(spy).to.be.calledOnce

        b.val = 'bb'
        expect(spy).to.be.calledOnce

        cond.val = false
        expect(spy).to.be.calledTwice

        spy.resetHistory()

        a.val = 'aaa'
        expect(spy).not.to.be.called
    })

    it('should batch writes', () => {
        const a = signal('a')
        const spy = sinon.spy(() => {
            a.val
        })
        effect(spy)
        spy.resetHistory()

        effect(() => {
            a.val = 'aa'
            a.val = 'aaa'
        })

        expect(spy).to.be.calledOnce
    })

    it('should call the cleanup callback before the next run', () => {
        const a = signal(0)
        const spy = sinon.spy()

        effect(() => {
            a.val
            return spy
        })
        expect(spy).not.to.be.called
        a.val = 1
        expect(spy).to.be.calledOnce
        a.val = 2
        expect(spy).to.be.calledTwice
    })

    it('should call only the callback from the previous run', () => {
        const spy1 = sinon.spy()
        const spy2 = sinon.spy()
        const spy3 = sinon.spy()
        const a = signal(spy1)

        effect(() => {
            return a.val
        })

        expect(spy1).not.to.be.called
        expect(spy2).not.to.be.called
        expect(spy3).not.to.be.called

        a.val = spy2
        expect(spy1).to.be.calledOnce
        expect(spy2).not.to.be.called
        expect(spy3).not.to.be.called

        a.val = spy3
        expect(spy1).to.be.calledOnce
        expect(spy2).to.be.calledOnce
        expect(spy3).not.to.be.called
    })

    it('should call the cleanup callback function when disposed', () => {
        const spy = sinon.spy()

        const dispose = effect(() => {
            return spy
        })
        expect(spy).not.to.be.called
        dispose()
        expect(spy).to.be.calledOnce
    })

    it('should not recompute if the effect has been notified about changes, but no direct dependency has actually changed', () => {
        const s = signal(0)
        const c = computed(() => {
            s.val
            return 0
        })
        const spy = sinon.spy(() => {
            c.val
        })
        effect(spy)
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        s.val = 1
        expect(spy).not.to.be.called
    })

    it('should not recompute dependencies unnecessarily', () => {
        const spy = sinon.spy()
        const a = signal(0).as('a')
        const b = signal(0).as('b')
        const c = computed(() => {
            b.val
            spy()
        }).as('c')
        effect(() => {
            if (a.val === 0) {
                c.val
            }
        })
        expect(spy).to.be.calledOnce

        batch(() => {
            b.val = 1
            a.val = 1
        })
        expect(spy).to.be.calledOnce
    })

    it('should not recompute dependencies out of order', () => {
        const a = signal(1).as('a')
        const b = signal(1).as('b')
        const c = signal(1).as('c')

        const spy = sinon.spy(() => c.val)
        const d = computed(spy).as('d')

        effect(() => {
            if (a.val > 0) {
                b.val
                d.val
            } else {
                b.val
            }
        })
        spy.resetHistory()

        batch(() => {
            a.val = 2
            b.val = 2
            c.val = 2
        })
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        batch(() => {
            a.val = -1
            b.val = -1
            c.val = -1
        })
        expect(spy).not.to.be.called
        spy.resetHistory()
    })

    it('should recompute if a dependency changes during computation after becoming a dependency', () => {
        const a = signal(0)
        const spy = sinon.spy(() => {
            if (a.val === 0) {
                a.val++
            }
        })
        effect(spy)
        expect(spy).to.be.calledTwice
    })

    it('should run the cleanup in an implicit batch', () => {
        const a = signal(0)
        const b = signal('a')
        const c = signal('b')
        const spy = sinon.spy()

        effect(() => {
            b.val
            c.val
            spy(b.val + c.val)
        })

        effect(() => {
            a.val
            return () => {
                b.val = 'x'
                c.val = 'y'
            }
        })

        expect(spy).to.be.calledOnce
        spy.resetHistory()

        a.val = 1
        expect(spy).to.be.calledOnce
        expect(spy).to.be.calledWith('xy')
    })

    it('should not retrigger the effect if the cleanup modifies one of the dependencies', () => {
        const a = signal(0)
        const spy = sinon.spy()

        effect(() => {
            spy(a.val)
            return () => {
                a.val = 2
            }
        })
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        a.val = 1
        expect(spy).to.be.calledOnce
        expect(spy).to.be.calledWith(2)
    })

    it('should run the cleanup if the effect disposes itself', () => {
        const a = signal(0)
        const spy = sinon.spy()

        const dispose = effect(() => {
            if (a.val > 0) {
                dispose()
                return spy
            }
        })
        expect(spy).not.to.be.called
        a.val = 1
        expect(spy).to.be.calledOnce
        a.val = 2
        expect(spy).to.be.calledOnce
    })

    it('should not run the effect if the cleanup function disposes it', () => {
        const a = signal(0)
        const spy = sinon.spy()

        const dispose = effect(() => {
            a.val
            spy()
            return () => {
                dispose()
            }
        })
        expect(spy).to.be.calledOnce
        a.val = 1
        expect(spy).to.be.calledOnce
    })

    it('should not subscribe to anything if first run throws', () => {
        const s = signal(0)
        const spy = sinon.spy(() => {
            s.val
            throw new Error('test')
        })
        expect(() => effect(spy)).to.throw('test')
        expect(spy).to.be.calledOnce

        s.val++
        expect(spy).to.be.calledOnce
    })

    it('should reset the cleanup if the effect throws', () => {
        const a = signal(0)
        const spy = sinon.spy()

        effect(() => {
            if (a.val === 0) {
                return spy
            } else {
                throw new Error('hello')
            }
        })
        expect(spy).not.to.be.called
        expect(() => (a.val = 1)).to.throw('hello')
        expect(spy).to.be.calledOnce
        a.val = 0
        expect(spy).to.be.calledOnce
    })

    it('should dispose the effect if the cleanup callback throws', () => {
        const a = signal(0)
        const spy = sinon.spy()

        effect(() => {
            if (a.val === 0) {
                return () => {
                    throw new Error('hello')
                }
            } else {
                spy()
            }
        })
        expect(spy).not.to.be.called
        expect(() => a.val++).to.throw('hello')
        expect(spy).not.to.be.called
        a.val++
        expect(spy).not.to.be.called
    })

    it('should run cleanups outside any evaluation context', () => {
        const spy = sinon.spy()
        const a = signal(0)
        const b = signal(0)
        const c = computed(() => {
            if (a.val === 0) {
                effect(() => {
                    return () => {
                        b.val
                    }
                })
            }
            return a.val
        })

        effect(() => {
            spy()
            c.val
        })
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        a.val = 1
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        b.val = 1
        expect(spy).not.to.be.called
    })

    it('should NOT throw on cycles', () => {
        const a = signal(0)
        let i = 0

        const fn = () =>
            effect(() => {
                // Prevent test suite from spinning if limit is not hit
                if (i++ > 200) {
                    throw new Error('test failed')
                }
                a.val
                a.val = NaN
            })

        expect(fn).not.to.throw()
        expect(a.peek).to.be.NaN
    })

    it('should NOT throw on indirect cycles', () => {
        const a = signal(0)
        let i = 0

        const c = computed(() => {
            a.val
            a.val = NaN
            return NaN
        })

        const fn = () =>
            effect(() => {
                // Prevent test suite from spinning if limit is not hit
                if (i++ > 200) {
                    throw new Error('test failed')
                }
                c.val
            })

        expect(fn).to.not.throw()
        expect(a.peek).to.be.NaN
    })

    it('should allow disposing the effect multiple times', () => {
        const dispose = effect(() => undefined)
        dispose()
        expect(() => dispose()).not.to.throw()
    })

    it('should allow disposing a running effect', () => {
        const a = signal(0)
        const spy = sinon.spy()
        const dispose = effect(() => {
            if (a.val === 1) {
                dispose()
                spy()
            }
        })
        expect(spy).not.to.be.called
        a.val = 1
        expect(spy).to.be.calledOnce
        a.val = 2
        expect(spy).to.be.calledOnce
    })

    it('should not run if it\'s first been triggered and then disposed in a batch', () => {
        const a = signal(0)
        const spy = sinon.spy(() => {
            a.val
        })
        const dispose = effect(spy)
        spy.resetHistory()

        batch(() => {
            a.val = 1
            dispose()
        })

        expect(spy).not.to.be.called
    })

    it('should not run if it\'s been triggered, disposed and then triggered again in a batch', () => {
        const a = signal(0)
        const spy = sinon.spy(() => {
            a.val
        })
        const dispose = effect(spy)
        spy.resetHistory()

        batch(() => {
            a.val = 1
            dispose()
            a.val = 2
        })

        expect(spy).not.to.be.called
    })

    it('should not rerun parent effect if a nested child effect\'s signal\'s value changes', () => {
        const parentSignal = signal(0)
        const childSignal = signal(0)

        const parentEffect = sinon.spy(() => {
            parentSignal.val
        })
        const childEffect = sinon.spy(() => {
            childSignal.val
        })

        effect(() => {
            parentEffect()
            effect(childEffect)
        })

        expect(parentEffect).to.be.calledOnce
        expect(childEffect).to.be.calledOnce

        childSignal.val = 1

        expect(parentEffect).to.be.calledOnce
        expect(childEffect).to.be.calledTwice

        parentSignal.val = 1

        expect(parentEffect).to.be.calledTwice
        expect(childEffect).to.be.calledThrice
    })

})

describe('computed()', () => {
    it('should return value', () => {
        const a = signal('a')
        const b = signal('b')

        const c = computed(() => a.val + b.val)
        expect(c.val).to.equal('ab')
    })

    it('should inherit from Signal', () => {
        expect(computed(() => 0)).to.be.instanceOf(Signal)
    })

    it('should return updated value', () => {
        const a = signal('a')
        const b = signal('b')

        const c = computed(() => a.val + b.val)
        expect(c.val).to.equal('ab')

        a.val = 'aa'
        expect(c.val).to.equal('aab')
    })

    it('should be lazily computed on demand', () => {
        const a = signal('a')
        const b = signal('b')
        const spy = sinon.spy(() => a.val + b.val)
        const c = computed(spy)
        expect(spy).to.not.be.called
        c.val
        expect(spy).to.be.calledOnce
        a.val = 'x'
        b.val = 'y'
        expect(spy).to.be.calledOnce
        c.val
        expect(spy).to.be.calledTwice
    })

    it('should be computed only when a dependency has changed at some point', () => {
        const a = signal('a')
        const spy = sinon.spy(() => {
            return a.val
        })
        const c = computed(spy)
        c.val
        expect(spy).to.be.calledOnce
        a.val = 'a'
        c.val
        expect(spy).to.be.calledOnce
    })

    it('should recompute if a dependency changes during computation after becoming a dependency', () => {
        const a = signal(0)
        const spy = sinon.spy(() => {
            a.val++
        })
        const c = computed(spy)
        c.val
        expect(spy).to.be.calledOnce
        c.val
        expect(spy).to.be.calledTwice
    })

    it('should detect simple dependency cycles and resort to undefined', () => {
        let i = 0
        const a = computed(() => {
            if (++i > 200) {
                throw new Error('test failed')
            }
            return a.val
        })
        expect(() => a.val).not.to.throw()
        expect(a.val).to.be.undefined
    })

    it('should detect deep dependency cycles', () => {
        const a = computed(() => b.val)
        const b = computed(() => c.val)
        const c = computed(() => d.val)
        let i = 0
        const d = computed(() => {
            if (++i > 200) {
                throw new Error('test failed')
            }
            return a.val
        })
        expect(() => a.val).not.to.throw()
        expect(a.val).to.be.undefined
    })

    it('should not allow a computed signal to become a direct dependency of itself', () => {
        const spy = sinon.spy(() => {
            try {
                a.val
            } catch {
                // pass
            }
        })
        const a = computed(spy)
        a.val
        expect(() => effect(() => a.val)).to.not.throw()
    })

    it('should store thrown errors and recompute only after a dependency changes', () => {
        const a = signal(0)
        const spy = sinon.spy(() => {
            a.val
            throw new Error()
        })
        const c = computed(spy)
        expect(() => c.val).to.throw()
        expect(() => c.val).to.throw()
        expect(spy).to.be.calledOnce
        a.val = 1
        expect(() => c.val).to.throw()
        expect(spy).to.be.calledTwice
    })

    it('should store thrown non-errors and recompute only after a dependency changes', () => {
        const a = signal(0)
        const spy = sinon.spy()
        const c = computed(() => {
            a.val
            spy()
            throw undefined
        })

        try {
            c.val
            expect.fail()
        } catch (err) {
            expect(err).to.be.undefined
        }
        try {
            c.val
            expect.fail()
        } catch (err) {
            expect(err).to.be.undefined
        }
        expect(spy).to.be.calledOnce

        a.val = 1
        try {
            c.val
            expect.fail()
        } catch (err) {
            expect(err).to.be.undefined
        }
        expect(spy).to.be.calledTwice
    })

    it('should conditionally unsubscribe from signals', () => {
        const a = signal('a')
        const b = signal('b')
        const cond = signal(true)

        const spy = sinon.spy(() => {
            return cond.val ? a.val : b.val
        })

        const c = computed(spy)
        expect(c.val).to.equal('a')
        expect(spy).to.be.calledOnce

        b.val = 'bb'
        expect(c.val).to.equal('a')
        expect(spy).to.be.calledOnce

        cond.val = false
        expect(c.val).to.equal('bb')
        expect(spy).to.be.calledTwice

        spy.resetHistory()

        a.val = 'aaa'
        expect(c.val).to.equal('bb')
        expect(spy).not.to.be.called
    })

    it('should consider undefined value separate from uninitialized value', () => {
        const a = signal(0)
        const spy = sinon.spy(() => undefined)
        const c = computed(spy)

        expect(c.val).to.be.undefined
        a.val = 1
        expect(c.val).to.be.undefined
        expect(spy).to.be.calledOnce
    })

    it('should not leak errors raised by dependencies', () => {
        const a = signal(0)
        const b = computed(() => {
            a.val
            throw new Error('error')
        })
        const c = computed(() => {
            try {
                b.val
            } catch {
                return 'ok'
            }
        })
        expect(c.val).to.equal('ok')
        a.val = 1
        expect(c.val).to.equal('ok')
    })

    it('should propagate notifications even right after first subscription', () => {
        const a = signal(0)
        const b = computed(() => a.val)
        const c = computed(() => b.val)
        c.val

        const spy = sinon.spy(() => {
            c.val
        })

        effect(spy)
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        a.val = 1
        expect(spy).to.be.calledOnce
    })

    it('should get marked as outdated right after first subscription', () => {
        const s = signal(0)
        const c = computed(() => s.val)
        c.val

        s.val = 1
        effect(() => {
            c.val
        })
        expect(c.val).to.equal(1)
    })

    it('should propagate notification to other listeners after one listener is disposed', () => {
        const s = signal(0)
        const c = computed(() => s.val)

        const spy1 = sinon.spy(() => {
            c.val
        })
        const spy2 = sinon.spy(() => {
            c.val
        })
        const spy3 = sinon.spy(() => {
            c.val
        })

        effect(spy1)
        const dispose = effect(spy2)
        effect(spy3)

        expect(spy1).to.be.calledOnce
        expect(spy2).to.be.calledOnce
        expect(spy3).to.be.calledOnce

        dispose()

        s.val = 1
        expect(spy1).to.be.calledTwice
        expect(spy2).to.be.calledOnce
        expect(spy3).to.be.calledTwice
    })

    it('should not recompute dependencies out of order', () => {
        const a = signal(1)
        const b = signal(1)
        const c = signal(1)

        const spy = sinon.spy(() => c.val)
        const d = computed(spy)

        const e = computed(() => {
            if (a.val > 0) {
                b.val
                d.val
            } else {
                b.val
            }
        })

        e.val
        spy.resetHistory()

        a.val = 2
        b.val = 2
        c.val = 2
        e.val
        expect(spy).to.be.calledOnce
        spy.resetHistory()

        a.val = -1
        b.val = -1
        c.val = -1
        e.val
        expect(spy).not.to.be.called
        spy.resetHistory()
    })

    it('should not recompute dependencies unnecessarily', () => {
        const spy = sinon.spy()
        const a = signal(0)
        const b = signal(0)
        const c = computed(() => {
            b.val
            spy()
        })
        const d = computed(() => {
            if (a.val === 0) {
                c.val
            }
        })
        d.val
        expect(spy).to.be.calledOnce

        batch(() => {
            b.val = 1
            a.val = 1
        })
        d.val
        expect(spy).to.be.calledOnce
    })

    describe('.peek', () => {
        it('should get value', () => {
            const s = signal(1)
            const c = computed(() => s.val)
            expect(c.peek).equal(1)
        })

        it('should throw when evaluation throws', () => {
            const c = computed(() => {
                throw Error('test')
            })
            expect(() => c.peek).to.throw('test')
        })

        it('should throw when previous evaluation threw and dependencies haven\'t changed', () => {
            const c = computed(() => {
                throw Error('test')
            })
            expect(() => c.val).to.throw('test')
            expect(() => c.peek).to.throw('test')
        })

        it('should refresh value if stale', () => {
            const a = signal(1)
            const b = computed(() => a.val)
            expect(b.peek).to.equal(1)

            a.val = 2
            expect(b.peek).to.equal(2)
        })

        it('should detect simple dependency cycles', () => {
            let i = 0
            const a = computed(() => {
                if (++i > 200) {
                    throw new Error('test failed')
                }
                return a.peek
            })
            expect(() => a.peek).not.to.throw()
            expect(a.peek).to.be.undefined
        })

        it('should detect deep dependency cycles', () => {
            const a = computed(() => b.val)
            const b = computed(() => c.val)
            const c = computed(() => d.val)
            let i = 0
            const d = computed(() => {
                if (++i > 200) {
                    throw new Error('test failed')
                }
                return a.peek
            })
            expect(() => d.peek).not.to.throw()
            expect(d.peek).to.be.undefined
        })

        it('should not make surrounding effect depend on the computed', () => {
            const s = signal(1)
            const c = computed(() => s.val)
            const spy = sinon.spy(() => {
                c.peek
            })

            effect(spy)
            expect(spy).to.be.calledOnce

            s.val = 2
            expect(spy).to.be.calledOnce
        })

        it('should not make surrounding computed depend on the computed', () => {
            const s = signal(1)
            const c = computed(() => s.val)

            const spy = sinon.spy(() => {
                c.peek
            })

            const d = computed(spy)
            d.val
            expect(spy).to.be.calledOnce

            s.val = 2
            d.val
            expect(spy).to.be.calledOnce
        })

        it('should not make surrounding effect depend on the peeked computed\'s dependencies', () => {
            const a = signal(1)
            const b = computed(() => a.val)
            const spy = sinon.spy()
            effect(() => {
                spy()
                b.peek
            })
            expect(spy).to.be.calledOnce
            spy.resetHistory()

            a.val = 1
            expect(spy).not.to.be.called
        })

        it('should not make surrounding computed depend on peeked computed\'s dependencies', () => {
            const a = signal(1)
            const b = computed(() => a.val)
            const spy = sinon.spy()
            const d = computed(() => {
                spy()
                b.peek
            })
            d.val
            expect(spy).to.be.calledOnce
            spy.resetHistory()

            a.val = 1
            d.val
            expect(spy).not.to.be.called
        })
    })

    describe('garbage collection', function () {
        before(function () {
            if (typeof gc === 'undefined') {
                this.skip() // Skip GC tests if window.gc/global.gc is not defined.
            }
        })

        it('should be garbage collectable if nothing is listening to its changes', async () => {
            const s = signal(0)
            const ref = new WeakRef(computed(() => s.val))

            gc()
            await new Promise(resolve => setTimeout(resolve, 0))
            gc()
            expect(ref.deref()).to.be.undefined
        })

        it('should be garbage collectable after it has lost all of its listeners', async () => {
            const s = signal(0)

            let ref
            let dispose

            (function () {
                const c = computed(() => s.val)
                ref = new WeakRef(c)
                dispose = effect(() => {
                    c.val
                })
            })()

            dispose()
            gc()
            await new Promise(resolve => setTimeout(resolve, 0))
            gc()
            expect(ref.deref()).to.be.undefined
        })
    })

    describe('graph updates', () => {
        it('should run computeds once for multiple dep changes', async () => {
            const a = signal('a')
            const b = signal('b')

            const compute = sinon.spy(() => {
                // debugger;
                return a.val + b.val
            })
            const c = computed(compute)

            expect(c.val).to.equal('ab')
            expect(compute).to.have.been.calledOnce
            compute.resetHistory()

            a.val = 'aa'
            b.val = 'bb'
            c.val
            expect(compute).to.have.been.calledOnce
        })

        it('should drop A->B->A updates', async () => {
            //     A
            //   / |
            //  B  | <- Looks like a flag doesn't it? :D
            //   \ |
            //     C
            //     |
            //     D
            const a = signal(2)

            const b = computed(() => a.val - 1)
            const c = computed(() => a.val + b.val)

            const compute = sinon.spy(() => 'd: ' + c.val)
            const d = computed(compute)

            // Trigger read
            expect(d.val).to.equal('d: 3')
            expect(compute).to.have.been.calledOnce
            compute.resetHistory()

            a.val = 4
            d.val
            expect(compute).to.have.been.calledOnce
        })

        it('should only update every signal once (diamond graph)', () => {
            // In this scenario "D" should only update once when "A" receives
            // an update. This is sometimes referred to as the "diamond" scenario.
            //     A
            //   /   \
            //  B     C
            //   \   /
            //     D
            const a = signal('a')
            const b = computed(() => a.val)
            const c = computed(() => a.val)

            const spy = sinon.spy(() => b.val + ' ' + c.val)
            const d = computed(spy)

            expect(d.val).to.equal('a a')
            expect(spy).to.be.calledOnce

            a.val = 'aa'
            expect(d.val).to.equal('aa aa')
            expect(spy).to.be.calledTwice
        })

        it('should only update every signal once (diamond graph + tail)', () => {
            // "E" will be likely updated twice if our mark+sweep logic is buggy.
            //     A
            //   /   \
            //  B     C
            //   \   /
            //     D
            //     |
            //     E
            const a = signal('a')
            const b = computed(() => a.val)
            const c = computed(() => a.val)

            const d = computed(() => b.val + ' ' + c.val)

            const spy = sinon.spy(() => d.val)
            const e = computed(spy)

            expect(e.val).to.equal('a a')
            expect(spy).to.be.calledOnce

            a.val = 'aa'
            expect(e.val).to.equal('aa aa')
            expect(spy).to.be.calledTwice
        })

        it('should bail out if result is the same', () => {
            // Bail out if value of "B" never changes
            // A->B->C
            const a = signal('a')
            const b = computed(() => {
                a.val
                return 'foo'
            })

            const spy = sinon.spy(() => b.val)
            const c = computed(spy)

            expect(c.val).to.equal('foo')
            expect(spy).to.be.calledOnce

            a.val = 'aa'
            expect(c.val).to.equal('foo')
            expect(spy).to.be.calledOnce
        })

        it('should only update every signal once (jagged diamond graph + tails)', () => {
            // "F" and "G" will be likely updated twice if our mark+sweep logic is buggy.
            //     A
            //   /   \
            //  B     C
            //  |     |
            //  |     D
            //   \   /
            //     E
            //   /   \
            //  F     G
            const a = signal('a').as('A')

            const b = computed(() => a.val).as('B')
            const c = computed(() => a.val).as('C')

            const d = computed(() => c.val).as('D')

            const eSpy = sinon.spy(() => b.val + ' ' + d.val)
            const e = computed(eSpy).as('E')

            const fSpy = sinon.spy(() => e.val)
            const f = computed(fSpy).as('F')
            const gSpy = sinon.spy(() => e.val)
            const g = computed(gSpy).as('G')

            expect(f.val).to.equal('a a')
            expect(fSpy).to.be.calledOnce

            expect(g.val).to.equal('a a')
            expect(gSpy).to.be.calledOnce

            eSpy.resetHistory()
            fSpy.resetHistory()
            gSpy.resetHistory()

            a.val = 'b'

            expect(e.val).to.equal('b b')
            expect(eSpy).to.be.calledOnce

            expect(f.val).to.equal('b b')
            expect(fSpy).to.be.calledOnce

            expect(g.val).to.equal('b b')
            expect(gSpy).to.be.calledOnce

            eSpy.resetHistory()
            fSpy.resetHistory()
            gSpy.resetHistory()

            a.val = 'c'

            expect(e.val).to.equal('c c')
            expect(eSpy).to.be.calledOnce

            expect(f.val).to.equal('c c')
            expect(fSpy).to.be.calledOnce

            expect(g.val).to.equal('c c')
            expect(gSpy).to.be.calledOnce

            // top to bottom
            expect(eSpy).to.have.been.calledBefore(fSpy)
            // left to right
            expect(fSpy).to.have.been.calledBefore(gSpy)
        })

        it('should only subscribe to signals listened to', () => {
            //    *A
            //   /   \
            // *B     C <- we don't listen to C
            const a = signal('a')

            const b = computed(() => a.val)
            const spy = sinon.spy(() => a.val)
            computed(spy)

            expect(b.val).to.equal('a')
            expect(spy).not.to.be.called

            a.val = 'aa'
            expect(b.val).to.equal('aa')
            expect(spy).not.to.be.called
        })

        it('should only subscribe to signals listened to', () => {
            // Here both "B" and "C" are active in the beginning, but
            // "B" becomes inactive later. At that point it should
            // not receive any updates anymore.
            //    *A
            //   /   \
            // *B     D <- we don't listen to C
            //  |
            // *C
            const a = signal('a')
            const spyB = sinon.spy(() => a.val)
            const b = computed(spyB)

            const spyC = sinon.spy(() => b.val)
            const c = computed(spyC)

            const d = computed(() => a.val)

            let result = ''
            const unsub = effect(() => {
                result = c.val
            })

            expect(result).to.equal('a')
            expect(d.val).to.equal('a')

            spyB.resetHistory()
            spyC.resetHistory()
            unsub()

            a.val = 'aa'

            expect(spyB).not.to.be.called
            expect(spyC).not.to.be.called
            expect(d.val).to.equal('aa')
        })

        it('should ensure subs update even if one dep unmarks it', () => {
            // In this scenario "C" always returns the same value. When "A"
            // changes, "B" will update, then "C" at which point its update
            // to "D" will be unmarked. But "D" must still update because
            // "B" marked it. If "D" isn't updated, then we have a bug.
            //     A
            //   /   \
            //  B     *C <- returns same value every time
            //   \   /
            //     D
            const a = signal('a')
            const b = computed(() => a.val)
            const c = computed(() => {
                a.val
                return 'c'
            })
            const spy = sinon.spy(() => b.val + ' ' + c.val)
            const d = computed(spy)
            expect(d.val).to.equal('a c')
            spy.resetHistory()

            a.val = 'aa'
            d.val
            expect(spy).to.returned('aa c')
        })

        it('should ensure subs update even if two deps unmark it', () => {
            // In this scenario both "C" and "D" always return the same
            // value. But "E" must still update because "A"  marked it.
            // If "E" isn't updated, then we have a bug.
            //     A
            //   / | \
            //  B *C *D
            //   \ | /
            //     E
            const a = signal('a')
            const b = computed(() => a.val)
            const c = computed(() => {
                a.val
                return 'c'
            })
            const d = computed(() => {
                a.val
                return 'd'
            })
            const spy = sinon.spy(() => b.val + ' ' + c.val + ' ' + d.val)
            const e = computed(spy)
            expect(e.val).to.equal('a c d')
            spy.resetHistory()

            a.val = 'aa'
            e.val
            expect(spy).to.returned('aa c d')
        })
    })

    describe('error handling', () => {
        it('should throw when writing to computeds', () => {
            const a = signal('a')
            const b = computed(() => a.val)
            const fn = () => (b.val = 'aa')
            expect(fn).to.throw(/Cannot write to a computed signal/)
        })

        it('should keep graph consistent on errors during activation', () => {
            const a = signal(0)
            const b = computed(() => {
                throw new Error('fail')
            })
            const c = computed(() => a.val)
            expect(() => b.val).to.throw('fail')

            a.val = 1
            expect(c.val).to.equal(1)
        })

        it('should keep graph consistent on errors in computeds', () => {
            const a = signal(0)
            const b = computed(() => {
                if (a.val === 1) throw new Error('fail')
                return a.val
            })
            const c = computed(() => b.val)
            expect(c.val).to.equal(0)

            a.val = 1
            expect(() => b.val).to.throw('fail')

            a.val = 2
            expect(c.val).to.equal(2)
        })

        it('should support lazy branches', () => {
            const a = signal(0)
            const b = computed(() => a.val)
            const c = computed(() => (a.val > 0 ? a.val : b.val))

            expect(c.val).to.equal(0)
            a.val = 1
            expect(c.val).to.equal(1)

            a.val = 0
            expect(c.val).to.equal(0)
        })

        it('should not update a sub if all deps unmark it', () => {
            // In this scenario "B" and "C" always return the same value. When "A"
            // changes, "D" should not update.
            //     A
            //   /   \
            // *B     *C
            //   \   /
            //     D
            const a = signal('a')
            const b = computed(() => {
                a.val
                return 'b'
            })
            const c = computed(() => {
                a.val
                return 'c'
            })
            const spy = sinon.spy(() => b.val + ' ' + c.val)
            const d = computed(spy)
            expect(d.val).to.equal('b c')
            spy.resetHistory()

            a.val = 'aa'
            expect(spy).not.to.be.called
        })
    })
})

describe('batch/transaction', () => {
    it('should return the value from the callback', () => {
        expect(batch(() => 1)).to.equal(1)
    })

    it('should throw errors thrown from the callback', () => {
        expect(() =>
            batch(() => {
                throw Error('hello')
            })
        ).to.throw('hello')
    })

    it('should throw non-errors thrown from the callback', () => {
        try {
            batch(() => {
                throw undefined
            })
            expect.fail()
        } catch (err) {
            expect(err).to.be.undefined
        }
    })

    it('should delay writes', () => {
        const a = signal('a')
        const b = signal('b')
        const spy = sinon.spy(() => {
            a.val + ' ' + b.val
        })
        effect(spy)
        spy.resetHistory()

        batch(() => {
            a.val = 'aa'
            b.val = 'bb'
        })

        expect(spy).to.be.calledOnce
    })

    it('should delay writes until outermost batch is complete', () => {
        const a = signal('a')
        const b = signal('b')
        const spy = sinon.spy(() => {
            a.val + ', ' + b.val
        })
        effect(spy)
        spy.resetHistory()

        batch(() => {
            batch(() => {
                a.val += ' inner'
                b.val += ' inner'
            })
            a.val += ' outer'
            b.val += ' outer'
        })

        // If the inner batch() would have flushed the update
        // this spy would've been called twice.
        expect(spy).to.be.calledOnce
    })

    it('should read signals written to', () => {
        const a = signal('a')

        let result = ''
        batch(() => {
            a.val = 'aa'
            result = a.val
        })

        expect(result).to.equal('aa')
    })

    it('should read computed signals with updated source signals', () => {
        // A->B->C->D->E
        const a = signal('a')
        const b = computed(() => a.val)

        const spyC = sinon.spy(() => b.val)
        const c = computed(spyC)

        const spyD = sinon.spy(() => c.val)
        const d = computed(spyD)

        const spyE = sinon.spy(() => d.val)
        const e = computed(spyE)

        spyC.resetHistory()
        spyD.resetHistory()
        spyE.resetHistory()

        let result = ''
        batch(() => {
            a.val = 'aa'
            result = c.val

            // Since "D" isn't accessed during batching, we should not
            // update it, only after batching has completed
            expect(spyD).not.to.be.called
        })

        expect(result).to.equal('aa')
        expect(d.val).to.equal('aa')
        expect(e.val).to.equal('aa')
        expect(spyC).to.be.calledOnce
        expect(spyD).to.be.calledOnce
        expect(spyE).to.be.calledOnce
    })

    it('should not block writes after batching completed', () => {
        // If no further writes after batch() are possible, than we
        // didn't restore state properly. Most likely "pending" still
        // holds elements that are already processed.
        const a = signal('a').as('A')
        const b = signal('b').as('B')
        const c = signal('c').as('C')
        const d = computed(() => a.val + ' ' + b.val + ' ' + c.val).as('D')

        let result
        effect(() => {
            result = d.val
        })

        batch(() => {
            a.val = 'aa'
            b.val = 'bb'
        })
        c.val = 'cc'
        expect(result).to.equal('aa bb cc')
    })

    it('should not lead to stale signals with .val in batch', () => {
        const invokes = []
        const counter = signal(0)
        const double = computed(() => counter.val * 2)
        const triple = computed(() => counter.val * 3)

        effect(() => {
            invokes.push([double.val, triple.val])
        })

        expect(invokes).to.deep.equal([[0, 0]])

        batch(() => {
            counter.val = 1
            expect(double.val).to.equal(2)
        })

        expect(invokes[1]).to.deep.equal([2, 3])
    })

    it('should not lead to stale signals with state in batch', () => {
        const invokes = []
        const counter = signal(0)
        const double = computed(() => counter.val * 2)
        const triple = computed(() => counter.val * 3)

        effect(() => {
            invokes.push([double.val, triple.val])
        })

        expect(invokes).to.deep.equal([[0, 0]])

        batch(() => {
            counter.val = 1
            expect(double.peek).to.equal(2)
        })

        expect(invokes[1]).to.deep.equal([2, 3])
    })

    it('should run pending effects even if the callback throws', () => {
        const a = signal(0)
        const b = signal(1)
        const spy1 = sinon.spy(() => {
            a.val
        })
        const spy2 = sinon.spy(() => {
            b.val
        })
        effect(spy1)
        effect(spy2)
        spy1.resetHistory()
        spy2.resetHistory()

        expect(() =>
            batch(() => {
                a.val++
                b.val++
                throw Error('hello')
            })
        ).to.throw('hello')

        expect(spy1).to.be.calledOnce
        expect(spy2).to.be.calledOnce
    })

    it('should run pending effects even if some effects throw', () => {
        const a = signal(0)
        const spy1 = sinon.spy(() => {
            a.val
        })
        const spy2 = sinon.spy(() => {
            a.val
        })
        effect(() => {
            if (a.val === 1) {
                throw new Error('hello')
            }
        })
        effect(spy1)
        effect(() => {
            if (a.val === 1) {
                throw new Error('hello')
            }
        })
        effect(spy2)
        effect(() => {
            if (a.val === 1) {
                throw new Error('hello')
            }
        })
        spy1.resetHistory()
        spy2.resetHistory()

        expect(() =>
            batch(() => {
                a.val++
            })
        ).to.throw('hello')

        expect(spy1).to.be.calledOnce
        expect(spy2).to.be.calledOnce
    })

    it('should run effect\'s first run immediately even inside a batch', () => {
        let callCount = 0
        const spy = sinon.spy()
        batch(() => {
            effect(spy)
            callCount = spy.callCount
        })
        expect(callCount).to.equal(1)
    })
})

describe('untracked', () => {
    it('should block tracking inside effects', () => {
        const a = signal(1)
        const b = signal(2)
        const spy = sinon.spy(() => {
            a.val + b.val
        })
        effect(() => untracked(spy))
        expect(spy).to.be.calledOnce

        a.val = 10
        b.val = 20
        expect(spy).to.be.calledOnce
    })

    it('should block tracking even when run inside effect run inside untracked', () => {
        const s = signal(1)
        const spy = sinon.spy(() => s.val)

        untracked(() =>
            effect(() => {
                untracked(spy)
            })
        )
        expect(spy).to.be.calledOnce

        s.val = 2
        expect(spy).to.be.calledOnce
    })

    it('should not cause signal assignments throw', () => {
        const a = signal(1)
        const aChangedTime = signal(0)

        const dispose = effect(() => {
            a.val
            untracked(() => {
                aChangedTime.val = aChangedTime.val + 1
            })
        })

        expect(() => (a.val = 2)).not.to.throw()
        expect(aChangedTime.val).to.equal(2)
        a.val = 3
        expect(aChangedTime.val).to.equal(3)

        dispose()
    })

    it('should block tracking inside computed signals', () => {
        const a = signal(1)
        const b = signal(2)
        const spy = sinon.spy(() => a.val + b.val)
        const c = computed(() => untracked(spy))

        expect(spy).to.not.be.called
        expect(c.val).to.equal(3)
        a.val = 10
        c.val
        b.val = 20
        c.val
        expect(spy).to.be.calledOnce
        expect(c.val).to.equal(3)
    })
})