declare function signal<T>(init: T): Signal<T>;
declare function signal<T>(init?: T): Signal<T|undefined>;

declare function computed<T>(callback: () => T): Computed<T>;

declare function effect(callback: () => (() => void) | void): () => void;

declare function batch<T>(callback: () => T): T;

declare function untracked<T>(callback: () => T): T;

declare function tracked<T>(callback: () => T): T;

export class Signal<T> {

    constructor(init: T);

    as(name: string): this;

    is(value: T): boolean;

    get value(): T;
    set value(value: T): void;

    get(): T;
    set(value: T): void;

    peek(): T;

    isLinked: boolean;

    subscribe(fn: (value: T) => () => void): () => void;

    scope?: Map<any,any>;
}

export class Computed<T> extends Signal<T> {
    constructor(callback: () => T);
}

export class Effect {

    constructor(callback: () => () => void);

    notify(): void;

    dispose(): void;
}

export class RenderEffect<T> {

    constructor(signal: Signal<T>, nextEffect: Effect);

    track(signal?: Signal<T>): T;

    refresh(): void;

    notify(): void;

    dispose(): void;
}
