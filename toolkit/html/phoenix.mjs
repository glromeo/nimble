import { atom, atomTag } from "../atoms/atoms.mjs";

let assertion = 0;

function debugNode(node) {
    let walker = document.createTreeWalker(node, NodeFilter.SHOW_ALL);
    let dump = [];
    while (node = walker.nextNode()) {
        dump.push(node.nodeType, node.nodeValue ?? node.tagName);
    }
    return dump;
}

const expect = function (input, output) {
    ++assertion;
    let [node, ...queue] = parseHTML(input);
    let actual = JSON.stringify([debugNode(node), ...queue]);
    let expected = JSON.stringify(output);
    if (actual !== expected) {
        console.error(`#${assertion} "${input}"`, "\nexpected:", expected, "\nactual:  ", actual);
    }
};

export const HOLE = "\x01";
export const PLACEHOLDER_NODE = document.createComment('');

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

const TEXT_NODE = 100;
const TAG_OPEN = 101;
const TAG_NAME = 102;
const WHITESPACE = 103;
const ATTR_NAME = 104;
const ASSIGN = 105;
const ATTR_VALUE = 106;
const QUOTED_VALUE = 107;
const TAG_CLOSE = 108;
const COMMENT = 109;

export const CHILD_NODE = 200;
export const PARENT_NODE = 201;
export const HOOK_NODE = 202;
export const HOOK_SLOT = 203;
export const HOOK_ATTR = 204;
export const HOOK_COMMENT = 205;
export const HOOK_QUOTE = 206;
export const HOOK_VALUE = 207;

const isWhitespace = ch => ch === " " || ch === "\n" || ch === "\t" || ch === "\r";


const VOID_TAGS = Object.assign(Object.create(null), {
    "AREA": 1,
    "BASE": 1,
    "BR": 1,
    "COL": 1,
    "EMBED": 1,
    "HR": 1,
    "IMG": 1,
    "INPUT": 1,
    "LINK": 1,
    "META": 1,
    "SOURCE": 1,
    "TRACK": 1,
    "WBR": 1
});

