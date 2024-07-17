import {JSX} from "../index";

export function css(strings: TemplateStringsArray, ...values: string[]): CSSStyleSheet;

export function adoptStyle(styleSheet: CSSStyleSheet): void;

export function createDirective<C extends JSX.CustomAttributes<HTMLElement>, K extends keyof C>(
    attr: K,
    cb: (el: infer D extends HTMLElement, v?: C[K], props?: any) => void
): void;
