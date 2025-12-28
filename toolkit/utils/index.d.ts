import {Signal} from "../signals/signals";

export function storedSignal<T extends object>(name: string, defaultValue: T = {} as T): Signal<T>;
