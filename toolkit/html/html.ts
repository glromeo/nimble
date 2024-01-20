import {Atom} from '../atoms/atoms'
import htm from 'htm/mini'

type HTM = <HResult>(this: (type: any, props: Record<string, any>, ...children: any[]) => HResult, args: IArguments) => HResult | HResult[];

const replaceWithSlot = (node: HTMLSlotElement | Text) => {
    const slot = document.createElement('slot')
    node.parentElement!.replaceChild(slot, node)
    return slot
}
const replaceWithText = (node: HTMLSlotElement | Text, value: string) => {
    const text = document.createTextNode(value)
    node.parentElement!.replaceChild(text, node)
    return text
}

function syncElement(atom: Atom<any>, el: HTMLElement): Function {
    let value = atom.get() ?? ''
    let type = typeof value
    let slot: HTMLSlotElement | Text
    let update: FrameRequestCallback | null
    switch (type) {
        case 'bigint':
        case 'number':
        case 'string': {
            slot = el.appendChild(document.createTextNode(value as string))
            update = () => (slot as Text).data = value as string
            break
        }
        case 'boolean':
        case 'symbol': {
            slot = el.appendChild(document.createTextNode(''))
            update = null
            break
        }
        case 'function': {
            slot = el.appendChild(document.createElement('slot'))
            value(slot)
            update = () => value(slot)
            break
        }
        default:
            slot = el.appendChild(document.createElement('slot'))

    }
    return atom.sub(() => {
        value = atom.get() ?? ''
        if (typeof value !== type) switch (type = typeof value) {
            case 'bigint':
            case 'number':
            case 'string':
                update = () => {
                    if (slot.nodeType !== 3) slot = replaceWithText(slot, value as string)
                    update = () => (slot as Text).data = value as string
                }
                break
            case 'boolean':
            case 'symbol':
                update = () => {
                    if (slot.nodeType !== 3) slot = replaceWithText(slot, '')
                    update = null
                }
                break
            case 'function':
                update = () => {
                    if (slot.nodeType !== 1) slot = replaceWithSlot(slot)
                    value(slot)
                    update = () => value(slot)
                }
                break
            default:
                update = () => {
                    if (slot.nodeType !== 1) slot = replaceWithSlot(slot)
                }
        }
        if (update) {
            requestAnimationFrame(update)
        }
    })
}

function setAttribute(node: HTMLElement, name: string, value: any, hooks?: Function[]): void {
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            return node.setAttribute(name, value as string)
        case 'boolean':
            if (value) {
                return node.setAttribute(name, '')
            }
            return
        case 'symbol':
        case 'undefined':
            return
        case 'function':
            return setAttribute(node, name, value(node))
        default:
            if (value) {
                let update: FrameRequestCallback | undefined
                if (value.constructor === Array) {
                    const parts = value.map(function format(part: any, index: number): string {
                            switch (typeof part) {
                                case 'bigint':
                                case 'number':
                                case 'string':
                                    return String(part)
                                case 'function':
                                    return format(part(node), index)
                                default:
                                    if (part && part.atomId) {
                                        const atom = part as Atom<any>
                                        if (hooks) {
                                            update = update || function defaultUpdate() {
                                                node.setAttribute(name, parts.join(' '))
                                                update = defaultUpdate
                                            }
                                            hooks.push(atom.sub(() => {
                                                parts[index] = atom.get()
                                                if (update) {
                                                    requestAnimationFrame(update)
                                                    update = undefined
                                                }
                                            }))
                                        }
                                        return format(atom.get(), index)
                                    } else {
                                        return ''
                                    }
                            }
                        }
                    )
                    node.setAttribute(name, parts.join(' '))
                } else if (value.atomId) {
                    const atom = value as Atom<any>
                    if (hooks) {
                        let value = atom.get()
                        update = function defaultUpdate() {
                            setAttribute(node, name, value)
                            update = defaultUpdate
                        }
                        hooks.push(atom.sub(() => {
                            value = atom.get()
                            if (update) {
                                requestAnimationFrame(update)
                                update = undefined
                            }
                        }))
                        return setAttribute(node, name, value)
                    } else {
                        return setAttribute(node, name, atom.get())
                    }
                } else {
                    const parts = Object.entries(value).map(function format([key, part]: [string, any], index: number): string {
                            switch (typeof part) {
                                case 'bigint':
                                case 'number':
                                case 'string':
                                    return `${key}:${part}`
                                case 'function':
                                    return format(part(node), index)
                                default:
                                    if (part && part.atomId) {
                                        const atom = part as Atom<any>
                                        if (hooks) {
                                            update = update || function defaultUpdate() {
                                                node.setAttribute(name, parts.join(' '))
                                                update = defaultUpdate
                                            }
                                            hooks.push(atom.sub(() => {
                                                parts[index] = atom.get()
                                                if (update) {
                                                    requestAnimationFrame(update)
                                                    update = undefined
                                                }
                                            }))
                                        }
                                        return format(atom.get(), index)
                                    } else {
                                        return ''
                                    }
                            }
                        }
                    )
                    node.setAttribute(name, parts.join(';'))
                }
            } else {
                node.removeAttribute(name)
            }
    }
}

