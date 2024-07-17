const esbuild = require("esbuild");

function configureBuild({environment}) {
    const {
        srcdir,
        outdir,
        buildOptions: {
            entryPoints = [],
            outExtension,
            alias,
            define,
            plugins = []
        }
    } = require("../config.cjs");

    return {
        entryPoints: [
            ...entryPoints,
            `${srcdir}/index.jsx`
        ],
        outdir,
        outbase: srcdir,
        outExtension: {
            ...outExtension,
            ".js": ".mjs"
        },
        format: "esm",
        jsxImportSource: "nimble",
        jsx: "automatic",
        jsxSideEffects: true,
        alias: {
            ...alias,
            "nimble/jsx-runtime": "@nimble/toolkit/jsx-runtime.js"
        },
        bundle: true,
        splitting: true,
        sourcemap: true,
        minify: environment === "production",
        treeShaking: environment === "production",
        define: {
            ...define,
            "process.env.NODE_ENV": JSON.stringify(environment)
        },
        plugins: [
            ...plugins,
            require("./plugins/build-logging.cjs").plugin,
            require("./plugins/jsx-transpiler.cjs").plugin,
            require("./plugins/copy-assets.cjs").plugin,
            require("./plugins/live-reload.cjs").plugin
        ]
    };
}

module.exports.build = async ({debug, watch, environment}) => {
    let buildOptions = configureBuild({
        environment: environment ?? "development"
    });
    if (debug) {
        console.log("build options:\n", buildOptions);
    }
    if (watch) {
        const context = await esbuild.context(buildOptions);
        await context.watch();
        await context.rebuild();
        console.log("watch mode enabled...");
        return context;
    } else {
        return await esbuild.build(buildOptions);
    }
};
