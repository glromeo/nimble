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
        updateChildNodes(parent, children);
    } else {
        parent.replaceChildren();
        appendChildren(parent, children);
    }
}

/**
 * Reconciles the children of owner to values, moving the nodes it already has instead of rebuilding
 * them.
 *
 * It runs in two passes. The first pairs every value with the node that will render it, reusing the
 * node already holding that position whenever this module owns it. The second brings the DOM into
 * that order. Keeping them apart is what makes the second pass correct: it compares nodes and never
 * values, so identity is exact and equal values cannot collapse onto one another.
 *
 * @param owner {HTMLElement|NodeGroup}
 * @param values {any[]}
 */
export function updateChildNodes(owner, values) {
    const parent = owner.groupStart?.parentNode ?? owner;
    const live = liveChildren(owner, parent);
    reconcile(parent, materialize(owner, values, live), live, owner.groupEnd ?? null);
}

/**
 * The nodes currently holding the range of owner, one entry per child. A nested group counts once, as
 * the group itself, because it moves and is removed as a whole.
 */
function liveChildren(owner, parent) {
    const live = [];
    let node, tail;
    if (owner === parent) {
        node = parent.firstChild;
        tail = parent.lastChild;
    } else {
        node = owner.groupStart;
        tail = owner.groupEnd;
    }
    if (node !== null) {
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
    return live;
}

/**
 * Pairs each value with the node that will render it. A value carrying its own identity (a node, a
 * function, an element descriptor) goes straight to createNode. The rest walk a cursor along the live
 * children and rewrite the first node this module owns that can carry them, which is why reordering
 * plain values costs a few data writes and no DOM moves at all.
 */
function materialize(owner, values, live) {
    const nsURI = owner.namespaceURI;
    const next = new Array(values.length);
    let cursor = 0;
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        let node = undefined;
        if (value instanceof Node) {
            // already its own node: take it as it stands. Going through createNode would collect a
            // NodeGroup back into its fragment here, detaching a range the reconcile below still has
            // to compare against; insertNode does that at the moment it moves one.
            node = value;
        } else if (rewritable(value)) {
            while (node === undefined && cursor < live.length) {
                const candidate = live[cursor++];
                if (Object.hasOwn(candidate, "__value__") && rewrite(candidate, value)) {
                    node = candidate;
                }
            }
        }
        next[i] = node ?? createNode(nsURI, value);
    }
    return next;
}

/**
 * Whether a value has no identity of its own, and so may be written into a node we already have.
 * A function is excluded: its DynamicNode went with everything else the enclosing observer owned when
 * that observer restarted, so its node is still in the DOM but nothing drives it any more.
 */
function rewritable(value) {
    if (value instanceof Node) {
        return false;
    }
    switch (typeof value) {
        case "function":
            return false;
        case "object":
            return value === null || value.constructor === Array || value.tag === undefined;
        default:
            return true;
    }
}

/**
 * Writes value into node when node is the right shape to carry it, reporting whether it took.
 */
function rewrite(node, value) {
    switch (typeof value) {
        case "string":
        case "number":
        case "bigint":
            if (node.nodeType !== Node.TEXT_NODE) {
                return false;
            }
            if (node.__value__ !== value) {
                own(node, value);
                node.data = value;
            }
            return true;
        case "object":
            if (value !== null && value.constructor === Array) {
                if (node.constructor !== NodeGroup) {
                    return false;
                }
                updateChildren(node, value, node.__value__);
                own(node, value);
                return true;
            }
    }
    if (node.nodeType !== Node.COMMENT_NODE) {
        return false;
    }
    if (node.__value__ !== value) {
        own(node, value);
        node.data = typeof value === "symbol" || (typeof value === "object" && value !== null)
            ? value.toString()
            : value;
    }
    return true;
}

/**
 * This function is an adaptation of https://github.com/WebReflection/udomdiff/blob/main/esm/index.js
 *
 * ISC
 *
 * Copyright © 2020-today, Andrea Giammarchi, @WebReflection
 *
 * Both lists hold nodes here, as the original intends, so its map stays a last resort: it is built
 * only once the head, tail and swap paths have all failed. The a array is the one liveChildren built
 * for this call and nothing outside it, which is why the swap path may write back into it.
 *
 * @param parent {HTMLElement|NodeGroup}
 * @param b {Array<Node|NodeGroup>}
 * @param a {Array<Node|NodeGroup>}
 * @param before {Node|null} where the range ends: a group's end sentinel - even while detached, when
 * the group is its own parent, since appending to the raw fragment would land after the sentinel -
 * and null for an element that owns all of its children
 */
