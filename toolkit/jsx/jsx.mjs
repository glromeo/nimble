import {Computed, contextScope, currentContext, observe, Signal, Observer} from "../signals/signals.mjs";
import {directives} from "./directives.mjs";

export const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
export const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

let namespaceURI = XHTML_NAMESPACE_URI;

function ns(tag, props, key) {
    const outerNamespaceURI = namespaceURI;
    namespaceURI = this;
    try {
        return jsx(tag, props, key);
    } finally {
        namespaceURI = outerNamespaceURI;
    }
}

export const svg = ns.bind(SVG_NAMESPACE_URI);
export const xhtml = ns.bind(XHTML_NAMESPACE_URI);

export function jsx(tag, props, key = null) {
    if (key === null) {
        return typeof tag === "function" ? tag(props) : createElement(tag, props);
    }
    const scope = contextScope();
    let node = scope.get(key);
    if (node !== undefined) {
        node.setProperties(props);
    } else {
        if (typeof tag === "function") {
            if (tag === Fragment) {
                node = Fragment(props);
                node.setProperties = props => setChildren.call(node, props.children);
            } else {
                node = createKFC(tag, props);
                node.setProperties = updateKFC.bind(props);
            }
        } else {
            node = createElement(tag, props, key);
            node.setProperties = updateElement.bind(node);
        }
        scope.set(key, node);
    }
    return node;
}

/**
 *
 * @param tag {string}
 * @param props {object}
 * @returns {Node}
 */
function createKFC(tag, props) {
    for (const name of Object.keys(props)) {
        const desc = Object.getOwnPropertyDescriptor(props, name);
        if (desc.get !== undefined) {
            const cs = new Computed(desc.get);
            desc.get = cs.get.bind(cs);
            desc.set = cs.rewire.bind(cs);
            Object.defineProperty(props, name, desc);
        } else {
            const ss = new Signal(desc.value);
            Object.defineProperty(props, name, {
                get: ss.get.bind(ss),
                set: ss.set.bind(ss)
            });
        }
    }
    return tag(props);
}

function updateKFC(props) {
    for (const name of Object.keys(props)) {
        const desc = Object.getOwnPropertyDescriptor(props, name);
        this[name] = desc.get ?? desc.value;
    }
}

/**
 * @param props {{xmlns?: string, children?: any[]}}
 * @returns {DocumentFragment}
 */
export function Fragment({xmlns, children}) {
    return new PersistentFragment(xmlns ?? namespaceURI, children);
}

export class PersistentFragment extends DocumentFragment {
    /**
     * @param children {any}
     */
    constructor(namespaceURI, children) {
        super();
        this.namespaceURI = namespaceURI;
        this.placeholder = new Comment();
        this.appendChild(this.placeholder);
        if (typeof children === "function") {
            children = new Computed(children);
        }
        if (children instanceof Signal) {
            children = propertyEffect(this, "children", children);
        }
        setChildren.call(this, children);
    }

    appendChild(node) {
        const placeholder = this.placeholder;
        const parentNode = placeholder.parentNode;
        if (parentNode) {
            parentNode.insertBefore(node, placeholder);
        } else {
            super.appendChild(node);
        }
    }

    append(...nodes) {
        const placeholder = this.placeholder;
        const parentNode = placeholder.parentNode;
        if (parentNode) {
            for (const node of nodes) {
                parentNode.insertBefore(node, placeholder);
            }
        } else {
            super.append(...nodes);
        }
    }

    reclaim() {
        if (this.childNodes.length === 0) {
            const placeholder = this.placeholder;
            super.appendChild(placeholder);
            if (Array.isArray(this.__nodes__)) {
                for (const node of this.__nodes__) {
                    super.insertBefore(node, placeholder);
                }
            } else if (this.__nodes__) {
                super.insertBefore(this.__nodes__, placeholder);
            }
        }
    }

    remove() {
        this.__nodes__?.forEach(removeNode);
    }

    get nextSibling() {
        return this.placeholder.nextSibling;
    }

    get firstNode() {
        let nodes = this.__nodes__;
        if (nodes instanceof Array) {
            return nodes[0];
        }
        return nodes ?? this.placeholder.previousSibling;
    }

    updateFragment(children) {
        setChildren.call(this, children);
    }
}

/**
 *
 * @param tag {string}
 * @param props {{xmlns?: string, children?: any[], [key: string]: any}}
 * @param key {any}
 * @returns {HTMLElement}
 */
