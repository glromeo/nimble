import {Atom, globalScope} from '../atoms/atoms.mjs'

function setProperty(style, property, value) {
    const type = typeof value
    if (type === 'function') {
        return setProperty.call(this, style, property, value(this, style, property))
    }
    if (type === 'object') {
        if (value instanceof Atom) {
            return setProperty.call(this, style, property, this.get(value))
        }
        if (value[Symbol.iterator]) {
            const parts = []
            for (let item of value) {
                if (item instanceof Atom) {
                    item = this.get(item)
                }
                const type = typeof item
                if (type === 'bigint' || type === 'number' || type === 'string') {
                    parts.push(item)
                }
            }
            return style.setProperty(property, parts.join(' '))
        }
        return style.setProperty(property, 'auto')
    }
    if (type === 'bigint' || type === 'number' || type === 'string') {
        return style.setProperty(property, String(value))
    }
    return style.removeProperty(property)
}

function setStyle(style, value) {
    const type = typeof value
    if (type === 'function') {
        return setStyle.call(this, value.call(this, style))
    }
    if (type === 'string') {
        for (const entry of value.split(';')) {
            const [property, value] = entry.split(':')
            style.setProperty(property.trim(), value.trim())
        }
        return
    }
    if (type === 'object') {
        if (value instanceof Atom) {
            return setStyle.call(this, style, this.get(atom))
        }
        if (value) {
            const entries = Object.entries(value)
            for (const [property, value] of entries) {
                setProperty.call(this, style, property, value)
            }
            return
        }
    }
    for (const property of style) {
        style.removeProperty(property)
    }
}

const HOLE = '\x01'

export function css(strings) {
    let text = strings.join(HOLE)
    const rules = []
    const path = []
    let p = 0
    let property
    let index = 0
    let from = 0, selector = ''
    text = text.replace(/\s+|[\x01{};:]/g, (ch, offset) => {
        switch (ch) {
            case ':':
                property = text.slice(from, offset)
                return ch
            case ';':
                property = undefined
                from = offset + 1
                return ch
            case '{':
                path.push(p)
                p = 0
                selector = text.slice(from, offset)
                from = offset + 1
                return ch
            case '}':
                p = path.pop() + 1
                from = offset + 1
                selector = ''
                return ch
            case HOLE:
                let value = arguments[++index]
                switch (typeof value) {
                    case 'bigint':
                    case 'number':
                    case 'string':
                        return String(value)
                    case 'boolean':
                    case 'symbol':
                        return 'unset'
                    default:
                        if (value) {
                            rules.push({
                                path: Uint8Array.from(path),
                                property,
                                value
                            })
                        }
                        return 'unset'
                }
            default:
                from = offset + ch.length
                return ' '
        }
    })
    return scope => {
        const styleSheet = new CSSStyleSheet();
        styleSheet.replaceSync(text);
        for (const {path, property, value} of rules) {
            let rule = styleSheet
            for (let i = 0; i < path.length; i++) {
                rule = rule.cssRules[path[i]]
            }
            const style = rule.style
            if (property) {
                if (value instanceof Atom) {
                    bindAtom(scope, setProperty.bind(scope, style, property), value)
                } else {
                    setProperty.call(scope, style, property, value)
                }
            } else {
                if (value instanceof Atom) {
                    bindAtom(scope, setStyle.bind(scope, style), value)
                } else {
                    setStyle(scope, style, value)
                }
            }
        }
        return styleSheet
    }
}

function bindAtom(scope, write, atom) {
    let pending
    const update = () => pending = write(scope.get(atom))
    scope.bind(atom, () => pending ||= requestAnimationFrame(update))
    update()
}

export function styleSheet(css) {
    return css(this ?? globalScope)
}