const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/transpiler.ts'],
    outfile: 'dist/transpiler.mjs',
    bundle: true,
    platform: 'browser',
    format: 'esm',
    sourcemap: false,
    minify: false,
    define: {
        "process.env.DEBUG": "false",
        "process.env.FORCE_COLOR": '"false"',
        "process.env.NODE_ENV": JSON.stringify({}),
        "process.env.BABEL_TYPES_8_BREAKING": "false",
        "process.env": JSON.stringify({})
    }
}).then(() => {
    console.log('bundle complete!');
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
