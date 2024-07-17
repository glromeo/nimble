import { useCallback, useContext, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { StoryContext } from "./context";

import type { ParameterType } from "../hooks/parameters";

type StoredParameter<T> = { type: string; value?: T | null };
type StoredParameters = Record<string, StoredParameter<any>>;

const bridge = {} as Record<string, StoredParameters>;

const persistParameters = (title: string, parameters: StoredParameters) => {
    localStorage.setItem(`atx-stories.parameters.${title}`, JSON.stringify(parameters));
};

const useLocalStorage = <T>(title: string, label: string, type: string, init?: T | (() => T)) => {
    const [reducer, initial] = useMemo(() => {
        let parameters = bridge[title];
        if (!parameters) {
            parameters = bridge[title] = JSON.parse(localStorage.getItem(`atx-stories.parameters.${title}`) ?? "{}");
            persistParameters(title, parameters);
        }
        let slot = parameters[label];
        if (!slot || slot.type !== type) {
            slot = parameters[label] = { type, value: typeof init === "function" ? (init as () => T)() : init };
            persistParameters(title, parameters);
        }
        return [
            (state: T, value: T) => {
                if (state !== value) {
                    slot.value = value;
                    persistParameters(title, parameters);
                }
                return value;
            },
            slot.value
        ];
    }, [label, type]);
    return useReducer(reducer, initial);
};

export function removeParameters(title: string) {
    localStorage.removeItem(`atx-stories.parameters.${title}`);
}

/**
 *
 * @param label
 * @param type
 * @param init
 */
export function useParameter<T>(label: string, type: ParameterType<T>, init?: T | (() => T)): [T, (value: T) => void] {
    const { title, parameters } = useContext(StoryContext)!;

    const [value, dispatch] = useLocalStorage(title, label, JSON.stringify(type), init);

    useLayoutEffect(() => parameters.mount(label, { type, init: value }, dispatch), [dispatch]);

    return [
        value,
        useCallback(
            (value: T) => {
                parameters.set(label, value);
                dispatch(value);
            },
            [dispatch]
        )
    ];
}
