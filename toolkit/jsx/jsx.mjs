import {RenderEffect, Signal} from "../signals/signals.mjs";

export const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
export const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

export const svg = SVG_NAMESPACE_URI;
export const xhtml = XHTML_NAMESPACE_URI;

export const directives = {};

export function createDirective(attr, callback) {
    directives[attr] = callback;
}

export function Fragment({children}) {
    const fragment = document.createDocumentFragment();
    if (children !== undefined) {
        appendChildren(fragment, children);
    }
    return fragment;
}

function appendChildren(node, children) {
    if (Array.isArray(children)) {
        for (const child of children) {
            appendNode(node, child);
        }
    } else {
        appendNode(node, children);
    }
}

export function createNode(tag, props) {

    if (typeof tag === "function") {
        return tag(props);
    }

    const {
        jsxns: nsURI,
        class: _class,
        style: _style,
        children,
        ref,
        ...attrs
    } = props;

    const node = nsURI && nsURI !== XHTML_NAMESPACE_URI
        ? document.createElementNS(nsURI, tag)
        : tag === "svg"
            ? document.createElementNS(SVG_NAMESPACE_URI, tag)
            : document.createElement(tag);

    if (_class) {
        if (_class instanceof Signal) {
            node.nextEffect = new ClassEffect(node, _class);
        } else {
            setClass(node, _class);
        }
    }
    if (_style) {
        if (_style instanceof Signal) {
            node.nextEffect = new StyleEffect(node, _style);
        } else {
            setStyle(node, _style);
        }
    }
    if (ref) {
        if (ref instanceof Signal) {
            ref.set(node);
        } else {
            ref(node);
        }
    }

    for (const name of Object.keys(attrs)) {
        const value = attrs[name];

        if (name[0] === "o" && name[1] === "n") {
            const event = name[2] === ":" ? name.slice(3) : name[2].toLowerCase() + name.slice(3);
            node.addEventListener(event, value);
            continue;
        }

        const directive = directives[name];
        if (directive) {
            node.setAttribute(name, value);
            directive(node, value);
            continue;
        }

        if (value instanceof Signal) {
            node.nextEffect = new AttrEffect(node, name, value);
        } else {
            setAttr(node, name, value);
        }
    }

    if (children !== undefined) {
        appendChildren(node, children)
    }

    return node;
}

export function unMount(node) {
    node.nextEffect?.dispose();
    if (node.firstChild) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, unMount.options);
        while (node = walker.nextNode()) {
            node.nextEffect.dispose();
        }
    }
}

window.unMount = unMount;

unMount.options = {
    acceptNode: node => node.nextEffect ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
};


class ClassEffect extends RenderEffect {
    constructor(node, signal) {
        super(signal, node.nextEffect);
        this.refresh = setClass.bind(null, node);
        this.refresh(this.track());
    }
}

function setClass(node, value) {
    if (value) {
        if (typeof value === "object") {
            const parts = [];
            if (value[Symbol.iterator]) {
                for (const part of value) {
                    if (part) parts.push(part);
                }
            } else {
                for (const [key, part] of Object.entries(value)) {
                    if (part) parts.push(key);
                }
            }
            value = parts.join(" ");
        }
        node.setAttribute("class", value);
    } else {
        node.removeAttribute("class");
    }
}

class StyleEffect extends RenderEffect {
    constructor(node, signal) {
        super(signal, node.nextEffect);
        this.refresh = setStyle.bind(null, node);
        this.refresh(this.track());
    }
}

function setStyle(node, value) {
    if (value) {
        if (typeof value === "object") {
            node.setAttribute("style", "");
            Object.assign(node.style, value);
            return
        }
        node.setAttribute("style", value);
    } else {
        node.removeAttribute("style");
    }
}

class AttrEffect extends RenderEffect {
    constructor(node, name, signal) {
        super(signal, node.nextEffect);
        this.refresh = setAttr.bind(null, node, name);
        this.refresh(this.track());
    }
}

function setAttr(node, name, value) {
    const type = typeof value;
    if (type === "string" || type === "number" || type === "bigint") {
        node.setAttribute(name, value);
        return;
    }
    if (value) {
        node.setAttribute(name, type === "boolean" ? "" : value);
    } else {
        node.removeAttribute(name);
    }
}

class NodeEffect extends RenderEffect {

    constructor(parent, signal) {
        super(signal, parent.nextEffect);
        this.node = appendNode(parent, this.track());
    }

    refresh(value) {
        const type = typeof value;
        switch (type) {
            case "string":
            case "number":
            case "bigint":
                this.setText(value);
                return;
            case "function":
                if ((value = value(node)) !== undefined) this.refresh(value);
                return;
            case "object":
                if (value instanceof Node) {
                    if (value !== this.node) this.setNode(value);
                    return;
                }
                if (value !== null) {
                    if (value[Symbol.iterator]) {
                        // TODO: make a proper diff/update
                        // if (!this.node.lastNode) {
                        //     this.node.replaceWith(this.node = document.createComment(value.constructor.name));
                        // }
                        const fragment = document.createDocumentFragment();
                        const placeholder = fragment.appendChild(document.createComment(value.constructor.name));
                        for (const item of value) {
                            appendNode(fragment, item).sourceValue = item
                        }
                        placeholder.lastNode = fragment.lastChild
                        this.setNode(fragment);
                        return;
                    }
                    if (value.tag) {
                        // TODO: make a proper diff/update
                        this.setNode(createNode(value.tag, {
                            jsxns: parent.namespaceURI,
                            children: value.children,
                            ...value.attrs
                        }));
                        return;
                    }
                }
            default:
                parent.appendChild(document.createComment(String(value)));
        }
        if (type === "object" && value !== null) {
        }
        this.setText("");
    }

    setText(text) {
        if (this.node.nodeType === Node.TEXT_NODE) {
            this.node.data = text;
        } else {
            this.setNode(document.createTextNode(text));
        }
    }

    setNode(node) {
        let lastNode = this.node.lastNode;
        if (lastNode) {
            while (lastNode !== this.node) (lastNode = lastNode.previousSibling).nextSibling.remove();
        }
        this.node.replaceWith(this.node = node);
    }
}

function appendNode(parent, value) {
    switch (typeof value) {
        case "bigint":
        case "number":
        case "string":
            return parent.appendChild(document.createTextNode(value));
        case "function":
            return appendNode(parent, value(parent));
        case "object":
            if (value instanceof Node) {
                return parent.appendChild(value);
            }
            if (value instanceof Signal) {
                const {node} = parent.nextEffect = new NodeEffect(parent, value);
                return node;
            }
            if (value !== null) {
                if (value[Symbol.iterator]) {
                    const placeholder = parent.appendChild(document.createComment(value.constructor.name));
                    for (const item of value) {
                        appendNode(parent, item).sourceValue = item
                    }
                    placeholder.lastNode = parent.lastChild
                    return placeholder;
                }
                if (value.tag) {
                    return parent.appendChild(createNode(value.tag, {
                        jsxns: parent.namespaceURI,
                        children: value.children,
                        ...value.attrs
                    }));
                }
            }
        default:
            return parent.appendChild(document.createComment(String(value)));
    }
}
