import {atom, atomTag} from '../atoms/atoms.mjs'

let assertion = 0

function debugNode(node) {
    let walker = document.createTreeWalker(node, NodeFilter.SHOW_ALL);
    let dump = []
    while (node = walker.nextNode()) {
        dump.push(node.nodeType, node.nodeValue ?? node.tagName)
    }
    return dump
}

const expect = function (input, output) {
    ++assertion
    let [node, ...queue] = parseHTML(input)
    let actual = JSON.stringify([debugNode(node), ...queue])
    let expected = JSON.stringify(output)
    if (actual !== expected) {
        console.error(`#${assertion} "${input}"`, '\nexpected:', expected, '\nactual:  ', actual)
    }
}

export const HOLE = '\x01'

const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

const TEXT_NODE = 10
const TAG_OPEN = 11
const TAG_NAME = 12
const WHITESPACE = 13
const ATTR_NAME = 14
const ASSIGN = 15
const ATTR_VALUE = 16
const QUOTED_VALUE = 17
const TAG_CLOSE = 18
const COMMENT = 19

const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'

const CHILD_NODE = 200
const PARENT_NODE = 202

export const HOOK_NODE = 101
export const HOOK_TAG = 102
export const HOOK_ATTR = 103
export const HOOK_TEXT = 104
export const HOOK_QUOTE = 105
export const HOOK_VALUE = 106

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

