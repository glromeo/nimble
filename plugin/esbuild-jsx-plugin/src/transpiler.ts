import {parse} from "@babel/parser";
import __traverse from "@babel/traverse";
import __generate, {GeneratorOptions} from "@babel/generator";
import {State, visitor} from "./visitor";

const traverse = (__traverse as any).default ?? __traverse;
const generate = (__generate as any).default ?? __generate;

export default (source: string, {
    compact = false,
    minified = false,
    sourceMaps = true,
    sourceFileName,
    defaultExt
}: Partial<GeneratorOptions & {defaultExt: string}> = {}) => {

    const ast = parse(source, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    });

    traverse(ast, visitor, undefined, {defaultExt} as State);

    return generate(
        ast,
        {
            compact,
            minified,
            sourceMaps,
            sourceFileName
        },
        source
    );
};