export function createElement(tag, props, key) {
    const {
        xmlns = tag === "svg" ? SVG_NAMESPACE_URI : namespaceURI
    } = props;

    const node = xmlns === XHTML_NAMESPACE_URI
        ? document.createElement(tag)
        : document.createElementNS(SVG_NAMESPACE_URI, tag);

    for (const name of Object.keys(props)) {
        if (name[0] === "i" && name[1] === "s" && name[2] === ":") {
            node.setAttribute(name, "");
            directives[name.slice(3)](node, props);
            continue;
        }

        let value = props[name];

        if (typeof value === "function") {
            if (name === "ref") {
                value(node);
                continue;
            }
            if (name[0] === "o" && name[1] === "n") {
                const event = name[2] === ":" ? name.slice(3) : name.slice(2).toLowerCase();
                node.addEventListener(event, value);
                continue;
            }
            value = new Computed(value);
        }
        if (value instanceof Signal) {
            if (name === "ref") {
                value.set(node);
                continue;
            }
            value = propertyEffect(node, name, value);
        }
        if (value != null) {
            if (name === "children") {
                if (key === null) {
                    if (value instanceof Array) {
                        for (const child of value) {
                            node.appendChild(createNode(xmlns, child));
                        }
                    } else {
                        node.appendChild(createNode(xmlns, value));
                    }
                    continue;
                }
                setChildren.call(node, value);
            } else {
                setProperty(node, name, value);
            }
        }
    }

    if (key !== null) {
        node.__props__ = props;
        node["#key"] = key;
    }

    return node;
}

/**
 * @this {HTMLElement}
 * @param props {{xmlns?: string, children?: any[], [key: string]: any}}
 */
function updateElement(props) {
    const prev = this.__props__;
    let effect,
        value;
    for (let name of Object.keys(props)) {
        if (Object.is(value = props[name], prev[name])) {
            continue;
        }
        if (name[0] === "i" && name[1] === "s" && name[2] === ":") {
            directives[name.slice(3)](this, props);
            continue;
        }

        effect = this.__effects__?.[name];

        if (typeof value === "function") {
            if (name === "ref") {
                value(this);
                continue;
            }
            if (name[0] === "o" && name[1] === "n") {
                const event = name[2] === ":" ? name.slice(3) : name.slice(2).toLowerCase();
                this.removeEventListener(event, this[name]);
                this.addEventListener(event, value);
                continue;
            }
            if (effect) {
                this.__effects__[name].rewire(value);
                continue;
            }
            value = new Computed(value);
        }
        if (value instanceof Signal) {
            if (name === "ref") {
                value.set(this);
                continue;
            }
            if (effect) {
                this.__effects__[name].rewire(value);
                continue;
            }
            value = propertyEffect(this, name, value);
        } else {
            if (effect) {
                effect.dispose();
                this.__effects__[name] = undefined;
            }
        }
        if (name === "children") {
            setChildren.call(this, value);
        } else {
            setProperty(this, name, value);
        }
    }
    this.__props__ = props;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let pendingUnmount = null;

const unmountNodes = () => {
    while (pendingUnmount !== null) {
        unMount(pendingUnmount);
        const nextUnmount = pendingUnmount.nextUnmount;
        pendingUnmount.nextUnmount = null;
        pendingUnmount = nextUnmount;
    }
};

export function removeNode(child) {
    if (child.__effects__) {
        if (pendingUnmount === null) {
            unmountNodes();
        }
        child.nextUnmount = pendingUnmount;
        pendingUnmount = child;
    }
    child.remove();
}

const UNMOUNT_OPTIONS = {
    acceptNode: node => node.__effects__ ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
};

export function unMount(node) {
    for (const effect of Object.values(node.__effects__)) {
        effect.dispose();
    }
    node.__effects__ = null;
    if (node.firstChild) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, UNMOUNT_OPTIONS);
        while (node = walker.nextNode()) {
            for (const effect of Object.values(node.__effects__)) effect.dispose();
        }
    }
}

Object.defineProperty(window, "unMount", {enumerable: true, value: unMount});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 * @param node
 * @param name
 * @param signal
 * @returns {*}
 */
export function propertyEffect(node, name, signal) {
    const value = signal.peek();
    if (signal.sources) {
        (node.__effects__ ??= {})[name] = new observe(
            signal,
            name === "children"
                ? setChildren.bind(node)
                : setProperty.bind(null, node, name)
        );
    }
    return value;
}

/**
 * @this {HTMLElement}
 * @param name {string}
 * @param value {any}
 */
