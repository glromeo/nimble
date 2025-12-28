import {memoryUsage} from "node:process";
import {computed, effect, signal} from "./signals.mjs";

const signals = [];

function prepare(l) {
    if (l < 16) {
        const lh = prepare(l + 1);
        const rh = prepare(l + 1);
        return computed(() => lh.get() + rh.get());
    } else {
        const a = signal(0);
        signals.push(a);
        return a;
    }
}

(async () => {
    const timeStart = performance.now();

    const top = prepare(0);

    let total = top.get();
    await new Promise((resolve) => {

        let i = 0;
        let dispose = effect(() => {
            total = top.get();
            if (i >= 1_000_000) {
                resolve();
                dispose();
            }
        });
        while (i++ < 1_000_000) {
            const a = signals[(3 * i) % signals.length];
            a.set(a.get() + 1);
        }
    });

    console.log(total, performance.now() - timeStart);
    console.log(memoryUsage());
})();

// 1000000 ????????????????? (M1)
// 1000000 2152.522500000894 (I7)

/*
{
  rss: 71225344,
  heapTotal: 53735424,
  heapUsed: 30887776,
  external: 1688197,
  arrayBuffers: 10519
}
1000000 2169.4328000098467
*/
