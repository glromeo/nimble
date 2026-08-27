import {batch, Computed, currentContext, Effect, Observer, Scope, Signal, tracked} from "../signals/signals.mjs";
import {directives} from "./directives.mjs";

export const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
export const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

let namespaceURI = undefined;

/**
 * Namespace bound jsx functions
 */
export const [
    svg,
    xhtml
] = [
    SVG_NAMESPACE_URI,
    XHTML_NAMESPACE_URI
].map(nsURI => (tag, props, key) => {
    if (namespaceURI !== nsURI) {
        const outerNamespaceURI = namespaceURI;
        namespaceURI = nsURI;
        try {
            return jsx(tag, props, key);
        } finally {
            namespaceURI = outerNamespaceURI;
        }
    } else {
        return jsx(tag, props, key);
    }
});

class KeyedFragment {
    constructor(key, props) {
        this.key = key;
        this.owned = undefined;
        this.scope = undefined;

        tracked(this, () => {
            this.node = Fragment(props);
            this.children = props.children;
        });
        this.reset();
    }

    /**
     * Promotes the keyed children rendered by this run to live, disposing the ones it didn't render.
     * Only call it after a run that re-rendered the children: an empty run would dispose them all.
     */
    reset() {
        if (this.scope !== undefined) {
            this.scope.reset();
        }
    }

    update({children}) {
        tracked(this, () => {
            let prev = this.children;
            if (prev instanceof Observer) {
                if (typeof children === "function") {
                    prev.observe(children);
                    return;
                }
                prev.dispose();
                prev = prev.value;
            } else if (typeof children === "function") {
                this.node.replaceChildren();
                this.children = new DynamicChildren(this.node, children);
                this.reset();
                return;
            }
            updateChildren(this.node, this.children = children, prev);
            this.reset();
        });
    }
}

class KeyedFC {
    constructor(key, tag, props) {
        this.key = key;
        this.props = {};
        this.signals = {};
        this.owned = undefined;
        this.scope = undefined;

        for (const name of Object.keys(props)) {
            this.defineSignal(props, name);
        }

        tracked(this, () => {
            this.node = tag(this.props);
        });
        if (this.scope !== undefined) {
            this.scope.reset(); // the body renders once, so this is its only run
        }
    }

    defineSignal(props, name) {
        const {get, value} = Object.getOwnPropertyDescriptor(props, name);
        this.signals[name] = get !== undefined ? new Computed(get) : new Signal(value);
        Object.defineProperty(this.props, name, {
            get: () => this.signals[name].get()
        });
    }

    update(props) {
        for (const name of Object.keys(props)) {
            const desc = Object.getOwnPropertyDescriptor(props, name);
            const signal = this.signals[name];
            if (signal !== undefined) {
                if (signal.constructor === Signal) {
                    if (desc.get !== undefined) {
                        signal.version++;
                        signal.notify();
                        this.signals[name] = new Computed(desc.get);
                    } else {
                        signal.set(desc.value);
                    }
                } else {
                    if (desc.get !== undefined) {
                        signal.reset(desc.get);
                    } else {
                        signal.version++;
                        signal.notify();
                        this.signals[name] = new Signal(desc.value);
                    }
                }
            } else {
                this.defineSignal(props, name);
            }
        }
    }
}

class KeyedElement {
    constructor(key, tag, props) {
        this.key = key;
        this.owned = undefined;
        this.scope = undefined;

        tracked(this, () => {
            this.node = createElement(tag, props);
            this.props = props;
        });
        this.reset();
    }

    /**
     * Promotes the keyed children rendered by this run to live, disposing the ones it didn't render.
     * Only call it after a run that re-rendered the children: an empty run would dispose them all.
     */
    reset() {
        if (this.scope !== undefined) {
            this.scope.reset();
        }
    }

