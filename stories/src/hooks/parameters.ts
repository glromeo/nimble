import { atom, createStore, WritableAtom } from "jotai";
import { AtxDropdownOption } from "@atx/toolkit";
import { atomFamily } from "jotai/utils";

export type ParameterType<T> =
    | "number"
    | "boolean"
    | "string"
    | "date"
    | "checkboxes"
    | (AtxDropdownOption<T> | T | null)[];

export type Parameter<T> = {
    label: string;
    type: ParameterType<T>;
    atom: WritableAtom<T, [T], void>;
};

export const parametersFamily = atomFamily((title: string) => {
    const parameters = atom({} as Record<string, Parameter<any>>);
    parameters.debugLabel = `${title} parameters`;
    return parameters;
});

type ParameterDesc<T> = { type: ParameterType<T>; init: T };

export class ParametersBridge<T> {
    mount: (label: string, desc: ParameterDesc<T>, callback: (value: T) => void) => () => void;
    set: (label: string, value: T) => void;

    constructor(title: string, store: ReturnType<typeof createStore>, paramsAtom: ReturnType<typeof parametersFamily>) {
        this.set = (label, value) => {
            const paramAtom = store.get(paramsAtom)[label]?.atom;
            if (paramAtom) {
                store.set(paramAtom, value);
            } else {
                console.warn("unmounted atom", label);
            }
        };
        this.mount = (label, { type, init }, callback) => {
            const paramAtom = atom(init);
            paramAtom.debugLabel = `${title}: ${label}`;
            store.set(paramsAtom, { ...store.get(paramsAtom), [label]: { label, type, atom: paramAtom } });
            const unsub = store.sub(paramAtom, () => callback(store.get(paramAtom)));
            return () => {
                unsub();
                const params = { ...store.get(paramsAtom) };
                delete params[label];
                store.set(paramsAtom, params);
            };
        };
    }
}
