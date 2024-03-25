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

import {
    hookNode,
    hookAttr,
    hookValue,
    hookQuote,
    hookText
} from './hooks.mjs'

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

