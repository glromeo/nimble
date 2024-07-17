import { atom } from "jotai";
import merge from "deepmerge";

export type Settings = {
    navigator: {
        width: number;
    };
};

export let storedSettingsAtom = atom(
    JSON.parse(
        localStorage.getItem("atx-stories.settings") ||
            JSON.stringify({
                navigator: {
                    width: 160
                }
            })
    ) as Settings
);

export const settingsAtom = atom(
    (get) => get(storedSettingsAtom),
    (get, set, update: Partial<Settings>): void => {
        const settings = merge(get(storedSettingsAtom), update, {
            arrayMerge: (destinationArray, sourceArray) => [...new Set([...sourceArray, ...destinationArray])]
        }) as Settings;
        set(storedSettingsAtom, settings);
        localStorage.setItem("atx-stories.settings", JSON.stringify(settings));
    }
);
