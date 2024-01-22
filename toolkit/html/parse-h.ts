const MODE_SLASH = 0
const MODE_TEXT = 1
const MODE_WHITESPACE = 2
const MODE_TAGNAME = 3
const MODE_COMMENT = 4
const MODE_PROP_SET = 5
const MODE_PROP_APPEND = 6

const CHILD_APPEND = 0
const CHILD_RECURSE = 2
const TAG_SET = 3
const PROPS_ASSIGN = 4
const PROP_SET = MODE_PROP_SET
const PROP_APPEND = MODE_PROP_APPEND

function h(this: any, tag: string | any, attrs: any, ...children: any[]) {
    // console.log(this, tag, attrs, children)
    if (typeof tag === 'object') {
        if (attrs.class && tag.attrs.class) {
            attrs.class = `${tag.attrs.class} ${attrs.class}`
        }
        if (attrs.style && tag.attrs.style) {
            attrs.style = `${tag.attrs.style}; ${attrs.style}`
        }
        return {
            ...tag,
            attrs: {
                ...tag.attrs,
                ...attrs
            }
        }
    }
    return {tag, attrs, children}
}

export function evaluate(commands: ReturnType<typeof build>, fields: IArguments, args: any[]) {

    // `build()` used the first element of the operation list as
    // temporary workspace. Now that `build()` is done we can use
    // that space to track whether the current element is "dynamic"
    // (i.e. it or any of its descendants depend on dynamic values).
    commands[0] = 0

    for (let i = 1; i < commands.length; i++) {
        const type = commands[i++]

        // Set `built[0]`'s appropriate bits if this element depends on a dynamic value.
        const value = commands[i] ? ((commands[0] |= type ? 1 : 2), fields[commands[i++]]) : commands[++i]

        if (type === TAG_SET) {
            args[0] = value
        } else if (type === PROPS_ASSIGN) {
            args[1] = Object.assign(args[1] || {}, value)
        } else if (type === PROP_SET) {
            (args[1] = args[1] || {})[commands[++i]] = value
        } else if (type === PROP_APPEND) {
            args[1][commands[++i]] += (value + '')
        } else if (type) { // type === CHILD_RECURSE
            // Set the operation list (including the staticness bits) as
            // `this` for the `h` call.
            let tmp = h.apply(value, evaluate(value, fields, ['', null]) as any)
            args.push(tmp)

            if (value[0]) {
                // Set the 2nd lowest bit it the child element is dynamic.
                commands[0] |= 2
            } else {
                // Rewrite the operation list in-place if the child element is static.
                // The currently evaluated piece `CHILD_RECURSE, 0, [...]` becomes
                // `CHILD_APPEND, 0, tmp`.
                // Essentially the operation list gets optimized for potential future
                // re-evaluations.
                commands[i - 2] = CHILD_APPEND
                commands[i] = tmp
            }
        } else { // type === CHILD_APPEND
            args.push(value)
        }
    }

    return args
}

export function build(strings: TemplateStringsArray) {
    let mode: any = MODE_TEXT
    let buffer = ''
    let quote = ''
    let stream: any[] = [0]
    let propName: string

    const commit = (pos?: number) => {
        switch (mode) {
            case MODE_TEXT:
                if (pos || buffer) {
                    stream.push(CHILD_APPEND, pos, buffer)
                }
                break
            case MODE_TAGNAME:
                if (pos || buffer) {
                    stream.push(TAG_SET, pos, buffer)
                    mode = MODE_WHITESPACE
                }
                break
            case MODE_WHITESPACE:
                if (buffer === '...' && pos) {
                    stream.push(PROPS_ASSIGN, pos, 0)
                }
                if (buffer && !pos) {
                    stream.push(PROP_SET, 0, true, buffer)
                }
                break
            case MODE_PROP_SET:
            case MODE_PROP_APPEND:
                if (buffer || (!pos && mode === MODE_PROP_SET)) {
                    stream.push(mode, 0, buffer, propName)
                    mode = MODE_PROP_APPEND
                }
                if (pos) {
                    stream.push(mode, pos, 0, propName)
                    mode = MODE_PROP_APPEND
                }
        }
        buffer = ''
    }

    for (let s = 0, text = strings[0]; s < strings.length; text = strings[++s]) {
        if (s) {
            if (mode === MODE_TEXT) {
                commit();
            }
            commit(s);
        }
        for (let c = 0, ch = text[0]; c < text.length; ch = text[++c]) {
            if (mode === MODE_TEXT) {
                if (ch === '<') {
                    buffer = buffer.trimEnd()
                    commit()
                    stream = [stream]
                    mode = MODE_TAGNAME
                } else if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
                    if (buffer.length) {
                        if (buffer[buffer.length - 1] !== ' ') {
                            buffer += ' '
                        }
                    } else {
                        buffer = ' '
                    }
                } else {
                    buffer += ch
                }
            } else if (mode === MODE_COMMENT) {
                // Ignore everything until the last three characters are '-', '-' and '>'
                if (buffer === '--' && ch === '>') {
                    mode = MODE_TEXT
                    buffer = ''
                } else {
                    buffer = ch + buffer[0]
                }
            } else if (quote) {
                if (ch === quote) {
                    quote = ''
                } else {
                    buffer += ch
                }
            } else if (ch === '"' || ch === '\'') {
                quote = ch
            } else if (ch === '>') {
                commit()
                mode = MODE_TEXT
            } else if (!mode) {
                // Ignore everything until the tag ends
            } else if (ch === '=') {
                mode = MODE_PROP_SET
                propName = buffer
                buffer = ''
            } else if (ch === '/' && (mode < MODE_PROP_SET || text[c + 1] === '>')) {
                commit()
                if (mode === MODE_TAGNAME) {
                    stream = stream[0]
                }
                mode = stream;
                (stream = stream[0]).push(CHILD_RECURSE, 0, mode)
                mode = MODE_SLASH
            } else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
                // <a disabled>
                commit()
                mode = MODE_WHITESPACE
            } else {
                buffer += ch
            }
            if (mode === MODE_TAGNAME && buffer === '!--') {
                mode = MODE_COMMENT
                stream = stream[0]
            }
        }
    }
    if (buffer === ' ') {
        buffer = ''
    }
    commit()
    return stream
}

const cache = new Map()

export const htm = function (statics: TemplateStringsArray, args: IArguments) {
    let built = cache.get(statics)
    if (built === undefined) {
        cache.set(statics, built = build(statics))
    }
    let tmp = evaluate(built, args, [])
    return tmp.length > 1 ? tmp : tmp[0]
}