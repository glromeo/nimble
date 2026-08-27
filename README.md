# nimble

**The framework lives in [wizkit](https://github.com/glromeo/wizkit) now.**

`toolkit/jsx`, `toolkit/html`, `toolkit/directives` and `toolkit/types` were imported into
`@wizkit/toolkit` from commit `09cf2e7`; `toolkit/signals` had already been extracted as
`@wizkit/signals` and was fast-forwarded at the same time. Work on any of that there, not here.

The rest of nimble was superseded rather than moved:

| here | there |
|---|---|
| `scripts/` | `@wizkit/scripts` — an ESM rewrite that also runs tests and a local registry |
| `testing/` | `@wizkit/testing`, plus its `dom` subpath for the DOM helpers |
| `plugin/esbuild-jsx-plugin/` | `@wizkit/babel-plugin-jsx-expressions` + `@wizkit/esbuild-babel-plugin` |
| `plugin/esbuild-postcss-plugin/` | `@wizkit/esbuild-postcss-plugin` |

## What is still only here

The consumers, kept for a later pass: `sample/`, `docs/`, `nxt-grid/`, `stories/`,
`demo/sierpinski-triangle/`, `demo/scrolling-demo/` — and `toolkit/components/tk-app`, which
pulls in bootstrap, and `toolkit/index.css`, which embeds a font. Neither belongs in a package
whose rule is no external dependencies.

They still build against `@nimble/*` as they always did. Nothing in this repo has been deleted.
