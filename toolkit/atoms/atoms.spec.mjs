import {atom, atomTag, globals, molecule} from './atoms.mjs'
import {expect} from 'mocha-toolkit'

suite('basics', () => {

    let scope = globals

    setup(() => {
        scope = molecule()
    })

    teardown(() => {
        expect(scope.dismiss(), "should not have active bindings").to.not.exist
    })

    test('typeof', () => {
        expect(atom(0)[atomTag]).to.eq('atom<0>')
        expect(atom.call('custom tag')[atomTag]).to.eq('custom tag')
        expect(typeof atom).to.eq('function')
        expect(typeof atom(0)).to.eq('object')
    })

    test('primitive', () => {
        let digit = atom(0)
        expect(scope.get(digit)).to.eq(0)
        scope.set(digit, 1)
        expect(scope.get(digit)).to.eq(1)
    })

    test('readable', () => {
        let digit = atom(1)
        let scaled = atom(get => get(digit) * 2)
        expect(scope.get(scaled)).to.eq(2)
        scope.set(digit, scope.get(digit) + 1)
        expect(scope.get(scaled)).to.eq(4)
    })

    test('writeable', () => {
        let digit = atom(0)
        let scaled = atom(null, (get, set, value) => set(digit, value * 2))
        expect(scope.get(digit)).to.eq(0)
        scope.set(scaled, 1)
        expect(scope.get(digit)).to.eq(2)
        scope.set(scaled, 2)
        expect(scope.get(digit)).to.eq(4)
    })

    test('store read/write two atoms', () => {
        let l = atom(0)
        let r = atom(0)
        let s = atom(get => get(l) + get(r))
        expect(scope.get(s)).to.eq(0)
        scope.set(l, 1)
        scope.set(r, 2)
        expect(scope.get(l)).to.eq(1)
        expect(scope.get(r)).to.eq(2)
        expect(scope.get(s)).to.eq(3)
    })

    test('store bind/write', () => {
        let z = atom(0)
        let notified = 0
        let unbind = scope.bind(z, () => {
            notified++
            expect(scope.get(z)).to.eq(1)
        })
        expect(notified).to.eq(0)
        expect(scope.get(z)).to.eq(0)
        scope.set(z, 1)
        expect(notified).to.eq(1)
        expect(scope.get(z)).to.eq(1)
        unbind()
        scope.set(z, 2)
        expect(notified).to.eq(1)
        expect(scope.get(z)).to.eq(2)
    })

    test('store bind/write multi (1)', () => {
        let c = atom.call('c', 0)
        let d = atom.call('d', 0)
        let b = atom.call('b', get => get(c) + get(d))
        let e = atom.call('e', 0)
        let a = atom.call('a', get => get(b) + get(e))
        let notifications = []
        let bindings = [c, d, b, e, a].map(k => scope.bind(k, () => {
            notifications.push([k[atomTag], scope.get(k)])
        }))
        scope.set(d, 1)
        expect(notifications.length).to.eq(3)
        expect(notifications[0].join()).to.eq('d,1')
        expect(notifications[1].join()).to.eq('b,1')
        expect(notifications[2].join()).to.eq('a,1')
        bindings.forEach(u => u())
    })

    test('store bind/write multi (2)', () => {
        let c = atom.call('c', 0)
        let d = atom.call('d', 0)
        let b = atom.call('b', get => get(c) + get(d))
        let e = atom.call('e', 0)
        let a = atom.call('a', get => get(b) + get(e))
        let notifications = [];
        [c, d, b, e, a].map(k => scope.bind(k, () => {
            notifications.push([k[atomTag], scope.get(k)])
        }))
        scope.set(c, 1)
        scope.set(d, 1)
        expect(notifications.length).to.eq(6)
        expect(notifications[0].join()).to.eq('c,1')
        expect(notifications[1].join()).to.eq('b,1')
        expect(notifications[2].join()).to.eq('a,1')
        expect(notifications[3].join()).to.eq('d,1')
        expect(notifications[4].join()).to.eq('b,2')
        expect(notifications[5].join()).to.eq('a,2')
        scope.dismiss()
    })

    test('store bind/write multi (2) no sub', () => {
        let trace = []
        let c = atom.call('c', 0)
        let d = atom.call('d', 0)
        let b = atom.call('b', get => {
            let l = get(c)
            let r = get(d)
            trace.push(`b: ${l} + ${r}`)
            return l + r
        })
        let e = atom.call('e', 0)
        let a = atom.call('a', get => {
            let l = get(b)
            let r = get(e)
            trace.push(`a: ${l} + ${r}`)
            return l + r
        })
        let notifications = []
        let effect
        scope.bind(a, effect = () => {
            notifications.push([a[atomTag], scope.get(a)])
        })

        expect(trace.length).to.eq(2)
        expect(trace[0]).to.eq('b: 0 + 0')
        expect(trace[1]).to.eq('a: 0 + 0')

        scope.set(c, 1)

        expect(trace.length).to.eq(4)
        expect(trace[2]).to.eq('b: 1 + 0')
        expect(trace[3]).to.eq('a: 1 + 0')

        expect(notifications.length).to.eq(1)
        expect(notifications[0].join()).to.eq('a,1')

        scope.set(d, 1)

        expect(trace.length).to.eq(6)
        expect(trace[4]).to.eq('b: 1 + 1')
        expect(trace[5]).to.eq('a: 2 + 0')

        expect(notifications.length).to.eq(2)
        expect(notifications[1].join()).to.eq('a,2')

        scope.unbind(a, effect)
    })

    test('derived are cleared at each update', () => {
        let l = atom.call('l', false)
        let r = atom.call('r', false)
        let s = atom.call('s', get => get(l) || get(r))
        expect(scope.get(s)).to.eq(false)
        expect(scope.peek(r).observers.size).to.eq(1)
        expect(scope.peek(l).observers.size).to.eq(1)
        scope.set(r, true)
        expect(scope.get(s)).to.eq(true)
        expect(scope.peek(r).observers.size).to.eq(1)
        expect(scope.peek(l).observers.size).to.eq(1)
        scope.set(l, true)
        expect(scope.get(s)).to.eq(true)
        expect(scope.peek(r).observers).to.be.null
        expect(scope.peek(l).observers.size).to.eq(1)
        expect(scope.get(s)).to.eq(true)
    })

    test('tree shaking', () => {
        let a0 = atom.call('a0', false)
        let c1 = 0
        let a1 = atom.call('a1', get => {
            ++c1
            return get(a0)
        })
        let c2 = 0
        let a2 = atom.call('a2', get => {
            ++c2
            return get(a1)
        })
        let c3 = 0
        const unbind = scope.bind(a2, () => {
            ++c3
        })
        expect(c3).to.eq(0) // the effect won't trigger until a2 changes
        expect(c2).to.eq(1) // b -> a2 ...had to be read to discover its dependencies
        expect(c1).to.eq(1) // a2 -> a1
        scope.set(a0, true)
        expect(c1).to.eq(2)
        expect(c2).to.eq(2)
        expect(c3).to.eq(1) // now the effect triggered!
        unbind()
        scope.set(a0, false) // since a2 is no longer bound there won't be any effects
        expect(c1).to.eq(2)
        expect(c2).to.eq(2)
        expect(c3).to.eq(1)
    })

    test('onbind/onunbind', () => {
        let m = 0, u = 0
        let a = atom(false)
        a.onbind = () => {
            m++ // this is invoked when the atom is bound
            return () => {
                u++ // this is invoked when the atom is unbound
            }
        }
        expect(m).to.eq(0)
        expect(u).to.eq(0)
        const unbind1 = scope.bind(a, () => {
        })
        const unbind2 = scope.bind(a, () => {
        })
        expect(m).to.eq(1)  // bind callback is invoked only the 1st time an atom is mounted
        expect(u).to.eq(0)
        unbind1()
        expect(u).to.eq(0)  // since there are 2 effects the atom is not unbound yet
        unbind2()
        expect(u).to.eq(1)  // now it is and the callback is invoked
    })

    test('dismiss', () => {
        let a1 = atom(false)
        let a2 = atom(false)
        const unbind1 = scope.bind(a1, () => {
        })
        const unbind2 = scope.bind(a1, () => {
        })
        scope.bind(a2, () => {
        })
        expect(unbind1()).to.be.undefined       // there are still effects bound to a1
        expect(unbind2()).to.eq(true)           // there are no more effects bound to a1
        expect(scope.dismiss()).to.eq(true)     // there were bound atoms, but they have been unbound
        expect(scope.dismiss()).to.be.undefined // there are no bound atoms
    })

    test('promises', async () => {
        let p = atom(0)
        let d = atom(get => get(p)+100)
        let e = atom(get => get(d)+100)
        let f = atom(async get => get(d)+100)
        expect(await scope.set(p, Promise.resolve(1))).to.eq(1)
        expect(scope.get(p)).to.eq(1)
        expect(scope.get(d)).to.eq(101)
        expect(scope.get(e)).to.eq(201)
        let q = atom(null, (get, set, value) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    set(p, value);
                    resolve('OK')
                },50)
            })
        })
        expect(await scope.set(q, 2)).to.eq('OK')
        expect(scope.get(p)).to.eq(2)
        expect(scope.get(d)).to.eq(102)
        expect(scope.get(e)).to.eq(202)

        expect(await new Promise(resolve => {
            scope.bind(e, resolve)
            scope.set(p, Promise.resolve(3))
        })).to.eq(203)
        scope.dismiss()

        expect(await new Promise(async resolve => {
            await scope.bind(f, resolve)
            scope.set(p, Promise.resolve(4))
        })).to.eq(204)
        scope.dismiss()
    })

    test('bound further away', () => {
        let p = atom(0)
        let q = atom(get => get(p) + 10)
        let r = atom(get => get(q) + 100)
        expect(scope.get(p)).to.eq(0)
        expect(scope.get(q)).to.eq(10)
        expect(scope.get(r)).to.eq(110)
        scope.bind(r, v => expect(v).to.eq(111))
        scope.set(p,1)
        scope.dismiss()
    })
})