import { ParseResult } from "@babel/parser";
import { GeneratorOptions } from "@babel/generator";
declare const _default: (source: string, options?: Partial<GeneratorOptions>) => any;
export default _default;
export declare function parse(source: string): ParseResult;
export declare function traverse(ast: ParseResult): ParseResult;
export declare function generate(ast: ParseResult, options: Partial<GeneratorOptions>, source: string): any;
