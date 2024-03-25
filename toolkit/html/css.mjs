import { atomTag } from "../atoms/atoms.mjs";

function setProperty(store, style, property, value, hooks) {
    switch (typeof value) {
        case 'bigint':
        case 'number':
        case 'string':
            return style.setProperty(property, String(value))
        case 'boolean':
        case 'symbol':
            style.removeProperty(property)
            return
        case 'function':
            return setProperty(store, style, property, value(store, style, property), hooks)
        default:
            if (value) {
                let update
                if (value.constructor === Array) {
                    const parts = value.map(function format(part, index) {
                            switch (typeof part) {
                                case 'bigint':
                                case 'number':
                                case 'string':
                                    return String(part)
                                case 'function':
                                    return format(part(store, style, property), index)
                                default:
                                    if (part && part.atomId) {
                                        const atom = part
                                        if (hooks) {
                                            update = update || function defaultUpdate() {
                                                style.setProperty(property, parts.join(' '))
                                                update = defaultUpdate
                                            }
                                            hooks.push(store.sub(atom, () => {
                                                parts[index] = store.get(atom)
                                                if (update) {
                                                    requestAnimationFrame(update)
                                                    update = undefined
                                                }
                                            }))
                                        }
                                        return format(store.get(atom), index)
                                    } else {
                                        return ''
                                    }
                            }
                        }
                    )
                    return style.setProperty(property, parts.join(' '))
                } else if (value[atomTag]) {
                    const atom = value
                    if (hooks) {
                        let value = store.get(atom)
                        update = function defaultUpdate() {
                            setProperty(store, style, property, value)
                            update = defaultUpdate
                        }
                        hooks.push(store.sub(atom, () => {
                            value = store.get(atom)
                            if (update) {
                                requestAnimationFrame(update)
                                update = undefined
                            }
                        }))
                        return setProperty(store, style, property, value)
                    } else {
                        return setProperty(store, style, property, store.get(atom))
                    }
                } else {
                    return style.setProperty(property, 'auto')
                }
            } else {
                style.removeProperty(property)
            }
    }
}

function setStyle(store, style, value, hooks) {
    switch (typeof value) {
        case 'boolean':
        case 'bigint':
        case 'number':
        case 'symbol':
            for (const property of style) {
                style.removeProperty(property)
            }
            return
        case 'string':
            return value.split(';').forEach(entry => {
                const [property, value] = entry.split(':')
                style.setProperty(property.trim(), value.trim())
            })
        case 'function':
            return setStyle(store, style, value(store, style), hooks)
        default:
            if (value) {
                let update
                if (value[atomTag]) {
                    const atom = value
                    if (hooks) {
                        let value = store.get(atom)
                        update = function defaultUpdate() {
                            setStyle(store, style, value)
                            update = defaultUpdate
                        }
                        hooks.push(store.sub(atom, () => {
                            value = store.get(atom)
                            if (update) {
                                requestAnimationFrame(update)
                                update = undefined
                            }
                        }))
                        return setStyle(store, style, value)
                    } else {
                        return setStyle(store, style, store.get(atom))
                    }
                } else {
                    const entries = Object.entries(value)
                    for (const [property, value] of entries) {
                        setProperty(store, style, property, value, hooks)
                    }
                }
            }
            for (const property of style) {
                style.removeProperty(property)
            }
    }
}

const CACHE = new WeakMap()
const HOLE = '\x01'

export function css(strings) {
    let render = CACHE.get(strings)
    if (render === undefined) {
        const rules = []
        const path = []
        let p = 0
        let property
        let index = 0
        let from = 0, selector = ''
        const textContent = strings.join(HOLE).replace(/\s+|[\x01{};:]/g, (ch, offset) => {
            switch (ch) {
                case ':':
                    property = textContent.slice(from, offset)
                    return ch
                case ';':
                    property = undefined
                    from = offset + 1
                    return ch
                case '{':
                    path.push(p)
                    p = 0
                    selector = textContent.slice(from, offset)
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
        CACHE.set(strings, render = (scope, vars) => {
            const extraSheet = new CSSStyleSheet();
            extraSheet.replaceSync(textContent);
        })
    }

    return (store, {adoptedStyleSheets} = document) => {

        adoptedStyleSheets.push();

        root.appendChild(style)
        const hooks = defaultHooks ?? []
        const styleSheet = document.styleSheets[document.styleSheets.length - 1]
        for (const {path, property, value} of rules) {
            let rule = styleSheet
            for (let i = 0; i < path.length; i++) {
                rule = rule.cssRules[path[i]]
            }
            const style = rule.style
            if (property) {
                setProperty(store, style, property, value, hooks)
            } else {
                setStyle(store, style, value, hooks)
            }
        }
        if (hooks !== defaultHooks) {
            return () => hooks.forEach(h => h())
        }
    }
}