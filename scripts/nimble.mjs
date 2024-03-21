#! /usr/bin/env node

import {build} from "esbuild";

await build({
    entryPoints: ['./src/index.jsx'],
    outdir: './out',
    outExtension: { '.js': '.mjs' },
    format: 'esm',
    jsxFactory: 'jsx',
    jsxFragment: 'Fragment',
    jsxImportSource: "@nimble",
    jsx: 'automatic',
    jsxSideEffects: true,
    bundle: true
})