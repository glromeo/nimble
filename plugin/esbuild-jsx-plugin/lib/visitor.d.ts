import { Identifier } from "@babel/types";
import { Visitor } from "@babel/traverse";
export type State = {
    imports: {
        jsx: Identifier;
        svg: Identifier;
        xhtml: Identifier;
        Fragment: Identifier;
    };
    isReactive?: boolean;
    defaultExt?: string;
};
export declare const visitor: Visitor<State>;
