import { suite, test, expectHTML } from '@nimble/testing'
import { atom, molecule } from "../atoms/atoms.mjs";
import { render } from "./render.mjs";

const specs = suite("JSX spec", (before, after) => {

    let scope, expect

    before.each(() => {
        scope = molecule()
        expect = component => expectHTML(render(scope, component(scope)))
    })

    test('simplest nodes', () => {
        expect(() => null).equals('')
        expect(() => 'Hello World').equals('Hello World')
        expect(() => BigInt(1234567890)).equals('1234567890')
        expect(() => 0).equals('0')
        expect(() => 1).equals('1')
        expect(() => 1_000_000_000.000_000_9).equals('1000000000.000001')
        expect(() => true).equals('')
        expect(() => false).equals('')
        expect(() => Symbol()).equals('')
    })

    test("fragments", () => {
        expect(() => <>Hello World</>).equals(`Hello World`)
        expect(() => <> before {1} {'after'} </>).equals(` before 1 after `)
        expect(() => <>{BigInt(2)}</>).equals(`2`)
        expect(() => <>{true}</>).equals(``)
        expect(() => <>{false}</>).equals(``)
        expect(() => <>{document.createTextNode('text')}</>).equals(`text`)
    })
    test('elements', () => {
        expect(() => <div>Hello World</div>).equals(`<div>Hello World</div>`)
        expect(() => <div class="message">Hello World</div>).equals(`<div class="message">Hello World</div>`)
        expect(() => <div class={{alpha: true, beta: false}}>Hello World</div>).equals(`<div class="alpha">Hello World</div>`)
        expect(() => <div class={['alpha','beta','gamma']}>Hello World</div>).equals(`<div class="alpha beta gamma">Hello World</div>`)
        expect(() => {
            const beta = atom('beta')
            return <div class={atom(get => `alpha ${get(beta)} gamma`)}>Hello World</div>
        }).equals(`<div class="alpha beta gamma">Hello World</div>`)
    })

    test('simple atoms', () => {
        expect(() => atom('Hello World')).equals('Hello World')
        expect(() => atom(BigInt(1234567890))).equals('1234567890')
        expect(() => atom(0)).equals('0')
        expect(() => atom(1)).equals('1')
        expect(() => atom(1_000_000_000.000_000_9)).equals('1000000000.000001')
        expect(() => atom(true)).equals('')
        expect(() => atom(false)).equals('')
        expect(() => atom(Symbol())).equals('')
    })

    const nextFrame = async () => await new Promise(resolve => requestAnimationFrame(resolve))

    test('text content (atoms changing)', async () => {
        const {get, set, sub} = scope
        let a = atom('Hello World')
        expect(() => <>{a}</>).equals('Hello World')
        set(a, BigInt(1234567890))
        await nextFrame()
        expect(() => <>{a}</>).equals('1234567890')
        set(a, 0)
        await nextFrame()
        expect(() => <>{a}</>).equals('0')
        set(a, 1)
        await nextFrame()
        expect(() => <>{a}</>).equals('1')
        set(a, 1_000_000_000.000_000_9)
        await nextFrame()
        expect(() => <>{a}</>).equals('1000000000.000001')
        set(a, true)
        await nextFrame()
        expect(() => <>{a}</>).equals('')
        set(a, false)
        await nextFrame()
        expect(() => <>{a}</>).equals('')
        set(a, Symbol())
        await nextFrame()
        expect(() => <>{a}</>).equals('')
        set(a, () => 'Hello World')
        await nextFrame()
        expect(() => <>{a}</>).equals('Hello World')
        set(a, () => 'Hello World')
        await nextFrame()
        expect(() => <>{a}</>).equals('Hello World')
    })

})

specs.run()
