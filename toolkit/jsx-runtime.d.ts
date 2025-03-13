import {JSX} from "nimble/types/jsx";

export * from "nimble/types/jsx";

// https://www.typescriptlang.org/docs/handbook/jsx.html

export function jsx(tag: string | Function, props: any, key?: any): JSX.Element;
export function jsxs(tag: string | Function, props: any, key?: any): JSX.Element;
export function svg(tag: string | Function, props: any, key?: any): JSX.Element;
export function xhtml(tag: string | Function, props: any, key?: any): JSX.Element;

export function Fragment(props:{children: JSX.Element|JSX.Element[]}): JSX.Element;
