import {assert, Assertion, expect, use} from "chai";
import sinonChai from "sinon-chai";
import sourcemapped from "sourcemapped-stacktrace";
import "./chai-dom.mjs";

export {expect, assert} from "chai";

use(sinonChai);

export const vsync = () => new Promise(requestAnimationFrame);

export function outerHTML(node) {
    switch (node.nodeType) {
        case Node.TEXT_NODE:
            return node.data;
        case Node.COMMENT_NODE:
            return `<!--${node.data}-->`;
        case Node.ELEMENT_NODE:
            const tag = node.tagName.toLowerCase();
            let attrs = "";
            for (const {name, value} of node.attributes) {
                attrs += ` ${name}="${value}"`;
            }
            return `<${tag}${attrs}>${node.innerHTML}</${tag}>`;
        case Node.DOCUMENT_FRAGMENT_NODE:
            const {groupStart, groupEnd} = node;
            if (groupStart) {
                let html = `<!--${groupStart.data}-->`;
                let node = groupStart.nextSibling;
                while (node !== groupEnd) {
                    html += outerHTML(node);
                    node = node.nextSibling;
                }
                html += `<!--${node.data}-->`;
                return html;
            } else {
                return [...node.childNodes].map(outerHTML).join("");
            }
        default:
            return String(node);
    }
}

export function trimLines(text) {
    return text.split("\n").map(line => line.trim()).filter(Boolean).join("\n");
}

for (const method of ["eq", "equal", "equals", "eql"]) {
    Assertion.overwriteMethod(method, fn => function () {
        if (typeof arguments[0] === "string" && this._obj instanceof Node) {
            this._obj = outerHTML(this._obj);
            arguments[0] = trimLines(arguments[0]);
        }
        if (typeof this._obj === "string" && arguments[0] instanceof Node) {
            arguments[0] = outerHTML(arguments[0]);
            this._obj = trimLines(this._obj);
        }
        fn.apply(this, arguments);
    });
}

const testContext = {};

const testId = () => {
    const prepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stack) => {
        for (let i = 2; i < stack.length; i++) {
            const entry = stack[i];
            let name = entry.getFunctionName();
            if (name?.startsWith("::")) {
                return name;
            }
        }
        return null;
    };
    const testId = new Error().stack;
    Error.prepareStackTrace = prepareStackTrace;
    return testId;
};

function simpleHash(text) {
    let hash = 0;
    if (text.length === 0) return hash;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash &= hash;
    }
    return hash.toString(16);
}

function createFixtures() {
    const root = document.createElement("div");
    root.id = "fixtures";
    return document.body.appendChild(root);
}

function appendFixture(title, index, node) {
    const root = document.getElementById("fixtures") ?? createFixtures();
    const fixture = root.appendChild(document.createElement("div"));
    fixture.setAttribute("class", "fixture");
    fixture.setAttribute("data-test", String(title));
    fixture.setAttribute("data-fixture", String(index));
    fixture.appendChild(node);
    return fixture;
}

export function renderFixture(node) {
    const id = testId();
    if (id !== null) try {
        const ctx = testContext[id];
        const fixtures = ctx.fixtures ?? (ctx.fixtures = []);
        const fixture = appendFixture(ctx.title, fixtures.length, node);
        fixtures.push(fixture);
        return fixture;
    } catch (e) {
        console.error(e);
        assert.fail("failed to render fixture");
    }
}

export function suite(title, spec) {
    const test = {
        suite: suite.current,
        title,
        tests: [],
        passed: 0,
        failed: 0
    };
    suite.current.tests.push(test);
    suite.current = test;
    spec();
    return suite.current = suite.current.suite;
}

async function* testWalker(suite) {
    const skip = suite.skip && new Set(suite.skip);
    const only = suite.only && new Set(suite.only);
    if (suite.title) {
        console.group(`suite: ${suite.title} %c...`, "color: gray");
    }
    for (const test of suite.tests) {
        if (skip && skip.has(test) || only && !only.has(test)) {
            console.log(`skipped ${test.spec ? "test" : "suite"}:`, test.title);
            continue;
        }
        if (test.spec) {
            console.group(`test: ${test.title} %c...`, "color: gray");
            yield test;
            console.groupEnd();
            if (typeof document !== "undefined") {
                for (const fixture of document.querySelectorAll(`[data-fixture][data-test="${test.title}"]`)) {
                    fixture.setAttribute("hidden", "");
                }
            }
        } else {
            if (test.beforeAll) {
                for (const fn of test.beforeAll) await fn(test);
            }
            yield* testWalker(test);
            if (test.afterAll) {
                for (const fn of test.afterAll) await fn(test);
            }
        }
    }
    if (suite.title && suite.tests.length) {
        console.groupEnd();
    }
}