export function setProperty(node, name, value) {
    const type = typeof value;
    if (name === "class") {
        if (value !== null && type === "object") {
            const parts = [];
            if (value[Symbol.iterator]) {
                for (const part of value) {
                    if (part) parts.push(part);
                }
            } else {
                for (const key of Object.keys(value)) {
                    if (value[key]) parts.push(key);
                }
            }
            if (node.namespaceURI === xhtml) {
                node.className = parts.join(" ");
            } else {
                node.setAttribute("class", parts.join(" "));
            }
            return;
        }
    } else if (name === "style") {
        if (value !== null && type === "object") {
            node.style = null;
            Object.assign(node.style, value);
            return;
        }
    } else if (name === "children") {
        if (value instanceof Array) {
            const xmlns = node.namespaceURI;
            for (const child of value) {
                node.appendChild(createNode(xmlns, child));
            }
            return;
        }
        node.appendChild(createNode(node.namespaceURI, value));
        return;
    }
    if (value === true) {
        node.setAttribute(name, "");
    } else if (type === "string" || type === "number" || type === "bigint" || value) {
        node.setAttribute(name, value);
    } else {
        node.removeAttribute(name);
    }
}

/**
 * @this {HTMLElement|PersistentFragment}
 * @param value {any}
 * @param value {any}
 */
