import { Expression, Identifier, StringLiteral } from "@babel/types";
import { Visitor } from "@babel/traverse";
type Context = {
    __proto__: Context;
    xmlns?: string;
    factory?: Identifier;
    tagName: Identifier | StringLiteral;
    key: Expression;
    props: any[];
    attr?: Identifier | StringLiteral;
};
export type State = {
    factories: {
        jsx: Identifier;
        svg: Identifier;
        xhtml: Identifier;
        Fragment: Identifier;
    };
    ctx: Context;
};
export declare const visitor: Visitor<State>;
export {};
