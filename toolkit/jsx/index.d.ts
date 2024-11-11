import {JSX} from "../index";

export function createDirective<D extends JSX.Directives>(
    name: keyof D,
    cb: (el: infer D extends HTMLElement, directive?: Signal<JSX.IntrinsicElements[K]>, props?: C) => void
): void;
