import {atom, atomTag} from '../atoms/atoms.mjs'

export const HOLE = '\x01'

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

export const HOOK_NODE = 101
export const HOOK_TAG = 102
export const HOOK_ATTR = 103
export const HOOK_TEXT = 104
export const HOOK_QUOTE = 105

const CACHE = new WeakMap()

const TEXT = 1
const TAG = 2
const WHITESPACE = 3
const ATTR_NAME = 4
const ATTR_VALUE = 5
const QUOTE = 6
const CLOSE = 7
const COMMENT = 8

const ignore = () => {
}
const invoke = () => {
}

const VOID_TAGS = Object.assign(Object.create(null), {
    'jsx': 1,
    'area': 1,
    'base': 1,
    'br': 1,
    'col': 1,
    'embed': 1,
    'hr': 1,
    'img': 1,
    'input': 1,
    'link': 1,
    'meta': 1,
    'source': 1,
    'track': 1,
    'wbr': 1
})

const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
const slice = Array.prototype.slice

const TEXT_NODE = 1
const ELEMENT = 2
const ELEMENT_NS = 3
const SET_ATTR = 4

export function html(strings) {
    if (!strings) {
        return null
    }
    if (!strings.raw) {
        let [scope, target] = arguments
        switch (typeof target) {
            case 'string':
                target = document.querySelector(target)
            case 'object':
                return function () {
                    const fragment = html.apply(scope, arguments)
                    target.replaceChildren(fragment)
                    return fragment
                }
            default:
                return function () {
                    return html.apply(scope, arguments)
                }
        }
    }
    let render = CACHE.get(strings)
    if (render === undefined) {
        let queue = [null]
        let state = TEXT
        let buffer = ''
        let name = null
        let quote = null
        let holes = 0
        let tagName = null
        let nsURI = null

        function flush() {
            switch (state) {
                case TEXT:
                    queue.push(TEXT_NODE, buffer)
                    break
                case TAG:
                    tagName = buffer.toLowerCase()
                    if (tagName === 'svg') {
                        nsURI = SVG_NAMESPACE_URI
                    }
                    if (nsURI) {
                        queue.push(ELEMENT_NS, nsURI, tagName)
                    } else {
                        queue.push(ELEMENT, tagName)
                    }
                    queue.push(queue = [queue, queue.length + 1])
                    break
                case ATTR_NAME:
                    name = buffer
                    quote = null
                    break
                case ATTR_VALUE:
                case QUOTE:
                    if (name && name !== '...') {
                        queue.push(SET_ATTR, name, buffer)
                        if (holes) {
                            queue.push(HOOK_QUOTE, holes)
                            holes = 0
                        }
                    }
                    name = null
                    quote = null
                    break
                case CLOSE:
                    if (queue[0]) {
                        queue = queue[0]
                        tagName = queue[queue.length - 1]
                        nsURI = queue[queue.length - 2]
                        if (nsURI === ELEMENT) {
                            nsURI = null
                        }
                    }
                    break
                case COMMENT:
                    queue.push(COMMENT, buffer)
                    if (holes) {
                        queue.push(HOOK_TEXT, holes)
                        holes = 0
                    }
            }
            buffer = ''
        }

        function hook() {
            switch (state) {
                case TEXT:
                    queue.push(HOOK_NODE)
                    return
                case TAG:
                    if (!buffer) {
                        tagName = 'jsx'
                        queue.push(HOOK_TAG, null, tagName)
                        queue.push(queue = [queue, queue.length + 1])
                        state = WHITESPACE
                        return
                    }
                case ATTR_NAME:
                    if (name && name !== '...') {
                        // node.setAttribute(name, buffer)
                        queue.push(SET_ATTR, name, buffer)
                        state = WHITESPACE
                    }
                    name = null
                case WHITESPACE:
                case ATTR_VALUE:
                    // hooks.push([name, HOOK_ATTR])
                    queue.push(HOOK_ATTR, name)
                    state = WHITESPACE
                    name = null
                    quote = null
                    return
                case QUOTE:
                case COMMENT:
                    buffer += HOLE
                    ++holes
                    return
                case CLOSE:
                    //
                    return
                //
            }
        }

        for (let s = 0; s < strings.length; ++s) {
            const text = strings[s]
            if (s) {
                if (buffer && state !== QUOTE && state !== COMMENT) {
                    flush()
                }
                hook()
            }
            for (let c = 0; c < text.length; ++c) {
                const ch = text[c]
                switch (state) {
                    case TEXT:
                        if (isWhitespace(ch)) {
                            if (c === 0 || buffer[buffer.length - 1] !== ' ') {
                                buffer += ' '
                            }
                        } else if (ch === '<') {
                            if (buffer) {
                                flush()
                            }
                            state = TAG
                        } else {
                            buffer += ch
                        }
                        continue
                    case TAG:
                        if (isWhitespace(ch)) {
                            if (buffer) {
                                flush()
                                state = WHITESPACE
                            } else {
                                buffer = '< '
                                state = TEXT
                            }
                        } else if (ch === '>') {
                            flush()
                            if (/*node.*/tagName in VOID_TAGS) {
                                state = CLOSE
                                flush()
                            }
                            state = TEXT
                        } else if (ch === '/') {
                            state = CLOSE
                        } else if (ch === '!') { // todo: what if in the middle?
                            state = COMMENT
                        } else {
                            buffer += ch
                        }
                        continue
                    case CLOSE:
                        if (ch === '>') {
                            flush()
                            state = TEXT
                        }
                        continue
                    case WHITESPACE:
                        if (isWhitespace(ch)) {
                            continue
                        } else if (ch === '>') {
                            if (/*node.*/tagName in VOID_TAGS) {
                                state = CLOSE
                                flush()
                            }
                            state = TEXT
                        } else if (ch === '/') {
                            state = CLOSE
                        } else if (name) {
                            if (ch === '"' || ch === '\'') {
                                quote = ch
                                state = QUOTE
                            } else {
                                buffer += ch
                                state = ATTR_VALUE
                            }
                        } else {
                            buffer += ch
                            state = ATTR_NAME
                        }
                        continue
                    case ATTR_NAME:
                        if (ch === '=' || isWhitespace(ch)) {
                            flush()
                            state = WHITESPACE
                        } else if (ch === '>') {
                            flush()
                            state = ATTR_VALUE
                            flush()
                            if (/*node.*/tagName in VOID_TAGS) {
                                state = CLOSE
                                flush()
                            }
                            state = TEXT
                        } else if (ch === '/') {
                            state = ATTR_VALUE
                            flush()
                            state = CLOSE
                        } else {
                            buffer += ch
                        }
                        continue
                    case ATTR_VALUE:
                        if (isWhitespace(ch)) {
                            flush()
                            state = WHITESPACE
                        } else if (ch === '>') {
                            flush()
                            if (/*node.*/tagName in VOID_TAGS) {
                                state = CLOSE
                                flush()
                            }
                            state = TEXT
                        } else {
                            buffer += ch
                        }
                        continue
                    case QUOTE:
                        if (ch === quote) {
                            flush()
                            state = WHITESPACE
                        } else {
                            buffer += ch
                        }
                        continue
                    case COMMENT:
                        if (ch === '>') {
                            const l = buffer.length
                            if (l <= 2 || buffer[0] !== '-' || buffer[1] !== '-') {
                                flush()
                                state = TEXT
                                continue
                            }
                            if (l >= 4 && buffer[l - 1] === '-' || buffer[l - 2] === '-') {
                                buffer = buffer.slice(2, -2)
                                flush()
                                state = TEXT
                                continue
                            }
                        }
                        buffer += ch
                }
            }
        }
        if (buffer) {
            flush()
        }

        const cmd = queue

        CACHE.set(strings, render = (scope, args) => {
            const fragment = document.createDocumentFragment()
            let parent = fragment
            let a = 1
            for (let queue = cmd, i = 1; parent; i = queue[1], queue = queue[0]) {
                for (let q = i; q < queue.length; ++q) {
                    switch (queue[q]) {
                        case TEXT_NODE:
                            parent.appendChild(document.createTextNode(queue[++q]))
                            continue
                        case ELEMENT:
                            parent = parent.appendChild(document.createElement(queue[++q]))
                            queue = queue[q + 1]
                            q = 1
                            continue
                        case ELEMENT_NS:
                            parent = parent.appendChild(document.createElementNS(queue[++q], queue[++q]))
                            queue = queue[q + 1]
                            q = 1
                            continue
                        case SET_ATTR:
                            parent.setAttribute(queue[++q], queue[++q])
                            continue
                        case COMMENT:
                            parent.appendChild(document.createComment(queue[++q]))
                            continue
                        case HOOK_NODE:
                            hookNode(scope, parent, args[a++])
                            continue
                        case HOOK_ATTR:
                            hookAttr(scope, parent, queue[++q], args[a++])
                            continue
                        case HOOK_QUOTE:
                            hookText(scope, parent.attributes, 'value', slice.call(args, a, a += queue[++q]))
                            continue
                        case HOOK_TEXT:
                            hookText(scope, parent.childNodes, 'data', slice.call(args, a, a += queue[++q]))
                            continue
                        case HOOK_TAG:
                            const fn = args[a++];
                            const attrs = {}
                            const children = []
                            for (let j = q + 3; j < queue.length; j++) {
                                switch (queue[q]) {
                                    case SET_ATTR:
                                        attrs[queue[++q]] = queue[++q]
                                        continue
                                    case HOOK_ATTR:
                                        attrs[queue[++q]] = queue[++q]
                                        continue
                                }
                                break
                            }
                            parent = {
                                attrs: {},
                                setAttribute(name, value) {
                                    this[name] = value
                                }
                            }
                    }
                }
                parent = parent.parentNode
            }
            return fragment
        })
    }
    // const clone = fragment.cloneNode(true)
    // const hooks = fragment.hooks
    // if (this) {
    //     if (hooks) {
    //         bind(this, clone, hooks, args)
    //     }
    //     return clone
    // } else {
    //     return function (node) {
    //         bind(this, clone, hooks, args)
    //         node.replaceWith(clone)
    //     }
    // }
    if (this) {
        return render(this, arguments)
    } else {
        const args = arguments
        return scope => render(scope, args)
    }
}

