import {atom, molecule} from './atoms.mjs'
import { memoryUsage } from 'node:process';

const scope = molecule()
const atoms = []

function prepare(l) {
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

    let total = scope.get(top)

    await new Promise((resolve) => {

        let i = 0
        scope.bind(top, () => {
            total = scope.get(top)
            if (i >= 100_000) {
                resolve()
            }
        })
        while (i++ < 100_000) {
            const a = atoms[(3 * i ) % atoms.length]
            scope.set(a, scope.get(a) + 1)
        }

    })

    console.log(memoryUsage());
    console.log(total, performance.now() - timeStart)
})()

// 1000000 3176.077374994755 (M1) ?
// 1000000 6230.769300013781 (I7)