function reconcile(parent, b, a, before) {
    const bLength = b.length;
    let aEnd = a.length;
    let bEnd = bLength;
    let aStart = 0;
    let bStart = 0;
    let map = undefined;

    while (aStart < aEnd || bStart < bEnd) {
        if (aEnd === aStart) {
            const node = bEnd < bLength
                ? bStart > 0 ? b[bStart - 1].nextSibling : b[bEnd]
                : before;
            while (bStart < bEnd) {
                insertNode(parent, b[bStart++], node);
            }
        } else if (bEnd === bStart) {
            while (aStart < aEnd) {
                if (map === undefined || !map.has(a[aStart])) {
                    a[aStart].remove();
                }
                aStart++;
            }
        } else if (a[aStart] === b[bStart]) {
            aStart++;
            bStart++;
        } else if (a[aEnd - 1] === b[bEnd - 1]) {
            aEnd--;
            bEnd--;
        } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
            const node = a[--aEnd].nextSibling;
            insertNode(parent, b[bStart++], a[aStart++].nextSibling);
            insertNode(parent, b[--bEnd], node);
            a[aEnd] = b[bEnd];
        } else {
            if (map === undefined) {
                map = new Map();
                let i = bStart;
                while (i < bEnd) map.set(b[i], i++);
            }
            const index = map.get(a[aStart]);
            if (index !== undefined) {
                if (bStart < index && index < bEnd) {
                    let i = aStart;
                    let sequence = 1;
                    while (++i < aEnd && i < bEnd && map.get(a[i]) === index + sequence) sequence++;
                    if (sequence > index - bStart) {
                        const node = a[aStart];
                        while (bStart < index) {
                            insertNode(parent, b[bStart++], node);
                        }
                    } else {
                        insertNode(parent, b[bStart++], a[aStart]);
                        a[aStart++].remove();
                    }
                } else {
                    aStart++;
                }
            } else {
                a[aStart++].remove();
            }
        }
    }
}

/**
 * Moves node into place.
 *
 * A reference can be a NodeGroup, and a group is a DocumentFragment and so never a child of parent:
 * the node to go before is its leading sentinel. Testing the constructor rather than a groupStart
 * property matters, because groupEnd carries one too and going before that would land outside the
 * group instead of at the end of it.
 *
 * moveBefore keeps what insertBefore throws away - focus, running animations and transitions, iframe
 * content, an open popover or modal dialog - so it is worth taking wherever it exists. It has two
 * limits that decide the shape below: it refuses anything that is not an Element or CharacterData, so
 * a group moves one node at a time rather than as a fragment, and it refuses a node that is not
 * already connected, which is every node just created and every node in a tree still being built
 * offscreen. Both fall back to insertBefore, which is also the whole path where moveBefore is missing.
 */
function insertNode(parent, node, ref) {
    ref = ref?.constructor === NodeGroup ? ref.groupStart : ref;
    if (node.constructor === NodeGroup) {
        if (movable(parent, node.groupStart)) {
            const {groupEnd} = node;
            let moving = node.groupStart;
            while (moving !== groupEnd) {
                const nextSibling = moving.nextSibling;
                parent.moveBefore(moving, ref);
                moving = nextSibling;
            }
            parent.moveBefore(groupEnd, ref);
        } else {
            node.remove();
            parent.insertBefore(node, ref);
        }
    } else if (movable(parent, node)) {
        parent.moveBefore(node, ref);
    } else {
        parent.insertBefore(node, ref);
    }
}

/**
 * Whether this is a move of something already in the document, into somewhere already in the
 * document, in a browser that can do it: anything else is an insertion.
 */
function movable(parent, node) {
    return parent.moveBefore !== undefined && node.isConnected && parent.isConnected;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Records the value a node was created from, so a later reconciliation can tell a node this module
 * owns and may rewrite in place from one the caller handed us and must not touch. Named after
 * Signal.__value__, and a plain property rather than a symbol so it shows up when inspecting the DOM.
 *
 * @param node {Node|NodeGroup}
 * @param value {any}
 */
function own(node, value) {
    node.__value__ = value;
    return node;
}

/**
 *
 * @param nsURI {string}
 * @param value {any}
 * @returns {Node|NodeGroup|Text|Comment}
 */
export function createNode(nsURI, value) {
    const source = value;
    switch (typeof value) {
        case "string":
        case "number":
        case "bigint":
            return own(new Text(value), source);
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
                return own(node, source);
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
    return own(new Comment(value), source);
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