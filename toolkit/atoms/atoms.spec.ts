import {Atom, atom, createStore, defaultStore} from './atoms'
import {expect} from 'mocha-toolkit'

suite("basics", ()=>{

    let $ = defaultStore

    setup(()=>{
        $ = createStore()
    })

    test("typeof", () => {
        expect(atom(0).atomId).to.eq('atom<0>')
        expect(typeof atom).to.eq('function')
        expect(typeof atom(0)).to.eq('object')
        expect(atom(0).constructor).to.eq(Atom)
    })

    test("primitive", () => {
        let digit = atom(0)
        expect($.get(digit)).to.eq(0)
        $.set(digit, 1)
        expect($.get(digit)).to.eq(1)
    });

    test("readable", () => {
        let digit = atom(1)
        let scaled = atom(get=> get(digit) * 2)
        expect($.get(scaled)).to.eq(2)
        $.set(digit, $.get(digit) + 1)
        expect($.get(scaled)).to.eq(4)
    })

    test("writeable", () => {
        let digit = atom(0)
        let scaled = atom(null, (get, set, value:number) => set(digit, value * 2))
        expect($.get(digit)).to.eq(0)
        $.set(scaled, 1)
        expect($.get(digit)).to.eq(2)
        $.set(scaled, 2)
        expect($.get(digit)).to.eq(4)
    })

    test("store read/write two atoms", () => {
        let l = atom(0)
        let r = atom(0)
        let s = atom(get => get(l) + get(r))
        expect($.get(s)).to.eq(0)
        $.set(l, 1)
        $.set(r, 2)
        expect($.get(l)).to.eq(1)
        expect($.get(r)).to.eq(2)
        expect($.get(s)).to.eq(3)
    })

    test("store sub/write", () => {
        let z = atom(0)
        let notified = 0
        let unsub = $.sub(z, () => {
            notified++
            expect($.get(z)).to.eq(1)
        })
        expect(notified).to.eq(0)
        expect($.get(z)).to.eq(0)
        $.set(z, 1)
        expect(notified).to.eq(1)
        expect($.get(z)).to.eq(1)
        unsub();
        $.set(z, 2)
        expect(notified).to.eq(1)
        expect($.get(z)).to.eq(2)
    })

    test("store sub/write multi (1)", () => {
        let c = atom('c', 0)
        let d = atom('d', 0)
        let b = atom('b', get => get(c) + get(d))
        let e = atom('e', 0)
        let a = atom('a', get => get(b) + get(e))
        let notifications:any = []
        let unsub = [c,d,b,e,a].map(k => $.sub(k, ()=>{
            notifications.push([k.atomId, $.get(k)])
        }))
        $.set(d, 1)
        expect(notifications.length).to.eq(3)
        expect(notifications[0].join()).to.eq('d,1')
        expect(notifications[1].join()).to.eq('b,1')
        expect(notifications[2].join()).to.eq('a,1')
        unsub.forEach(unsub => unsub())
    })

    test("store sub/write multi (2)", () => {
        let c = atom('c', 0)
        let d = atom('d', 0)
        let b = atom('b', get => get(c) + get(d))
        let e = atom('e', 0)
        let a = atom('a', get => get(b) + get(e))
        let notifications:any = []
        let unsub = [c,d,b,e,a].map(k => $.sub(k, ()=>{
            notifications.push([k.atomId, $.get(k)])
        }))
        $.set(c, 1)
        $.set(d, 1)
        expect(notifications.length).to.eq(6)
        expect(notifications[0].join()).to.eq('c,1')
        expect(notifications[1].join()).to.eq('b,1')
        expect(notifications[2].join()).to.eq('a,1')
        expect(notifications[3].join()).to.eq('d,1')
        expect(notifications[4].join()).to.eq('b,2')
        expect(notifications[5].join()).to.eq('a,2')
        unsub.forEach(unsub => unsub())
    })

    test("store sub/write multi (2) no sub", () => {
        let trace:any = []
        let c = atom('c', 0)
        let d = atom('d', 0)
        let b = atom('b', get => {
            let l = get(c)
            let r = get(d)
            trace.push(`b: ${l} + ${r}`)
            return l + r
        })
        let e = atom('e', 0)
        let a = atom('a', get => {
            let l = get(b)
            let r = get(e)
            trace.push(`a: ${l} + ${r}`)
            return l + r
        })
        let notifications:any = []
        const unsub = $.sub(a, ()=>{
            notifications.push([a.atomId, $.get(a)])
        })

        expect(trace.length).to.eq(2)
        expect(trace[0]).to.eq('b: 0 + 0')
        expect(trace[1]).to.eq('a: 0 + 0')

        $.set(c, 1)

        expect(trace.length).to.eq(4)
        expect(trace[2]).to.eq('b: 1 + 0')
        expect(trace[3]).to.eq('a: 1 + 0')

        expect(notifications.length).to.eq(1)
        expect(notifications[0].join()).to.eq('a,1')

        $.set(d, 1)

        expect(trace.length).to.eq(6)
        expect(trace[4]).to.eq('b: 1 + 1')
        expect(trace[5]).to.eq('a: 2 + 0')

        expect(notifications.length).to.eq(2)
        expect(notifications[1].join()).to.eq('a,2')

        unsub();
    })

    test("derived are cleared at each update", () => {
        let l = atom(false)
        let r = atom(false)
        let s = atom(get => get(l) || get(r))
        expect($.get(s)).to.eq(false)
        expect($.debug(r)!.listeners!.size).to.eq(1)
        expect($.debug(l)!.listeners!.size).to.eq(1)
        $.set(r, true)
        expect($.get(s)).to.eq(true)
        expect($.debug(r)!.listeners!.size).to.eq(1)
        expect($.debug(l)!.listeners!.size).to.eq(1)
        $.set(l, true)
        expect($.get(s)).to.eq(true)
        expect($.debug(r)!.listeners!.size).to.eq(0)
        expect($.debug(l)!.listeners!.size).to.eq(1)
        expect($.get(s)).to.eq(true)
    })

})