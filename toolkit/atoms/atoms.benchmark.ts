import {Atom, atom, createStore} from './atoms'

const store = createStore()
const atoms = [] as Atom<number>[]

function prepare(l):Atom<number> {
    if (l < 16) {
        const lh = prepare(l + 1)
        const rh = prepare(l + 1)
        return atom(get => get(lh) + get(rh))
    } else {
        const a = atom(0)
        atoms.push(a)
        return a
    }
}

(async () => {
    const timeStart = performance.now()

    const top = prepare(0)

    let total = store.get(top)

    await new Promise<void>((resolve) => {

        let i = 0
        store.sub(top, () => {
            total = store.get(top)
            if (i >= 1_000_000) {
                resolve()
            }
        })
        while (i++ < 1_000_000) {
            const a = atoms[(3 * i ) % atoms.length]
            store.set(a, store.get(a) + 1)
        }

    })

    console.log(total, performance.now() - timeStart)
})()

// 1000000 3176.077374994755 (M1)
// 1000000 5465.098600000143 (I7)