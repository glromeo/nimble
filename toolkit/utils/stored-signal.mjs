import {effect, signal} from "../signals/signals.mjs";
import {untracked} from "nimble";

export function storedSignal(name, defaultValue = {}) {
    const stored = signal(JSON.parse(localStorage.getItem(name) ?? JSON.stringify(defaultValue)));
    effect(() => {
        console.log("storing:", name);
        localStorage.setItem(name, JSON.stringify(stored.value));
    });
    window.addEventListener("storage", ({storageArea, key, newValue}) => {
        if (storageArea === localStorage && key === name) untracked(() => {
            stored.value = JSON.parse(newValue);
        });
    });
    return stored;
}