function setAttrs(node: HTMLElement, attrs: any, hooks?: Function[]):void {
    if (attrs.atomId) {
        const atom = attrs as Atom<any>
        if (hooks) {
            let value = atom.get()
            const update = () => {
                setAttrs(node, value)
            }
            hooks.push(atom.sub(() => {
                value = atom.get()
                requestAnimationFrame(update)
            }))
            return setAttrs(node, value)
        } else {
            return setAttrs(node, atom.get())
        }
    } else {
        for (const [name, value] of Object.entries(attrs)) {
            switch (name[0]) {
                case '0':
                    return
                case ':':
                case '.':
                    (node as any)[name.slice(1)] = value
                    continue
                case '@':
                    const event = name.slice(1)
                    node.addEventListener(event, value as any)
                    continue
                default:
                    setAttribute(node, name, value, hooks)
            }
        }
    }
}

const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'

function h(this: any, tag:string|any, attrs:any, ...children:any[]) {
    // console.log({type, props, children})
    if (typeof tag === 'object') {
        if (attrs.class && tag.attrs.class) {
            attrs.class = `${tag.attrs.class} ${attrs.class}`
        }
        if (attrs.style && tag.attrs.style) {
            attrs.style = `${tag.attrs.style}; ${attrs.style}`
        }
        return {
            ...tag,
            attrs: {
                ...tag.attrs,
                ...attrs
            }
        }
    }
    return {tag, attrs, children}
}

export function html(statics:TemplateStringsArray, ...fields:any[]) {
    const template: string | any | any[] = (htm as HTM).apply(h, arguments as any)
    // debugger;
    return (root: HTMLElement, defaultHooks?: Function[]) => {
        const hooks = defaultHooks ?? []
        let target: HTMLElement = root
        const stack = [template]
        while (stack.length) {
            const tos = stack.pop()
            if (tos === target) {
                target = target.parentElement!
                continue
            }
            switch (typeof tos) {
                case 'bigint':
                case 'number':
                case 'string':
                    target.appendChild(document.createTextNode(tos as string))
                    continue
                case 'boolean':
                case 'symbol':
                    continue
                case 'function':
                    stack.push(tos(target, hooks))
                    continue
                default:
                    if (tos) {
                        if (tos.constructor === Array) {
                            let t = tos.length
                            while (--t >= 0) stack.push(tos[t])
                        } else if (tos.atomId) {
                            hooks.push(syncElement(tos as Atom<any>, target))
                        } else if (tos instanceof Node) {
                            if ((tos as HTMLElement).shadowRoot?.contains(target)) {
                                continue
                            }
                            target.appendChild(tos.cloneNode(true))
                        } else {
                            const {tag, attrs, children} = tos
                            const namespaceURI = tag === "svg" ? SVG_NAMESPACE_URI : target.namespaceURI
                            const el = target.appendChild(
                                namespaceURI
                                    ? document.createElementNS(namespaceURI, tag)
                                    : document.createElement(tag)
                            ) as HTMLElement
                            if (attrs) {
                                setAttrs(el, attrs, hooks)
                            }
                            if (children) {
                                stack.push(el)
                                target = el
                                let t = children.length
                                while (--t >= 0) stack.push(children[t])
                            }
                        }
                    }
            }
        }
        if (hooks !== defaultHooks) {
            return () => hooks.forEach(h => h())
        }
    }
}
