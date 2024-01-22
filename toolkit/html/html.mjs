const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'

const CACHE = new WeakMap()

function format(value) {
    switch (value.constructor) {
        case BigInt:
        case Number:
        case String:
            return value
        case Array:
            return value.map(format, this).join(' ')
        case Function:
            return format(value(this))
        default:
            return ''
    }
}

const updateNode = (node, value) => requestAnimationFrame(() => {
    switch (value.constructor) {
        case BigInt:
        case Number:
        case String:
            return node.replaceChildren(value)
        case Array:
            const fragment = document.createDocumentFragment()
            for (let v = 0; v < value.length; v++) {
                nodeHook(fragment.appendChild(document.createTextNode('')), value[v])
            }
            return node.replaceChildren(fragment)
        case Function:
            value(node)
            return
    }
})

function nodeHook(node, field, holes) {
    switch (field.constructor) {
        case BigInt:
        case Number:
        case String:
            node.data = field
            return
        case Array:
            if (holes) {
                let f = 0
                node.data = node.data.replaceAll(HOLE, () => field[f++])
            } else {
                const fragment = document.createDocumentFragment()
                for (let f = 0; f < field.length; f++) {
                    nodeHook(fragment.appendChild(TEXT_NODE.cloneNode(true)), field[f])
                }
                node.replaceWith(fragment)
            }
            return
        case Function: {
            const slot = document.createElement('slot')
            field(slot, value => updateNode(slot, value))
            node.replaceWith(slot)
            return
        }
    }
}

function attrHook(node, name, field, holes) {
    if (!name) {
        for (const [name, value] of Object.entries(field)) {
            attrHook(node, name, value)
        }
    } else switch (name[0]) {
        case '0':
            return
        case ':':
        case '.':
            node[name.slice(1)] = value
            return
        case '@':
            const event = name.slice(1)
            node.addEventListener(event, value)
            return
        default:
            switch (field.constructor) {
                case BigInt:
                case Number:
                case String:
                    return node.setAttribute(name, field)
                case Array:
                    let text
                    if (holes) {
                        let f = 0
                        text = node.getAttribute(name).replaceAll(HOLE, () => field[f++])
                    } else {
                        text = field.join(' ')
                    }
                    return node.setAttribute(name, text)
                default:
            }
    }
}

const TEXT = 1
const TAG = 2
const ATTR_NAME = 3
const ATTR_INIT = 4
const ATTR_VALUE = 5
const ATTR_QUOTE = 6
const END = 7
const COMMENT = 8

const TEXT_NODE = document.createTextNode('')
const HOLE = '\x01'