    update(props) {
        tracked(this, () => {
            let value, prev, children = false;
            for (let name of Object.keys(this.props)) {
                if (name === "ref" ||
                    name[0] === "i" && name[1] === "s" && name[2] === ":" ||
                    Object.is(value = props[name], prev = this.props[name])) {
                    continue;
                }
                if (name[0] === "o" && name[1] === "n") {
                    const event = name[2] === ":" ? name.slice(3) : name.slice(2).toLowerCase();
                    this.node.removeEventListener(event, prev);
                    this.node.addEventListener(event, this.props[name] = value);
                    continue;
                }
                if (prev instanceof Observer) {
                    if (typeof value === "function") {
                        prev.observe(value);
                        continue;
                    }
                    prev.dispose();
                    prev = prev.value;
                }
                if (typeof value === "function") {
                    if (name === "children") {
                        children = true;
                        this.node.replaceChildren();
                        this.props[name] = new DynamicChildren(this.node, value);
                    } else {
                        this.props[name] = new DynamicProperty(this.node, name, value);
                    }
                } else if (name === "children") {
                    children = true;
                    updateChildren(this.node, this.props[name] = value, prev);
                } else {
                    setProperty(this.node, name, this.props[name] = value);
                }
            }
            if (children) {
                this.reset();
            }
        });
    }
}

export function contextScope() {
    const ctx = currentContext();
    if (ctx === undefined) {
        throw new Error("no reactive context");
    }
    return ctx.scope ??= new Scope();
}

/**
 *
 * @param tag
 * @param props
 * @param key
 * @returns {HTMLElement|NodeGroup|*}
 */
export function jsx(tag, props, key) {
    if (key === undefined) {
        if (typeof tag === "function") {
            if (tag === Fragment) {
                return Fragment(props);
            } else {
                return tag(props);
            }
        } else {
            return createElement(tag, props);
        }
    }
    const ctx = currentContext();
    if (ctx === undefined) {
        throw new Error("no reactive context");
    }
    const scope = ctx.scope ??= new Scope();
    let state = scope.get(key);
    if (state !== undefined) {
        batch(() => state.update(props));
    } else {
        if (typeof tag === "function") {
            if (tag === Fragment) {
                state = new KeyedFragment(key, props);
            } else {
                state = new KeyedFC(key, tag, props);
            }
        } else {
            state = new KeyedElement(key, tag, props);
        }
    }
    scope.set(state.key, state);
    return state.node;
}

/**
 * @param props {{xmlns?: string, children?: any|(any[])}}
 * @returns {NodeGroup}
 */
export function Fragment(props) {
    const nodeGroup = new NodeGroup(props.xmlns ?? namespaceURI);
    if (typeof props.children === "function") {
        props.children = new DynamicChildren(nodeGroup, props.children);
    } else {
        appendChildren(nodeGroup, props.children);
    }
    return nodeGroup;
}

const newGroupStart = Node.prototype.cloneNode.bind(new Comment("<>"), false);
const newGroupEnd = Node.prototype.cloneNode.bind(new Comment("</>"), false);

export class NodeGroup extends DocumentFragment {
    /**
     * @param nsURI {string}
     */
    constructor(nsURI) {
        super();
        this.namespaceURI = nsURI;
        this.groupStart = newGroupStart();
        this.groupEnd = newGroupEnd();
        super.appendChild(this.groupEnd.groupStart = this.groupStart).nodeGroup = this;
        super.appendChild(this.groupStart.groupEnd = this.groupEnd).nodeGroup = this;
    }

    /**
     * Where this group's nodes actually live: the host once mounted, itself while detached.
     *
     * @returns {HTMLElement|NodeGroup}
     */
    get host() {
        return this.groupEnd.parentNode ?? this;
    }

    appendChild(node) {
        this.host.insertBefore(node, this.groupEnd);
        return node;
    }

    append(...nodes) {
        const {host, groupEnd} = this;
        for (const node of nodes) {
            host.insertBefore(node, groupEnd);
        }
    }

    replaceChildren(...nodes) {
        const {host, groupStart, groupEnd} = this;
        let node = groupStart.nextSibling;
        while (node !== groupEnd) {
            const nextSibling = node.nextSibling;
            host.removeChild(node);
            node = nextSibling;
        }
        this.append(...nodes);
    }

