import {atom, atomTag} from '../atoms/atoms.mjs'

import {
    CHILD_NODE,
    HOLE,
    HOOK_ATTR,
    HOOK_COMMENT,
    HOOK_NODE,
    HOOK_QUOTE,
    HOOK_VALUE,
    PARENT_NODE,
    parseHTML,
    PLACEHOLDER_NODE,
    SVG_NAMESPACE_URI
} from './parseHTML.mjs'

const CACHE = new WeakMap()

const slice = Array.prototype.slice

export function htmlOld(strings) {
    if (!strings) {
        return null
    }
    if (!strings.raw) {
        const scope = strings
        return function () {
            return htmlOld.apply(scope, arguments)
        }
    }
    let render = CACHE.get(strings)
    if (render === undefined) {
        const queue = parseHTML(strings.join(HOLE))
        CACHE.set(strings, render = (scope, args) => {
            const fragment = queue[0].cloneNode(true)
            let node = fragment
            let a = 1
            for (let q = 1; q < queue.length; ++q) switch (queue[q]) {
                case CHILD_NODE:
                    node = node.childNodes[queue[++q]]
                    continue
                case PARENT_NODE:
                    node = node.parentNode
                    continue
                case HOOK_NODE:
                    hookNode(scope, node.childNodes[queue[++q]], args[a++])
                    continue
                case HOOK_ATTR:
                    hookAttr(scope, node, args[a++])
                    continue
                case HOOK_VALUE:
                    hookValue(scope, node, queue[++q], args[a++])
                    continue
                case HOOK_QUOTE: {
                    const attrNode = node.getAttributeNode(queue[++q])
                    const strings = attrNode.value.split(HOLE)
                    hookText(scope, attrNode, 'value', strings, slice.call(args, a, a += strings.length - 1))
                    continue
                }
                case HOOK_COMMENT: {
                    const childNode = node.childNodes[queue[++q]]
                    const strings = childNode.data.split(HOLE)
                    hookText(scope, childNode, 'data', strings, slice.call(args, a, a += strings.length - 1))
                    continue
                }
            }
            return fragment
        })
    }
    if (this) {
        return render(this, arguments)
    } else {
        const args = arguments
        return scope => render(scope, args)
    }
}

function hookNode(scope, node, value) {
    const type = typeof value
    if (type === 'function') {
        hookNode(scope, node, value.call(scope, node))
        return
    }
    if (type === 'object' && value !== null) {
        if (value[atomTag]) {
            let pending
            const update = () => {
                node = updateNode(scope, node, scope.get(value))
                pending = 0
            }
            scope.bind(value, () => pending ||= requestAnimationFrame(update))
            update()
            return
        }
        if (value[Symbol.iterator]) {
            const fragment = document.createDocumentFragment()
            for (const item of value) {
                hookNode(scope, fragment.appendChild(PLACEHOLDER_NODE.cloneNode()), item)
            }
            node.replaceWith(fragment)
            return
        }
    }
    updateNode(scope, node, value)
}

function updateNode(scope, node, value) {
    if (value === null) {
        node.replaceWith(node = PLACEHOLDER_NODE.cloneNode())
        return node
    }
    switch (typeof value) {
        case 'boolean':
            value = ''
        case 'bigint':
        case 'number':
        case 'string':
            if (node.nodeType === 3) {
                node.data = value
            } else {
                node.replaceWith(node = document.createTextNode(value))
            }
            return node
        case 'function':
            value = value.call(scope, node)
            return value !== undefined ? updateNode(scope, node, value) : node
        case 'object':
            if (value[atomTag]) {
                return updateNode(scope, node, scope.get(value))
            }
            if (value[Symbol.iterator]) {
                if (node.tagName === 'slot') {
                    // TODO: This is a rudimental diff & replace... a lot of room for improvement here
                    let childIndex = 0
                    for (const item of value) {
                        let childNode = node.childNodes[childIndex++]
                        if (childNode.$item !== item) {
                            childNode = updateNode(scope, PLACEHOLDER_NODE.cloneNode(), item)
                        }
                        childNode.$item = item
                    }
                } else {
                    const slot = document.createElement('slot')
                    for (const item of value) {
                        const childNode = updateNode(scope, slot.appendChild(PLACEHOLDER_NODE.cloneNode()), item)
                        childNode.$item = item
                    }
                    node.replaceWith(slot)
                }
                return node
            }
            if (value.tag) {
                const {tag, attrs, children} = value
                const nsURI = node.parentNode.namespaceURI
                const el = nsURI
                    ? document.createElementNS(nsURI, tag)
                    : tag === 'svg'
                        ? document.createElementNS(SVG_NAMESPACE_URI, tag)
                        : document.createElement(tag)
                if (attrs) for (const [name, value] of Object.entries(attrs)) {
                    setAttr(scope, el, name, value)
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
                        updateNode(scope, el.appendChild(document.createTextNode('')), c, bind)
                    }
                }
                node.replaceWith(el)
                return node
            }
            if (value instanceof Node) {
                node.replaceWith(value)
                return
            }
        default:
            node.replaceWith(node = PLACEHOLDER_NODE.cloneNode())
            return node
    }
}

