import {molecule} from '@nimble/toolkit'

let commands = []


export function jsx(tag, props) {
    if (typeof tag === 'function') {
        return tag(props)
    }
    const node = document.createElement(tag)
    for (const name of Object.keys(props)) {
        const value = props[name]
        const type = typeof value
        if (type === 'string' || type === 'number' || type === 'bigint') {
            if (name === "children") {
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
    return node
}

export function Fragment({children}) {
    const fragment = document.createDocumentFragment()
    fragment.replaceChildren(children)
    return fragment
}
