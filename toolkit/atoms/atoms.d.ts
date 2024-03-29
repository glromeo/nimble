export type Atom<V, A extends unknown[] = [V], R = void> = {
    atomId: string
    init?: V
    read?: Read<V>
    write?: Write<A, R>
    on?: (event: 'bind', action: (scope:Scope) => Function) => Atom<V,A,R>
}

export type Getter = <V>(atom: Atom<V>) => V
export type Setter = <V>(atom: Atom<V>, value: V) => void

export type Read<V> = (get: Getter) => V
export type Write<A extends unknown[], R> = (get: Getter, set: Setter, ...args: A) => R

export type AtomState<V> = {
    value: V | Symbol
    listeners: Set<() => void> | null
}

export function atom<V, A extends unknown[] = [V], R = void>(read: V | Read<V> | void, write?: Write<A, R>): Atom<V, A, R>;

export type Scope = {
    get: Getter
    set: Setter
    bind: <V>(atom: Atom<V>, callback: () => void) => void
    unbind: (<V>(atom: Atom<V>, callback?: () => void) => void)
        | (<V>(atom: Atom<V>) => void)
        | ((callback?: () => void) => void)
}
