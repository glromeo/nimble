function remove(state, observer) {
    if (state.observers?.delete(observer) && state.observers.size === 0 && !state.listeners?.size) {
        state.observers = null;
        if (state.dependencies) {
            for (const dependency of state.dependencies) remove(dependency, state);
        }
    }
}

function notify(state, pending) {
    if (!state.stale) {
        state.stale = true;
        if (state.listeners) {
            pending.push(state);
        }
        if (state.observers) for (const observer of state.observers) {
            notify(observer, pending);
        }
    }
}

export class Scope extends WeakMap {

    constructor() {
        super();
        this.bound = new Map();
        this.get = this.get.bind(this);
        this.set = this.set.bind(this);
        this.bind = this.bind.bind(this);
        this.peek = super.get.bind(this);
    }

    init(atom) {
        const state = {
            atom,
            value: atom.init,
            observers: null,
            listeners: null,
            stale: false
        };
        if (atom.read) {
            state.dependencies = new Set();
            const getter = (atom) => {
                const value = this.get(atom);
                const dependency = super.get(atom);
                state.dependencies.add(dependency);
                if (dependency.observers) {
                    dependency.observers.add(state);
                } else {
                    dependency.observers = new Set([state]);
                }
                return value;
            };
            state.stale = true;
            state.refresh = () => {
                const {value, dependencies, listeners} = state;
                state.dependencies = new Set();
                state.value = atom.read(getter);
                const finalize = () => {
                    for (const dependency of dependencies) {
                        if (!state.dependencies.has(dependency)) {
                            remove(dependency, state);
                        }
                    }
                    state.stale = false;
                    if (listeners && !Object.is(value, state.value)) {
                        for (const listener of listeners) {
                            listener(state.value);
                        }
                    }
                    return state.value;
                };
                if (state.value?.then) {
                    return state.value.then(resolved => {
                        state.value = resolved;
                        return finalize();
                    });
                } else {
                    return finalize();
                }
            };
        }
        return state;
    }

    get(atom) {
        let state = super.get(atom);
        if (state === undefined) {
            super.set(atom, state = this.init(atom));
        }
        return state.stale ? state.refresh() : state.value;
    }

    set(atom, ...args) {
        if (atom.write) {
            return atom.write(this.get, this.set, ...args);
        } else if (atom.read === undefined) {
            const value = args[0];
            if (value?.then) {
                return value?.then(value => this.set(atom, value));
            }
            let state = super.get(atom);
            if (state === undefined) {
                super.set(atom, state = this.init(atom));
            }
            if (!Object.is(value, state.value)) {
                state.value = value;
                const pending = [];
                if (state.observers) {
                    for (const observer of state.observers) notify(observer, pending);
                }
                if (state.listeners) {
                    for (const listener of state.listeners) listener(state.value);
                }
                for (const state of pending) {
                    if (state.stale) state.refresh();
                }
            }
            return state.value;
        }
    }

    bind(atom, listener) {
        let state = super.get(atom);
        if (!state) {
            const value = this.get(atom);
            if (value?.then) {
                return value.then(() => this.#mount(super.get(atom), listener));
            }
        }
        return this.#mount(super.get(atom), listener);
    }

    #mount(state, listener) {
        if (state.listeners === null) {
            state.listeners = new Set();
            this.bound.set(state, state.atom.onbind?.(this.get, this.set));
        }
        state.listeners.add(listener);
        if (state.dependencies) {
            for (const dependency of state.dependencies) this.#mount(dependency, state.refresh);
        }
        return () => this.#unbind(state, listener);
    }

    #unbind(state, listener) {
        if (state.listeners?.delete(listener) && !state.listeners.size) {
            if (state.dependencies) {
                for (const dependency of state.dependencies) {
                    remove(dependency, state);
                    this.#unbind(dependency, state.refresh);
                }
            }
            state.listeners = null;
            this.bound.get(state)?.();
            return this.bound.delete(state);
        }
    }

    unbind(atom, listener) {
        let state = super.get(atom);
        if (state) {
            if (listener) {
                return this.#unbind(state, listener);
            } else {
                if (state.listeners) {
                    for (const listener of state.listeners) this.#unbind(state, listener);
                }
                return true;
            }
        }
    }

    dismiss() {
        if (this.bound.size) {
            for (const [state] of this.bound) {
                if (state.listeners) {
                    for (const listener of state.listeners) this.#unbind(state, listener);
                }
            }
            return true;
        }
    }
}

let counter = 0;

export function Atom(name, init, read, write) {
    this.name = name;
    this[init] = read;
    this.write = write;
}

export function atom(read, write) {
    return new Atom(
        this ?? `atom<${counter++}>`,
        typeof read === "function" ? "read" : "init",
        read,
        write
    );
}

export const globalScope = new Scope();
