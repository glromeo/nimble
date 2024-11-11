# JSX.Element 

JSX elements are DOM nodes result of plain jsx evaluation

```jsx
<div class="container">
    <button style="color: white; background: red;">Click Me!</button>
</div>
```

```js
jsx("div", {
    class: "container", 
    children: jsx("button", { 
        style: "color: white; background: red;", 
        children: "Click Me!" 
    }) 
})
```

or the result of invoking a constructor function passing it the parameters as arguments

```jsx
<div class="container">
    <Button type="danger">Click Me!</Button>
</div>

function Button({type}) {
    if (type === "danger") {
        return <button style="color: white; background: red;">Click Me!</button>
    } else {
        return <button style="color: white; background: green;">Click Me!</button>
    }
}
```

```js
jsx("div", {
    class: "container", 
    children: jsx(Button, { 
        style: "color: white; background: red;", 
        children: "Click Me!" 
    }) 
})
```

### this
When the component function is invoked `this` is bound to the scope of that component
corresponding to the context of the function. 
The scope is an object used to easily access by key the nodes defined in that scope
as well as access the properties with which that scope has been declared in a reactive way.

```js
function Button() {
    return <button style={`"color: white; background: ${() => this.type === "danger" ? "red" : "green"};"`}>Click Me!</button>
}   
```

Reactivity comes from the usage of signals and to simplify signals usage in nimble
functions passed as values to properties are wrapped into computed signals.

```js
function Button() {
    const background = computed(() => this.type === "danger" ? "red" : "green");
    return <button style={`"color: white; background: ${background};"`}>Click Me!</button>
}   
```

If you prefer the arrow notation you can still access the signals from the props parameter

```js
const Button = props => {
    const background = computed(() => props.type === "danger" ? "red" : "green");
    return <button style={`"color: white; background: ${background};"`}>Click Me!</button>
}   
```

Then why writing functions and using **this**? Because it makes it easy to define signals just using arrow functions!

**BE AWARE** though that if you destructure the parameter or if you just access the props 
within the body of the function no re-rendering will take place!

```js
// THIS COMPONENT WILL NEVER CHANGE BACKGROUND !!! IT STAYS AS IT WAS AT TIME OF CREATION....
const StaticButton = ({type}) => {
    const background = computed(() => type === "danger" ? "red" : "green");
    return <button style={`"color: white; background: ${background};"`}>Click Me!</button>
}   
```

> In a nutshell:
> 
> **props** are for initialization, **signals** are for updates

NOTE: nimble **will** checks that the computed signal is actually mutable and if not it outputs a warning to the console

TODO: I have to implement that ^^^
