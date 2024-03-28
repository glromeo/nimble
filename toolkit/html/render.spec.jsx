import {suite, test, expectHTML} from '@nimble/testing'
import { atom, molecule } from "../atoms/atoms.mjs";
import { render } from "./render.mjs";

const specs = suite("JSX spec", (before, after) => {

    let scope, expect

    before.each(() => {
        scope = molecule()
        expect = component => expectHTML(render(scope, component(scope)))
    })

    test("fragments", () => {
        expect(() => <>Hello World</>).equals(`Hello World`)
        expect(() => <>{1}</>).equals(`1`)
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
})

specs.run()
