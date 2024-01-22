export function WebConsole(runner) {
    const stats = {suites: 0, tests: 0, passes: 0, pending: 0, failures: 0}
    const failures = (this.failures = [])
    const total = runner.total
    const title = document.title
    const calls = []
    runner.stats = stats

    runner.on('pass', function (test) {
        stats.passes = stats.passes || 0
        const medium = test.slow() / 2
        test.speed =
            test.duration > test.slow()
                ? 'slow'
                : test.duration > medium ? 'medium' : 'fast'
        stats.passes++
    })

    runner.on('pending', function () {
        stats.pending++
    })

    runner.on('start', function () {
        stats.start = new Date()
    })

    runner.on('test', function (test) {
        console.log('Running test:', test.title)
    })

    runner.on('fail', function (test, err) {
        stats.failures = stats.failures || 0
        stats.failures++
        test.err = err
        failures.push(test)
        calls.push(['info', null, test.title])
        calls.push(['error', null, test.err.stack])
        calls.push(['log', null, {Expected: err.expected, Actual: err.actual}])
        flagFailures(test.parent)
    })

    function flagFailures(node) {
        node.hasFailures = true
        if (node.parent) flagFailures(node.parent)
    }

    runner.on('suite', function (suite) {
        if (!suite.root) {
            ++stats.suites
            const location = document.location
            const url = `${location.origin + location.pathname}?grep=${encodeURIComponent(suite.fullTitle())}`
            calls.push(['group', suite, suite.title])
            calls.push(['groupCollapsed', suite, 'url'])
            calls.push(['log', suite, url])
            calls.push(['groupEnd', suite])
        } else {
            stats.suites = 0
        }
    })

    runner.on('suite end', function (suite) {
        if (!suite.root) {
            calls.push(['groupEnd', suite])
            logCalls()
        }
    })

    runner.on('test end', function (test) {
        stats.tests = (stats.tests || 0) + 1
        const percent = (stats.tests / total * 100) | 0
        document.title =
            percent +
            '% ' +
            (stats.failures ? stats.failures + ' failures ' : '') +
            title
    })

    runner.on('end', function () {
        stats.end = new Date()
        stats.duration = new Date() - stats.start
        logCalls()
        if (stats.errors) {
            console.warn(`${stats.errors} %cerrors`, 'color:red;font-weight:bold;')
        }
        if (stats.failures) {
            console.warn(`${stats.failures} %cfailures`, 'color:yellow;font-weight:bold;')
        }
        const skipped = stats.tests - stats.failures - stats.passes
        if (skipped) console.warn(skipped, ' skipped')
        console.log(`${stats.passes} tests %cpassed`, 'color:green;font-weight:bold;')
        console.log(`${(stats.duration / 1000).toFixed(3)} seconds`)
    })

    function logCalls() {
        for (let i = 0; i < calls.length; i++) {
            const [command, suite, message] = calls[i]
            const failures = !suite || suite.hasFailures
            if (failures || command === 'info' || command === 'error') {
                console[command](message)
            }
        }
        calls.length = 0
    }

}