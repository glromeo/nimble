import {
    createElement,
    HOLE,
    HOOK_NODE,
    HOOK_ATTR,
    HOOK_TEXT,
    HOOK_QUOTE
} from './hooks.mjs'

const CACHE = new WeakMap()

const TEXT = 1
const TAG = 2
const WHITESPACE = 3
const ATTR_NAME = 4
const ATTR_VALUE = 5
const QUOTE = 6
const CLOSE = 7
const COMMENT = 8

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
    let template = CACHE.get(strings)
    if (template === undefined) {
        CACHE.set(strings, template = document.createElement('h-root'))
        let node = template
        let state = TEXT
        let buffer = ''
        let name = null
        let quote = null
        let hooks = arguments.length > 1 ? [0, null] : null
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
        if (hooks) {
            template.hooks = hooks
            template.args = arguments
            if (this) {
                template.connect(this)
            }
        }
        return template
    } else {
        const clone = template.cloneNode(true)
        if (template.hooks) {
            clone.hooks = template.hooks
            clone.args = arguments
            if (this) {
                clone.connect(this)
            }
        }
        return clone
    }
}
