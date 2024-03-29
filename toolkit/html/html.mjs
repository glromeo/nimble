import {atom, atomTag} from '../atoms/atoms.mjs'
import {
    APPEND_CHILD,
    APPEND_COMMENT,
    APPEND_TEXT,
    BOOL_ATTR,
    HOLE,
    HOOK_ATTR,
    HOOK_COMMENT,
    HOOK_ELEMENT,
    HOOK_NODE,
    HOOK_QUOTE,
    HOOK_VALUE,
    PARENT_NODE,
    parseHTML,
    SET_ATTR
} from './parseHTML.mjs'

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'
export const PLACEHOLDER = document.createComment('')

const CACHE = new WeakMap()

const slice = Array.prototype.slice

export function html(strings) {
    let render = CACHE.get(strings)
    if (render === undefined) {
        const [commands, args] = parseHTML(strings.join(HOLE))
        CACHE.set(strings, render = (scope, vars) => {
            const fragment = document.createDocumentFragment()
            let node = fragment, tagName
            for (let c = 0, a = 0, v = 1; c < commands.length; ++c) {
                const command = commands[c]
                if (command === APPEND_TEXT) {
                    node.appendChild(document.createTextNode(args[a++]))
                    continue
                }
                if (command === APPEND_COMMENT) {
                    node.appendChild(document.createComment(args[a++]))
                    continue
                }
                if (command === APPEND_CHILD) {
                    tagName = args[a++]
                    node = node.appendChild(
                        node.namespaceURI && node.namespaceURI !== XHTML_NAMESPACE_URI
                            ? document.createElementNS(node.namespaceURI, tagName)
                            : tagName === 'svg'
                                ? document.createElementNS(SVG_NAMESPACE_URI, tagName)
                                : document.createElement(tagName)
                    )
                    continue
                }
                if (command === PARENT_NODE) {
                    node = node.parentNode ?? node
                    continue
                }
                if (command === BOOL_ATTR) {
                    node.setAttribute(args[a++], '')
                    continue
                }
                if (command === SET_ATTR) {
                    node.setAttribute(args[a++], args[a++])
                    continue
                }
                if (command === HOOK_NODE) {
                    hookNode(scope, node.appendChild(PLACEHOLDER.cloneNode()), vars[v++])
                    continue
                }
                if (command === HOOK_ELEMENT) {
                    tagName = 'slot'
                    node = node.appendChild(document.createElement(tagName))
                    hookNode(scope, node, vars[v++])
                    continue
                }
                if (command === HOOK_ATTR) {
                    hookAttr(scope, node, vars[v++])
                    continue
                }
                if (command === HOOK_VALUE) {
                    hookValue(scope, node, args[a++], vars[v++])
                    continue
                }
                if (command === HOOK_QUOTE) {
                    const name = args[a++]
                    const strings = args[a++].split(HOLE)
                    hookQuote(scope, node, name, strings, slice.call(vars, v, v += strings.length - 1))
                    continue
                }
                if (command === HOOK_COMMENT) {
                    const data = args[a++]
                    const comment = node.appendChild(document.createComment(data))
                    const strings = data.split(HOLE)
                    hookText(scope, comment, strings, slice.call(vars, v, v += strings.length - 1))
                    continue
                }
            }
            return fragment
        })
    }
    const vars = arguments
    return scope => render(scope, vars)
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
                hookNode(scope, fragment.appendChild(PLACEHOLDER.cloneNode()), item)
            }
            node.replaceWith(fragment)
            return
        }
    }
    updateNode(scope, node, value)
}

function updateNode(scope, node, value) {
    if (value === null) {
        node.replaceWith(node = PLACEHOLDER.cloneNode())
        return node
    }
    const type = typeof value
    if (type === 'boolean') {
        value = ''
        if (node.nodeType === 3) {
            node.data = value
        } else {
            node.replaceWith(node = document.createTextNode(value))
        }
        return node
    }
    if (type === 'bigint' || type === 'number' || type === 'string') {
        if (node.nodeType === 3) {
            node.data = value
        } else {
            node.replaceWith(node = document.createTextNode(value))
        }
        return node
    }
    if (type === 'function') {
        value = value.call(scope, node)
        return value !== undefined ? updateNode(scope, node, value) : node
    }
    if (type === 'object') {
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
                        childNode = updateNode(scope, PLACEHOLDER.cloneNode(), item)
                    }
                    childNode.$item = item
                }
            } else {
                const slot = document.createElement('slot')
                for (const item of value) {
                    const childNode = updateNode(scope, slot.appendChild(PLACEHOLDER.cloneNode()), item)
                    childNode.$item = item
                }
                node.replaceWith(slot)
            }
            return node
        }
        if (value.tag) {
            const {tag, attrs, children} = value
            const nsURI = node.parentNode.namespaceURI
            const el = nsURI && nsURI !== XHTML_NAMESPACE_URI
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
    }
    node.replaceWith(node = PLACEHOLDER.cloneNode())
    return node
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
            } catch (error) {
                console.warn(`Unable to hook attributes on node <${node.tagName}>.`, error.message)
            }
        }
    }
    setAttr(scope, node, value)
}

function format(value) {
    const type = typeof value
    if (type === 'bigint' || type === 'number' || type === 'string') {
        return value
    }
    return ''
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
            const pair = (key, value) => {
                const text = format(value)
                return text ? `${key}:${text}` : ''
            }
            for (const [key, part] of Object.entries(value)) {
                if (part?.[atomTag]) {
                    const p = parts.length
                    scope.bind(part, v => {
                        parts[p] = pair(key, v)
                        pending ||= requestAnimationFrame(update)
                    })
                    parts.push(pair(key, scope.get(part)))
                } else {
                    parts.push(pair(key, part))
                }
            }
        }
        update()
        return
    }
    setAttr(scope, node, name, value)
}

function hookQuote(scope, node, name, strings, values) {
    let pending = 0
    const update = () => {
        let text = strings[0]
        for (let i = 0; i < values.length;) {
            text += values[i]
            text += strings[++i]
        }
        node.setAttribute(name, text)
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

function hookText(scope, node, strings, values) {
    let pending = 0
    const update = () => {
        let text = strings[0]
        for (let i = 0; i < values.length;) {
            text += values[i]
            text += strings[++i]
        }
        node.data = text
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
    const type = typeof value
    if (type === 'bigint' || type === 'number' || type === 'string') {
        node.setAttribute(name, value)
        return
    }
    if (type === 'boolean') {
        if (value) {
            node.setAttribute(name, '')
        } else {
            node.removeAttribute(name)
        }
        return
    }
    if (type === 'function') {
        setAttr(node, name, value(node))
        return
    }
    if (type === 'object') {
        if (value[atomTag]) {
            setAttr(node, name, scope.get(atom))
            return
        }
        const parts = []
        let joint
        if (value[Symbol.iterator]) {
            for (const part of value) {
                parts.push(format(part?.[atomTag] ? scope.get(part) : part))
            }
            joint = ' '
        } else {
            for (const [key, part] of Object.entries(value)) {
                parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`)
            }
            joint = ';'
        }
        return node.setAttribute(name, parts.join(joint))
    }
    return node.removeAttribute(name)
}