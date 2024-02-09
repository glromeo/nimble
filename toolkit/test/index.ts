import {css, html, defaultStore, molecule, atom, Store} from '@nimble/toolkit'

const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_TEST_BEGIN,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_TEST_END,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END
} = Mocha.Runner.constants

const style = css`
    #test-results {
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }
    .suite {
        padding: .25rem;
        border: 1px solid lightskyblue;
        background-color: cornflowerblue;
        color: white;
        font-family: sans-serif;
    }
    .test {
        padding: 1rem;
        border: 1px solid gray;
        background-color: lightgray;
    }
`
mocha.setup('tdd')
mocha.checkLeaks()

mocha.reporter(class Index extends Mocha.reporters.Base {

    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        super(runner, options)

        const unmount: Function[] = []

        let store = createStore();

        const running = atom(false)

        runner.once(EVENT_RUN_BEGIN, () => {
            style(store, document.head, unmount)
            html`
                <div id="test-results">
                    Running...
                </div>
            `(store, document.getElementById('root')!)
        })

        runner.on(EVENT_SUITE_BEGIN, suite => {
            const testResults = document.getElementById('test-results')!
            const title = suite.title
            html`
                <div class="suite" title=${title}>
                    ${title && html`<div class="heading">${title}</div>`}
                </div>
            `(store, testResults)
            Object.assign(suite.ctx, {
                store: createStore(),
                fixture: 0,
                root: testResults.lastElementChild as HTMLElement,
                unmount: [] as Function[],
                render(template: ReturnType<typeof html>) {
                    html`
                        <div class="fixture" data-suite=${title} data-fixture=${this.fixture++}/>
                            ${template}
                        </div>
                    `(this.store, this.root)
                    return this.root.lastElementChild as HTMLElement
                }
            })
        })

        runner.on(EVENT_SUITE_END, suite => {
            suite.ctx.unmount.forEach((u:Function) => u())
        })

        runner.on(EVENT_TEST_BEGIN, (test) => {
            const {store, root} = test.parent!.ctx
            html`
                <div class="test" title=${test.title}>
                    <div class="heading">${test.title}</div>
                </div>
            `(store, root)
            Object.assign(test.ctx!, {
                store: createStore(),
                fixture: 0,
                root: root.lastElementChild as HTMLElement,
                unmount: [] as Function[],
                render(template: ReturnType<typeof html>) {
                    html`
                        <div class="fixture" data-test=${test.title} data-fixture=${this.fixture++}/>
                            ${template}
                        </div>
                    `(this.store, this.root)
                    return this.root.lastElementChild as HTMLElement
                }
            })
        })

        runner.on(EVENT_TEST_PASS, test => {

        })

        runner.on(EVENT_TEST_FAIL, (test, err) => {

        })

        runner.on(EVENT_TEST_END, test => {
            test.ctx!.unmount.forEach((u:Function) => u())
        })

        runner.once(EVENT_RUN_END, () => {
            const stats = runner.stats!
            console.log(`end: ${stats.passes}/${stats.passes + stats.failures} ok`)
            unmount.forEach(unsub => unsub())
        })
    }
})

export const suite = (title:string, cb:(
    ctx: {render: (template: ReturnType<typeof html>) => HTMLDivElement}
) => Promise<void>|void) => {
    return window.suite(title, async function (this:any) {
        await cb(this.ctx)
    })
}

export const test = (title:string, cb:(
    ctx: {render: (template: ReturnType<typeof html>) => HTMLDivElement}
) => Promise<void>|void) => {
    return window.test(title, async function (this) {
        await cb(this.ctx)
    })
}