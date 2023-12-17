type HT = {
    tag: string
    attrs: Record<string, string>
    children: (string | HT)[]
}

export function toHyperScript(node: Node): string | HT | ((string | HT)[]) {
    switch (node.nodeType) {
        case Node.ELEMENT_NODE: {
            const {tagName, attributes, childNodes} = node as HTMLElement
            const hso: HT = {
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
                    hso.children.push(...(items as (string | HT)[]))
                } else {
                    hso.children.push(items as string | HT)
                }
            }
            return hso
        }
        case Node.TEXT_NODE:
        case Node.CDATA_SECTION_NODE:
        case Node.PROCESSING_INSTRUCTION_NODE:
        case Node.COMMENT_NODE:
            return (node as Text).data
        default: {
            const {childNodes} = node as DocumentFragment
            const hsa = [] as (string | HT)[]
            for (const child of childNodes) {
                const items = toHyperScript(child)
                if (items.constructor === Array) {
                    hsa.push(...(items as (string | HT)[]))
                } else {
                    hsa.push(items as string | HT)
                }
            }
            return hsa
        }
    }
}

export function AntIcon(module: any | {default: any}) {
    const {icon, name, theme} = module.default ?? module
    const get = ({tag, attrs, children}:HT) => ({
        tag,
        attrs: {
            ...attrs,
            name,
            class: 'ant-icon ' + theme
        },
        children
    })
    if (typeof icon === 'function') {
        return (...args:any[]) => get(icon(...args)) as HT
    } else {
        return get(icon) as HT
    }
}