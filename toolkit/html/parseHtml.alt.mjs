export const HOLE = '\x01'

export const APPEND_TEXT = 200
export const APPEND_COMMENT = 201
export const APPEND_CHILD = 202
export const BOOL_ATTR = 203
export const SET_ATTR = 204
export const PARENT_NODE = 205
export const HOOK_NODE = 206
export const HOOK_ELEMENT = 207
export const HOOK_COMMENT = 208
export const HOOK_ATTR = 209
export const HOOK_VALUE = 210
export const HOOK_QUOTE = 211

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

const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'

export function parseHtml(html) {
    let commands = [], args = []
    let stack = []
    let tagName = ''
    let state = TEXT_NODE
    let name = null
    let start = 0
    let end = -1
    let quote = null

    const isVoid = () => (
        tagName === 'area' ||
        tagName === 'base' ||
        tagName === 'br' ||
        tagName === 'col' ||
        tagName === 'embed' ||
        tagName === 'hr' ||
        tagName === 'img' ||
        tagName === 'input' ||
        tagName === 'link' ||
        tagName === 'meta' ||
        tagName === 'source' ||
        tagName === 'track' ||
        tagName === 'wbr'
    )

    function appendComment(start, end) {
        const text = html.slice(start, end)
        commands.push(APPEND_COMMENT)
        args.push(text)
        if (text.indexOf(HOLE) >= 0) {
            commands.push(HOOK_COMMENT)
        }
    }

    function setAttr() {
        commands.push(SET_ATTR)
        args.push(name, html.slice(start, end))
    }

    function appendText(end) {
        if (end > start) {
            commands.push(APPEND_TEXT)
            args.push(html.slice(start, end))
        }
    }

    function appendSlot() {
        stack.push(tagName)
        commands.push(APPEND_CHILD)
        args.push(tagName = 'slot')
    }

    function appendChild() {
        stack.push(tagName)
        commands.push(APPEND_CHILD)
        args.push(tagName = html.slice(start, end).toLowerCase())
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
                    commands.push(HOOK_NODE)
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
                    stack.push(tagName)
                    tagName = null
                    commands.push(HOOK_ELEMENT)
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
                    appendChild()
                    if (ch === HOLE) {
                        commands.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                    continue
                }
                if (ch === '/') {
                    appendChild()
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    appendChild()
                    if (isVoid()) {
                        tagName = stack.pop()
                        commands.push(PARENT_NODE)
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
                    commands.push(HOOK_ATTR)
                    continue
                }
                if (ch === '/') {
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    if (isVoid()) {
                        tagName = stack.pop()
                        commands.push(PARENT_NODE)
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
                    commands.push(BOOL_ATTR)
                    args.push(html.slice(start, end))
                    if (ch === HOLE) {
                        commands.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                    continue
                }
                if (ch === '=') {
                    name = html.slice(start, end)
                    state = ASSIGN
                    start = end + 1
                    continue
                }
                if (ch === '/') {
                    commands.push(BOOL_ATTR)
                    args.push(html.slice(start, end))
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    commands.push(BOOL_ATTR)
                    args.push(html.slice(start, end))
                    if (isVoid()) {
                        tagName = stack.pop()
                        commands.push(PARENT_NODE)
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case ASSIGN:
                if (ch === HOLE) {
                    commands.push(HOOK_VALUE)
                    args.push(name)
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
                    commands.push(SET_ATTR)
                    args.push(name, html.slice(start, end))
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
                    commands.push(SET_ATTR)
                    args.push(name, html.slice(start, end))
                    quote = null
                    state = WHITESPACE
                    continue
                }
            case HOLEY_VALUE:
                if (ch === quote) {
                    if (end - start === 1) {
                        commands.push(HOOK_VALUE)
                        args.push(name)
                    } else {
                        commands.push(HOOK_QUOTE)
                        args.push(name, html.slice(start, end))
                    }
                    quote = null
                    state = WHITESPACE
                    continue
                }
                continue
            case ATTR_VALUE:
                if (ch === HOLE) {
                    setAttr()
                    commands.push(HOOK_ATTR)
                    state = WHITESPACE
                    continue
                }
                if (ch === '/') {
                    commands.push(SET_ATTR)
                    args.push(name, html.slice(start, end))
                    start = end + 1
                    state = TAG_CLOSE
                    continue
                }
                if (ch === '>') {
                    commands.push(SET_ATTR)
                    args.push(name, html.slice(start, end))
                    start = end + 1
                    state = TEXT_NODE
                    continue
                }
                if (isWhitespace(ch)) {
                    commands.push(SET_ATTR)
                    args.push(name, html.slice(start, end))
                    state = WHITESPACE
                }
                continue
            case TAG_CLOSE:
                if (ch === '>') {
                    if (end === start || !tagName || tagName === html.slice(start, end).toLowerCase()) {
                        tagName = stack.pop()
                        commands.push(PARENT_NODE)
                    }
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

    if (start < end && state < TAG_NAME) {
        appendText(end)
    }
    if (state > TAG_NAME) {
        commands.length = commands.lastIndexOf(APPEND_CHILD)
        args.length = args.lastIndexOf(tagName)
    }

    return [commands, args]
}
