const testContext = {}

const testId = () => {
    const prepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace = (error, stack) => {
        for (let i = 2; i < stack.length; i++) {
            const entry = stack[i]
            let name = entry.getFunctionName()
            if (name?.startsWith('::')) {
                return name
            }
        }
        return null
    }
    const testId = new Error().stack
    Error.prepareStackTrace = prepareStackTrace
    return testId
}

function simpleHash(text) {
    let hash = 0
    if (text.length === 0) return hash
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i)
        hash &= hash
    }
    return hash.toString(16)
}

function appendFixture(title, index, component) {
    const fixture = document.getElementById('fixtures').appendChild(document.createElement('div'))
    fixture.setAttribute('class', 'fixture')
    fixture.setAttribute('data-test', String(title))
    fixture.setAttribute('data-fixture', String(index))
    fixture.appendChild(component())
    return fixture
}

export function renderFixture(component) {
    const ctx = testContext[testId()]
    const fixtures = ctx.fixtures ?? (ctx.fixtures = [])
    const fixture = appendFixture(ctx.title, fixtures.length, component)
    fixtures.push(fixture)
    return fixture
}

export function renderHTML(component) {
    return renderFixture(component).innerHTML
}

export function renderText(component) {
    return renderFixture(component).innerText
}

export function debugHTML(node) {
    switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
            let text = `<${node.tagName}`
            if (node.attributes) for (const {name, value} of node.attributes) {
                text += ` [${name}]=[${value}]`
            }
            if (node.childNodes.length) {
                text += '>'
                text += debugHTML(node)
                text += `</${node.tagName}>`
            } else {
                text += '/>'
            }
            return text
        }
        case Node.COMMENT_NODE:
            return `<!${node.data}>`
        case Node.TEXT_NODE:
            return `[#${node.data}]`
        default:
            return String(node)
    }
}

export function suite(title, spec) {
    const test = {
        suite: suite.current,
        title,
        tests: [],
        passed: 0,
        failed: 0
    }
    suite.current.tests.push(test)
    suite.current = test
    spec({
        each: fn => {
            test.beforeEach = test.beforeEach?.concat(fn) ?? [fn]
        },
        all: fn => {
            test.beforeAll = test.beforeAll?.concat(fn) ?? [fn]
        }
    }, {
        each: fn => {
            test.afterEach = test.afterEach?.concat(fn) ?? [fn]
        },
        all: fn => {
            test.afterAll = test.afterAll?.concat(fn) ?? [fn]
        }
    })
    return suite.current = suite.current.suite
}

async function* testWalker(suite) {
    for (const test of suite.tests) {
        if (test.spec) {
            yield test
        } else {
            if (test.beforeAll) {
                for (const fn of test.beforeAll) await fn(test)
            }
            yield* testWalker(test)
            if (test.afterAll) {
                for (const fn of test.afterAll) await fn(test)
            }
        }
    }
}

suite.current = suite.root = {
    tests: [],
    async run() {
        console.time('specs')
        let passed = 0, failed = 0
        for await (const test of testWalker(this)) {
            Object.defineProperty(test.spec, 'name', {value: test.id})
            try {
                testContext[test.id] = test
                if (test.suite.beforeEach) {
                    for (const fn of test.suite.beforeEach) await fn(test)
                }
                await test.spec.call(test)
                passed++
                test.suite.passed++
                test.ok = true
            } catch (error) {
                console.error(`"${test.title}"`, 'failed', error.message, error.stack)
                console.log(`%cexpected: %c${error.expected}\n%cactual:   %c${error.actual}`, 'font-weight:bold;color:green;', 'color:darkgreen;', 'font-weight:bold;color:red;', 'color:darkred;')
                failed++
                test.suite.failed++
                test.error = error
            } finally {
                if (test.suite.afterEach) {
                    for (const fn of test.suite.afterEach) await fn(test)
                }
                testContext[test.id] = undefined
            }
        }
        console.timeEnd('specs')
        if (failed) {
            console.log('Failed:', passed, 'tests passed', failed, 'tests failed')
        } else {
            console.log('OK!', passed, 'tests passed')
        }
    }
}

export function test(title, spec) {
    const ctx = {
        id: '::' + simpleHash(title) + '-' + Date.now().toString(16),
        suite: suite.current,
        title,
        spec
    }
    suite.current.tests.push(ctx)
}