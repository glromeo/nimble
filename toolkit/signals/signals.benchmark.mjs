import {memoryUsage} from 'node:process'
import {computed, effect, signal} from './signals.mjs'

const signals = []

function prepare(l) {
    if (l < 16) {
        const lh = prepare(l + 1)
        const rh = prepare(l + 1)
        return computed(() => lh.get() + rh.get())
    } else {
        const a = signal(0)
        signals.push(a)
        return a
    }
}

(async () => {
    const timeStart = performance.now()

    const top = prepare(0)

    let total = top.get()
    await new Promise((resolve) => {

        let i = 0
        let dispose = effect(() => {
            total = top.get()
            if (i >= 1_000_000) {
                resolve()
                dispose()
            }
        })
        while (i++ < 1_000_000) {
            const a = signals[(3 * i) % signals.length]
            a.set(a.get() + 1)
        }
    })

    console.log(memoryUsage())
    console.log(total, performance.now() - timeStart)
})()

// 1000000 ????????????????? (M1)
// 1000000 3164.793099999428 (I7)