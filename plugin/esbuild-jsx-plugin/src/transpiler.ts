import {parse as babelParse, ParseResult} from "@babel/parser";
import __traverse from "@babel/traverse";
import __generate, {GeneratorOptions} from "@babel/generator";

import {State, visitor} from "./visitor";

const babelTraverse = (__traverse as any).default ?? __traverse;
const babelGenerate = (__generate as any).default ?? __generate;

export default (source: string, options: Partial<GeneratorOptions> = {}) => {
    return generate(traverse(parse(source)), options, source);
};

export function parse(source: string): ParseResult {
    return babelParse(source, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    });
}

export function traverse(ast: ParseResult, opt?: any): ParseResult {
    babelTraverse(ast, opt ? {...opt, ...visitor} : visitor, undefined, {} as State);
    return ast;
}

export function generate(ast: ParseResult, options: Partial<GeneratorOptions>, source: string) {
    return babelGenerate(ast, options, source);
}