export function setChildren(value) {
    if (this.__value__ === value) {
        return;
    }
    const isArray = value instanceof Array;
    const isEmpty = value == null || isArray && !value.length;
    const wasArray = this.__value__ instanceof Array;
    const wasEmpty = this.__value__ == null || wasArray && !this.__value__.length;
    if (wasEmpty) {
        if (isEmpty) return;
    } else {
        if (isEmpty) {
            if (wasArray) {
                this.__nodes__.forEach(removeNode);
            } else {
                removeNode(this.__nodes__);
            }
            this.__nodes__ = this.__value__ = null;
            return;
        }
        if (wasArray) {
            if (isArray) {
                this.__nodes__ = updateNodes(
                    this,
                    value,
                    this.__value__,
                    this.__nodes__
                );
                this.__value__ = value;
                return;
            }
            let index = 0, recycled = null;
            for (const node of this.__nodes__) {
                if (recycled === null || !Object.is(value, this.__value__[index++])) {
                    removeNode(node);
                } else {
                    recycled = this.__value__[index - 1];
                }
            }
            if (recycled) {
                this.__nodes__ = recycled;
                this.__value__ = value;
                return;
            }
        } else {
            if (isArray) {
                let index = value.length;
                let nodes = Array(index);
                let {parentNode, nextSibling} = this.__nodes__;
                while (--index) {
                    const child = value[index];
                    if (Object.is(child, this.__value__)) {
                        nodes[index] = this.__nodes__;
                    } else {
                        parentNode.insertBefore(nodes[index] = createNode(namespaceURI, child), nextSibling);
                    }
                }
                this.__nodes__ = nodes;
                this.__value__ = value;
                return;
            }
            removeNode(this.__nodes__);
        }
    }
    if (isArray) {
        this.append(...(this.__nodes__ = value.map(createNode.bind(null, this.namespaceURI))));
    } else {
        this.appendChild(this.__nodes__ = createNode(this.namespaceURI, value));
    }
    this.__value__ = value;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function replaceNodeWith(value) {
    const type = typeof value;
    const node = this.node;
    if (type === "string" || type === "number" || type === "bigint") {
        if (node.nodeType === Node.TEXT_NODE) {
            node.data = value;
        } else {
            replaceNode(this, new Text(value));
        }
        return;
    } else if (type === "object") {
        if (value instanceof Node) {
            valure.reclaim?.();
            replaceNode(this, value);
            return;
        }
        if (value !== null) {
            const namespaceURI = node.namespaceURI;
            if (value.forEach) {
                if (node instanceof PersistentFragment) {
                    node.updateFragment(value);
                    return;
                }
                replaceNode(this, new PersistentFragment(namespaceURI, value));
                return;
            }
            if (value.tag) {
                replaceNode(this, jsx(value.tag, {
                    xmlns: value.xmlns ?? namespaceURI,
                    children: value.children,
                    ...value.attrs
                }, value.key));
                return;
            }
            value = value.toString();
        }
    } else if (type === "function") {
        value = `[function ${value.name}]`;
    } else if (type === "symbol") {
        value = value.toString();
    }
    if (node.nodeType === Node.COMMENT_NODE) {
        node.data = value;
    } else {
        replaceNode(this, new Comment(value));
    }
}

function replaceNode(ref, replacement) {
    replacement.__effects__ = ref.node.__effects__;
    ref.node.replaceWith(ref.node = replacement);
}

/**
 *
 * @param namespaceURI
 * @param value
 * @returns {Node|PersistentFragment|Text|Comment}
 */
export function createNode(namespaceURI, value) {
    if (value instanceof Node) {
        value.reclaim?.();
        return value;
    }
    if (typeof value === "function") {
        value = new Computed(value);
    }
    if (value instanceof Signal) {
        let node = value.peek();
        if (value.sources) {
            if (node instanceof Node) {
                node.reclaim?.();
            } else {
                node = createUnboundNode(namespaceURI, node);
            }
            node.__effects__ = {self: observe(value, replaceNodeWith.bind({node}))};
            return node;
        } else {
            value = node;
        }
    }
    return createUnboundNode(namespaceURI, value);
}

function createUnboundNode(namespaceURI, value) {
    const type = typeof value;
    if (type === "object") {
        if (value !== null) {
            if (value.forEach) {
                return new PersistentFragment(namespaceURI, value);
            }
            if (value.tag) {
                return jsx(value.tag, {
                    xmlns: value.xmlns,
                    children: value.children,
                    ...value.attrs
                }, value.key);
            }
        }
    } else if (type === "string" || type === "number" || type === "bigint") {
        return new Text(value);
    } else if (type === "function") {
        return new Comment(`[function ${value.name}]`);
    } else if (type === "symbol") {
        return new Comment(String(value));
    }
    return new Comment(value);
}

/**
 * This method is an adaptation of https://github.com/WebReflection/uhtml/blob/main/esm/persistent-fragment.js
 *
 * Copyright © 2020-today, Andrea Giammarchi, @WebReflection
 *
 * @param parent
 * @param b
 * @param a
 * @param live
 * @returns {*}
 */
export function updateNodes(owner, b, a, live) {
    let nodes = new Array(b.length);
    let aStart = 0;
    let aEnd = a.length;
    let bStart = 0;
    let bEnd = b.length;
    let map = undefined;
    let nsURI = owner.namespaceURI;

    const parent = owner instanceof PersistentFragment ? owner.placeholder.parentNode : owner;

    while (aStart < aEnd && bStart < bEnd) {
        if (a[aStart] === b[bStart]) {
            nodes[bStart++] = live[aStart++];
        } else if (a[aEnd - 1] === b[bEnd - 1]) {
            nodes[--bEnd] = live[--aEnd];
        } else if (a[aStart] === b[bEnd - 1] && a[aEnd - 1] === b[bStart]) {
            const before = live[--aEnd].nextSibling;
            nodes[bStart++] = insertBefore(parent, live[aEnd], live[aStart].nextSibling);
            nodes[--bEnd] = insertBefore(parent, live[aStart++], before);
        } else {
            if (map === undefined) {
                map = new Map();
                let i = bStart;
                while (i < bEnd) map.set(b[i], i++);
            }
            const index = map.get(a[aStart]);
            if (index !== undefined) {
                if (bStart < index && index < bEnd) {
                    let n = index + 1;
                    let i = aStart;
                    while (++i < aEnd && n < bEnd && a[i] === b[n]) n++;
                    if (n - index > index - bStart) {
                        const before = live[aStart];
                        while (bStart < index) {
                            nodes[bStart] = insertBefore(parent, createNode(nsURI, b[bStart++]), before);
                        }
                    } else {
                        nodes[bStart] = insertBefore(parent, createNode(nsURI, b[bStart++]), live[aStart]);
                        removeNode(live[aStart++]);
                    }
                } else {
                    aStart++;
                }
            } else {
                removeNode(live[aStart++]);
            }
        }
    }

    if (bStart < bEnd) {
        const before = bEnd < b.length
            ? bStart > 0
                ? nodes[bStart - 1].nextSibling
                : nodes[bEnd].firstNode ?? nodes[bEnd]
            : owner.placeholder ?? null;
        do {
            nodes[bStart] = insertBefore(parent, createNode(nsURI, b[bStart++]), before);
        } while (bStart < bEnd);
    }

    while (aStart < aEnd) {
        if (map === undefined || !map.has(a[aStart])) {
            removeNode(live[aStart]);
        }
        aStart++;
    }

    if (nodes.some(n => !n.parentNode)) {
        // debugger;
    }

    return nodes;
}

export function insertBefore(parent, node, ref) {
    node.reclaim?.();
    parent.insertBefore(node, ref);
    return node;
}

export function checkJsx() {
    if (namespaceURI !== XHTML_NAMESPACE_URI) {
        throw new Error(`unexpected namespaceURI: ${XHTML_NAMESPACE_URI}`);
    }
    // if (pendingUnmount !== null) {
    //     throw new Error(`pending nextUnmount: ${pendingUnmount.toString()}`);
    // }
    // if (pendingUpdate !== null) {
    //     throw new Error(`pending nextUpdate: ${pendingUpdate.toString()}`);
    // }
}
