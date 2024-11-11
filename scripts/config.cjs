const {resolve, join} = require("node:path");

const cwd = process.cwd();
const resolveOpts = {paths: [cwd]};

const deepmerge = require("deepmerge");

const arrayMerge = (target, source) => {
    return [...new Set([...source, ...target])];
};

const mergeObjects = (baseConfig, ...configs) => {
    let mergedConfig = baseConfig;
    let options = {arrayMerge};
    for (const config of configs) {
        mergedConfig = deepmerge(mergedConfig, config, options);
    }
    return mergedConfig;
};

const resolveConfig = pathname => {
    try {
        return require.resolve(pathname, resolveOpts);
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            return;
        }
        throw e;
    }
};

const requireConfig = pathname => {
    const resolved = resolveConfig(pathname);
    if (resolved) {
        return require(resolved);
    }
};

const mergeConfig = (target, pathname) => {
    let cfg = requireConfig(pathname);
    if (cfg) {
        return mergeObjects(target, cfg) ?? target
    }
    return target
};

const {
    name,
    main,
    config: {
        baseUrl
    } = {},
    dependencies = []
} = requireConfig("./package.json");

let buildOptions = {};
let middleware = [];

buildOptions = mergeConfig(buildOptions, "./scripts/esbuild.config.cjs");
middleware = mergeConfig(middleware, "./scripts/middleware.config.cjs");

for (const pkg of Object.keys(dependencies)) {
    if (pkg.startsWith("@nimble/") && pkg !== "@nimble/scripts") {
        buildOptions = mergeConfig(buildOptions, join(pkg, "scripts/esbuild.config.cjs"));
        middleware = mergeConfig(middleware, join(pkg, "scripts/middleware.config.cjs"));
    }
}

module.exports = {
    cwd,
    name,
    main,
    srcdir: resolve(cwd, "src"),
    outdir: resolve(cwd, "build"),
    baseUrl: new URL(baseUrl ?? "http://localhost:3000"),
    stories: [
        "src/**/*.stories.[jt]sx",
        "components/**/*.stories.[jt]sx",
        "stories/**/*.stories.[jt]sx",
    ],
    tests: [
        "test/**/*.spec.[jt]sx?"
    ],
    buildOptions,
    middleware
};
