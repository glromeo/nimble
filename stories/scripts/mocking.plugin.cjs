const { readFile } = require("fs").promises;
const { basename } = require("path");

const { parse } = require("@babel/parser");
const { default: template } = require("@babel/template");
const { default: generate } = require("@babel/generator");

const importCreateMock = template(`import { createMock } from "@nimble/stories";`);
const proxyAstTemplate = template(`export const PROXY = createMock(TARGET);`);

/**
 *
 * @param ast {import("@babel/parser").ParseResult<import("@babel/types").File>}
 * @param names {Set<string>}
 * @return {undefined}
 */
function injectMocks({ program }, names) {
    const proxies = [];
    for (const { declaration, specifiers, type } of program.body) {
        if (type === "ExportNamedDeclaration") {
            if (declaration) {
                const { declarations, id } = declaration;
                if (declarations) {
                    for (const { type, id } of declarations) {
                        if (type === "VariableDeclarator") {
                            if (names.delete(id.name)) {
                                proxies.push(id.name);
                                id.name = "__" + id.name;
                            }
                        }
                    }
                } else if (id) {
                    if (names.delete(id.name)) {
                        proxies.push(id.name);
                        id.name = "__" + id.name;
                    }
                }
            } else if (specifiers) {
                for (const { type, exported } of declarations) {
                    if (type === "ExportSpecifier") {
                        if (names.delete(exported.name)) {
                            proxies.push(exported.name);
                            exported.name = "__" + exported.name;
                        }
                    }
                }
            }
        }
    }

    program.body.unshift(importCreateMock());

    for (const name of proxies) {
        const PROXY = name;
        const TARGET = "__" + name;
        const ast = proxyAstTemplate({ PROXY, TARGET });
        program.body.push(ast);
    }
}

/**
 *
 * @param path {string}
 * @param names {string[]}
 * @param options {{minify: boolean}}
 */
const loadModule = async (path, names, { minify }) => {

    const source = await readFile(path, "utf8");

    let ast = parse(source, {
        sourceType: "module",
        plugins: [
            "typescript"
        ]
    });

    const required = new Set(names);

    injectMocks(ast, required);

    if (required.size) {
        throw new Error(`unable to proxy: ${[...required].join(", ")} in ${path}`);
    }

    return generate(
        ast,
        {
            compact: false,
            minified: minify,
            sourceMaps: minify,
            sourceFileName: basename(path) + " (orig)"
        },
        source
    );
};

/**
 * Mock Modules Plugin
 *
 * @param options {{modules: Map<string, Set<string>>}}
 * @return {import("esbuild").Plugin}
 */
module.exports.mockingPlugin = ({ modules }) => ({
    name: "mock-modules",
    setup: ({ onResolve, onStart, onLoad, onEnd }) => {

        onResolve({ filter: /^sinon$/ }, () => ({ path: "sinon", namespace: "globals" }));

        onLoad({ filter: /./, namespace: "globals" }, ({ path }) => ({
            contents: `export default window.${path};`
        }));

        onLoad({ filter: /\.ts$/ }, async ({ path }) => {
            const names = modules.get(path);
            if (names) {
                modules.delete(path);
                let { code, map } = await loadModule(path, names, { minify: true });
                if (map) {
                    const data = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
                    code = `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${data}`;
                }
                return {
                    contents: code,
                    loader: "ts"
                };
            }
        });

        onEnd(() => {
            if (modules.size > 0) {
                console.error("some imports have not been hooked", modules.keys());
                process.exit(1);
            }
        });
    }
});