export function parseHTML(html) {
    let node = document.createDocumentFragment();
    let hooks = [node];
    let state = TEXT_NODE;
    let name = null;
    let start = 0;
    let end = -1;
    let quote = null;

    function appendElement() {
        hooks.push(CHILD_NODE, node.childNodes.length);
        const tagName = html.slice(start, end).toLowerCase();
        node = node.appendChild(
            node.namespaceURI
                ? document.createElementNS(node.namespaceURI, tagName)
                : tagName === "svg"
                    ? document.createElementNS(SVG_NAMESPACE_URI, tagName)
                    : document.createElement(tagName)
        );
    }

    function appendSlot() {
        hooks.push(CHILD_NODE, node.childNodes.length);
        node = node.appendChild(document.createElement("slot"));
    }

    function matchTagName() {
        const slice = html.slice(start, end);
        return node.tagName === node.namespaceURI ? slice.toLowerCase() : slice.toUpperCase();
    }

    function parentElement() {
        if (end === start || !node.tagName || matchTagName()) {
            if (hooks[hooks.length - 2] === CHILD_NODE) {
                hooks.length -= 2;
            } else {
                hooks.push(PARENT_NODE);
            }
        }
        node = node.parentNode;
    }

    function appendText(end) {
        if (end > start) {
            node.appendChild(document.createTextNode(html.slice(start, end)));
        }
    }

    while (++end < html.length) {
        const ch = html[end];
        switch (state) {
            case TEXT_NODE:
                if (ch === "<") {
                    state = TAG_OPEN;
                    continue;
                }
                if (ch === HOLE) {
                    appendText(end);
                    hooks.push(HOOK_NODE, node.childNodes.length);
                    node.appendChild(PLACEHOLDER_NODE.cloneNode());
                    start = end + 1;
                }
                continue;
            case TAG_OPEN:
                if (isWhitespace(ch)) {
                    state = TEXT_NODE;
                    continue;
                }
                appendText(end - 1);
                if (ch === HOLE) {
                    appendSlot();
                    hooks.push(HOOK_SLOT);
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "!") {
                    start = end + 1;
                    state = COMMENT;
                    continue;
                }
                if (ch === "/") {
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (ch === ">") {
                    appendSlot();
                    start = end + 1;
                    state = TEXT_NODE;
                    continue;
                }
                start = end;
                state = TAG_NAME;
                continue;
            case TAG_NAME:
                if (ch === HOLE) {
                    appendElement();
                    hooks.push(HOOK_ATTR);
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "/") {
                    appendElement();
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (ch === ">") {
                    appendElement();
                    if (node.tagName in VOID_TAGS) {
                        parentElement();
                    }
                    start = end + 1;
                    state = TEXT_NODE;
                    continue;
                }
                if (isWhitespace(ch)) {
                    appendElement();
                    state = WHITESPACE;
                }
                continue;
            case COMMENT:
                if (ch === ">") {
                    if (html[start] === "-" && html[start + 1] === "-") {
                        if (html[end - 1] === "-" && html[end - 2] === "-") {
                            node.appendChild(document.createComment(html.slice(start + 2, end - 2)));
                        } else {
                            continue;
                        }
                    } else {
                        node.appendChild(document.createComment(html.slice(start, end)));
                    }
                    start = end + 1;
                    state = TEXT_NODE;
                }
                continue;
            case WHITESPACE:
                if (ch === HOLE) {
                    hooks.push(HOOK_ATTR);
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "/") {
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (ch === ">") {
                    if (node.tagName in VOID_TAGS) {
                        parentElement();
                    }
                    start = end + 1;
                    state = TEXT_NODE;
                    continue;
                }
                if (!isWhitespace(ch)) {
                    start = end;
                    state = ATTR_NAME;
                }
                continue;
            case ATTR_NAME:
                if (ch === HOLE) {
                    hooks.push(HOOK_ATTR);
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "=" || isWhitespace(ch)) {
                    name = html.slice(start, end);
                    state = ASSIGN;
                    continue;
                }
                if (ch === "/") {
                    node.setAttribute(html.slice(start, end), "");
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (ch === ">") {
                    node.setAttribute(html.slice(start, end), "");
                    if (node.tagName in VOID_TAGS) {
                        parentElement();
                    }
                    start = end + 1;
                    state = TEXT_NODE;
                }
                continue;
            case ASSIGN:
                if (ch === HOLE) {
                    hooks.push(HOOK_VALUE, name);
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "'" || ch === "\"") {
                    quote = ch;
                    start = end + 1;
                    state = QUOTED_VALUE;
                    continue;
                }
                if (ch === "/") {
                    hooks.push("");
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (!isWhitespace(ch)) {
                    start = end;
                    state = ATTR_VALUE;
                }
                continue;
            case QUOTED_VALUE:
                if (ch === quote) {
                    node.setAttribute(name, html.slice(start, end));
                    // if (end - start > 1) {
                    //     const values = html.slice(start, end).split(HOLE)
                    //     if (values.length > 1) {
                    //         hooks.push(html.slice(start, end))
                    //     } else {
                    //         hooks.push(values[0])
                    //     }
                    // }
                    quote = null;
                    state = WHITESPACE;
                }
                continue;
            case ATTR_VALUE:
                if (ch === HOLE) {
                    if (end - start === 1) {
                        hooks.push(HOOK_VALUE, name);
                    } else {
                        node.setAttribute(name, html.slice(start, end));
                        hooks.push(HOOK_ATTR);
                    }
                    state = WHITESPACE;
                    continue;
                }
                if (ch === "/") {
                    node.setAttribute(name, html.slice(start, end));
                    start = end + 1;
                    state = TAG_CLOSE;
                    continue;
                }
                if (ch === ">") {
                    node.setAttribute(name, html.slice(start, end));
                    start = end + 1;
                    state = TEXT_NODE;
                    continue;
                }
                if (isWhitespace(ch)) {
                    node.setAttribute(name, html.slice(start, end));
                    state = WHITESPACE;
                }
                continue;
            case TAG_CLOSE:
                if (ch === ">") {
                    parentElement();
                    start = end + 1;
                    state = TEXT_NODE;
                    continue;
                }
                if (ch === "/") {
                    start = end + 1;
                    continue;
                }
                if (isWhitespace(ch)) {
                    state = WHITESPACE;
                }
        }
    }

    if (start < end) {
        if (state === TEXT_NODE || state === TAG_OPEN) {
            appendText(end);
        }
        if (state === ATTR_NAME) {
            node.setAttribute(html.slice(start, end), "");
        }
        if (state === ASSIGN) {
            node.setAttribute(name, "");
        }
        if (state === WHITESPACE) {
            node.remove();
        }
    }

    return hooks;
}

const CACHE = new WeakMap();

export function html(strings) {
    if (!strings) {
        return null;
    }
    if (!strings.raw) {
        const scope = strings;
        return function () {
            return html.apply(scope, arguments);
        };
    }
    let render = CACHE.get(strings);
    if (render === undefined) {
        const queue = parseHTML(strings.join(HOLE));
        CACHE.set(strings, render = (scope, args) => {
            const fragment = queue[0].cloneNode(true);
            let node = fragment;
            let a = 1;
            for (let q = 1; q < queue.length; ++q) {
                switch (queue[q]) {
                    case CHILD_NODE:
                        node = node.childNodes[queue[++q]];
                        continue;
                    case PARENT_NODE:
                        node = node.parentNode;
                        continue;
                    case HOOK_NODE:
                        hookNode(scope, node.childNodes[queue[++q]], args[a++]);
                        continue;
                    case HOOK_ATTR:
                        hookAttr(scope, node, null, args[a++]);
                        continue;
                    case HOOK_VALUE:
                        hookAttr(scope, node, queue[++q], args[a++]);
                        continue;
                    case HOOK_QUOTE:
                        hookText(scope, node.attributes, "value", slice.call(args, a, a += queue[++q]));
                        continue;
                    case HOOK_COMMENT:
                        hookText(scope, node.childNodes, "data", slice.call(args, a, a += queue[++q]));
                        continue;
                    case HOOK_SLOT:
                        const fn = args[a++];
                        const attrs = {};
                        const children = [];
                        for (let j = q + 3; j < queue.length; j++) {
                            switch (queue[q]) {
                                case ATTR:
                                    attrs[queue[++q]] = queue[++q];
                                    continue;
                                case HOOK_ATTR:
                                    attrs[queue[++q]] = queue[++q];
                                    continue;
                            }
                            break;
                        }
                        node = {
                            attrs: {},
                            setAttribute(name, value) {
                                this[name] = value;
                            }
                        };
                }
            }
            return fragment;
        });
    }
    if (this) {
        return render(this, arguments);
    } else {
        const args = arguments;
        return scope => render(scope, args);
    }
}

const SIBLINGS = Symbol();

function hookNode(scope, node, value) {
    const type = typeof value;
    if (type === "function") {
        hookNode(scope, node, value.call(scope, node));
        return
    }
    if (type === "object" && value !== null) {
        if (value[atomTag]) {
            let pending;
            const update = () => {
                node = updateNode(scope, node, scope.get(value));
                pending = 0;
            };
            scope.bind(value, () => pending ||= requestAnimationFrame(update));
            update();
            return;
        }
        if (value[Symbol.iterator]) {
            const fragment = document.createDocumentFragment()
            for (const item of value) {
                hookNode(scope, fragment.appendChild(PLACEHOLDER_NODE.cloneNode()), item);
            }
            node.replaceWith(fragment);
            return;
        }
    }
    updateNode(scope, node, value);
}

function updateNode(scope, node, value) {
    if (value === null) {
        node.replaceWith(node = PLACEHOLDER_NODE.cloneNode())
        return node
    }
    switch (typeof value) {
        case "bigint":
        case "number":
        case "string":
            if (node.nodeType === 3) {
                node.data = value;
            } else {
                node.replaceWith(node = document.createTextNode(value));
            }
            return node;
        case "function":
            value = value.call(scope, node);
            return value !== undefined ? updateNode(scope, node, value) : node;
        case "object":
            if (value[atomTag]) {
                return updateNode(scope, node, scope.get(value));
            }
            if (value[Symbol.iterator]) {
                if (node.tagName === 'slot') {
                    // TODO: This is a rudimental diff & replace... a lot of room for improvement here
                    let childIndex = 0
                    for (const item of value) {
                        let childNode = node.childNodes[childIndex++];
                        if (childNode.$item !== item) {
                            childNode = updateNode(scope, PLACEHOLDER_NODE.cloneNode(), item);
                        }
                        childNode.$item = item
                    }
                } else {
                    const slot = document.createElement('slot')
                    for (const item of value) {
                        const childNode = updateNode(scope, slot.appendChild(PLACEHOLDER_NODE.cloneNode()), item);
                        childNode.$item = item
                    }
                    node.replaceWith(slot);
                }
                return node;
            }
            if (value.tag) {
                // TODO: This needs to be refactored once the Attrs logis is settled
                const {tag, attrs, children} = value;
                const el = createElement(tag);
                if (attrs) {
                    spreadAttr(scope, el, attrs, bind);
                }
                for (const name of node.getAttributeNames()) {
                    let attribute = node.getAttribute(name);
                    el.setAttribute(name, attribute);
                }
                const className = node.getAttribute("class");
                if (className) {
                    el.setAttribute("class", `${attrs.class} ${className}`);
                }
                const style = node.getAttribute("style");
                if (style) {
                    el.setAttribute("style", `${attrs.style};${style}`);
                }
                if (children) {
                    for (const c of children) {
                        updateNode(scope, el.appendChild(document.createTextNode("")), c, bind);
                    }
                }
                node.replaceWith(el);
                return node;
            }
            if (value instanceof Node) {
                node.replaceWith(value);
                return;
            }
        default:
            node.replaceWith(node = PLACEHOLDER_NODE.cloneNode())
            return node
    }
}

function hookAttr(scope, node, value) {

    const type = typeof value;

    if (type === "function") {
        hookAttr(scope, node, value.call(scope, node));
        return
    }

    if (type === "object" && value !== null) {

        if (value[atomTag]) {
            const atom = value;
            let names = Object.keys(value = store.get(atom));
            let pending;
            const update = () => {
                for (const name of names) {
                    if (!(name in value)) {
                        node.removeAttribute(name);
                    }
                }
                for (const name of names = Object.keys(value)) {
                    setAttr(scope, node, name, value[name]);
                }
                pending = 0;
            };
            scope.bind(value, () => pending ||= requestAnimationFrame(update));
            update();
            return;
        }

        for (const entry of value.entries?.() ?? Object.entries(value)) {
            const [name, value] = entry;
            hookValue(scope, node, name, value);
        }
    }
}

function format(value) {
    switch (typeof value) {
        case "bigint":
        case "number":
        case "string":
            return value;
        default:
            return "";
    }
}

function hookValue(scope, node, name, value) {

    const type = typeof value;

    if (type === "function") {
        hookValue(scope, node, name, value.call(scope, node));
        return
    }

    if (type === "object" && value !== null) {
        if (value[atomTag]) {
            const atom = value
            let pending;
            const update = () => {
                setAttr(scope, node, name, scope.get(atom))
                pending = 0
            };
            scope.bind(atom, () => pending ||= requestAnimationFrame(update));
            update();
            return;
        }
        if (value[Symbol.iterator]) {
            const parts = [];
            let pending;
            const update = () => {
                node.setAttribute(name, parts.join(" "));
                pending = 0;
            };
            for (const part of value) {
                if (part?.[atomTag]) {
                    const p = parts.length;
                    scope.bind(part, v => {
                        parts[p] = format(v);
                        update();
                    });
                    parts.push(format(scope.get(part)));
                } else {
                    parts.push(format(part));
                }
            }
            scope.bind(atom, () => pending ||= requestAnimationFrame(update));
            update()
            return
        }
    }

    setAttr(scope, node, name, value)

    switch (typeof value) {
        case "bigint":
        case "number":
        case "string":
            return node.setAttribute(name, value);
        case "boolean":
            if (value) {
                return node.setAttribute(name, "");
            } else {
                return node.removeAttribute(name);
            }
        case "function":
            return node.setAttribute(name, value.call(scope, node));
        case "object":
            if (value[Symbol.iterator]) {
                const parts = [];
                if (bind) {
                    let pending = false;
                    const update = () => {
                        node.setAttribute(name, parts.join(" "));
                        pending = false;
                    };
                    for (const part of value) {
                        if (part?.[atomTag]) {
                            const p = parts.length;
                            scope.bind(part, v => {
                                parts[p] = format(v);
                                update();
                            });
                            parts.push(format(scope.get(part)));
                        } else {
                            parts.push(format(part));
                        }
                    }
                } else {
                    for (const part of value) {
                        parts.push(format(part?.[atomTag] ? scope.get(part) : part));
                    }
                }
                return node.setAttribute(name, parts.join(" "));
            } else {
                const parts = [];
                if (bind) {
                    let pending = false;
                    const update = () => {
                        node.setAttribute(name, parts.join(";"));
                        pending = false;
                    };
                    for (const [key, part] of Object.entries(value)) {
                        if (part?.[atomTag]) {
                            const p = parts.length;
                            scope.bind(part, v => {
                                parts[p] = format(v);
                                update();
                            });
                            parts.push(`${key}:${format(scope.get(part))}`);
                        } else {
                            parts.push(`${key}:${format(part)}`);
                        }
                    }
                } else {
                    for (const [key, part] of Object.entries(value)) {
                        parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`);
                    }
                }
                return node.setAttribute(name, parts.join(";"));
            }
        default:
            return node.removeAttribute(name);
    }
}

function hookText(scope, nodes, field, values) {
    const node = nodes[nodes.length - 1];
    let pending = 0;
    const strings = node[field].split(HOLE);
    const update = () => {
        let text = strings[0];
        for (let i = 0; i < values.length;) {
            text += values[i];
            text += strings[++i];
        }
        node[field] = text;
        pending = 0;
    };
    for (let i = 0; i < values.length; ++i) {
        if (values[i]?.[atomTag]) {
            scope.bind(values[i], value => {
                values[i] = value;
                pending ||= requestAnimationFrame(update);
            });
            values[i] = format(scope.get(values[i]));
        } else {
            values[i] = format(values[i]);
        }
    }
    update();
}

function setProperty(scope, node, name, value, bind) {
    if (value?.[atomTag]) {
        if (bind) {
            scope.bind(atom, v => node[name] = v);
        }
        node[name] = scope.get(value);
    } else {
        node[name] = value;
    }
}

function setHandler(scope, node, event, value, bind) {
    if (value?.[atomTag]) {
        const atom = value;
        if (bind) {
            scope.bind(atom, v => {
                node.removeEventListener(event, value);
                node.addEventListener(event, value = v);
            });
        } else {
            node.addEventListener(event, value = scope.get(atom));
        }
    } else if (typeof value === "function") {
        node.addEventListener(event, value);
    }
}

function setAttr(scope, node, name, value, bind) {
    value = value ?? "";
    switch (typeof value) {
        case "bigint":
        case "number":
        case "string":
            return node.setAttribute(name, value);
        case "boolean":
            if (value) {
                return node.setAttribute(name, "");
            } else {
                return node.removeAttribute(name);
            }
        case "function":
            return setAttr(node, name, value(node));
        case "object":
            if (value[atomTag]) {
                const atom = value;
                if (bind) {
                    let pending = false;
                    const update = () => pending = !(node = setAttr(node, name, value));
                    scope.bind(atom, v => {
                        value = v;
                        pending ||= requestAnimationFrame(update);
                    });
                    update();
                    return node;
                } else {
                    return node = setAttr(node, name, scope.get(atom));
                }
            }
            if (value[Symbol.iterator]) {
                const parts = [];
                if (bind) {
                    let pending = false;
                    const update = () => {
                        node.setAttribute(name, parts.join(" "));
                        pending = false;
                    };
                    for (const part of value) {
                        if (part?.[atomTag]) {
                            const p = parts.length;
                            scope.bind(part, v => {
                                parts[p] = format(v);
                                update();
                            });
                            parts.push(format(scope.get(part)));
                        } else {
                            parts.push(format(part));
                        }
                    }
                } else {
                    for (const part of value) {
                        parts.push(format(part?.[atomTag] ? scope.get(part) : part));
                    }
                }
                return node.setAttribute(name, parts.join(" "));
            } else {
                const parts = [];
                if (bind) {
                    let pending = false;
                    const update = () => {
                        node.setAttribute(name, parts.join(";"));
                        pending = false;
                    };
                    for (const [key, part] of Object.entries(value)) {
                        if (part?.[atomTag]) {
                            const p = parts.length;
                            scope.bind(part, v => {
                                parts[p] = format(v);
                                update();
                            });
                            parts.push(`${key}:${format(scope.get(part))}`);
                        } else {
                            parts.push(`${key}:${format(part)}`);
                        }
                    }
                } else {
                    for (const [key, part] of Object.entries(value)) {
                        parts.push(`${key}:${format(part?.[atomTag] ? scope.get(part) : part)}`);
                    }
                }
                return node.setAttribute(name, parts.join(";"));
            }
        default:
            return node.removeAttribute(name);
    }
}