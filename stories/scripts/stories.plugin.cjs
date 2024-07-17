const { readFile, writeFile } = require("node:fs/promises");
const { resolve, dirname } = require("node:path");
const fg = require("fast-glob");

const {parse} = require("@babel/parser");
const {default: traverse} = require("@babel/traverse");

const isMockingCallee = (callee) => callee === "spy" || callee === "stub" || callee === "mock";

/**
 *
 * @param source {string}
 * @param resolveImport {import("esbuild").PluginBuild["resolve"]}
 */
const scanStory = (source, resolveImport) => {

    const ast = parse(source, {
        sourceType: "module",
        plugins: [
            "typescript",
            "jsx"
        ]
    });

    const imported = new Map();

    const exports = [];
    const imports = [];

    traverse(ast, {
        ExportDefaultDeclaration({node}) {
            const {type} = node.declaration;
            switch (type) {
                case "ArrowFunctionExpression":
                    exports.push("default");
                    return;
                case "FunctionDeclaration":
                    exports.push("default");
                    return;
            }
        },
        ExportNamedDeclaration({node}) {
            const {type, id, properties, declarations, specifiers} = node.declaration;
            switch (type) {
                case "FunctionDeclaration":
                    exports.push(id.name ?? "default");
                    return;
                case "VariableDeclaration":
                    for (const {id, init} of declarations) {
                        if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
                            exports.push(id.name);
                        }
                    }
                    return;
                default:
                    if (specifiers) {
                        const exportMap = new Map();
                        for (const {local, exported} of specifiers) {
                            exportMap.set(local.name, exported.name);
                        }
                        for (const {type, id, declarations} of ast.program.body) {
                            if (type === "FunctionDeclaration") {
                                const name = exportMap.get(id.name);
                                if (name) {
                                    exports.push(name);
                                }
                            }
                            if (type === "VariableDeclaration") {
                                for (const {id, init} of declarations) {
                                    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
                                        const name = exportMap.get(id.name);
                                        if (name) {
                                            exports.push(name);
                                        }
                                    }
                                }
                            }
                        }
                    }
            }
        },
        ImportDeclaration({node}) {
            for (const spec of node.specifiers) {
                if (spec.imported) {
                    imported.set(spec.imported.name, node.source.value);
                }
            }
        },
        CallExpression({node}) {
            const callee = node.callee?.name;
            if (callee && isMockingCallee(callee)) {
                const [lhs] = node.arguments;
                if (lhs?.type === "Identifier") {
                    const id = lhs.name;
                    let source = imported.get(id);
                    if (source) {
                        imported.delete(id);
                        imports.push(resolveImport(source).then(path => {
                            console.log(`proxying '${id}' from "${source}"`);
                            return [path, id];
                        }))
                    }
                }
            }
        }
    })

    return {
        exports,
        imports
    };
}

/**
 * This is optimized for one path being most likely the common path and another one being most likely longer
 *
 * @param path
 * @param other
 * @returns {*}
 */
const commonPath = (path, other) => {
    if (other.length > path.length) {
        other = other.slice(0, path.length);
    } else {
        path = path.slice(0, other.length);
    }
    while (path && path !== other) {
        const sep = path.lastIndexOf("/", path.length - 2) + 1;
        path = path.slice(0, sep);
        other = other.slice(0, sep);
    }
    return path;
}

/**
 * Mock Modules Plugin
 *
 * @param options {{modules: Map<string, Set<string>>}}
 * @return {import("esbuild").Plugin}
 */
module.exports.storiesPlugin = ({ modules }) => ({
    name: "stories-plugin",
    setup({ initialOptions: { outdir }, onStart, onEnd, onResolve, onLoad, resolve: resolveAsync }) {

        const {cwd, stories: globs} = require("@nimble/scripts/config.cjs")

        const resolved = new Map();

        let resolveDir = ".";
        let stories = {};

        onStart(() => new Promise((done, fail) => {

            resolveDir = ".";
            stories = {};
            modules.clear();
            resolved.clear();

            const pending = [];

            fg.globStream(globs, { cwd: cwd })
                .on("data", story => {
                    const filename = resolve(cwd, story);
                    const resolveDir = dirname(filename);

                    const resolveImport = async source => {
                        let entry = resolved.get(source);
                        if (!entry) {
                            entry = resolveAsync(source, {
                                kind: "import-statement",
                                resolveDir
                            });
                            resolved.set(source, entry);
                        }
                        const { errors, path } = await entry;
                        if (errors.length) {
                            const [{ text }] = errors;
                            fail(`failed to scan story '${story}': ${text}`);
                        } else {
                            return path;
                        }
                    };

                    pending.push(
                        readFile(filename, "utf8").then(async source => {
                            const {
                                exports,
                                imports
                            } = scanStory(source, resolveImport);

                            stories[story] = exports;

                            for await (const [path, name] of imports) {
                                let names = modules.get(path);
                                if (names) {
                                    names.add(name);
                                } else {
                                    modules.set(path, new Set([name]));
                                }
                            }
                        }).catch(error => {
                            // TODO: improve error reporting
                            console.error("unable to scan file", filename, error);
                            fail("scan failed");
                        })
                    )
                })
                .on("end", () => Promise.all(pending).then(() => {
                    const paths = Object.keys(stories);
                    let common = paths[0];
                    for (const path of paths) {
                        common = commonPath(common, path);
                    }
                    stories = Object.fromEntries(Object.entries(stories).map(
                        ([path, exports]) => [path.slice(common.length), exports])
                    );
                    resolveDir = resolve(cwd, common ?? ".");
                    done();
                }));
        }));

        onResolve({ filter: /^\.\/loader$/ }, ({ path }) => ({ path, namespace: "@stories" }));

        onLoad({ filter: /./, namespace: "@stories" }, () => {
            let contents = `export async function loadStory(hash) { switch(hash) {`;
            for (const story of Object.keys(stories)) {
                contents += `\n  case "#/${story}": return import("./${story}");`
            }
            contents += `\n} };`;
            const watchDirs = [
                ...new Set(Object.keys(stories).map(story => resolve(resolveDir, dirname(story)))),
                resolveDir
            ];
            return {
                contents: contents,
                loader: "js",
                resolveDir,
                watchDirs
            };
        });

        onEnd(async () => {
            await writeFile(resolve(outdir, "stories.json"), JSON.stringify(stories, null, "  "));
        })
    }
});