    remove() {
        if (this.host !== this) {
            let {groupStart: node, groupEnd} = this;
            while (node !== groupEnd) {
                const nextSibling = node.nextSibling;
                super.appendChild(node);
                node = nextSibling;
            }
            super.appendChild(groupEnd);
        }
    }

    get firstChild() {
        const firstChild = this.groupStart.nextSibling;
        return firstChild === this.groupEnd ? null : firstChild;
    }

    get lastChild() {
        const lastChild = this.groupEnd.previousSibling;
        return lastChild === this.groupStart ? null : lastChild;
    }

    get previousSibling() {
        return this.groupStart.previousSibling;
    }

    get nextSibling() {
        return this.groupEnd.nextSibling;
    }

    replaceWith(node) {
        if (this.host !== this) {
            const {parentNode, nextSibling} = this.groupEnd;
            this.remove();
            parentNode.insertBefore(node, nextSibling);
        }
    }
}

/**
 *
 * @param tag {string}
 * @param props {{xmlns?: string, children?: any[], [key: string]: any}}
 * @returns {HTMLElement}
 */
export function createElement(tag, props) {
    const xmlns = props.xmlns ?? namespaceURI;
    const node = xmlns === undefined
        ? document.createElement(tag)
        : document.createElementNS(xmlns, tag);

    for (const name of Object.keys(props)) {
        if (name[0] === "i" && name[1] === "s" && name[2] === ":") {
            node.setAttribute(name, "");
            directives[name.slice(3)](node, props);
            continue;
        }

        const value = props[name];

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
            props[name] = name === "children"
                ? new DynamicChildren(node, value)
                : new DynamicProperty(node, name, value);
        } else if (value != null) {
            if (name === "children") {
                appendChildren(node, value);
            } else if (name !== "xmlns") {
                setProperty(node, name, value);
            }
        }
    }

    return node;
}

/**
 * @param parent {HTMLElement|NodeGroup}
 * @param value {any}
 */
function appendChildren(parent, value) {
    const nsURI = parent.namespaceURI;
    if (value instanceof Array) {
        for (let child of value) {
            parent.appendChild(createNode(nsURI, child));
        }
    } else if (value != null) {
        parent.appendChild(createNode(nsURI, value));
    }
}

/**
 * @param node {HTMLElement}
 * @param name {string}
 * @param value {any}
 */
export function setProperty(node, name, value) {
    const type = typeof value;
    if (type === "object" && value !== null) {
        if (name === "class") {
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
            if (node.namespaceURI === XHTML_NAMESPACE_URI) {
                node.className = parts.join(" ");
            } else {
                node.setAttribute("class", parts.join(" "));
            }
            return;
        }
        if (name === "style") {
            node.style = null;
            Object.assign(node.style, value);
            return;
        }
    }
    if (type === "string" || type === "number" || type === "bigint") {
        node.setAttribute(name, value);
    } else if (value) {
        node.setAttribute(name, "");
    } else {
        node.removeAttribute(name);
    }
}

/**
 * @param parent {HTMLElement|NodeGroup}
 * @param children {any}
 * @param previous {any}
 */
export function updateChildren(parent, children, previous) {
    if (children === previous) {
        return;
    }
    if (
        children?.constructor === Array && children.length > 0 &&
        previous?.constructor === Array && previous.length > 0
    ) {
        updateChildNodes(
            parent,
            children,
            previous
        );
    } else {
        parent.replaceChildren();
        appendChildren(parent, children);
    }
}

/**
 * This function is an adaptation of https://github.com/WebReflection/udomdiff/blob/main/esm/index.js
 *
 * ISC
 *
 * Copyright © 2020-today, Andrea Giammarchi, @WebReflection
 *
 * @param owner {HTMLElement | NodeGroup}
 * @param b {any[]}
 * @param a {any[]}
 */