const DEAULT_TIMEOUT = 3000;

function runWithTimeout(title, fn, ctx, ms = DEAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`test timeout: ${title} ${fn.toString()}`));
        }, ms);
        fn.call(ctx).then(result => {
            clearTimeout(timeout);
            resolve(result);
        });
    });
}

suite.current = suite.root = {
    tests: [],
    async run() {
        console.time("done in");
        let passed = 0, failed = 0;
        for await (const test of testWalker(this)) {
            Object.defineProperty(test.spec, "name", {value: test.id});
            const ctx = testContext[test.id] = Object.create(test);
            const suite = test.suite;
            try {
                if (suite.beforeEach) {
                    for (const fn of suite.beforeEach) await runWithTimeout(test.title, fn, ctx, suite.timeout);
                }
                await runWithTimeout(test.title, test.spec, ctx, suite.timeout);
                passed++;
                suite.passed++;
                test.ok = true;
            } catch (error) {
                sourcemapped.mapStackTrace(error.stack, mappedStack => {
                    console.error(`"${test.title}"`, "failed", error.stack);
                    console.log(`%cexpected: %c${error.expected}\n%cactual:   %c${error.actual}`, "font-weight:bold;color:green;", "color:darkgreen;", "font-weight:bold;color:red;", "color:darkred;");
                }, {cacheGlobally: true});
                failed++;
                suite.failed++;
                test.error = error;
            } finally {
                if (suite.afterEach) {
                    for (const fn of suite.afterEach) await runWithTimeout(test.title, fn, ctx, suite.timeout);
                }
                testContext[test.id] = undefined;
            }
        }
        console.timeEnd("done in");
        if (failed) {
            console.log("Failed:", passed, "tests passed", failed, "tests failed");
        } else {
            console.log("OK!", passed, "tests passed");
        }
    }
};

export const test = (title, spec) => {
    const ctx = {
        id: "::" + simpleHash(title) + "-" + Date.now().toString(16),
        suite: suite.current,
        title,
        spec
    };
    suite.current.tests.push(ctx);
};

export function beforeEach(fn) {
    const current = suite.current;
    current.beforeEach = current.beforeEach?.concat(fn) ?? [fn];
}

export function afterEach(fn) {
    const current = suite.current;
    current.afterEach = current.afterEach?.concat(fn) ?? [fn];
}

export function beforeAll(fn) {
    const current = suite.current;
    current.beforeAll = current.beforeAll?.concat(fn) ?? [fn];
}

export function afterAll(fn) {
    const current = suite.current;
    current.afterAll = current.afterAll?.concat(fn) ?? [fn];
}

suite.only = function (title, spec) {
    suite(title, spec);
    include();
};

suite.skip = function (title, spec) {
    suite(title, spec);
    exclude();
};

test.only = function (title, spec) {
    test(title, spec);
    include();
};

test.skip = function (title, spec) {
    test(title, spec);
    exclude();
};

function include() {
    let current = suite.current;
    (current.only ??= []).push(current.tests.at(-1));
    while (current.suite !== suite.root && !current.suite.only) {
        current = current.suite;
        current.only = [current.tests.at(-1).title];
    }
}

function exclude() {
    let current = suite.current;
    (current.skip ??= []).push(current.tests.at(-1));
}

if (!globalThis.suite) {
    Object.assign(globalThis, {
        suite,
        test,
        beforeAll,
        afterAll,
        beforeEach,
        afterEach,
    });
    if (typeof window !== "undefined") {
        window.document.addEventListener("DOMContentLoaded", () => suite.root.run());
    }
}

export const describe = suite;
export const context = suite;
export const it = test;
export const setup = beforeEach;
export const teardown = afterEach;
export const suiteSetup = beforeAll;
export const suiteTeardown = afterAll;
export const before = beforeAll;
export const after = afterAll;
