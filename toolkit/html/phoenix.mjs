const TEXT = 0
const TAG = 1
const WS = 2
const A_N = 3
const BRK = 4
const A_V = 5
const A_Q1 = 6
const A_Q2 = 7
const S_C = 8

const isWhitespace = ch => ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'

const TEXT_NODE = 1
const ELEMENT = 2
const ELEMENT_NS = 3
const SET_ATTR = 4

function parseHTML(html) {
    const queue = []
    let node = queue
    let state = TEXT
    let i = 0
    for (let j = 0; j < html.length; j++) {
        const ch = html[j]
        switch (state) {
            case TEXT:
                if (ch === '<') {
                    node.push(TEXT_NODE, html.slice(i, i = j))
                    state = TAG
                }
                continue
            case TAG:
                if (isWhitespace(ch)) {
                    if (j - i === 1) {
                        i -= node[node.length - 1].length
                        node.length -= 2
                        state = TEXT
                    }
                } else if (ch === '>') {
                    if (j - i === 1) {
                        i -= node[node.length - 1].length
                        node.length -= 2
                        state = TEXT
                    }
                }
                continue
            case WS:
                continue
            case A_N:
                continue
            case BRK:
                continue
            case A_V:
                continue
            case A_Q1:
                continue
            case A_Q2:
                continue
            case S_C:
                continue
            default:
        }
    }

    if (i < html.length) {
        if (state === TEXT) {
            node.push(TEXT_NODE, html.slice(i, html.length))
        }
    }

    return queue
}

function expect(input, output) {
    let actual = JSON.stringify(parseHTML(input))
    let expected = JSON.stringify(output)
    if (actual !== expected) console.error(`"${input}"`, 'actual:', actual, 'expected:', expected)
}

expect('', [])
expect(' ', [TEXT_NODE, ' '])
expect(' <', [TEXT_NODE, ' <'])
expect(' < ', [TEXT_NODE, ' < '])
expect(' <>', [TEXT_NODE, ' <>'])
expect(' <a', [TEXT_NODE, ' '])
expect(' <a ', [TEXT_NODE, ' '])