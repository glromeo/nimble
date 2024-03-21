export function jsx(tag, props) {
    if (typeof tag === 'function') {
        return tag(props)
    }
    const el = document.createElement(tag)
    if (props.children) {
        el.replaceChildren(props.children)
        props.children = null
    }
    for (const name of Object.keys(props)) {
        const value = props[name]
        const type = typeof value
        if (type === 'string' || type === 'number' || type === 'bigint') {
            el.setAttribute(name, value)
        }
        if (type === 'object') {
            if (name === 'class') {
                el.classList.add(...value)
            }
            if (name === 'style') {
                Object.assign(el.style, value)
                continue
            }
        }
        if (type === 'boolean') {
            if (value) {
                el.setAttribute(name, '')
            }
        }
    }
    return el
}

export function Fragment({children}) {
    const fragment = document.createDocumentFragment()
    fragment.replaceChildren(children)
    return fragment
}

