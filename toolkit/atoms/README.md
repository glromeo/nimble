# Atoms

I fell in love with Atoms (aka Signals) since I first saw [this video](https://youtu.be/_ISAA_Jt9kI)
on [Recoil](https://recoiljs.org/)
and I have been using them since the beginning of 2023.
My library of choice was [Jotai](https://jotai.org/) because of the beautiful API...and when like me, you like your
coding, the enjoyment is using an API is second only to the need for speed!
Not that Jotai is perfect but it gets pretty close. I have used
also [Preact signals](https://preactjs.com/guide/v10/signals/)
but I find it less pleasant to envision scopes with it since the signal (and effect) definition is pretty much bound
to the module you import.
Jotai is building rapidly an ecosystem of utility modules around it which I don't personally like because most of them
are just a little bit of syntactic sugar which hardly works for every situation.
On top of it the implementation of the vanilla library has some room for performance improvement and the react hooks
are way too cumbersome (to get decent peformance I had to implement myself ones based
on [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
folloing the example of Preact signals ...big thank you there!).
With the experience I got in using them I decided to take a stab at rolling out my own version of Jotai like atoms
and now that my implementation is complete here is how it performs.

|              | Jotai   | mine    |
|--------------|---------|---------|
| **duration** | 9.30sec | 0.91sec |
| rss          | 654M    | 175M    |
| heapTotal    | 622M    | 146M    |
| heapUsed     | 489M    | 116M    |
| external     | 1.5M    | 1.6M    |

**mine** is roughly **10** times faster, using **1/4** of the memory

> The benchmark creates a binary tree 16 level deep (64k nodes) where the leaves are primitive and for 100k times
> changes the other 3rd of these to trigger an update of the subscriber that looking at the root node

I do believe the runtime around the atoms won't be the major bottleneck but I still see value in betting on my own
solution rather than leaning on the more established version also because I want to be able to tweak its internals
as I see it fit

## What are atoms?

**Atoms** are values stored in a **WeakMap** which I like to call a **molecule**. An atom can be primitive or derived.
A primitive atom refers to a value while a derived atom refers to a computation but atoms don't actually store 
values or results, they are purely keys in a map, they make sense within a molecule.
You can think of the molecule as a scope, a context in which certain variables (the atoms) have certain values
and these values change over time according to rules defined by derived atoms and the values that are directly
set on the primitive atoms.

```javascript 
const p = atom(5) // is an example of primitive
```
**p** is an object that's used as a key to look up the value of the atom in a molecule

```javascript
const {get, set} = molecule()
const p = atom(9)

console.log(get(p))  // prints 9 
set(p, 5)
console.log(get(p))  // prints 5
```
A derived atom allows to perform computations and the intermediate values of these computations
are cached in the WeakMap so unless there is an actual change being propagated the function
that defines a derived atom value is not invoked

```javascript
const d = atom(get => get(num) * 2)
console.log(scope.get(d))  // prints 10 
```

To define multiple scopes is as easy as creating as many molecules as needed

```javascript
const scope1 = molecule()
const scope2 = molecule()
const num = atom(9)

scope1.set(num, 5)
scope2.set(num, 10)

console.log(scope1.get(num))  // prints 5 
console.log(scope2.get(num))  // prints 10
```

Atoms can be observed for change in the scope the listener is bound to,
changes to the same atom in another scope won't be notified to that listener

```javascript
scope1.bind(num, () => console.log('num has changed in scope 1'))
scope2.bind(num, () => console.log('num has changed in scope 2'))

scope1.set(num, 42) // prints 'num has changed in scope 1' and nothing else
```
with **bind**, differently from Jotai's **sub** the links between the listener and the atoms are kept withing 
a set of bindings in the molecule. 
There are the `unbind` and `dispose` functions available on every molecule. 