function html(strings) {
    let slot = CACHE.get(strings)
    if (slot === undefined) {
        CACHE.set(strings, slot = document.createElement('slot'))
        let target = slot
        let mode = TEXT
        let buffer = ''
        let name = null
        let quote = null
        let hooks = slot.hooks = arguments.length > 1 ? [0, null] : null
        let holes = 0

        function flush() {
            switch (mode) {
                case TEXT:
                    target.appendChild(document.createTextNode(buffer))
                    if (hooks) {
                        ++hooks[0]
                    }
                    break
                case TAG:
                    target = target.appendChild(document.createElement(buffer))
                    if (hooks) {
                        hooks.push([hooks[0], hooks = [0, hooks]])
                    }
                    break
                case ATTR_NAME:
                    name = buffer
                    quote = null
                    break
                case ATTR_INIT:
                case ATTR_VALUE:
                case ATTR_QUOTE:
                    if (holes) {
                        hooks.push([name, attrHook, holes])
                        holes = 0
                    }
                    target.setAttribute(name, buffer)
                    name = null
                    quote = null
                    break
                case END:
                    target = target.parentNode
                    if (hooks) {
                        if (hooks.length > 2) {
                            hooks[0] = hooks[1].length - 1
                            hooks = hooks[1]
                        } else {
                            (hooks = hooks[1]).pop()
                        }
                    }
                    break
                case COMMENT:
                    if (holes) {
                        hooks.push([hooks[0], nodeHook, holes])
                        holes = 0
                    }
                    target.appendChild(document.createComment(buffer))
            }
            buffer = ''
        }

        function hook() {
            switch (mode) {
                case TEXT:
                    target.appendChild(TEXT_NODE.cloneNode(true))
                    hooks.push([hooks[0]++, nodeHook])
                    return
                case TAG:
                case ATTR_NAME:
                    if (name && name !== '...') {
                        target.setAttribute(name, buffer)
                        name = null
                    }
                    hooks.push([null, attrHook])
                    break
                case ATTR_INIT:
                case ATTR_VALUE:
                    hooks.push([name, attrHook])
                    mode = ATTR_NAME
                    name = null
                    quote = null
                    break
                case ATTR_QUOTE:
                case COMMENT:
                    buffer += HOLE
                    ++holes
                    break
                case END:
                    //
                    break
                //
            }
        }

        for (let s = 0, text = strings[0]; s < strings.length; text = strings[++s]) {
            if (s) {
                if (buffer && mode !== ATTR_QUOTE && mode !== COMMENT) {
                    flush()
                }
                hook()
            }
            for (let c = 0, ch = text[0]; c < text.length; ch = text[++c]) {
                switch (mode) {
                    case TEXT:
                        if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
                            if (c === 0 || buffer[buffer.length - 1] !== ' ') {
                                buffer += ' '
                            }
                        } else if (ch === '<') {
                            if (buffer) {
                                flush()
                            }
                            mode = TAG
                        } else {
                            buffer += ch
                        }
                        continue
                    case TAG:
                        if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
                            flush()
                            mode = ATTR_NAME
                        } else if (ch === '>') {
                            flush()
                            mode = TEXT
                        } else if (ch === '/') {
                            mode = END
                        } else if (ch === '!') {
                            mode = COMMENT
                        } else {
                            buffer += ch
                        }
                        continue
                    case ATTR_NAME:
                        if (ch === '=') {
                            flush()
                            mode = ATTR_INIT
                        } else if (ch === '>') {
                            if (buffer) {
                                flush()
                                mode = ATTR_VALUE
                                flush()
                            }
                            mode = TEXT
                        } else if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') {
                            buffer += ch
                        }
                        continue
                    case ATTR_INIT:
                        if (ch === '"' || ch === '\'') {
                            quote = ch
                            mode = ATTR_QUOTE
                        } else if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') {
                            buffer += ch
                            mode = ATTR_VALUE
                        }
                        continue
                    case ATTR_VALUE:
                        if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
                            flush()
                            mode = ATTR_NAME
                        } else if (ch === '>') {
                            flush()
                            mode = TEXT
                        } else {
                            buffer += ch
                        }
                        continue
                    case ATTR_QUOTE:
                        if (ch === quote) {
                            flush()
                            mode = ATTR_NAME
                        } else {
                            buffer += ch
                        }
                        continue
                    case END:
                        if (ch === '>') {
                            flush()
                            mode = TEXT
                        }
                        continue
                    case COMMENT:
                        if (ch === '>') {
                            const l = buffer.length
                            if (l <= 2 || buffer[0] !== '-' || buffer[1] !== '-') {
                                flush()
                                mode = TEXT
                                continue
                            }
                            if (l >= 4 && buffer[l - 1] === '-' || buffer[l - 2] === '-') {
                                buffer = buffer.slice(2, -2)
                                flush()
                                mode = TEXT
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
    } else {
        slot = slot.cloneNode(true)
    }
    if (slot.hooks) {
        let target = slot
        let field = arguments.length
        let hooks = slot.hooks
        let h = hooks.length
        while (--h) {
            if (h === 1) {
                target = target.parentNode
                h = hooks[0]
                if (!(hooks = hooks[1])) {
                    h = 1
                }
            } else {
                const [key, hook, holes] = hooks[h]
                if (hook.constructor === Array) {
                    target = target.childNodes[key]
                    hooks = hook
                    h = hooks.length
                } else {
                    let value
                    if (holes) {
                        value = []
                        for (let i = field - holes; i < field; i++) {
                            value.push(arguments[i])
                        }
                        field -= holes
                    } else {
                        value = arguments[--field]
                    }
                    if (hook === nodeHook) {
                        hook(target.childNodes[key], value, holes)
                    } else {
                        hook(target, key, value, holes)
                    }
                }
            }
        }
    }
    return slot
}