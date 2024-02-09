import {atom, globals} from '../atoms/atoms.mjs'

export const HOLE = '\x01'
export const TEXT_NODE = document.createTextNode('')
export const I_NODE = document.createElement('i-node')

const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

export function createElement(tag, namespaceURI) {
    if (tag === 'svg') {
        return document.createElementNS(SVG_NAMESPACE_URI, tag)
    } else if (namespaceURI) {
        return document.createElementNS(namespaceURI, tag)
    } else {
        return document.createElement(tag)
    }
}

export const HOOK_NODE = 1
export const HOOK_ATTR = 2
export const HOOK_TEXT = 3
export const HOOK_QUOTE = 4

const globalScope = connect(globals)

const scopes = new WeakMap([[globals, globalScope]])

function bindElement(node, hooks, args, scope = globalScope, bindings) {
    let a = args.length
    let h = hooks.length
    while (--h) {
        if (h === 1) {
            node = node.parentNode
            h = hooks[0]
            if (!(hooks = hooks[1])) {
                h = 1
            }
        } else {
            const [key, hook, holes] = hooks[h]
            if (typeof hook === 'number') {
                let value
                if (holes) {
                    value = []
                    for (let max = a, i = a -= holes; i < max; i++) {
                        value.push(args[i])
                    }
                } else {
                    value = args[--a]
                }
                try {
                    if (hook === HOOK_NODE || hook === HOOK_TEXT) {
                        scope[hook](node.childNodes[key], value, bindings)
                    } else {
                        scope[hook](node, key, value, bindings)
                    }
                } catch (e) {
                    if (hook === HOOK_NODE || hook === HOOK_TEXT) {
                        console.error('unable to hook node', node.childNodes[key], 'with', value, e)
                    } else {
                        console.error('unable to hook attr', node.getAttributeNode(key), 'with', value, e)
                    }
                }
            } else {
                node = node.childNodes[key]
                hooks = hook
                h = hooks.length
            }
        }
    }
}

customElements.define('h-root', class extends HTMLElement {

    connect(atoms) {
        if (!(this.scope = scopes.get(atoms))) {
            scopes.set(atoms, this.scope = connect(atoms))
        }
    }

    connectedCallback() {
        if (this.isConnected) {
            const {hooks, args, scope = globalScope} = this
            if (hooks) {
                const bindings = []
                bindElement(this, hooks, args, scope, bindings)
                if (bindings.length) {
                    this.unbind = () => bindings.forEach(scope.unbind)
                } else {
                    this.unbind = null
                }
            }
        }
    }

    disconnectedCallback() {
        if (!this.isConnected) {
            this.unbind?.()
        }
    }
})

