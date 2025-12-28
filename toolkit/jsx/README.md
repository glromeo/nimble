# Nimble - Fine-Grained Reactive JSX Library

Nimble is a lightweight reactive library that combines fine-grained reactivity with JSX rendering. It provides automatic dependency tracking, efficient DOM updates, and a simple mental model.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Signals](#signals)
- [JSX Rendering](#jsx-rendering)
- [Components](#components)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)

---

## Getting Started

### What is Nimble?

Nimble is a reactive UI library that automatically updates your interface when data changes. Unlike frameworks that re-render entire components, Nimble updates only the specific DOM nodes that need to change.
```javascript
import { signal } from './signals/signals.mjs';

const count = signal(0);
const node = <div>Count: {count.value}</div>;
document.body.appendChild(node);

count.set(1); // Only the text changes, not the entire div
```

### Installation

[Add installation instructions]

### Your First Nimble App
```jsx
import { signal } from './signals/signals.mjs';
import { mount } from './jsx/jsx.mjs';

function App() {
    const count = signal(0);
    
    return (
        <div>
            <h1>Count: {count.value}</h1>
            <button onClick={() => count.value++}>Increment</button>
        </div>
    );
}

mount(document.body, () => <App />);
```

---

## Core Concepts

### Signals: Reactive State

Signals are containers for values that notify when they change:
```javascript
import { signal } from './signals/signals.mjs';

const name = signal("Alice");
console.log(name.value); // "Alice"

name.set("Bob");
console.log(name.value); // "Bob"
```

### Fine-Grained Updates

When you use signals in your UI, Nimble tracks which parts of the DOM depend on which signals. When a signal changes, only those specific DOM nodes update:
```jsx
const message = signal("Hello");

// Only the text node inside the div updates when message changes
<div>{message.value}</div>
```

This is different from frameworks like React, where changing state re-renders the entire component.

### Automatic Dependency Tracking

You don't need to tell Nimble what depends on what. It figures it out automatically:
```javascript
import { computed } from './signals/signals.mjs';

const firstName = signal("Alice");
const lastName = signal("Smith");

// Automatically tracks both firstName and lastName
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

console.log(fullName.value); // "Alice Smith"
firstName.set("Bob");
console.log(fullName.value); // "Bob Smith"
```

---

## Signals

### Creating and Using Signals

Signals are the foundation of reactivity in Nimble:
```javascript
import { signal } from './signals/signals.mjs';

// Create a signal
const count = signal(0);

// Read the value
console.log(count.value); // or count.get()

// Update the value
count.set(5);
count.value = 5; // equivalent
```

### Computed Values

Computed values derive from other signals and update automatically:
```javascript
import { computed } from './signals/signals.mjs';

const price = signal(100);
const quantity = signal(2);
const total = computed(() => price.value * quantity.value);

console.log(total.value); // 200
quantity.set(3);
console.log(total.value); // 300 (automatically updated)
```

Computed values are:
- **Lazy**: Only evaluate when you access them
- **Cached**: Don't re-evaluate unless their dependencies change
- **Automatic**: Track dependencies without manual configuration

### Effects: Responding to Changes

Effects run code when signals change:
```javascript
import { effect } from './signals/signals.mjs';

const count = signal(0);

effect(() => {
    console.log(`Count is: ${count.value}`);
});
// Immediately logs: "Count is: 0"

count.set(1);
// Logs: "Count is: 1"
```

Effects are perfect for:
- Logging and debugging
- Synchronizing with external systems (localStorage, APIs)
- Setting up subscriptions or timers

#### Cleaning Up Effects

Effects can return a cleanup function that runs before the next execution:
```javascript
effect(() => {
    const timer = setInterval(() => {
        console.log(count.value);
    }, 1000);
    
    // Cleanup runs when effect re-runs or is disposed
    return () => clearInterval(timer);
});
```

#### Stopping Effects

Effects return a dispose function:
```javascript
const dispose = effect(() => {
    console.log(count.value);
});

// Later, stop the effect
dispose();
```

### Batching Updates

Batch multiple updates to run effects only once:
```javascript
import { batch } from './signals/signals.mjs';

const firstName = signal("Alice");
const lastName = signal("Smith");

effect(() => {
    console.log(`${firstName.value} ${lastName.value}`);
});
// Logs: "Alice Smith"

batch(() => {
    firstName.set("Bob");
    lastName.set("Jones");
});
// Logs once: "Bob Jones" (instead of twice)
```

### Untracked Reads

Sometimes you want to read a signal without creating a dependency:
```javascript
import { untracked } from './signals/signals.mjs';

const a = signal(1);
const b = signal(2);

const sum = computed(() => {
    const aVal = a.value;                      // Tracked
    const bVal = untracked(() => b.value);     // Not tracked
    return aVal + bVal;
});

b.set(3); // sum doesn't recompute (b is not tracked)
a.set(2); // sum recomputes (a is tracked)
```

---

## JSX Rendering

### Basic Elements

Create DOM elements with JSX syntax:
```jsx
const element = <div class="greeting">Hello World</div>;
document.body.appendChild(element);
```

### Reactive Content

Use signals to create dynamic content:
```jsx
const message = signal("Hello");
const element = <div>{message.value}</div>;

message.set("Goodbye");
// The div's text automatically updates
```

**Important**: Your JSX transform should wrap dynamic expressions in functions to make them reactive. Nimble's recommended transform does this automatically:
```jsx
// You write:
<div>{message.value}</div>

// Transform produces:
<div>{() => message.value}</div>
```

### Attributes

#### Static Attributes
```jsx
<input type="text" placeholder="Enter your name" />
```

#### Dynamic Attributes
```jsx
const inputType = signal("text");
<input type={inputType.value} placeholder="Dynamic type" />
```

#### Special Attributes

**Class attribute** accepts objects or arrays:
```jsx
// Object: keys are class names, values are boolean
const isActive = signal(true);
<div class={{ active: isActive.value, disabled: false }}>
// Renders: <div class="active">

// Array: list of class names
<div class={["btn", "primary"]}>
// Renders: <div class="btn primary">
```

**Style attribute** accepts objects:
```jsx
const color = signal("red");
<div style={{ color: color.value, fontSize: "16px" }}>
```

### Event Handlers

Attach event listeners with the `on` prefix:
```jsx
function handleClick(event) {
    console.log("Clicked!", event.target);
}

<button onClick={handleClick}>Click me</button>
```

For custom events or to preserve case, use `on:` prefix:
```jsx
<custom-element on:customEvent={(e) => console.log(e.detail)} />
```

### Refs

Get direct access to DOM elements:
```jsx
let inputElement;

<input ref={(el) => inputElement = el} />

// Use the element after rendering
inputElement.focus();
```

### Lists and Arrays

Render arrays of items:
```jsx
const fruits = signal(["Apple", "Banana", "Orange"]);

<ul>
    {fruits.value.map(fruit => <li>{fruit}</li>)}
</ul>
```

### Fragments

Group multiple elements without a wrapper:
```jsx
<>
    <h1>Title</h1>
    <p>Paragraph</p>
</>

// Or explicitly:
import { Fragment } from './jsx/jsx.mjs';
<Fragment>
    <h1>Title</h1>
    <p>Paragraph</p>
</Fragment>
```

Fragments use HTML comments as boundaries:
```html
<!--<>--><h1>Title</h1><p>Paragraph</p><!--</-->
```

---

## Components

### Basic Components

Components are just functions that return JSX:
```jsx
function Greeting(props) {
    return <div>Hello, {props.name}!</div>;
}

// Use it:
<Greeting name="Alice" />
```

### Props

Props are passed to components and can be:
- Static values
- Signal values
- Computed values
```jsx
const userName = signal("Alice");

function UserCard(props) {
    return (
        <div class="card">
            <h2>{props.title}</h2>
            <p>{props.name}</p>
        </div>
    );
}

<UserCard title="User Profile" name={userName.value} />
```

**Important**: Props are read-only. Don't try to modify them inside components.

### Children

Components can accept children via the `children` prop:
```jsx
function Card(props) {
    return (
        <div class="card">
            <h2>{props.title}</h2>
            <div class="content">
                {props.children}
            </div>
        </div>
    );
}

<Card title="My Card">
    <p>This is the card content</p>
    <button>Click me</button>
</Card>
```

### Component State

Components can have their own local state using signals:
```jsx
function Counter() {
    const count = signal(0);
    
    return (
        <div>
            <p>Count: {count.value}</p>
            <button onClick={() => count.value++}>Increment</button>
        </div>
    );
}
```

**Important**: Create signals outside the component function or they'll be recreated on every render:
```jsx
// ❌ Bad: Creates new signal each time
function Counter() {
    const count = signal(0); // Don't do this in unkeyed components
    return <div>{count.value}</div>;
}

// ✅ Good: Signal created once
const count = signal(0);
function Counter() {
    return <div>{count.value}</div>;
}

// ✅ Also good: Use keyed components (see next section)
```

---

## Advanced Features

### Keyed Components

Keys allow components to maintain their state and identity across parent re-renders.

#### The Problem Without Keys
```jsx
function Counter(props) {
    const localCount = signal(0);
    return (
        <div>
            <p>Prop: {props.value}</p>
            <p>Local: {localCount.value}</p>
            <button onClick={() => localCount.value++}>+</button>
        </div>
    );
}

const tab = signal("home");

effect(() => {
    if (tab.value === "home") {
        // Counter recreates, localCount resets to 0
        node = <Counter value={homeData} />;
    }
});
```

Every time the effect re-runs, the Counter component is recreated from scratch, losing its local state.

#### The Solution: Using Keys
```jsx
effect(() => {
    // With key: Counter persists, localCount preserved
    node = <Counter key="stable" value={
        tab.value === "home" ? homeData : settingsData
    } />;
});
```

Now when the effect re-runs, Nimble recognizes the component by its key and updates only its props instead of recreating it.

#### Keyed Lists

Keys are essential for efficient list rendering:
```jsx
const items = signal([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" }
]);

<div>
    {() => items.value.map(item => (
        <div key={item.id}>{item.name}</div>
    ))}
</div>
```

When items reorder, Nimble moves the existing DOM nodes instead of destroying and recreating them. This is faster and preserves things like focus state and scroll position.

**Rule**: Always use keys when rendering dynamic lists.

#### How Keyed Components Work

Keyed components:
1. Store their state in a scope attached to the parent effect
2. Persist across parent re-renders
3. Update reactively when their props change
4. Are disposed when removed from the scope
```jsx
function Counter(props) {
    const localCount = signal(0); // Persists across parent re-renders
    
    return (
        <div>
            <div>Prop: {props.value}</div>
            <div>Local: {localCount.value}</div>
            <button onClick={() => localCount.value++}>+</button>
        </div>
    );
}

effect(() => {
    parentSignal.value; // Trigger on change
    <Counter key="stable" value={propValue.value} />
    // Counter instance and localCount persist
});
```

### Ownership and Cleanup

Nimble automatically manages the lifecycle of effects and computations through an ownership tree.

#### Ownership Tree

When you create effects inside other effects, they form a parent-child relationship:
```javascript
const outerDispose = effect(() => {
    console.log("Outer effect");
    
    // This inner effect is "owned" by the outer effect
    effect(() => {
        console.log("Inner effect");
    });
});

outerDispose();
// Both outer and inner effects are disposed
```

This prevents memory leaks - you don't need to manually track and dispose every nested effect.

#### Scope Lifecycle

When using keyed components, their effects and computations are tied to the parent's scope:
```jsx
import { currentContext } from './signals/signals.mjs';

effect(() => {
    const ctx = currentContext();
    const scope = ctx.scope;
    
    <Component key="comp1" />; // Stored in scope
    <Component key="comp2" />; // Stored in scope
    
    // When effect re-runs, components with same keys are reused
    // Components with keys that disappear are disposed
});
```

### Error Handling

Nimble provides a global error boundary system for handling errors in reactive rendering.

#### Setting Error Handlers
```javascript
import { errorBoundary } from './jsx/jsx.mjs';

// Handle errors in dynamic children (like from computed values)
errorBoundary.set('children', (node, err) => {
    node.innerHTML = `<div class="error">${err.message}</div>`;
});

// Handle errors in dynamic nodes
errorBoundary.set('node', (node, err) => {
    const errorEl = document.createElement('span');
    errorEl.className = 'error';
    errorEl.textContent = err.message;
    return errorEl; // Return replacement node
});

// Handle errors in dynamic properties
errorBoundary.set('property', (node, name, err) => {
    console.error(`Error setting ${name}:`, err);
    node.setAttribute('data-error', err.message);
});
```

#### Error Types

**Children Errors** occur when dynamic children throw during evaluation:
```jsx
const throws = signal(false);
const comp = computed(() => {
    if (throws.value) throw new Error("Something went wrong");
    return "ok";
});

<div>{comp.value}</div>
// When throws becomes true, the error handler is called
```

**Node Errors** occur when a dynamic node value throws:
```jsx
<div>{() => {
    if (errorCondition) throw new Error("error");
    return "content";
}}</div>
```

**Property Errors** occur when a dynamic property throws:
```jsx
<div class={() => {
    if (error) throw new Error("class error");
    return "normal";
}} />
```

#### Resetting Error Handlers
```javascript
// Reset to default behavior
errorBoundary.set('children', null);
errorBoundary.set('node', null);
errorBoundary.set('property', null);
```

#### Default Error Behavior

By default:
- **Children**: Renders error stack in HTML comment
- **Node**: Renders error stack in comment node
- **Property**: Logs error to console

### Custom Directives

Create reusable element behaviors with directives:
```javascript
import { createDirective } from './jsx/directives.mjs';

createDirective("autofocus", (element, props) => {
    element.focus();
});

createDirective("tooltip", (element, props) => {
    element.setAttribute('title', props['is:tooltip']);
});

// Use in JSX:
<input is:autofocus />
<button is:tooltip="Click me">Hover</button>
```

### Mounting Applications

#### createRoot

Creates a root rendering scope with automatic cleanup:
```javascript
import { createRoot } from './jsx/jsx.mjs';

const dispose = createRoot((dispose) => {
    const node = <App />;
    document.body.appendChild(node);
    return dispose;
});

// Clean up everything when done
dispose();
```

#### mount

Convenience function for mounting to a parent element:
```javascript
import { mount } from './jsx/jsx.mjs';

const dispose = mount(document.body, () => {
    return <App />;
});

// Clean up
dispose();
```

### Namespaced Elements (SVG)

Use the `svg` helper for SVG elements:
```jsx
import { svg } from './jsx/jsx.mjs';

const circle = svg("circle", {
    cx: 50,
    cy: 50,
    r: 40,
    fill: "blue"
});
```

---

## API Reference

### Signals Module (`signals/signals.mjs`)

#### `signal(initialValue)`

Creates a mutable reactive signal.
```javascript
const count = signal(0);
```

**Methods:**
- `.get()` / `.value` - Read current value
- `.set(value)` / `.value = value` - Update value
- `.peek()` - Read without creating dependency
- `.notify()` - Manually trigger dependents
- `.sub(callback)` - Subscribe with effect (returns dispose function)

#### `computed(fn)`

Creates a derived reactive value.
```javascript
const doubled = computed(() => count.value * 2);
```

**Methods:**
- `.get()` / `.value` - Read current value (auto-updates)
- `.peek()` - Read without creating dependency
- `.reset(fn)` - Replace computation function

#### `effect(fn)`

Runs side effects that re-run when dependencies change.
```javascript
const dispose = effect(() => {
    console.log(signal.value);
    return () => {/* cleanup */};
});
```

**Returns:** Dispose function

#### `batch(fn)`

Batches multiple updates to run effects only once.
```javascript
batch(() => {
    signal1.set(1);
    signal2.set(2);
}); // Effects run once after both updates
```

#### `untracked(fn)`

Runs function without tracking dependencies.
```javascript
const value = untracked(() => signal.value);
```

#### `currentContext()`

Gets the current reactive context (for advanced use).
```javascript
const ctx = currentContext();
const scope = ctx.scope; // Access scope for keyed components
```

---

### JSX Module (`jsx/jsx.mjs`)

#### `jsx(tag, props, key?)`

Creates JSX elements (usually called by your JSX transform).
```javascript
// Typically you write:
<div>Hello</div>

// Transform calls:
jsx("div", {children: "Hello"})
```

#### `Fragment(props)`

Creates a document fragment with boundary markers.
```jsx
<Fragment>
    <p>Content</p>
</Fragment>
```

#### `createElement(tag, props)`

Creates a DOM element with props.
```javascript
const div = createElement("div", {
    class: "container",
    children: "Hello"
});
```

#### `svg(tag, props, key?)` / `xhtml(tag, props, key?)`

Creates elements with specific namespaces.
```jsx
import { svg } from './jsx/jsx.mjs';

const circle = svg("circle", {
    cx: 50,
    cy: 50,
    r: 40
});
```

#### `createRoot(fn)`

Creates a root rendering scope with automatic disposal.
```javascript
import { createRoot } from './jsx/jsx.mjs';

const dispose = createRoot((dispose) => {
    const node = <App />;
    document.body.appendChild(node);
    return dispose;
});

// Later:
dispose(); // Cleans up all effects
```

#### `mount(parent, fn)`

Mounts a component to a parent element.
```javascript
import { mount } from './jsx/jsx.mjs';

const dispose = mount(document.body, () => {
    return <App />;
});
```

#### `errorBoundary`

Global error boundary configuration.
```javascript
import { errorBoundary } from './jsx/jsx.mjs';

// Configure
errorBoundary.set('children', (node, err) => {
    node.innerHTML = `<error>${err.message}</error>`;
});

// Reset
errorBoundary.set('children', null);
```

**Types:** `'children'`, `'node'`, `'property'`

---

### Directives Module (`jsx/directives.mjs`)

#### `createDirective(name, handler)`

Creates a custom directive.
```javascript
import { createDirective } from './jsx/directives.mjs';

createDirective("autofocus", (element, props) => {
    element.focus();
});

// Use in JSX:
<input is:autofocus />
```

**Handler signature:** `(element: HTMLElement, props: object) => void`

---

## Advanced Patterns

### Custom Reactive Primitives

Build your own reactive abstractions:
```javascript
function createToggle(initial = false) {
    const value = signal(initial);
    return {
        get value() { return value.value; },
        toggle: () => value.set(!value.value),
        on: () => value.set(true),
        off: () => value.set(false)
    };
}

const darkMode = createToggle(false);
<button onClick={darkMode.toggle}>
    {() => darkMode.value ? "🌙" : "☀️"}
</button>
```

### Derived Signals with Setters
```javascript
function createDerivedSignal(source, {get, set}) {
    const derived = computed(get);
    return {
        get value() { return derived.value; },
        set value(v) { set(v, source); }
    };
}

const celsius = signal(0);
const fahrenheit = createDerivedSignal(celsius, {
    get: () => celsius.value * 9/5 + 32,
    set: (f) => celsius.set((f - 32) * 5/9)
});
```

### Reactive Collections
```javascript
function createReactiveArray(initial = []) {
    const items = signal(initial);
    return {
        get items() { return items.value; },
        push: (item) => items.set([...items.value, item]),
        remove: (index) => items.set(
            items.value.filter((_, i) => i !== index)
        ),
        update: (index, item) => items.set(
            items.value.map((x, i) => i === index ? item : x)
        )
    };
}
```

### Async Data Loading
```javascript
function createResource(fetcher) {
    const data = signal(null);
    const loading = signal(false);
    const error = signal(null);
    
    const load = async (...args) => {
        loading.set(true);
        error.set(null);
        try {
            const result = await fetcher(...args);
            data.set(result);
        } catch (err) {
            error.set(err);
        } finally {
            loading.set(false);
        }
    };
    
    return { data, loading, error, load };
}

const userResource = createResource(fetchUser);

function UserProfile() {
    return (
        <div>
            {() => userResource.loading.value ? (
                <div>Loading...</div>
            ) : userResource.error.value ? (
                <div>Error: {userResource.error.value.message}</div>
            ) : (
                <div>User: {userResource.data.value.name}</div>
            )}
        </div>
    );
}
```

---

## Best Practices

### 1. Use Keys for Lists

Always use keys when rendering dynamic lists:
```jsx
// ❌ Bad
{items.value.map(item => <div>{item}</div>)}

// ✅ Good
{items.value.map(item => <div key={item.id}>{item}</div>)}
```

### 2. Create Signals Outside Components

Avoid creating signals inside unkeyed component functions:
```jsx
// ❌ Bad: Creates new signal on every render
function Counter() {
    const count = signal(0);
    return <div>{count.value}</div>;
}

// ✅ Good: Signal created once
const count = signal(0);
function Counter() {
    return <div>{count.value}</div>;
}

// ✅ Also good: Use keyed components
function Counter() {
    const count = signal(0); // Safe with keys
    return <div>{count.value}</div>;
}
<Counter key="counter" />
```

### 3. Use Computed for Derived Values

Prefer computed over effects for derived state:
```jsx
// ❌ Bad: Using effect for derived value
const fullName = signal("");
effect(() => {
    fullName.set(`${first.value} ${last.value}`);
});

// ✅ Good: Using computed
const fullName = computed(() => `${first.value} ${last.value}`);
```

### 4. Batch Related Updates
```jsx
// ❌ Bad: Triggers 3 effect runs
items.set([]);
loading.set(false);
error.set(null);

// ✅ Good: Triggers 1 effect run
batch(() => {
    items.set([]);
    loading.set(false);
    error.set(null);
});
```

### 5. Clean Up Effects

Always clean up resources in effects:
```jsx
effect(() => {
    const timer = setInterval(() => {
        count.value++;
    }, 1000);
    
    return () => clearInterval(timer); // ✅ Cleanup
});
```

### 6. Use Error Boundaries in Production
```javascript
if (import.meta.env.PROD) {
    errorBoundary.set('children', (node, err) => {
        node.innerHTML = '<div>Something went wrong</div>';
        logErrorToService(err);
    });
} else {
    errorBoundary.set('children', (node, err) => {
        node.innerHTML = `<pre>${err.stack}</pre>`;
    });
}
```

---

## Performance Tips

### 1. Minimize Reactive Scope

Only make reactive what needs to be:
```jsx
// ❌ Wider reactive scope
<div>{() => `Count: ${count.value}`}</div>

// ✅ Minimal reactive scope
<div>Count: {count.value}</div>
```

### 2. Use Untracked for Constant Values
```javascript
const config = signal({theme: 'dark', ...});

computed(() => {
    // Read config once without tracking
    const cfg = untracked(() => config.value);
    return expensiveOperation(cfg);
});
```

### 3. Memoize Expensive Computations
```javascript
// Automatically memoized
const expensive = computed(() => {
    return heavyCalculation(signal.value);
}); // Only recalculates when signal changes
```

### 4. Batch DOM Operations
```javascript
batch(() => {
    width.set(100);
    height.set(200);
    color.set('blue');
}); // DOM updates once
```

---

## Complete Examples

### Todo App
```jsx
import { signal, computed } from './signals/signals.mjs';
import { mount } from './jsx/jsx.mjs';

function TodoApp() {
    const todos = signal([]);
    const filter = signal('all');
    
    const filteredTodos = computed(() => {
        const items = todos.value;
        switch (filter.value) {
            case 'active': return items.filter(t => !t.done);
            case 'completed': return items.filter(t => t.done);
            default: return items;
        }
    });
    
    let input;
    
    const addTodo = () => {
        if (!input.value.trim()) return;
        todos.set([...todos.value, {
            id: Date.now(),
            text: input.value,
            done: false
        }]);
        input.value = '';
    };
    
    const toggleTodo = (id) => {
        todos.set(todos.value.map(t =>
            t.id === id ? {...t, done: !t.done} : t
        ));
    };
    
    const removeTodo = (id) => {
        todos.set(todos.value.filter(t => t.id !== id));
    };
    
    return (
        <div class="todo-app">
            <h1>Todos</h1>
            
            <div class="input-group">
                <input
                    ref={el => input = el}
                    placeholder="What needs to be done?"
                    onKeyPress={e => e.key === 'Enter' && addTodo()}
                />
                <button onClick={addTodo}>Add</button>
            </div>
            
            <div class="filters">
                <button
                    class={() => ({active: filter.value === 'all'})}
                    onClick={() => filter.set('all')}
                >All</button>
                <button
                    class={() => ({active: filter.value === 'active'})}
                    onClick={() => filter.set('active')}
                >Active</button>
                <button
                    class={() => ({active: filter.value === 'completed'})}
                    onClick={() => filter.set('completed')}
                >Completed</button>
            </div>
            
            <ul class="todo-list">
                {() => filteredTodos.value.map(todo => (
                    <li key={todo.id} class={{done: todo.done}}>
                        <input
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => toggleTodo(todo.id)}
                        />
                        <span>{todo.text}</span>
                        <button onClick={() => removeTodo(todo.id)}>×</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

mount(document.body, () => <TodoApp />);
```

### Timer Component
```jsx
import { signal, effect } from './signals/signals.mjs';

function Timer() {
    const count = signal(0);
    const running = signal(false);
    
    effect(() => {
        if (!running.value) return;
        
        const timer = setInterval(() => {
            count.value++;
        }, 1000);
        
        return () => clearInterval(timer);
    });
    
    return (
        <div>
            <h1>{count.value}</h1>
            <button onClick={() => running.set(!running.value)}>
                {() => running.value ? 'Stop' : 'Start'}
            </button>
            <button onClick={() => count.set(0)}>Reset</button>
        </div>
    );
}
```

### Async Data Fetching
```jsx
function UserList() {
    const users = signal([]);
    const loading = signal(true);
    const error = signal(null);
    
    async function loadUsers() {
        loading.set(true);
        error.set(null);
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            users.set(data);
        } catch (err) {
            error.set(err);
        } finally {
            loading.set(false);
        }
    }
    
    // Load on mount
    effect(() => {
        loadUsers();
    });
    
    return (
        <div>
            {() => loading.value ? (
                <div>Loading...</div>
            ) : error.value ? (
                <div>Error: {error.value.message}</div>
            ) : (
                <ul>
                    {users.value.map(user => (
                        <li key={user.id}>{user.name}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

---

## TypeScript Support

Nimble works with TypeScript. Define JSX types:
```typescript
// jsx.d.ts
declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: any;
    }
    
    interface Directives {
        autofocus?: boolean;
        // Add custom directives
    }
}

// Component types
interface Props {
    name: string;
    count?: number;
    children?: any;
}

function MyComponent(props: Props) {
    return <div>{props.name}</div>;
}
```

---

## Migration Guide

### From React
```jsx
// React
const [count, setCount] = useState(0);

// Nimble
const count = signal(0);
count.set(1); // or count.value = 1

// React
const doubled = useMemo(() => count * 2, [count]);

// Nimble
const doubled = computed(() => count.value * 2);

// React
useEffect(() => {
    console.log(count);
}, [count]);

// Nimble
effect(() => {
    console.log(count.value);
});
```

### From Solid.js

Nimble is very similar to Solid.js! Main differences:
```jsx
// Solid
const [count, setCount] = createSignal(0);

// Nimble
const count = signal(0);
count.set(1);

// Solid - props are getters
function Component(props) {
    return <div>{props.name()}</div>;
}

// Nimble - props are direct values
function Component(props) {
    return <div>{props.name}</div>;
}
```

---

## FAQ

**Q: Do I need a build step?**
A: Yes, you need a JSX transform to convert JSX syntax to `jsx()` function calls.

**Q: How big is Nimble?**
A: The core library is approximately 10KB minified (signals + jsx + directives).

**Q: Can I use Nimble with existing libraries?**
A: Yes! Nimble plays well with other libraries. Mount Nimble components wherever you need them.

**Q: What about server-side rendering?**
A: Nimble is currently client-side only. SSR support may be added in the future.

**Q: How do I debug reactivity?**
A: Use browser developer tools to inspect signal values, or add console.log statements in effects and computed values.

**Q: Is Nimble production-ready?**
A: Nimble is currently experimental. Use it in production at your own discretion.

**Q: How does Nimble compare to React/Vue/Svelte?**
A: Nimble uses fine-grained reactivity like Solid.js, updating only what changed instead of re-rendering components. This can be more efficient but requires a different mental model.

---

## Contributing

[Add contribution guidelines]

## License

[Add license information]