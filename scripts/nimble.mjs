#! /usr/bin/env node

import {build} from "esbuild";

await build({
    entryPoints: ['./src/index.jsx'],
    outdir: './out',
    outExtension: { '.js': '.mjs' },
    format: 'esm',
    jsxFactory: 'Array',
    jsxFragment: 'null',
    jsxImportSource: "@nimble",
    jsx: 'transform',
    jsxSideEffects: true,
    bundle: true
})