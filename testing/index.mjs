const testContext = {}

const testId = () => {
    const prepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace = (error, stack) => {
        for (let i = 2; i < stack.length; i++) {
            const entry = stack[i]
            let name = entry.getFunctionName()
            if (name.startsWith('::')) {
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
    spec()
    return suite.current = suite.current.suite
}

function* testWalker(suite) {
    for (const test of suite.tests) {
        if (test.spec) {
            yield test
        } else {
            yield* testWalker(test)
        }
    }
}

suite.current = suite.root = {
    tests: [],
    async run() {
        console.time('specs')
        let passed = 0, failed = 0
        for (const test of testWalker(this)) {
            Object.defineProperty(test.spec, 'name', {
                writable: true,
                enumerable: true,
                configurable: true,
                value: test.id
            })
            try {
                await test.spec.call(testContext[test.id] = test)
                passed++
                test.suite.passed++
                test.ok = true
            } catch (error) {
                console.error(test.title, 'failed', error)
                failed++
                test.suite.failed++
                test.error = error
            } finally {
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