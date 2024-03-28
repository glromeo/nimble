import {atom, atomTag} from '../atoms/atoms.mjs'
import {PLACEHOLDER, SVG_NAMESPACE_URI, XHTML_NAMESPACE_URI} from './html.mjs'

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
            let node = appendNode(scope, parent, scope.get(value)), pending
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
    return parent.appendChild(document.createComment(String(value)))
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

export function hookSpread(scope, node, value) {
    const type = typeof value
    if (type === 'function') {
        hookSpread(scope, node, value.call(scope, node))
        return
    }
    if (type === 'object' && value !== null) {
        if (value[atomTag]) {
            const atom = value
            let names = Object.keys(value = scope.get(atom))
            let pending
            const update = () => {
                for (const name of names) {
                    if (!(name in value)) {
                        node.removeAttribute(name)
                    }
                }
                for (const name of names = Object.keys(value)) {
                    setAttribute(scope, node, name, value[name])
                }
                pending = 0
            }
            scope.bind(value, () => pending ||= requestAnimationFrame(update))
            update()
            return
        }
        for (const entry of value.entries?.() ?? Object.entries(value)) {
            const [name, value] = entry
            try {
                createAttribute(scope, node, name, value)
            } catch (error) {
                console.warn(`Unable to hook attributes on node <${node.tagName}>.`, error.message)
            }
        }
    }
}

function format(value) {
    const type = typeof value
    if (type === 'bigint' || type === 'number' || type === 'string') {
        return value
    }
    return ''
}

export function createAttribute(scope, node, name, value) {
    const type = typeof value
    if (type === 'function') {
        if (name[0] === 'o' && name[1] === 'n') {
            const event = name[2] === ':' ? name.slice(3) : name[2].toLowerCase() + name.slice(3)
            node.addEventListener(event, value)
            return
        }
        createAttribute(scope, node, name, value.call(scope, node))
        return
    }
    if (type === 'object' && value !== null) {
        if (value[atomTag]) {
            const atom = value
            let pending
            const update = () => {
                setAttribute(scope, node, name, scope.get(atom))
                pending = 0
            }
            scope.bind(atom, () => pending ||= requestAnimationFrame(update))
            update()
            return
        }
        const parts = []
        const separator = value[Symbol.iterator] ? ' ' : ';'
        let pending
        const update = () => {
            node.setAttribute(name, parts.join(separator))
            pending = 0
        }
        if (separator === ' ') {
            for (const part of value) {
                if (part?.[atomTag]) {
                    const p = parts.length
                    scope.bind(part, v => {
                        parts[p] = format(v)
                        pending ||= requestAnimationFrame(update)
                    })
                    parts.push(format(scope.get(part)))
                } else {
                    parts.push(format(part))
                }
            }
        } else {
            const pair = (key, value) => {
                const text = format(value)
                return text ? `${key}:${text}` : ''
            }
            for (const [key, part] of Object.entries(value)) {
                if (part?.[atomTag]) {
                    const p = parts.length
                    scope.bind(part, v => {
                        parts[p] = pair(key, v)
                        pending ||= requestAnimationFrame(update)
                    })
                    parts.push(pair(key, scope.get(part)))
                } else {
                    parts.push(pair(key, part))
                }
            }
        }
        update()
        return
    }
    setAttribute(scope, node, name, value)
}

export function holeyAttribute(scope, node, name, strings, values) {
    let pending = 0
    const update = () => {
        let text = strings[0]
        for (let i = 0; i < values.length;) {
            text += values[i]
            text += strings[++i]
        }
        node.setAttribute(name, text)
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

export function hookText(scope, node, strings, values) {
    let pending = 0
    const update = () => {
        let text = strings[0]
        for (let i = 0; i < values.length;) {
            text += values[i]
            text += strings[++i]
        }
        node.data = text
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

function setAttribute(scope, node, name, value) {
    if (value === null) {
        node.removeAttribute(name)
        return
    }
    const type = typeof value
    if (type === 'bigint' || type === 'number' || type === 'string') {
        node.setAttribute(name, value)
        return
    }
    if (type === 'boolean') {
        if (value) {
            node.setAttribute(name, '')
        } else {
            node.removeAttribute(name)
        }
        return
    }
    if (type === 'function') {
        setAttribute(node, name, value(node))
        return
    }
    if (type === 'object') {
        if (value[atomTag]) {
            setAttribute(node, name, scope.get(atom))
            return
        }
        const parts = []
        let joint
        if (value[Symbol.iterator]) {
            for (const part of value) {
                parts.push(format(part?.[atomTag] ? scope.get(part) : part))
            }
            joint = ' '
        } else {
            for (const [key, part] of Object.entries(value)) {
                parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`)
            }
            joint = ';'
        }
        return node.setAttribute(name, parts.join(joint))
    }
    return node.removeAttribute(name)
}