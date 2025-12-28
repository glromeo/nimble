import { useEffect } from "react";
import consoleReporter from "./reporters/console-reporter";
import Env = jasmine.Env;
import SuiteResult = jasmine.SuiteResult;

import type { JasmineInterface } from "../index";

console.log("loading jasmine");
window.global = window;
const jasmineRequire = require("jasmine-core/lib/jasmine-core/jasmine");
console.log("jasmine loaded");

const deferred = new Set<string>([
    "describe",
    "fdescribe",
    "xdescribe",
    "it",
    "fit",
    "xit",
    "beforeEach",
    "afterEach",
    "beforeAll",
    "afterAll",
    "before",
    "after",
    "test",
    "focus"
]);

const cache = {} as Record<string, Function[]>;

export function initJasmine(story: string) {
    if (cache[story]) {
        return cache[story];
    }

    const spec: Function[] = (cache[story] = []);

    const jasmine = jasmineRequire.core(jasmineRequire);
    const jasmineInterface: JasmineInterface = jasmineRequire.interface(jasmine, jasmine.getEnv());

    for (const method of deferred) {
        Object.defineProperty(window, method, {
            configurable: true,
            writable: true,
            enumerable: true,
            value(...args: any[]) {
                spec.push((jasmineInterface: any) => jasmineInterface[method].apply(this, args));
            }
        });
    }

    for (const method of Object.keys(jasmineInterface))
        if (!deferred.has(method)) {
            Object.defineProperty(window, method, {
                configurable: true,
                writable: true,
                enumerable: true,
                value() {
                    throw new Error(`'${method}' is not supported at module level`);
                }
            });
        }

    return spec;
}

export function runJasmine(story: string, spec: Function[]) {
    const jasmine = jasmineRequire.core(jasmineRequire);
    const env: Env = jasmine.getEnv();
    const jasmineInterface: JasmineInterface = jasmineRequire.interface(jasmine, env);

    jasmineInterface.before = jasmineInterface.beforeAll;
    jasmineInterface.after = jasmineInterface.afterAll;
    jasmineInterface.test = jasmineInterface.it;
    jasmineInterface.focus = jasmineInterface.fit;

    Object.assign(window, jasmineInterface);

    env.addReporter(consoleReporter);
    env.addReporter({
        suiteStarted(suite: SuiteResult) {
            console.log("I am the reporter hooked inside the component - starting");
        },
        suiteDone({ failedExpectations, fullName, status }: SuiteResult) {
            console.log("I am the reporter hooked inside the component - done");
        }
    });

    env.configure({});

    console.log("jasmine is ready");

    for (const invocation of spec) {
        invocation(jasmineInterface);
    }

    console.log("running tests for:", story);
    env.execute();
}
