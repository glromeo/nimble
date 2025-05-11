import { Identifier } from "@babel/types";
import { Visitor } from "@babel/traverse";
export type State = {
    imports: {
        jsx: Identifier;
        svg: Identifier;
        xhtml: Identifier;
        Fragment: Identifier;
    };
    factory: Identifier;
    isReactive?: boolean;
};
export declare const visitor: Visitor<State>;
