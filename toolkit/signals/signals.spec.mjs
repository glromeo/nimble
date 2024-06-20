import {signal, computed, effect} from './signals.mjs'
import {expect} from 'mocha-toolkit'

suite('signals', () => {

    test('read/write', () => {
        let $a = signal(0)
        expect($a.val).eq(0)
        $a.val = 1
        expect($a.val).eq(1)
    })

    test('computed (1L)', () => {
        let $a = signal(0)
        expect($a.obs).is.null

        let $b = computed(() => $a.val + 1)
        expect($a.obs).is.null // not until $b is actually evaluated

        expect($b.val).eq(1)

        expect($a.obs.length).eq(1)
        expect($a.obs[0]).eq($b)

        expect($b.deps.length).eq(1)
        expect($b.deps[0]).eq($a)

        $a.val = 1
        expect($b.val).eq(2)

        expect($b.obs).is.null
    })

    test('computed (2L)', () => {
        let $a = signal(0)
        let $b = computed(() => $a.val + 1)
        let $c = computed(() => $b.val + 1)
        expect($c.val).eq(2)
        $a.val = 1
        expect($c.val).eq(3)
    })

    test('computed (X2)', () => {
        let $a = signal(0)
        let $b = signal(0)
        let $c = computed(() => $a.val + $b.val)

        expect($c.val).eq(0)

        expect($a.obs.length).eq(1)
        expect($a.obs[0]).eq($c)
        expect($b.obs.length).eq(1)
        expect($b.obs[0]).eq($c)

        expect($c.deps.length).eq(2)
        expect($c.deps[0]).eq($a)
        expect($c.deps[1]).eq($b)

        $a.val = 1
        expect($c.val).eq(1)
        $b.val = 1
        expect($c.val).eq(2)
    })

    test('computed (cyclic read)', () => {
        let $a = signal(0)
        let $b = computed(() => $a.val + $c.val)
        let $c = computed(() => $a.val + $b.val)

        $a.val = 1
        expect($a.val).eq(1)
        expect($b.val).to.be.NaN
        expect($c.val).to.be.NaN
    });

    test('computed (cyclic notify)', () => {
        let $a = signal(0)
        let $b = computed(() => $a.val + $c.val)
        let $c = computed(() => $b.val)

        $a.val = 1
        expect($a.val).eq(1)
        expect($b.val).to.be.NaN
        expect($c.val).to.be.NaN
    });

    test('computed with update', () => {
        let $a = signal(0)
        let was
        let $b = computed(() => {
            was = $a.val
            $a.val = 1
            return $a.val
        })
        expect($b.val).eq(1)
        expect(was).eq(0)

        expect($a.obs.length).eq(1)
        expect($a.obs[0]).eq($b)
        expect($b.deps.length).eq(1)
        expect($b.deps[0]).eq($a)

        $a.val = 2
        expect($b.val).eq(1)
        expect(was).eq(2)
    })
})