function hookTag(scope, parent, attrs, children) {
    const {tag, attrs, children} = value
    const el = createElement(tag, parent.namespaceURI)
    if (attrs) {
        hookAttr(scope, el, attrs)
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
            setNode(scope, el.appendChild(document.createTextNode('')), c, bind)
        }
    }
    node.replaceWith(el)
    return node
}

function hookNode(scope, parent, value) {
    value = value ?? ''
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            return parent.appendChild(document.createTextNode(value))
        case 'function':
            return hookNode(scope, parent, value = value.call(scope, parent))
        case 'object':
            if (value instanceof Node) {
                node.replaceWith(value)
                return
            }
            if (value[atomTag]) {
                if (bind) {
                    let pending = 0
                    const update = () => {
                        if (node.isConnected) {
                            setNode(scope, node, scope.get(value))
                            pending = 0
                        } else {
                            // I rather stop the listeners when they return false
                        }
                    }
                    scope.bind(value, () => pending ||= requestAnimationFrame(update))
                }
                return node = setNode(scope, node, scope.get(value))
            }
            if (value[Symbol.iterator]) {
                for (const item of value) {
                    hookNode(scope, parent, item)
                }
                return
            }
    }
}

function hookAttr(scope, node, name, value) {
    if (name === null) {
        if (value) {
            if (value[atomTag]) {
                const atom = value
                let names = Object.keys(value = store.get(atom))
                for (const name of names) {
                    setAttr(scope, node, name, value[name])
                }
                scope.bind(atom, value => {
                    for (const name of names) {
                        if (!(name in value)) {
                            node.removeAttribute(name)
                        }
                    }
                    for (const name of names = Object.keys(value)) {
                        setAttr(scope, node, name, value[name])
                    }
                })
            } else if (typeof value === 'object' && value.constructor !== Array) {
                for (const entry of Object.entries(value)) {
                    const [name, value] = entry
                    hookAttr(scope, node, name, value)
                }
            }
        }
        return
    }
    value = value ?? false
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
            return node.setAttribute(name, value.call(scope, node))
        case 'object':
            if (value[atomTag]) {
                const atom = value
                if (bind) {
                    let pending = false
                    const update = () => pending = !(node = setAttr(node, name, value))
                    scope.bind(atom, v => {
                        value = v
                        pending ||= requestAnimationFrame(update)
                    })
                    update()
                    return node
                } else {
                    return node = setAttr(node, name, scope.get(atom))
                }
            }
            if (value[Symbol.iterator]) {
                const parts = []
                if (bind) {
                    let pending = false
                    const update = () => {
                        node.setAttribute(name, parts.join(' '))
                        pending = false
                    }
                    for (const part of value) {
                        if (part?.[atomTag]) {
                            const p = parts.length
                            scope.bind(part, v => {
                                parts[p] = format(v)
                                update()
                            })
                            parts.push(format(scope.get(part)))
                        } else {
                            parts.push(format(part))
                        }
                    }
                } else {
                    for (const part of value) {
                        parts.push(format(part?.[atomTag] ? scope.get(part) : part))
                    }
                }
                return node.setAttribute(name, parts.join(' '))
            } else {
                const parts = []
                if (bind) {
                    let pending = false
                    const update = () => {
                        node.setAttribute(name, parts.join(';'))
                        pending = false
                    }
                    for (const [key, part] of Object.entries(value)) {
                        if (part?.[atomTag]) {
                            const p = parts.length
                            scope.bind(part, v => {
                                parts[p] = format(v)
                                update()
                            })
                            parts.push(`${key}:${format(scope.get(part))}`)
                        } else {
                            parts.push(`${key}:${format(part)}`)
                        }
                    }
                } else {
                    for (const [key, part] of Object.entries(value)) {
                        parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`)
                    }
                }
                return node.setAttribute(name, parts.join(';'))
            }
        default:
            return node.removeAttribute(name)
    }
}

function hookText(scope, nodes, field, values) {
    const node = nodes[nodes.length - 1]
    let pending = 0
    const strings = node[field].split(HOLE)
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

/**
 * setNode tries to set the data of a text node whenever possible, otherwise replaces it with an appropriate element
 *
 * @param scope
 * @param node
 * @param value
 * @param bind
 * @returns {*|Text|Node}
 */
function setNode(scope, node, value, bind) {
    value = value ?? ''
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            if (node.nodeType === 3) {
                node.data = value
                return
            } else {
                value = document.createTextNode(value)
                node.replaceWith(value)
                return
            }
        case 'function':
            value = value.call(scope, node)
            if (value !== undefined && node.isConnected) {
                setNode(scope, node, value)
            }
            return
        case 'object':
            if (value instanceof Node) {
                node.replaceWith(value)
                return
            }
            if (value[atomTag]) {
                if (bind) {
                    let pending = 0
                    const update = () => {
                        if (node.isConnected) {
                            setNode(scope, node, scope.get(value))
                            pending = 0
                        } else {
                            // I rather stop the listeners when they return false
                        }
                    }
                    scope.bind(value, () => pending ||= requestAnimationFrame(update))
                }
                return node = setNode(scope, node, scope.get(value))
            }
            if (value[Symbol.iterator]) {
                if (node.nodeType === 3) {
                    let last = node
                    for (const v of value) {
                        const next = last.splitText(0)
                        setNode(scope, last, v, bind)
                        last = next
                    }
                } else {
                    node.replaceWith(node = I_NODE.cloneNode(true))
                    for (const v of value) {
                        setNode(scope, node.appendChild(document.createTextNode('')), v, bind)
                    }
                }
                return node
            }
            if (value.tag) {
                const {tag, attrs, children} = value
                const el = createElement(tag)
                if (attrs) {
                    spreadAttr(scope, el, attrs, bind)
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
                        setNode(scope, el.appendChild(document.createTextNode('')), c, bind)
                    }
                }
                node.replaceWith(el)
                return node
            }
        default:
            if (node.nodeType === 3) {
                node.data = ''
            } else {
                node.replaceWith(node = document.createTextNode(''))
            }
            return node
    }
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

function setAttr(scope, node, name, value, bind) {
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
            if (value[atomTag]) {
                const atom = value
                if (bind) {
                    let pending = false
                    const update = () => pending = !(node = setAttr(node, name, value))
                    scope.bind(atom, v => {
                        value = v
                        pending ||= requestAnimationFrame(update)
                    })
                    update()
                    return node
                } else {
                    return node = setAttr(node, name, scope.get(atom))
                }
            }
            if (value[Symbol.iterator]) {
                const parts = []
                if (bind) {
                    let pending = false
                    const update = () => {
                        node.setAttribute(name, parts.join(' '))
                        pending = false
                    }
                    for (const part of value) {
                        if (part?.[atomTag]) {
                            const p = parts.length
                            scope.bind(part, v => {
                                parts[p] = format(v)
                                update()
                            })
                            parts.push(format(scope.get(part)))
                        } else {
                            parts.push(format(part))
                        }
                    }
                } else {
                    for (const part of value) {
                        parts.push(format(part?.[atomTag] ? scope.get(part) : part))
                    }
                }
                return node.setAttribute(name, parts.join(' '))
            } else {
                const parts = []
                if (bind) {
                    let pending = false
                    const update = () => {
                        node.setAttribute(name, parts.join(';'))
                        pending = false
                    }
                    for (const [key, part] of Object.entries(value)) {
                        if (part?.[atomTag]) {
                            const p = parts.length
                            scope.bind(part, v => {
                                parts[p] = format(v)
                                update()
                            })
                            parts.push(`${key}:${format(scope.get(part))}`)
                        } else {
                            parts.push(`${key}:${format(part)}`)
                        }
                    }
                } else {
                    for (const [key, part] of Object.entries(value)) {
                        parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`)
                    }
                }
                return node.setAttribute(name, parts.join(';'))
            }
        default:
            return node.removeAttribute(name)
    }
}
