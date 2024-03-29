import {atomTag} from '../atoms/atoms.mjs'
import {PLACEHOLDER} from './html.mjs'

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg'
export const XHTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml'

export function render(scope, input, nsURI) {
    const parts = Array.isArray(input) ? input : [null, null, input]
    const tag = parts[0]
    const attrs = parts[1]
    if (typeof tag === 'function') {
        return tag({attrs, children: parts.slice(2)})
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
    for (let i = 2; i < parts.length; i++) {
        appendNode(scope, node, parts[i])
    }
    return node
}

export function appendNode(scope, parent, value) {
    const type = typeof value
    if (type === 'string' || type === 'number' || type === 'bigint') {
        return parent.appendChild(document.createTextNode(value))
    }
    if (type === 'function') {
        return appendNode(scope, parent, value.call(scope, parent))
    }
    if (type === 'object' && value !== null) {
        if (value instanceof Node) {
            return parent.appendChild(value)
        }
        if (value[atomTag]) {
            let node = appendNode(scope, parent, scope.get(value))
            let pending
            const update = () => {
                node = updateNode(scope, node, scope.get(value))
                pending = 0
            }
            scope.bind(value, () => pending ||= requestAnimationFrame(update))
            return node
        }
        if (value[Symbol.iterator]) {
            const slot = parent.appendChild(document.createElement('slot'))
            const $nodes = slot.$nodes = new WeakMap()
            for (const item of value) {
                $nodes.set(item, appendNode(scope, parent, item))
            }
            return slot
        }
    }
    return parent.appendChild(document.createTextNode(''))
}

function updateNode(scope, node, value) {
    if (value === null) {
        node.replaceWith(node = PLACEHOLDER.cloneNode())
        return node
    }
    const type = typeof value
    if (type === 'boolean') {
        value = ''
        if (node.nodeType === 3) {
            node.data = value
        } else {
            node.replaceWith(node = document.createTextNode(value))
        }
        return node
    }
    if (type === 'bigint' || type === 'number' || type === 'string') {
        if (node.nodeType === 3) {
            node.data = value
        } else {
            node.replaceWith(node = document.createTextNode(value))
        }
        return node
    }
    if (type === 'function') {
        value = value.call(scope, node)
        return value !== undefined ? updateNode(scope, node, value) : node
    }
    if (type === 'object') {
        if (value[atomTag]) {
            return updateNode(scope, node, scope.get(value))
        }
        if (value[Symbol.iterator]) {
            if (node.tagName === 'slot') {
                // TODO: This is a rudimental diff & replace... a lot of room for improvement here
                let childIndex = 0
                for (const item of value) {
                    let childNode = node.childNodes[childIndex++]
                    if (childNode.$item !== item) {
                        childNode = updateNode(scope, PLACEHOLDER.cloneNode(), item)
                    }
                    childNode.$item = item
                }
            } else {
                const slot = document.createElement('slot')
                for (const item of value) {
                    const childNode = updateNode(scope, slot.appendChild(PLACEHOLDER.cloneNode()), item)
                    childNode.$item = item
                }
                node.replaceWith(slot)
            }
            return node
        }
        if (value.tag) {
            const {tag, attrs, children} = value
            const nsURI = node.parentNode.namespaceURI
            const el = nsURI && nsURI !== XHTML_NAMESPACE_URI
                ? document.createElementNS(nsURI, tag)
                : tag === 'svg'
                    ? document.createElementNS(SVG_NAMESPACE_URI, tag)
                    : document.createElement(tag)
            if (attrs) for (const [name, value] of Object.entries(attrs)) {
                setAttribute(scope, el, name, value)
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
    }
    node.replaceWith(node = PLACEHOLDER.cloneNode())
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