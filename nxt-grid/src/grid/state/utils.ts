import {Signal} from "@nimble/toolkit";

export type MaybeSignals<T extends object> = {
    [key in keyof T]: T[key] | Signal<T[key]>
}

export function reactivify<O extends object>(target: MaybeSignals<O>): O {
    for (const [key, value] of Object.entries(target)) {
        if (value instanceof Signal) {
            defineReactiveProperty(target, key as keyof O, value);
        }
    }
    return Object.seal(target as O);
}

export function defineReactiveProperty<K extends keyof O, O extends object>(target: O, key: K, s: Signal<O[K]>) {
    const desc = Object.getOwnPropertyDescriptor((s as any).__proto__, "value")!;
    desc.get = desc.get!.bind(s);
    if (desc.set) {
        desc.set = desc.set.bind(s);
    }
    Object.defineProperty(target, key, desc);
}