function hookAttr(scope, node, value) {
    const type = typeof value
    if (type === 'function') {
        hookAttr(scope, node, value.call(scope, node))
        return
    }
    if (type === 'object' && value !== null) {
        if (value[atomTag]) {
            const atom = value
            let names = Object.keys(value = scope.get(atom))
            let pending
            const update = () => {
                for (const name of names) {
                    if (!(name in value)) {
                        node.removeAttribute(name)
                    }
                }
                for (const name of names = Object.keys(value)) {
                    setAttr(scope, node, name, value[name])
                }
                pending = 0
            }
            scope.bind(value, () => pending ||= requestAnimationFrame(update))
            update()
            return
        }
        for (const entry of value.entries?.() ?? Object.entries(value)) {
            const [name, value] = entry
            try {
                hookValue(scope, node, name, value)
            } catch(error) {
                console.error(`Unable to hook attributes on node <${node.tagName}>.`, error.message)
            }
        }
    }
    setAttr(scope, node, value)
}

function format(value) {
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            return value
        default:
            return ''
    }
}

function hookValue(scope, node, name, value) {
    const type = typeof value
    if (type === 'function') {
        hookValue(scope, node, name, value.call(scope, node))
        return
    }
    if (type === 'object' && value !== null) {
        if (value[atomTag]) {
            const atom = value
            let pending
            const update = () => {
                setAttr(scope, node, name, scope.get(atom))
                pending = 0
            }
            scope.bind(atom, () => pending ||= requestAnimationFrame(update))
            update()
            return
        }
        const parts = []
        const separator = value[Symbol.iterator] ? ' ' : ';'
        let pending
        const update = () => {
            node.setAttribute(name, parts.join(separator))
            pending = 0
        }
        if (separator === ' ') {
            for (const part of value) {
                if (part?.[atomTag]) {
                    const p = parts.length
                    scope.bind(part, v => {
                        parts[p] = format(v)
                        pending ||= requestAnimationFrame(update)
                    })
                    parts.push(format(scope.get(part)))
                } else {
                    parts.push(format(part))
                }
            }
        } else {
            for (const [key, part] of Object.entries(value)) {
                if (part?.[atomTag]) {
                    const p = parts.length
                    scope.bind(part, v => {
                        parts[p] = `${key}:${format(v)}`
                        pending ||= requestAnimationFrame(update)
                    })
                    parts.push(`${key}:${format(scope.get(part))}`)
                } else {
                    parts.push(`${key}:${format(part)}`)
                }
            }
        }
        update()
        return
    }
    setAttr(scope, node, name, value)
}

function hookText(scope, node, field, strings, values) {
    let pending = 0
    const update = () => {
        let text = strings[0]
        for (let i = 0; i < values.length;) {
            text += values[i]
            text += strings[++i]
        }
        node[field] = text
        pending = 0
    }
    for (let i = 0; i < values.length; ++i) {
        if (values[i]?.[atomTag]) {
            scope.bind(values[i], value => {
                values[i] = value
                pending ||= requestAnimationFrame(update)
            })
            values[i] = format(scope.get(values[i]))
        } else {
            values[i] = format(values[i])
        }
    }
    update()
}

function setProperty(scope, node, name, value, bind) {
    if (value?.[atomTag]) {
        if (bind) {
            scope.bind(atom, v => node[name] = v)
        }
        node[name] = scope.get(value)
    } else {
        node[name] = value
    }
}

function setHandler(scope, node, event, value, bind) {
    if (value?.[atomTag]) {
        const atom = value
        if (bind) {
            scope.bind(atom, v => {
                node.removeEventListener(event, value)
                node.addEventListener(event, value = v)
            })
        } else {
            node.addEventListener(event, value = scope.get(atom))
        }
    } else if (typeof value === 'function') {
        node.addEventListener(event, value)
    }
}

function setAttr(scope, node, name, value) {
    if (value === null) {
        node.removeAttribute(name)
        return
    }
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            node.setAttribute(name, value)
            return
        case 'boolean':
            if (value) {
                node.setAttribute(name, '')
            } else {
                node.removeAttribute(name)
            }
            return
        case 'function':
            setAttr(node, name, value(node))
            return
        case 'object':
            if (value[atomTag]) {
                setAttr(node, name, scope.get(atom))
                return
            }
            if (value[Symbol.iterator]) {
                const parts = []
                for (const part of value) {
                    parts.push(format(part?.[atomTag] ? scope.get(part) : part))
                }
                return node.setAttribute(name, parts.join(' '))
            } else {
                const parts = []
                for (const [key, part] of Object.entries(value)) {
                    parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`)
                }
                return node.setAttribute(name, parts.join(';'))
            }
        default:
            return node.removeAttribute(name)
    }
}