import { atom, useAtom } from "jotai";
import merge from "deepmerge";

export type Settings = {
    layout: {
        left: string | number | null;
        bottom: string | number | null;
    };
};

type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

export let storedSettingsAtom = atom(
    merge(
        {
            layout: {
                left: 160,
                bottom: 300
            }
        },
        JSON.parse(localStorage.getItem("atx-stories.settings") || "{}")
    ) as Settings
);

export const settingsAtom = atom(
    (get) => get(storedSettingsAtom),
    (get, set, update: DeepPartial<Settings>, reflect: boolean = true): void => {
        const settings = merge(get(storedSettingsAtom), update, {
            arrayMerge: (destinationArray, sourceArray) => [...new Set([...sourceArray, ...destinationArray])]
        }) as Settings;
        set(storedSettingsAtom, settings);
        localStorage.setItem("atx-stories.settings", JSON.stringify(settings));
    }
);

export function useSettings() {
    return useAtom(settingsAtom);
}