export function updateChildNodes(owner, b, a) {
    let aStart = 0;
    let aEnd = a.length;
    let bStart = 0;
    let bEnd = b.length;
    let map = undefined;

    const parent = owner.groupStart?.parentNode ?? owner;

    const live = [];
    let node, head, tail;
    if (owner === parent) {
        head = parent.firstChild;
        tail = parent.lastChild;
    } else {
        head = owner.groupStart;
        tail = owner.groupEnd;
    }
    if ((node = head) !== null) {
        const before = tail.nextSibling;
        while (node !== before) {
            if (node.nodeGroup !== undefined) {
                if (node.nodeGroup !== owner) {
                    live.push(node.nodeGroup);
                    node = node.groupEnd;
                }
            } else {
                live.push(node);
            }
            node = node.nextSibling;
        }
    }

    while (aStart < aEnd && bStart < bEnd) {
        if (a[aStart] === b[bStart]) {
            bStart++;
            head = live[aStart++];
        } else if (a[aEnd - 1] === b[bEnd - 1]) {
            --bEnd;
            tail = live[--aEnd];
        } else if (a[aStart] === b[bEnd - 1] && a[aEnd - 1] === b[bStart]) {
            const before = live[--aEnd].nextSibling;
            insertBefore(parent, head = live[aEnd], live[aStart].nextSibling);
            insertBefore(parent, tail = live[aStart++], before);
            bStart++;
            a[aEnd] = b[--bEnd];
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
                        const node = live[aStart];
                        while (bStart < index) {
                            head = insertBefore(parent, b[bStart++], node);
                        }
                    } else {
                        head = insertBefore(parent, b[bStart++], live[aStart]);
                        live[aStart++].remove();
                    }
                } else {
                    if (a[aStart] !== live[aStart]) {
                        live[aStart].remove();
                    }
                    aStart++;
                }
            } else {
                live[aStart++].remove();
            }
        }
    }

    if (bStart < bEnd) {
        const node = bEnd < b.length
            ? bStart > 0
                ? head.nextSibling
                : tail.groupStart ?? tail
            : parent === owner ? tail.nextSibling : owner.groupEnd;
        do {
            insertBefore(parent, b[bStart++], node);
        } while (bStart < bEnd);
    }

    while (aStart < aEnd) {
        if (map === undefined || !map.has(a[aStart])) {
            live[aStart].remove();
        }
        aStart++;
    }
}

