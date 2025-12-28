# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nimble is a lightweight, reactive JavaScript/TypeScript framework for building web applications. It features:
- Fine-grained reactivity through a custom signals implementation
- JSX support with custom transpilation
- Template-based HTML rendering with `html`` tagged templates
- Type-safe development with TypeScript

This is an npm monorepo with multiple workspaces for the core framework, build tools, demos, and applications.

## Build Commands

The project uses a custom build system via the `@nimble/scripts` package:

```bash
# Development workflow
nimble start              # Clean, build with watch, and serve with live reload
nimble start --debug      # Same as above with debug logging

# Production build
nimble build --release    # Build with minification and optimization

# Build variants
nimble build              # Development build without minification
nimble build --watch      # Build with file watching

# Development server
nimble serve              # Start dev server without building
nimble serve --port 3000  # Start server on specific port
nimble serve --debug      # Start with debug logging

# Utilities
nimble clean              # Remove build artifacts (build/ directory)
nimble init [name]        # Initialize a new project
```

## Testing

Tests use Mocha with TDD interface, Chai for assertions, and Sinon for mocking.

```bash
# Run all tests in toolkit
cd toolkit
npm test                  # Runs mocha with TDD UI on **/*.spec.mjs files

# Run specific test file
npx mocha path/to/test.spec.mjs

# Benchmark (signals performance)
npm run benchmark         # Runs toolkit/signals/signals.benchmark.mjs
```

Test files use `.spec.mjs` extension and follow TDD style (`suite()`, `test()`, `setup()`, `teardown()`).

## Architecture

### Monorepo Structure

**Core Packages:**
- **`toolkit/`** (@nimble/toolkit) - Framework core: signals, JSX runtime, HTML templates, directives
- **`scripts/`** (@nimble/scripts) - Build system CLI (`nimble` command)
- **`testing/`** (@nimble/testing) - Test utilities with Chai/Mocha/Sinon integration

**Build Plugins:**
- **`plugin/esbuild-jsx-plugin/`** - Custom JSX transpilation using Babel
- **`plugin/esbuild-postcss-plugin/`** - PostCSS integration for esbuild

**Applications & Demos:**
- **`sample/`** - Sample application demonstrating framework features
- **`nxt-grid/`** - Grid component showcase
- **`stories/`** - Component story system
- **`docs/`** - Documentation site
- **`apps/event-planner/`** - Event planner demo
- **`demo/sierpinski-triangle/`** - Performance demo
- **`demo/scrolling-demo/`** - Scrolling performance demo

### Toolkit Core Architecture

The `toolkit/` package is organized into modules:

```
toolkit/
├── signals/          # Reactive signals (Signal, Computed, Effect, batch, untracked)
├── jsx/              # JSX runtime and component reconciliation
├── html/             # html`` tagged templates with cached parsing
├── directives/       # Built-in directives (resizable, etc.)
├── components/       # Built-in components (tk-app)
├── utils/            # Utilities (stored-signal, udomdiff, etc.)
└── types/            # TypeScript definitions
```

**Key Concepts:**

1. **Signals** (`toolkit/signals/signals.mjs`):
   - `Signal<T>` - Mutable reactive state
   - `Computed<T>` - Derived reactive values
   - `Effect` - Side-effect observer that runs when dependencies change
   - `batch()` - Batch multiple signal updates to minimize recomputation
   - `untracked()` - Read signals without tracking dependencies

2. **JSX Runtime** (`toolkit/jsx/jsx.mjs`):
   - Custom JSX factory function (`jsx()`) with automatic reconciliation
   - Component state management (ComponentState, ElementState, FragmentState)
   - Keyed reconciliation for efficient list updates
   - Dynamic properties and children via signals
   - Event directives: `on:eventName` (e.g., `on:click={handler}`)
   - Property directives: `is:directiveName` for custom behaviors

3. **HTML Templates** (`toolkit/html/html.mjs`):
   - `html`` tagged template for declarative HTML rendering
   - Pre-parsed command sequences cached via WeakMap for performance
   - Hook system for dynamic content insertion
   - SVG/XHTML namespace support
   - `css`` tagged template for adoptable stylesheets

### Build System

**Pipeline:**
```
Source files → Babel JSX transpilation → esbuild bundling → PostCSS (CSS) → Output
```

**Key Files:**
- `scripts/bin/cli.cjs` - CLI entry point
- `scripts/lib/build.cjs` - Main build orchestration
- `scripts/lib/serve.cjs` - Development server with live reload
- `scripts/config.cjs` - Configuration resolution

**Build Features:**
- esbuild for fast bundling
- Custom JSX transpilation via Babel AST transforms
- PostCSS integration with SCSS support
- File watching via chokidar
- Live reload via WebSocket
- Automatic CSV file processing
- Asset copying

**Configuration:**
Each workspace can have a `nimble.config.js` file to customize build settings. Config is merged with defaults from `scripts/config.cjs`.

### Reactive Data Flow

```
Signal.value = x
  → Notify subscribers
  → batch() effect recomputation
  → Component update()
  → JSX reconciliation
  → DOM updates
```

Components are created with an owner context that tracks signal dependencies. When signals change, only affected components recompute.

### JSX Directives

The framework supports custom directives in JSX:

- **Event binding:** `on:click={handler}`, `on:input={handler}`
- **Property directives:** `is:resizable`, `is:customDirective`
- **Dynamic attributes:** Pass signals directly as props, they'll be tracked automatically

Directives are defined in `toolkit/jsx/directives.mjs` and can be extended.

## Development Workflow

1. **Working on toolkit:** Changes require rebuilding dependent workspaces
2. **Working on apps/demos:** Use `nimble start` for live reload during development
3. **Testing changes:** Run `npm test` in the relevant workspace
4. **Build system changes:** Modify `scripts/lib/` files, test with a sample app

## TypeScript Configuration

Each workspace has its own `tsconfig.json`. The root level has minimal TypeScript configuration since workspaces are independent.

Key workspace configs:
- `toolkit/tsconfig.json` - Framework types
- `testing/tsconfig.json` - Test utilities types
- Individual app `tsconfig.json` files extend base configs

## Important Patterns

### Owner Context
Components track signal dependencies through an "owner" context. When creating effects or computed values inside components, they automatically track the component's lifecycle.

### Batching Updates
Use `batch()` when making multiple signal updates to avoid intermediate recomputations:
```typescript
batch(() => {
  signal1.value = newValue1;
  signal2.value = newValue2;
});
```

### Untracked Reads
Use `untracked()` to read signal values without creating dependencies:
```typescript
const currentValue = untracked(() => mySignal.value);
```

### Component State Management
JSX components can have internal state via `ComponentState` which is automatically managed. Avoid manual DOM manipulation; let the reconciliation handle updates.

## File Conventions

- **`.mjs`** - ES modules (most toolkit and test files)
- **`.cjs`** - CommonJS modules (build scripts)
- **`.tsx`** - TypeScript with JSX
- **`.spec.mjs`** - Test files (Mocha TDD)
- **`.benchmark.mjs`** - Benchmark files
- **`.d.ts`** - TypeScript type definitions

## Module System

All workspaces use ES modules (`"type": "module"` in package.json) except `@nimble/scripts` which uses CommonJS for broader tooling compatibility.
