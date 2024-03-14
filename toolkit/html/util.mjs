export function toHyperScript(node) {
    switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
            const {tagName, attributes, childNodes} = node
            const hso = {
                tag: tagName,
                attrs: {},
                children: []
            }
            for (const attr of attributes) {
                hso.attrs[attr.name] = attr.value
            }
            for (const child of childNodes) {
                const items = toHyperScript(child)
                if (items.constructor === Array) {
                    hso.children.push(...items)
                } else {
                    hso.children.push(items)
                }
            }
            return hso
        }
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
        case Node.PROCESSING_INSTRUCTION_NODE:
        case Node.COMMENT_NODE:
            return node.data
        default: {
            const {childNodes} = node
            const hsa = []
            for (const child of childNodes) {
                const items = toHyperScript(child)
                if (items.constructor === Array) {
                    hsa.push(...items)
                } else {
                    hsa.push(items)
                }
            }
            return hsa
        }
    }
}

export function AntIcon(module) {
    const {icon, name, theme} = module.default ?? module
    const get = ({tag, attrs, children}) => ({
        tag,
        attrs: {
            ...attrs,
            name,
            class: 'ant-icon ' + theme
        },
        children
    })
    if (typeof icon === 'function') {
        return (...args) => get(icon(...args))
    } else {
        return get(icon)
    }
}