function insertBefore(parent, child, ref) {
    const node = createNode(parent.namespaceURI, child);
    parent.insertBefore(node, ref);
    return node;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 * @param nsURI {string}
 * @param value {any}
 * @returns {Node|NodeGroup|Text|Comment}
 */
export function createNode(nsURI, value) {
    switch (typeof value) {
        case "string":
        case "number":
        case "bigint":
            return new Text(value);
        case "function": {
            const {node} = new DynamicNode(nsURI, value);
            return node;
        }
        case "object": {
            if (value === null) break;
            if (value instanceof Node) {
                if (value.constructor === NodeGroup) {
                    value.remove();
                }
                return value;
            }
            if (value.constructor === Array) {
                const node = new NodeGroup(nsURI);
                appendChildren(node, value);
                return node;
            }
            if (value.tag !== undefined) {
                const {tag, xmlns, children, attrs, key} = value;
                return jsx(tag, {xmlns, children, ...attrs}, key);
            }
        }
        case "symbol":
            value = value.toString();
            break;
    }
    return new Comment(value);
}

/*
 * In any observer that creates nodes, hence bound to the namespace ambient when it was created: its
 * callback is re-invoked long after the synchronous extent of the svg/xhtml call that set it, so
 * without this the elements it creates on update land in a different namespace than on creation.
 */

class DynamicNode extends Observer {

    constructor(nsURI, callback) {
        super(callback);
        this.namespaceURI = nsURI;
        const finish = this.start();
        try {
            this.node = typeof (this.value = this.callback()) !== "function"
                ? createNode(nsURI, this.value)
                : new Comment(`[function ${this.value.name}]`);
        } finally {
            finish();
        }
    }

    invoke() {
        if (namespaceURI !== this.namespaceURI) {
            const outerNamespaceURI = namespaceURI;
            namespaceURI = this.namespaceURI;
            try {
                return super.invoke();
            } finally {
                namespaceURI = outerNamespaceURI;
            }
        } else {
            return super.invoke();
        }
    }

    onChange(value, prev) {
        switch (typeof value) {
            case "string":
            case "number":
            case "bigint":
                if (this.node.nodeType === Node.TEXT_NODE) {
                    this.node.data = value;
                    return;
                }
                this.replaceWith(new Text(value));
                return;
            case "function": {
                value = `[function ${value.name}]`;
                break;
            }
            case "object": {
                if (value === null) break;
                if (value instanceof Node) {
                    if (this.node !== value) {
                        if (value.constructor === NodeGroup) {
                            value.remove();
                        }
                        this.replaceWith(value);
                    }
                    return;
                }
                if (value.constructor === Array) {
                    if (this.node.constructor === NodeGroup) {
                        updateChildren(this.node, value, prev);
                        return;
                    }
                    const nodeGroup = new NodeGroup(this.namespaceURI);
                    appendChildren(nodeGroup, value);
                    this.replaceWith(nodeGroup);
                    return;
                }
                if (value.tag !== undefined) {
                    const {tag, xmlns = this.namespaceURI, children, attrs, key} = value;
                    this.replaceWith(jsx(tag, {xmlns, children, ...attrs}, key));
                    return;
                }
            }
            case "symbol":
                value = value.toString();
                break;
        }
        if (this.node.nodeType === Node.COMMENT_NODE) {
            this.node.data = value;
            return;
        }
        this.replaceWith(new Comment(value));
    }

    replaceWith(newNode) {
        this.node.replaceWith(this.node = newNode);
    }

    onError(err) {
        const errorNode = errorBoundary.node(this.node, err);
        if (errorNode) {
            this.replaceWith(errorNode);
        }
    }
}

class DynamicChildren extends Observer {

    constructor(node, callback) {
        super(callback);
        const finish = this.start();
        try {
            appendChildren(node, this.value = this.callback());
            this.node = node;
        } finally {
            finish();
        }
    }

    invoke() {
        if (namespaceURI !== this.node.namespaceURI) {
            const outerNamespaceURI = namespaceURI;
            namespaceURI = this.node.namespaceURI;
            try {
                return super.invoke();
            } finally {
                namespaceURI = outerNamespaceURI;
            }
        } else {
            return super.invoke();
        }
    }

    onChange(value, prev) {
        updateChildren(this.node, value, prev);
    }

    onError(err) {
        errorBoundary.children(this.node, err);
    }
}

class DynamicProperty extends Observer {

    constructor(node, name, observable) {
        super(observable);
        const finish = this.start();
        try {
            setProperty(node, this.name = name, this.value = this.callback());
            this.node = node;
        } finally {
            finish();
        }
    }

    onChange(value, prev) {
        setProperty(this.node, this.name, value);
    }

    onError(err) {
        errorBoundary.property(this.node, this.name, err);
    }
}

export const errorBoundary = {

    handlers: {},

    set(type, handler) {
        if (typeof handler === "function") {
            this.handlers[type] = handler;
        } else {
            this.reset(type);
        }
    },

    reset(type) {
        if (type) {
            delete this.handlers[type];
        } else {
            delete this.handlers.node;
            delete this.handlers.children;
            delete this.handlers.property;
        }
    },

    get node() {
        return this.handlers.node ?? this.defaults.node;
    },

    get children() {
        return this.handlers.children ?? this.defaults.children;
    },

    get property() {
        return this.handlers.property ?? this.defaults.property;
    },

    defaults: {
        node: (node, err) => new Comment(err.stack),
        children: (node, err) => {
            node.replaceChildren(new Comment(err.stack));
        },
        property: (node, name, err) => {
            console.error(`Error setting property ${name}:`, err);
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Create a root rendering scope with its own ownership tree
 * Returns a dispose function to clean up all effects
 */
export function createRoot(fn) {
    const owner = new Effect(() => {
    });
    let result;
    tracked(owner, () => {
        result = fn(() => owner.dispose());
    });
    return result;
}

/**
 * Mount a component to a DOM node
 */
export function mount(parent, fn) {
    return createRoot((dispose) => {
        const node = fn();
        parent.appendChild(node);
        return dispose;
    });
}