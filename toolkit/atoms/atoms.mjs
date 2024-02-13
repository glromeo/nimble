export function molecule() {

    const store = new WeakMap()

    function init(atom) {
        const state = {
            atom,
            value: atom.init,
            observers: null,
            listeners: null,
            stale: false
        }
        if (atom.read) {
            state.dependencies = new Set()
            const getter = (atom) => {
                const value = get(atom)
                const dependency = store.get(atom)
                state.dependencies.add(dependency)
                if (dependency.observers) {
                    dependency.observers.add(state)
                } else {
                    dependency.observers = new Set([state])
                }
                return value
            }
            state.stale = true
            state.refresh = () => {
                const {value, dependencies, listeners} = state
                state.dependencies = new Set()
                state.value = atom.read(getter)
                const finalize = () => {
                    for (const dependency of dependencies) {
                        if (!state.dependencies.has(dependency)) {
                            remove(dependency, state)
                        }
                    }
                    state.stale = false
                    if (listeners && !Object.is(value, state.value)) {
                        for (const listener of listeners) {
                            listener(state.value)
                        }
                    }
                    return state.value
                }
                if (state.value?.then) {
                    return state.value.then(resolved => {
                        state.value = resolved
                        return finalize()
                    })
                } else {
                    return finalize()
                }
            }
        }
        return state
    }

    function remove(state, observer) {
        if (state.observers?.delete(observer) && state.observers.size === 0 && !state.listeners?.length) {
            state.observers = null
            if (state.dependencies) {
                for (const dependency of state.dependencies) remove(dependency, state)
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function get(atom) {
        let state = store.get(atom)
        if (state === undefined) {
            store.set(atom, state = init(atom))
        }
        return state.stale ? state.refresh() : state.value
    }

    function notify(state, pending) {
        if (!state.stale) {
            state.stale = true
            if (state.listeners) {
                pending.push(state)
            }
            if (state.observers) for (const observer of state.observers) {
                notify(observer, pending)
            }
        }
    }

    function set(atom, ...args) {
        if (atom.write) {
            return atom.write(get, set, ...args)
        } else if (atom.read === undefined) {
            const value = args[0]
            if (value?.then) {
                return value?.then(value => set(atom, value))
            }
            let state = store.get(atom)
            if (state === undefined) {
                store.set(atom, state = init(atom))
            }
            if (!Object.is(value, state.value)) {
                state.value = value
                const pending = []
                if (state.observers) {
                    for (const observer of state.observers) notify(observer, pending)
                }
                if (state.listeners) {
                    for (const listener of state.listeners) listener(state.value)
                }
                for (const state of pending) {
                    if (state.stale) state.refresh()
                }
            }
            return state.value
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const bound = new Map()

    function bind(atom, listener) {
        let state = store.get(atom)
        if (!state) {
            const value = get(atom)
            if (value?.then) {
                return value.then(() => mount(store.get(atom), listener))
            }
        }
        return mount(store.get(atom), listener)
    }

    function mount(state, listener) {
        if (state.listeners) {
            state.listeners.push(listener)
        } else {
            state.listeners = [listener]
            if (!bound.has(state)) {
                bound.set(state, atom.onbind?.(get, set))
            }
        }
        if (state.dependencies) {
            for (const dependency of state.dependencies) mount(dependency, state.refresh)
        }
        return () => unbind(state, listener)
    }

    function unbind(state, listener) {
        if (state.listeners) {
            if (state.listeners.length === 1) {
                if (state.listeners[0] === listener) {
                    if (state.dependencies) {
                        for (const dependency of state.dependencies) {
                            remove(dependency, state)
                            unbind(dependency, state.listeners)
                        }
                    }
                    state.listeners = null
                    bound.get(state)?.()
                    return bound.delete(state)
                }
            } else {
                const index = state.listeners.indexOf(listener)
                if (index >= 0) {
                    state.listeners.splice(index, 1)
                }
            }
        }
    }

    return {
        peek: store.get.bind(store),
        get,
        set,
        bind,
        unbind(atom, listener) {
            let state = store.get(atom)
            if (state) {
                if (listener) {
                    return unbind(state, listener)
                } else {
                    if (state.listeners) {
                        for (const listener of state.listeners) unbind(state, listener)
                    }
                    return true
                }
            }
        },
        dismiss() {
            if (bound.size) {
                for (const [state] of bound) {
                    if (state.listeners) {
                        for (const listener of state.listeners) unbind(state, listener)
                    }
                }
                return true
            }
        }
    }
}

let counter = 0

const on = function(event, action) {
    this[`on${event}`] = action
    return this
}

export function atom() {
    return {
        constructor: atom,
        id: this ?? `atom<${counter++}>`,
        [typeof arguments[0] === 'function' ? 'read' : 'init']: arguments[0],
        write: arguments[1],
        on
    }
}

export const globals = molecule()