function connect(atoms) {

    const {get, set, bind, unbind} = atoms

    const scope = {
        [HOOK_NODE]: setNode,
        [HOOK_TEXT](node, values, bindings) {
            hookHoley(node, 'data', values, bindings)
        },
        [HOOK_ATTR](node, key, value, bindings) {
            if (key) switch (key[0]) {
                case ':':
                case '.':
                    return setProperty(node, key.slice(1), value, bindings)
                case '@':
                    return setHandler(node, key.slice(1), value, bindings)
                default:
                    return setAttr(node, key, value, bindings)
            } else {
                return spreadAttr(node, value, bindings)
            }
        },
        [HOOK_QUOTE](node, name, values, bindings) {
            hookHoley(node.getAttributeNode(name), 'value', values, bindings)
        },
        unbind
    }

    function hookHoley(node, field, values, bindings) {
        if (bindings) {
            const strings = node[field].split(HOLE)
            let af = 0
            const update = () => {
                let text = strings[0]
                let i = 0;
                while (i < values.length) {
                    text = `${text}${format(values[i])}${strings[++i]}`
                }
                node[field] = text
                af = 0
            }
            for (let i = 0; i < values.length; ++i) {
                if (values[i] instanceof atom) {
                    const atom = values[i]
                    bindings.push(bind(get => {
                        values[i] = get(atom)
                        af ||= requestAnimationFrame(update)
                    }))
                }
            }
            update()
        } else {
            let v = 0
            node[field] = node[field].replaceAll(HOLE, () => format(values[v++]))
        }
    }

    function setNode(node, value, bindings) {
        value = value ?? ''
        switch (typeof value) {
            case 'bigint':
            case 'number':
            case 'string':
                if (node.nodeType === 3) {
                    node.data = value
                    return node
                } else {
                    value = document.createTextNode(value)
                    node.replaceWith(value)
                    return value
                }
            case 'function':
                return setNode(node, value.call(atoms, node), bindings)
            case 'object':
                if (value instanceof atom) {
                    const atom = value
                    if (bindings) {
                        let pending = true
                        const update = () => pending = !(node = setNode(node, value))
                        bindings.push(
                            bind(get => {
                                value = get(atom)
                                pending ||= requestAnimationFrame(update)
                            })
                        )
                        update()
                        return node
                    } else {
                        return node = setNode(node, get(atom))
                    }
                }
                if (value instanceof Node && !value.shadowRoot?.contains(node)) {
                    if (value.tagName === 'H-ROOT') {
                        const root = {childNodes: [...value.childNodes]}
                        node.replaceWith.apply(node, root.childNodes)
                        const {hooks, args} = value
                        if (hooks) {
                            bindElement(root, hooks, args, scope, bindings)
                        }
                        return root.childNodes[0]
                    } else {
                        node.parentNode.replaceChild(value, node)
                        return value
                    }
                }
                if (value[Symbol.iterator]) {
                    if (node.nodeType === 3) {
                        let last = node
                        for (const v of value) {
                            const next = last.splitText(0)
                            setNode(last, v, bindings)
                            last = next
                        }
                    } else {
                        node.replaceWith(node = I_NODE.cloneNode(true))
                        for (const v of value) {
                            setNode(node.appendChild(TEXT_NODE.cloneNode(true)), v, bindings)
                        }
                    }
                    return node
                }
                if (value.tag) {
                    const {tag, attrs, children} = value
                    const el = createElement(tag)
                    if (attrs) {
                        spreadAttr(el, attrs, bindings)
                    }
                    for (const name of node.getAttributeNames()) {
                        let attribute = node.getAttribute(name)
                        el.setAttribute(name, attribute)
                    }
                    const className = node.getAttribute('class')
                    if (className) {
                        el.setAttribute('class', `${attrs.class} ${className}`)
                    }
                    const style = node.getAttribute('style')
                    if (style) {
                        el.setAttribute('style', `${attrs.style};${style}`)
                    }
                    if (children) {
                        for (const c of children) {
                            setNode(el.appendChild(TEXT_NODE.cloneNode(true)), c, bindings)
                        }
                    }
                    node.replaceWith(el)
                    return node
                }
            default:
                if (node.nodeType === 3) {
                    node.data = ''
                } else {
                    node.replaceWith(node = TEXT_NODE.cloneNode(true))
                }
                return node
        }
    }

    function spreadAttr(node, value, bindings) {
        if (value instanceof atom) {
            if (bindings) {
                bindings.push(
                    bind(get => spreadAttr(node, get(value)))
                )
            } else {
                spreadAttr(node, get(value))
            }
        } else if (typeof value === 'object' && value.constructor !== Array) {
            for (const entry of Object.entries(value)) {
                const [name, value] = entry
                setAttr(node, name, value, bindings)
            }
        }
    }

    function setProperty(node, name, value, bindings) {
        if (value instanceof atom) {
            if (bindings) {
                bindings.push(
                    bind(get => node[name] = get(value))
                )
            } else {
                node[name] = get(value)
            }
        } else {
            node[name] = value
        }
    }

    function setHandler(node, event, value, bindings) {
        if (value instanceof atom) {
            const atom = value
            if (bindings) {
                bindings.push(
                    bind(get => {
                        node.removeEventListener(event, value)
                        node.addEventListener(event, value = get(atom))
                    })
                )
            } else {
                node.addEventListener(event, value = get(atom))
            }
        } else if (typeof value === 'function') {
            node.addEventListener(event, value)
        }
    }

    function format(value) {
        switch (typeof value) {
            case 'bigint':
            case 'number':
            case 'string':
                return value
            case 'object':
                if (value instanceof atom) {
                    return format(get(value))
                }
            default:
                return ''
        }
    }

    function setAttr(node, name, value, bindings) {
        value = value ?? ''
        switch (typeof value) {
            case 'bigint':
            case 'number':
            case 'string':
                return node.setAttribute(name, value)
            case 'boolean':
                if (value) {
                    return node.setAttribute(name, '')
                } else {
                    return node.removeAttribute(name)
                }
            case 'function':
                return setAttr(node, name, value(node))
            case 'object':
                if (value instanceof atom) {
                    const atom = value
                    if (bindings) {
                        bindings.push(
                            bind(queueAnimationFrame(get => {
                                node = setAttr(node, name, get(atom))
                            }))
                        )
                        return node
                    } else {
                        return node = setAttr(node, name, get(atom))
                    }
                }
                if (value[Symbol.iterator]) {
                    const parts = []
                    const queueUpdate = bindings && queueAnimationFrame(() => {
                        node.setAttribute(name, parts.join(' '))
                    })
                    for (const part of value) {
                        if (part instanceof atom) {
                            if (bindings) {
                                const p = parts.length++
                                bindings.push(
                                    bind(get => {
                                        parts[p] = format(get(part))
                                        queueUpdate()
                                    })
                                )
                            } else {
                                parts.push(format(get(part)))
                            }
                        } else {
                            parts.push(format(part))
                        }
                    }
                    return node.setAttribute(name, parts.join(' '))
                }
                const parts = []
                const queueUpdate = bindings && queueAnimationFrame(() => {
                    node.setAttribute(name, parts.join(';'))
                })
                for (const [key, part] of Object.entries(value)) {
                    if (part instanceof atom) {
                        if (bindings) {
                            const p = parts.length++
                            bindings.push(
                                bind(get => {
                                    parts[p] = `${key}:${format(get(part))}`
                                    queueUpdate()
                                })
                            )
                        } else {
                            parts.push(`${key}:${format(get(part))}`)
                        }
                    } else {
                        parts.push(`${key}:${format(part)}`)
                    }
                }
                return node.setAttribute(name, parts.join(';'))
            default:
                return node.removeAttribute(name)
        }
    }

    return scope
}