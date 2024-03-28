import {appendNode} from './hooks.mjs'
import {atomTag} from '../atoms/atoms.mjs'

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

export function render(scope, jsx, nsURI) {
    const tag = jsx[0]
    const attrs = jsx[1]
    if (typeof tag === 'function') {
        return tag({attrs, children: jsx.slice(2)})
    }
    const node = tag === null
        ? document.createDocumentFragment()
        : nsURI && nsURI !== XHTML_NAMESPACE_URI
            ? document.createElementNS(nsURI, tag)
            : tag === 'svg'
                ? document.createElementNS(SVG_NAMESPACE_URI, tag)
                : document.createElement(tag)
    if (attrs) {
        for (const name of Object.keys(attrs)) {
            const value = attrs[name]
            if (name === 'class' || name === 'className') {
                if (value?.[atomTag]) {
                    hookAttr(scope, writeClassName.bind(node), value)
                } else {
                    writeClassName.call(node, value)
                }
                continue
            }
            if (name === 'style') {
                if (value?.[atomTag]) {
                    hookAttr(scope, writeStyle.bind(node), value)
                } else {
                    writeStyle.call(node, value)
                }
                continue
            }
            if (name[0] === 'o' && name[1] === 'n') {
                const event = name[2] === ':' ? name.slice(3) : name[2].toLowerCase() + name.slice(3)
                node.addEventListener(event, value)
                continue
            }
            if (name === 'ref') {
                if (value?.[atomTag]) {
                    scope.set(value, node)
                } else if (typeof value === 'function') {
                    value(node)
                }
                continue
            }
            if (value?.[atomTag]) {
                hookAttr(scope, writeAttr.bind(node, name), value)
            } else {
                writeAttr.call(node, name, value)
            }
        }
    }
    for (let i = 2; i < jsx.length; i++) {
        const value = jsx[i]
        const type = typeof value
        if (type === 'string' || type === 'number' || type === 'bigint') {
            node.appendChild(document.createTextNode(value))
            continue
        }
        if (type === 'object' && value) {
            if (value instanceof Node) {
                node.appendChild(value)
                continue
            }
        }
    }
    return node
}

function hookAttr(scope, write, atom) {
    let pending
    const update = () => pending = write(scope.get(atom))
    scope.bind(atom, () => pending ||= requestAnimationFrame(update))
    update()
}

function writeClassName(value) {
    const type = typeof value
    if (type === 'string' || type === 'number' || type === 'bigint') {
        this.className = value
        return
    }
    if (value) {
        if (type === 'object') {
            const parts = []
            if (value[Symbol.iterator]) {
                for (const part of value) {
                    if (typeof part === 'string') parts.push(part)
                }
            } else {
                for (const [key, part] of Object.entries(value)) {
                    if (part) parts.push(key)
                }
            }
            this.className = parts.join(' ')
            return
        }
        this.className = String(value)
    } else {
        this.className = null
    }
}

function writeStyle(value) {
    const type = typeof value
    if (type === 'string' || type === 'number' || type === 'bigint') {
        this.className = value
        return
    }
    if (value) {
        if (type === 'object') {
            const parts = []
            if (value[Symbol.iterator]) {
                for (const part of value) {
                    if (typeof part === 'string') parts.push(part)
                }
            } else {
                for (const [key, part] of Object.entries(value)) {
                    if (part) parts.push(key)
                }
            }
            this.className = parts.join(' ')
            return
        }
        this.className = String(value)
    } else {
        this.className = null
    }
}

function writeAttr(name, value) {
    const type = typeof value
    if (type === 'boolean') {
        if (value) {
            this.setAttribute(name, '')
        } else {
            this.removeAttribute(name)
        }
        return
    }
    if (type === 'string' || type === 'number' || type === 'bigint') {
        this.setAttribute(name, value)
        return
    }
    if (value) {
        this.setAttribute(name, String(value))
    } else {
        this.removeAttribute(name)
    }
}