function parseHTML(html) {
    let node = document.createDocumentFragment()
    let hooks = [node]
    let state = TEXT_NODE
    let name = null
    let start = 0
    let end = -1
    let quote = null

    function childElement() {
        const tagName = html.slice(start, end)
        const nsURI = node.namespaceURI || tagName.length === 3 && tagName.toLowerCase() === 'svg' && SVG_NAMESPACE_URI
        hooks.push(CHILD_NODE, node.childNodes.length)
        node = node.appendChild(nsURI ? document.createElementNS(nsURI, tagName) : document.createElement(tagName))
    }

    function createFragment() {
        hooks.push(CHILD_NODE, node.childNodes.length)
        node = node.appendChild(document.createDocumentFragment())
    }

    const tagName = () => {
        const slice = html.slice(start, end)
        return node.namespaceURI === XHTML_NAMESPACE_URI ? slice.toUpperCase() : slice
    }

    function parentElement() {
        if (end === start || !node.tagName || node.tagName === tagName()) {
            if (hooks[hooks.length - 2] === CHILD_NODE) {
                hooks.length -= 2
            } else {
                hooks.push(PARENT_NODE)
            }
        }
        node = node.parentNode
    }

    function emptyAttr() {
        node.setAttribute(html.slice(start, end), '')
    }

    function setAttr() {
        node.setAttribute(name, end > start ? html.slice(start, end) : '')
        name = null
    }

    function flushText(end) {
        if (end > start) {
            node.appendChild(document.createTextNode(html.slice(start, end)))
        }
    }

    while (++end < html.length) {
        const ch = html[end]
        switch (state) {
            case TEXT_NODE:
                if (ch === '<') {
                    state = TAG_OPEN
                } else if (ch === HOLE) {
                    flushText(end)
                    hooks.push(HOOK_NODE, node.childNodes.length)
                    node.appendChild(document.createTextNode(''))
                    start = end + 1
                }
                continue
            case TAG_OPEN:
                if (isWhitespace(ch)) {
                    state = TEXT_NODE
                } else {
                    flushText(end - 1)
                    if (ch === HOLE) {
                        hooks.push(HOOK_TAG)
                        state = WHITESPACE
                    } else if (ch === '!') {
                        start = end + 1
                        state = COMMENT
                    } else if (ch === '/') {
                        start = end + 1
                        state = TAG_CLOSE
                    } else if (ch === '>') {
                        createFragment()
                        start = end + 1
                        state = TEXT_NODE
                    } else {
                        start = end
                        state = TAG_NAME
                    }
                }
                continue
            case TAG_NAME:
                if (ch === HOLE) {
                    childElement()
                    hooks.push(HOOK_ATTR)
                    state = WHITESPACE
                } else if (ch === '/') {
                    childElement()
                    start = end + 1
                    state = TAG_CLOSE
                } else if (ch === '>') {
                    childElement()
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                } else if (isWhitespace(ch)) {
                    childElement()
                    state = WHITESPACE
                }
                continue
            case COMMENT:
                if (ch === '>') {
                    if (html[start] === '-' && html[start + 1] === '-') {
                        if (html[end - 1] === '-' && html[end - 2] === '-') {
                            hooks.push(COMMENT, html.slice(start + 2, end - 2))
                        } else {
                            continue
                        }
                    } else {
                        hooks.push(COMMENT, html.slice(start, end))
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case WHITESPACE:
                if (ch === HOLE) {
                    hooks.push(HOOK_ATTR)
                    state = WHITESPACE
                } else if (ch === '/') {
                    start = end + 1
                    state = TAG_CLOSE
                } else if (ch === '>') {
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                } else if (!isWhitespace(ch)) {
                    start = end
                    state = ATTR_NAME
                }
                continue
            case ATTR_NAME:
                if (ch === HOLE) {
                    hooks.push(HOOK_ATTR)
                    state = WHITESPACE
                } else if (ch === '=' || isWhitespace(ch)) {
                    name = html.slice(start, end)
                    state = ASSIGN
                } else if (ch === '/') {
                    emptyAttr()
                    start = end + 1
                    state = TAG_CLOSE
                } else if (ch === '>') {
                    emptyAttr()
                    if (node.tagName in VOID_TAGS) {
                        parentElement()
                    }
                    start = end + 1
                    state = TEXT_NODE
                }
                continue
            case ASSIGN:
                if (ch === HOLE) {
                    hooks.push(HOOK_VALUE)
                    state = WHITESPACE
                } else if (ch === '\'' || ch === '"') {
                    quote = ch
                    start = end + 1
                    state = QUOTED_VALUE
                } else if (ch === '/') {
                    hooks.push('')
                    start = end + 1
                    state = TAG_CLOSE
                } else if (!isWhitespace(ch)) {
                    start = end
                    state = ATTR_VALUE
                }
                continue
            case QUOTED_VALUE:
                if (ch === quote) {
                    setAttr()
                    // if (end - start > 1) {
                    //     const values = html.slice(start, end).split(HOLE)
                    //     if (values.length > 1) {
                    //         hooks.push(html.slice(start, end))
                    //     } else {
                    //         hooks.push(values[0])
                    //     }
                    // }
                    quote = null
                    state = WHITESPACE
                }
                continue
            case ATTR_VALUE:
                if (ch === HOLE) {
                    if (end - start === 1) {
                        hooks.push(HOOK_VALUE)
                    } else {
                        setAttr()
                        hooks.push(HOOK_ATTR)
                    }
                    state = WHITESPACE
                } else if (ch === '/') {
                    setAttr()
                    start = end + 1
                    state = TAG_CLOSE
                } else if (ch === '>') {
                    setAttr()
                    start = end + 1
                    state = TEXT_NODE
                } else if (isWhitespace(ch)) {
                    setAttr()
                    state = WHITESPACE
                }
                continue
            case TAG_CLOSE:
                if (ch === '>') {
                    parentElement()
                    start = end + 1
                    state = TEXT_NODE
                } else if (ch === '/') {
                    start = end + 1
                } else if (isWhitespace(ch)) {
                    state = WHITESPACE
                }
        }
    }

    if (start < end) {
        if (state === TEXT_NODE || state === TAG_OPEN) {
            flushText(end)
        }
        if (state === ATTR_NAME) {
            emptyAttr()
        }
        if (state === ASSIGN) {
            node.setAttribute(name, '')
        }
    }

    return hooks
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// expect.call(parseHTML, '', [[]])
// expect.call(parseHTML, ' ', [[3, ' ']])
// expect.call(parseHTML, ' <', [[3, ' <']])
// expect.call(parseHTML, ' < ', [[3, ' < ']])
// expect.call(parseHTML, ' <>', [[3, ' '], 200, 1])
// expect.call(parseHTML, ' <a', [[3, ' '], 200, 1])
// expect.call(parseHTML, ' <a ', [[3, ' '], 200, 1])
// expect.call(parseHTML, ' <svg ', [[3, ' '], 200, 1])
// expect.call(parseHTML, ' <a>', [[3, ' ', ELEMENT, 'a']])
// expect.call(parseHTML, ' <svg>', [[3, ' ', ELEMENT_NS, SVG_NAMESPACE_URI, 'svg']])
// expect.call(parseHTML, '<a>', [ELEMENT, 'a'])
// expect.call(parseHTML, '<svg>', [ELEMENT_NS, SVG_NAMESPACE_URI, 'svg'])
// expect.call(parseHTML, '<p>hello</p>', [ELEMENT, 'p', TEXT_NODE, 'hello', PARENT_NODE])
// expect.call(parseHTML, '</>', [PARENT_NODE])
// expect.call(parseHTML, '< />', [TEXT_NODE, '< />'])
// expect.call(parseHTML, '<a/>', [ELEMENT, 'a', PARENT_NODE])
// expect.call(parseHTML, '<a />', [ELEMENT, 'a', PARENT_NODE])
// expect.call(parseHTML, '<a / >', [ELEMENT, 'a'])
// expect.call(parseHTML, '<a //>', [ELEMENT, 'a', PARENT_NODE])
// expect.call(parseHTML, '<a u>', [ELEMENT, 'a', ATTR, 'u', ''])
// expect.call(parseHTML, '<a =u>', [ELEMENT, 'a', ATTR, '=u', ''])
// expect.call(parseHTML, '<a u/>', [ELEMENT, 'a', ATTR, 'u', '', PARENT_NODE])
// expect.call(parseHTML, '<a u=1>', [ELEMENT, 'a', ATTR, 'u', '1'])
// expect.call(parseHTML, '<a u="2">', [ELEMENT, 'a', ATTR, 'u', '2'])
// expect.call(parseHTML, `<a u='3'>`, [ELEMENT, 'a', ATTR, 'u', '3'])
// expect.call(parseHTML, `<a "b c"=d>`, [ELEMENT, 'a', ATTR, '"b', 'c"=d'])
// expect.call(parseHTML, `<a u='3' f="g"/>`, [ELEMENT, 'a', ATTR, 'u', '3', ATTR, 'f', 'g', PARENT_NODE])
// expect.call(parseHTML, `<img>`, [ELEMENT, 'img', PARENT_NODE])
// expect.call(parseHTML, `  pre  <p><img></p>  post  `, [TEXT_NODE, '  pre  ', ELEMENT, 'p', ELEMENT, 'img', PARENT_NODE, PARENT_NODE, TEXT_NODE, '  post  '])
// expect.call(parseHTML, `<!>`, [COMMENT, ''])
// expect.call(parseHTML, `<!->`, [COMMENT, '-'])
// expect.call(parseHTML, `<!-->`, [COMMENT, ''])
// expect.call(parseHTML, `<!--->`, [COMMENT, ''])
// expect.call(parseHTML, `<!---->`, [COMMENT, ''])
// expect.call(parseHTML, `<!-->-->`, [COMMENT, '', TEXT_NODE, '-->'])
// expect.call(parseHTML, `<!-- > -->`, [COMMENT, ' > '])
// expect.call(parseHTML, `<!-- -> -->`, [COMMENT, ' -> '])
// expect.call(parseHTML, `<!-- --> -->`, [COMMENT, ' ', TEXT_NODE, ' -->'])
// expect.call(parseHTML, ` <!--no comment--> `, [TEXT_NODE, ' ', COMMENT, 'no comment', TEXT_NODE, ' '])
// expect.call(parseHTML, `${HOLE}`, [HOOK_NODE])
// expect.call(parseHTML, `x${HOLE}y`, [TEXT_NODE, 'x', HOOK_NODE, TEXT_NODE, 'y'])
// expect.call(parseHTML, `<${HOLE}>`, [HOOK_TAG])
// expect.call(parseHTML, `<p${HOLE}>`, [ELEMENT, 'p', HOOK_ATTR])
// expect.call(parseHTML, `<p ${HOLE} ${HOLE}>`, [ELEMENT, 'p', HOOK_ATTR, HOOK_ATTR])
// expect.call(parseHTML, `<p${HOLE} />`, [ELEMENT, 'p', HOOK_ATTR, PARENT_NODE])
// expect.call(parseHTML, `<p${HOLE}a>`, [ELEMENT, 'p', HOOK_ATTR, ATTR, 'a', ''])
// expect.call(parseHTML, `<${HOLE} a=b>`, [HOOK_TAG, ATTR, 'a', 'b'])
// expect.call(parseHTML, `<b ${HOLE}=${HOLE}>`, [ELEMENT, 'b', HOOK_ATTR, HOOK_ATTR])
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const CACHE = new WeakMap()

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
        const queue = parseHTML(strings.join(HOLE))
        CACHE.set(strings, render = (scope, args) => {
            const fragment = queue[0].cloneNode(true)
            let node = fragment
            let a = 1
            for (let q = 1; q < queue.length; ++q) {
                switch (queue[q]) {
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
                        hookAttr(scope, node, queue[++q], args[a++])
                        continue
                    case HOOK_QUOTE:
                        hookText(scope, node.attributes, 'value', slice.call(args, a, a += queue[++q]))
                        continue
                    case HOOK_TEXT:
                        hookText(scope, node.childNodes, 'data', slice.call(args, a, a += queue[++q]))
                        continue
                    case HOOK_TAG:
                        const fn = args[a++]
                        const attrs = {}
                        const children = []
                        for (let j = q + 3; j < queue.length; j++) {
                            switch (queue[q]) {
                                case ATTR:
                                    attrs[queue[++q]] = queue[++q]
                                    continue
                                case HOOK_ATTR:
                                    attrs[queue[++q]] = queue[++q]
                                    continue
                            }
                            break
                        }
                        node = {
                            attrs: {},
                            setAttribute(name, value) {
                                this[name] = value
                            }
                        }
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
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            return node.data = value
        case 'function':
            return hookNode(scope, node, value.call(scope, node))
        case 'object':
            if (value) {
                if (value[atomTag]) {
                    let pending
                    const update = () => {
                        node = updateNode(scope, node, scope.get(value))
                        pending = 0
                    }
                    scope.bind(value, () => pending ||= requestAnimationFrame(update))
                    update()
                } else if (value[Symbol.iterator]) {
                    for (const item of value) {
                        const next = node.splitText(0)
                        hookNode(scope, node, item)
                        node = next
                    }
                    node.remove()
                } else if (value instanceof Node) {
                    node.appendChild(value)
                }
            }
    }
}

function updateNode(scope, node, value) {
    switch (typeof value) {
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
                if (bind) {
                    let pending = 0
                    const update = () => {
                        if (node.isConnected) {
                            updateNode(scope, node, scope.get(value))
                            pending = 0
                        } else {
                            // I rather stop the listeners when they return false
                        }
                    }
                    scope.bind(value, () => pending ||= requestAnimationFrame(update))
                }
                return node = updateNode(scope, node, scope.get(value))
            }
            if (value[Symbol.iterator]) {
                if (node.nodeType === 3) {
                    let last = node
                    for (const v of value) {
                        const next = last.splitText(0)
                        updateNode(scope, last, v, bind)
                        last = next
                    }
                } else {
                    node.replaceWith(node = I_NODE.cloneNode(true))
                    for (const v of value) {
                        updateNode(scope, node.appendChild(document.createTextNode('')), v, bind)
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
            if (node.nodeType === 3) {
                node.data = ''
            } else {
                node.replaceWith(node = document.createTextNode(''))
            }
            return node
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