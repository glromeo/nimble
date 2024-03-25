export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

export function render(scope, node, jsx) {
    const tag = jsx[0]
    const attrs = jsx[1]
    if (typeof tag === 'function') {
        return tag({})
    }
    node = node.appendChild(
        node.namespaceURI && node.namespaceURI !== XHTML_NAMESPACE_URI
            ? document.createElementNS(node.namespaceURI, tag)
            : tag === 'svg'
                ? document.createElementNS(SVG_NAMESPACE_URI, tag)
                : document.createElement(tag)
    )
    for (const name of Object.keys(attrs)) {
        const value = props[name]
        const type = typeof value
        if (type === 'string' || type === 'number' || type === 'bigint') {
            if (name === 'children') {
                node.appendChild(document.createTextNode(value))
            } else {
                node.setAttribute(name, value)
            }
            continue
        }
        if (type === 'function') {
            if (name[0] === 'o' && name[1] === 'n') {
                const event = name[2] === ':' ? name.slice(3) : name[2].toLowerCase() + name.slice(3)
                node.addEventListener(event, value)
            }
            value(node)
            continue
        }
        if (type === 'object') {
            if (name === 'class') {
                if (value[Symbol.iterator]) {
                    node.classList.add(...value)
                    continue
                }
                for (const [name, truthy] of Object.entries(value)) {
                    if (truthy) {
                        node.classList.add(name)
                    } else {
                        node.classList.remove(name)
                    }
                }
                continue
            }
            if (name === 'style') {
                Object.assign(node.style, value)
                continue
            }
        }
        if (type === 'boolean') {
            if (value) {
                node.setAttribute(name, '')
            }
            continue
        }
    }
    for (let i = 2; i < jsx.length; i++) {

    }
}