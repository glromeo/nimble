type Getter = <V>(atom: Atom<V>) => V
type Setter = <V>(atom: Atom<V>, value: V) => void

type Read<V> = (get: Getter) => V
type Write<A extends unknown[], R> = (get: Getter, set: Setter, ...args: A) => R

export class Atom<V, A extends unknown[] = [V], R = void> {
    static counter = 0

    public atomId: string
    public init?: V
    public read?: Read<V>
    public write?: Write<A, R>

    constructor(r?: any, w?: any, x?: any) {
        let id
        if (typeof r === 'string' && arguments.length > 1) {
            id = r
            r = w
            w = x
        } else {
            id = `atom<${Atom.counter}>`
        }
        if (typeof r === 'function') {
            this.atomId = id
            this.read = r
            this.write = r
        } else {
            this.atomId = id
            this.init = r
            this.write = w
        }
        ++Atom.counter
    }
}

const VOID = Symbol()

type AtomState<V> = {
    value: V | typeof VOID
    listeners: Set<() => void> | null
}

export function createStore() {

    const store = new WeakMap<Atom<any>, AtomState<any>>()

    function read<V>(state: AtomState<V>, read: Read<V>): V {

        let dependencies = new Set<AtomState<any>>()

        function refresh() {
            const value = state.value
            if (dependencies.size) {
                const previous = dependencies
                dependencies = new Set<AtomState<any>>()
                state.value = read(getter)
                for (const dependency of previous) {
                    if (!dependencies.has(dependency)) {
                        dependency.listeners!.delete(refresh)
                    }
                }
            } else {
                state.value = read(getter)
            }
            if (!Object.is(value, state.value)) {
                state.listeners?.forEach(cb => cb())
            }
        }

        function getter(a: Atom<any>) {
            const value = get(a)
            const state = store.get(a)!
            dependencies.add(state)
            if (state.listeners) {
                state.listeners.add(refresh)
            } else {
                state.listeners = new Set([refresh])
            }
            return value
        }

        return read(getter)
    }

    function get<V>(atom: Atom<V>): V {
        let state: AtomState<V> | undefined = store.get(atom)
        if (!state) {
            store.set(atom, state = {
                value: VOID,
                listeners: null
            })
        }
        if (state.value === VOID) {
            if (atom.read) {
                state.value = read(state, atom.read)
            } else {
                state.value = atom.init!
            }
        }
        return state.value
    }

    function sub<V>(atom: Atom<V>, listener: () => void) {
        let state = store.get(atom)
        if (!state) {
            get(atom)
            state = store.get(atom)!
        }
        state.listeners?.add(listener) || (state.listeners = new Set([listener]))
        return () => {
            state!.listeners?.delete(listener)
        }
    }

    function set<V, A extends unknown[] = [V], R = void>(atom: Atom<V, A, R>, ...args: A): R {
        if (atom.write) {
            return atom.write(get, set, ...args)
        } else {
            const state = store.get(atom as Atom<V, [V], R>)
            if (atom.read) {
                if (!state) {
                    return <R>undefined
                }
                state.value = VOID
            } else {
                const value = args[0]
                if (!state) {
                    store.set(atom as Atom<V, [V], R>, {
                        value: value,
                        listeners: null
                    })
                    return <R>undefined
                }
                if (Object.is(value, state.value)) {
                    return <R>undefined
                }
                state.value = value
            }
            state!.listeners?.forEach(cb => cb())
        }
        return <R>undefined
    }

    function debug<V>(atom: Atom<V>): AtomState<V> | undefined {
        return store.get(atom)
    }

    return {debug, get, set, sub}
}

export type Store = ReturnType<typeof createStore>

export const defaultStore = createStore()

export function atom<V, A extends unknown[] = [V], R = void>(id: string, read: V | Read<V> | void, write?: Write<A, R>): Atom<V, A, R>;
export function atom<V, A extends unknown[] = [V], R = void>(read: V | Read<V> | void, write?: Write<A, R>): Atom<V, A, R>;

export function atom() {
    switch (arguments.length) {
        case 0:
            return new Atom()
        case 1:
            return new Atom(arguments[0])
        case 2:
            return new Atom(arguments[0], arguments[1])
        case 3:
            return new Atom(arguments[0], arguments[1], arguments[2])
        default:
            throw new TypeError(`invalid call to atom() creator with ${arguments.length} arguments`)
    }
}
