import {Atom} from '../atoms/atoms'

function setProperty(style: CSSStyleDeclaration, property: string, value: any, hooks?: Function[]): void {
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
            return setProperty(style, property, value(style, property), hooks)
        default:
            if (value) {
                let update: FrameRequestCallback | undefined
                if (value.constructor === Array) {
                    const parts = value.map(function format(part: any, index: number): string {
                            switch (typeof part) {
                                case 'bigint':
                                case 'number':
                                case 'string':
                                    return String(part)
                                case 'function':
                                    return format(part(style, property), index)
                                default:
                                    if (part && part.atomId) {
                                        const atom = part as Atom<any>
                                        if (hooks) {
                                            update = update || function defaultUpdate() {
                                                style.setProperty(property, parts.join(' '))
                                                update = defaultUpdate
                                            }
                                            hooks.push(atom.sub(() => {
                                                parts[index] = atom.get()
                                                if (update) {
                                                    requestAnimationFrame(update)
                                                    update = undefined
                                                }
                                            }))
                                        }
                                        return format(atom.get(), index)
                                    } else {
                                        return ''
                                    }
                            }
                        }
                    )
                    return style.setProperty(property, parts.join(' '))
                } else if (value.atomId) {
                    const atom = value as Atom<any>
                    if (hooks) {
                        let value = atom.get()
                        update = function defaultUpdate() {
                            setProperty(style, property, value)
                            update = defaultUpdate
                        }
                        hooks.push(atom.sub(() => {
                            value = atom.get()
                            if (update) {
                                requestAnimationFrame(update)
                                update = undefined
                            }
                        }))
                        return setProperty(style, property, value)
                    } else {
                        return setProperty(style, property, atom.get())
                    }
                } else {
                    return style.setProperty(property, 'auto')
                }
            } else {
                style.removeProperty(property)
            }
    }
}

function setStyle(style: CSSStyleDeclaration, value: any, hooks?: Function[]): void {
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
            return setStyle(style, value(style), hooks)
        default:
            if (value) {
                let update: FrameRequestCallback | undefined
                if (value.atomId) {
                    const atom = value as Atom<any>
                    if (hooks) {
                        let value = atom.get()
                        update = function defaultUpdate() {
                            setStyle(style, value)
                            update = defaultUpdate
                        }
                        hooks.push(atom.sub(() => {
                            value = atom.get()
                            if (update) {
                                requestAnimationFrame(update)
                                update = undefined
                            }
                        }))
                        return setStyle(style, value)
                    } else {
                        return setStyle(style, atom.get())
                    }
                } else {
                    const entries = Object.entries(value)
                    for (const [property, value] of entries) {
                        setProperty(style, property, value, hooks)
                    }
                }
            }
            for (const property of style) {
                style.removeProperty(property)
            }
    }
}

const HOLE = '\x01'
let gId = 0

export function css(statics: TemplateStringsArray, ...values: any[]) {
    const textContent = statics.join(HOLE)
    const style = document.createElement('style')
    style.setAttribute('title', 'nimble-css')
    style.setAttribute('group-id', String(++gId))

    const rules: { path: Uint8Array, property?: string, value: Function | Atom<any> }[] = []
    const path: number[] = []
    let p = 0
    let property: string | undefined
    let index = 0
    let from = 0, selector = ''
    style.textContent = textContent.replace(/\s+|[\x01{};:]/g, (ch: string, offset: number) => {
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
                p = path.pop()! + 1
                from = offset + 1
                selector = ''
                return ch
            case HOLE:
                let value = values[index++]
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

    return (root: HTMLElement = document.head, defaultHooks?: Function[]) => {
        root.appendChild(style)
        const hooks = defaultHooks ?? []
        const styleSheet = document.styleSheets[document.styleSheets.length - 1]
        for (const {path, property, value} of rules) {
            let rule = styleSheet as any
            for (let i = 0; i < path.length; i++) {
                rule = rule.cssRules[path[i]]
            }
            const style = rule.style as CSSStyleDeclaration
            if (property) {
                setProperty(style, property, value, hooks)
            } else {
                setStyle(style, value, hooks)
            }
        }
        if (hooks !== defaultHooks) {
            return () => hooks.forEach(h => h())
        }
    }
}