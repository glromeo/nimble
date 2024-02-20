import {atom} from '../atoms/atoms.mjs'

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
    'JSX': 1,
    'AREA': 1,
    'BASE': 1,
    'BR': 1,
    'COL': 1,
    'EMBED': 1,
    'HR': 1,
    'IMG': 1,
    'INPUT': 1,
    'LINK': 1,
    'META': 1,
    'SOURCE': 1,
    'TRACK': 1,
    'WBR': 1
})

function isWhitespace(ch) {
    return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
}

export function html(strings) {
    if (!strings) {
        return null
    }
    const args = arguments
    if (!strings.raw) {
        let [scope, target] = args
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
    let fragment = CACHE.get(strings)
    if (fragment === undefined) {
        CACHE.set(strings, fragment = document.createDocumentFragment())
        let node = fragment
        let state = TEXT
        let buffer = ''
        let name = null
        let quote = null
        let hooks = fragment.hooks = args.length > 1 ? [0, null] : null
        let holes = 0

        function flush() {
            switch (state) {
                case TEXT:
                    node.appendChild(document.createTextNode(buffer))
                    if (hooks) {
                        hooks[0]++
                    }
                    break
                case TAG:
                    node = node.appendChild(createElement(buffer, node.namespaceURI))
                    if (hooks) {
                        hooks.push([hooks[0]++, hooks = [0, hooks]])
                    }
                    break
                case ATTR_NAME:
                    name = buffer
                    quote = null
                    break
                case ATTR_VALUE:
                case QUOTE:
                    if (name && name !== '...') {
                        node.setAttribute(name, buffer)
                        if (holes) {
                            hooks.push([name, HOOK_QUOTE, holes])
                            holes = 0
                        }
                    }
                    name = null
                    quote = null
                    break
                case CLOSE:
                    if (node.parentNode) {
                        node = node.parentNode
                        if (hooks) {
                            if (hooks.length > 2) {
                                hooks[0] = hooks[1].length - 1
                                hooks = hooks[1]
                            } else {
                                (hooks = hooks[1]).pop()
                            }
                        }
                    }
                    break
                case COMMENT:
                    node.appendChild(document.createComment(buffer))
                    if (holes) {
                        hooks.push([hooks[0]++, HOOK_TEXT, holes])
                        holes = 0
                    }
            }
            buffer = ''
        }

        function hook() {
            switch (state) {
                case TEXT:
                    node.appendChild(document.createTextNode(''))
                    hooks.push([hooks[0]++, HOOK_NODE])
                    return
                case TAG:
                    if (!buffer) {
                        hooks.push([hooks[0], HOOK_NODE])
                        buffer = 'jsx'
                        return
                    }
                case ATTR_NAME:
                    if (name && name !== '...') {
                        node.setAttribute(name, buffer)
                        state = WHITESPACE
                        name = null
                    }
                    hooks.push([null, HOOK_ATTR])
                    return
                case WHITESPACE:
                case ATTR_VALUE:
                    hooks.push([name, HOOK_ATTR])
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
                            if (node.tagName in VOID_TAGS) {
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
                            if (node.tagName in VOID_TAGS) {
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
                            if (node.tagName in VOID_TAGS) {
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
                            if (node.tagName in VOID_TAGS) {
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
    }
    const clone = fragment.cloneNode(true)
    if (fragment.hooks) {
        if (this) {
            bind(this, clone, fragment.hooks, args)
        } else {
            clone.bind = scope => clone.bind = bind.bind(scope, clone, fragment.hooks, args)
        }
    }
    return clone
}

function bind(scope, node, hooks, args) {
    let a = args.length
    let h = hooks.length
    while (--h >= 0) {
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
                    switch (hook) {
                        case HOOK_NODE:
                            setNode(scope, node.childNodes[key], value, true)
                            continue
                        case HOOK_TEXT:
                            hookHoley(scope, node.childNodes[key], 'data', value, true)
                            continue
                        case HOOK_ATTR:
                            if (key) switch (key[0]) {
                                case ':':
                                case '.':
                                    setProperty(scope, node, key.slice(1), value, true)
                                    continue
                                case '@':
                                    setHandler(scope, node, key.slice(1), value, true)
                                    continue
                                default:
                                    setAttr(scope, node, key, value, true)
                                    continue
                            } else {
                                spreadAttr(scope, node, value, true)
                                continue
                            }
                        case HOOK_QUOTE:
                            hookHoley(scope, node.getAttributeNode(name), 'value', value, true)
                            continue
                        default:
                            console.error('unexpected hook', hook, node, key, value, true)
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

function hookHoley(scope, node, field, values, bind) {
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
        if (values[i]?.__atomId__) {
            if (bind) {
                scope.bind(values[i], value => {
                    values[i] = value
                    pending ||= requestAnimationFrame(update)
                })
            }
            values[i] = format(scope.get(values[i]))
        } else {
            values[i] = format(values[i])
        }
    }
    update()
}


function setNode(scope, node, value, bind) {
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
                value.binding = node.binding
                node.replaceWith(value)
                return value
            }
        case 'function':
            return setNode(scope, node, value.call(scope, node), bind)
        case 'object':
            if (value instanceof Node) {
                value.bind?.(scope)
                node.parentNode.replaceChild(value, node)
                return value
            }
            if (value.__atomId__) {
                if (bind) {
                    let pending = 0
                    const update = () => {
                        node = setNode(scope, node, scope.get(value))
                        pending = 0
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
                        setNode(scope, node.appendChild(TEXT_NODE.cloneNode(true)), v, bind)
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
                        setNode(scope, el.appendChild(TEXT_NODE.cloneNode(true)), c, bind)
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

function spreadAttr(scope, node, value, bind) {
    if (value?.__atomId__) {
        if (bind) {
            scope.bind(atom, v => spreadAttr(scope, node, v))
        }
        spreadAttr(scope, node, scope.get(value))
    } else if (typeof value === 'object' && value.constructor !== Array) {
        for (const entry of Object.entries(value)) {
            const [name, value] = entry
            setAttr(scope, node, name, value, bind)
        }
    }
}

function setProperty(scope, node, name, value, bind) {
    if (value?.__atomId__) {
        if (bind) {
            scope.bind(atom, v => node[name] = v)
        }
        node[name] = scope.get(value)
    } else {
        node[name] = value
    }
}

function setHandler(scope, node, event, value, bind) {
    if (value?.__atomId__) {
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
            if (value.__atomId__) {
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
                        if (part?.__atomId__) {
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
                        parts.push(format(part?.__atomId__ ? scope.get(part) : part))
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
                        if (part?.__atomId__) {
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
                        parts.push(`${key}:${format(part?.__atomId__ ? scope.get(part) : part)}`)
                    }
                }
                return node.setAttribute(name, parts.join(';'))
            }
        default:
            return node.removeAttribute(name)
    }
}
