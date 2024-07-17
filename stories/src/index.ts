export * from "./sandbox/parameters";

export interface JasmineInterface {
    // These methods are part of the jasmineInterface, they are ripped from the namespace in @types/jasmine
    // because I couldn't find a better way to import them... i.e. that typing is shit

    describe(description: string, specDefinitions: () => void): void;

    fdescribe(description: string, specDefinitions: () => void): void;

    xdescribe(description: string, specDefinitions: () => void): void;

    it(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    fit(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    xit(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    pending(reason?: string): void;

    setSpecProperty(key: string, value: unknown): void;

    setSuiteProperty(key: string, value: unknown): void;

    beforeEach(action: jasmine.ImplementationCallback, timeout?: number): void;

    afterEach(action: jasmine.ImplementationCallback, timeout?: number): void;

    beforeAll(action: jasmine.ImplementationCallback, timeout?: number): void;

    afterAll(action: jasmine.ImplementationCallback, timeout?: number): void;

    expect<T extends jasmine.Func>(spy: T | jasmine.Spy<T>): jasmine.FunctionMatchers<T>;

    expect<T>(actual: ArrayLike<T>): jasmine.ArrayLikeMatchers<T>;

    expect<T>(actual: T): jasmine.Matchers<T>;

    expect(): jasmine.NothingMatcher;

    expectAsync<T, U>(actual: T | PromiseLike<T>): jasmine.AsyncMatchers<T, U>;

    fail(e?: any): void;

    // mocha like aliases

    beforeEach(action: jasmine.ImplementationCallback, timeout?: number): void;

    after(action: jasmine.ImplementationCallback, timeout?: number): void;

    test(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    focus(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    fixture<T extends HTMLElement>(options?: { timeout?: number }): Promise<T>;
}

declare global {
    function describe(description: string, specDefinitions: (fixtures: any) => void): void;

    function before(action: jasmine.ImplementationCallback, timeout?: number): void;

    function after(action: jasmine.ImplementationCallback, timeout?: number): void;

    function test(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    function focus(expectation: string, assertion?: jasmine.ImplementationCallback, timeout?: number): void;

    function fixture<T extends HTMLElement>(options?: { timeout?: number }): Promise<T>;
}

export function css(strings: TemplateStringsArray, ...values: (string | number)[]) {
    let cssText = "";
    let i = 0;
    while (i < values.length) {
        cssText += strings[i] + String(values[i]);
        ++i;
    }
    if (i < strings.length) {
        cssText += strings[i];
    }
    document.head.appendChild(document.createElement("style")).appendChild(document.createTextNode(cssText));
}

export function storyUrl(story: string, fixture?: string) {
    if (!story.startsWith("/")) {
        story = `/${story}`;
    }
    if (!story.endsWith(".stories.tsx")) {
        story = `${story}.stories.tsx`;
    }
    if (fixture) {
        return `./story.html?fixture=${fixture}#${story}`;
    } else {
        return `./story.html#${story}`;
    }
}

export type Spy<T> = T & {
    target: T;
    interactions: Array<{
        this: any;
        arguments: any[];
        result: any;
        thrown: any;
    }>;
};

const MOCK_HANDLERS = new Map();

export function createMock<T extends object>(target: T) {
    const handler = {};
    const proxy = new Proxy(target, handler);
    MOCK_HANDLERS.set(proxy, handler);
    return proxy;
}

export function mock<T extends object>(proxy: T, handler: ProxyHandler<T>) {
    Object.assign(MOCK_HANDLERS.get(proxy), handler);
}

declare global {
    interface Window {
        stories: Promise<string[]>;
    }
}
