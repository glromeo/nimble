export const HOLE = '\x01'
export const PLACEHOLDER_NODE = document.createComment('')

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

export const CHILD_NODE = 200
export const PARENT_NODE = 201
export const HOOK_NODE = 202
export const HOOK_ATTR = 203
export const HOOK_COMMENT = 204
export const HOOK_VALUE = 205
export const HOOK_QUOTE = 206

const TEXT_NODE = 100
const TAG_OPEN = 101
const TAG_NAME = 102
const WHITESPACE = 103
const ATTR_NAME = 104
const ASSIGN = 105
const ATTR_VALUE = 106
const QUOTED_VALUE = 107
const HOLEY_VALUE = 108
const TAG_CLOSE = 109
const COMMENT = 110

const VOID_TAGS = Object.assign(Object.create(null), {
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

const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'

export function parseHTML(html) {
    let node = document.createDocumentFragment()
    let hooks = [node]
    let state = TEXT_NODE
    let name = null
    let start = 0
    let end = -1
    let quote = null

    function appendElement() {
        hooks.push(CHILD_NODE, node.childNodes.length)
        const tagName = html.slice(start, end).toLowerCase()
        node = node.appendChild(
            node.namespaceURI
                ? document.createElementNS(node.namespaceURI, tagName)
                : tagName === 'svg'
                    ? document.createElementNS(SVG_NAMESPACE_URI, tagName)
                    : document.createElement(tagName)
        )
    }

    function appendSlot() {
        hooks.push(CHILD_NODE, node.childNodes.length)
        node = node.appendChild(document.createElement('slot'))
    }

    function matchTagName() {
        const slice = html.slice(start, end)
        return node.tagName === node.namespaceURI ? slice.toLowerCase() : slice.toUpperCase()
    }

    function parentElement() {
        if (end === start || !node.tagName || matchTagName()) {
            if (hooks[hooks.length - 2] === CHILD_NODE) {
                hooks.length -= 2
            } else if (node.parentNode) {
                hooks.push(PARENT_NODE)
            }
        }
        node = node.parentNode ?? node
    }

    function appendText(end) {
        if (end > start) {
            node.appendChild(document.createTextNode(html.slice(start, end)))
        }
    }

    function unaryAttr() {
        node.setAttribute(html.slice(start, end), '')
    }

    function setAttribute() {
        node.setAttribute(name, html.slice(start, end))
    }

    function appendComment(start, end) {
        const text = html.slice(start, end)
        if (text.indexOf(HOLE) >= 0) {
            hooks.push(HOOK_COMMENT, node.childNodes.length)
        }
        node.appendChild(document.createComment(text))
    }

    while (++end < html.length) {
        const ch = html[end]
        switch (state) {
            case TEXT_NODE:
                if (ch === '<') {
                    state = TAG_OPEN
                    continue
                }
                if (ch === HOLE) {
                    appendText(end)
                    hooks.push(HOOK_NODE, node.childNodes.length)
                    node.appendChild(PLACEHOLDER_NODE.cloneNode())
                    start = end + 1
                }
                continue
            case TAG_OPEN:
                if (isWhitespace(ch)) {
                    state = TEXT_NODE
                    continue
                }
                appendText(end - 1)
                if (ch === HOLE) {
                    hooks.push(HOOK_NODE, node.childNodes.length)
                    appendSlot()
                    state = WHITESPACE
                    continue
                }
                if (ch === '!') {
                    start = end + 1
                    state = COMMENT
                    continue
                }
                if (ch === '/') {
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    appendSlot()
                    start = end + 1
                    state = TEXT_NODE
                    continue
                }
                start = end
                state = TAG_NAME
                continue
            case TAG_NAME:
                if (isWhitespace(ch) || ch === HOLE) {
                    appendElement()
                    if (ch === HOLE) {
                        hooks.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                    continue
                }
                if (ch === '/') {
                    appendElement()
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    appendElement()
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case COMMENT:
                if (ch === '>') {
                    if (html[start] === '-' && html[start + 1] === '-') {
                        if (html[end - 1] === '-' && html[end - 2] === '-') {
                            appendComment(start + 2, end - 2)
                        } else {
                            continue
                        }
                    } else {
                        appendComment(start, end)
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case WHITESPACE:
                if (ch === HOLE) {
                    hooks.push(HOOK_ATTR)
                    continue
                }
                if (ch === '/') {
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                    continue
                }
                if (!isWhitespace(ch)) {
                    start = end
                    state = ATTR_NAME
                }
                continue
            case ATTR_NAME:
                if (isWhitespace(ch) || ch === HOLE) {
                    unaryAttr()
                    if (ch === HOLE) {
                        hooks.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                    continue
                }
                if (ch === '=') {
                    name = html.slice(start, end)
                    state = ASSIGN
                    continue
                }
                if (ch === '/') {
                    unaryAttr()
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    unaryAttr()
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case ASSIGN:
                if (ch === HOLE) {
                    hooks.push(HOOK_VALUE, name)
                    state = WHITESPACE
                    continue
                }
                if (ch === '\'' || ch === '"') {
                    quote = ch
                    start = end + 1
                    state = QUOTED_VALUE
                    continue
                }
                if (ch === '/') {
                    hooks.push('')
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (!isWhitespace(ch)) {
                    start = end
                    state = ATTR_VALUE
                }
                continue
            case QUOTED_VALUE:
                if (ch === HOLE) {
                    state = HOLEY_VALUE
                    continue
                }
                if (ch === quote) {
                    setAttribute()
                    quote = null
                    state = WHITESPACE
                    continue
                }
            case HOLEY_VALUE:
                if (ch === quote) {
                    if (end - start === 1) {
                        hooks.push(HOOK_VALUE, name)
                    } else {
                        setAttribute()
                        hooks.push(HOOK_QUOTE, name)
                    }
                    quote = null
                    state = WHITESPACE
                    continue
                }
                continue
            case ATTR_VALUE:
                if (ch === HOLE) {
                    if (end === start) {
                        hooks.push(HOOK_VALUE, name)
                    } else {
                        setAttribute()
                        hooks.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                    continue
                }
                if (ch === '/') {
                    setAttribute()
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    setAttribute()
                    start = end + 1
                    state = TEXT_NODE
                    continue
                }
                if (isWhitespace(ch)) {
                    setAttribute()
                    state = WHITESPACE
                }
                continue
            case TAG_CLOSE:
                if (ch === '>') {
                    parentElement()
                    start = end + 1
                    state = TEXT_NODE
                    continue
                }
                if (ch === '/') {
                    start = end + 1
                    continue
                }
                if (isWhitespace(ch)) {
                    state = WHITESPACE
                }
        }
    }

    if (start < end) {
        if (state === TEXT_NODE || state === TAG_OPEN) {
            appendText(end)
        }
        if (state === ATTR_NAME) {
            node.setAttribute(html.slice(start, end), '')
        }
        if (state === ASSIGN) {
            node.setAttribute(name, '')
        }
        if (state === WHITESPACE) {
            node.remove()
            hooks.length = hooks.lastIndexOf(CHILD_NODE)
        }
    }

    return hooks
}
