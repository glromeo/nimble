// ../toolkit/atoms/atoms.mjs
function remove(state, observer) {
  if (state.observers?.delete(observer) && state.observers.size === 0 && !state.listeners?.size) {
    state.observers = null;
    if (state.dependencies) {
      for (const dependency of state.dependencies)
        remove(dependency, state);
    }
  }
}
function notify(state, pending) {
  if (!state.stale) {
    state.stale = true;
    if (state.listeners) {
      pending.push(state);
    }
    if (state.observers)
      for (const observer of state.observers) {
        notify(observer, pending);
      }
  }
}
var Scope = class extends WeakMap {
  constructor() {
    super();
    this.bound = /* @__PURE__ */ new Map();
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.bind = this.bind.bind(this);
    this.peek = super.get.bind(this);
  }
  init(atom3) {
    const state = {
      atom: atom3,
      value: atom3.init,
      observers: null,
      listeners: null,
      stale: false
    };
    if (atom3.read) {
      state.dependencies = /* @__PURE__ */ new Set();
      const getter = (atom4) => {
        const value = this.get(atom4);
        const dependency = super.get(atom4);
        state.dependencies.add(dependency);
        if (dependency.observers) {
          dependency.observers.add(state);
        } else {
          dependency.observers = /* @__PURE__ */ new Set([state]);
        }
        return value;
      };
      state.stale = true;
      state.refresh = () => {
        const { value, dependencies, listeners } = state;
        state.dependencies = /* @__PURE__ */ new Set();
        state.value = atom3.read(getter);
        const finalize = () => {
          for (const dependency of dependencies) {
            if (!state.dependencies.has(dependency)) {
              remove(dependency, state);
            }
          }
          state.stale = false;
          if (listeners && !Object.is(value, state.value)) {
            for (const listener of listeners) {
              listener(state.value);
            }
          }
          return state.value;
        };
        if (state.value?.then) {
          return state.value.then((resolved) => {
            state.value = resolved;
            return finalize();
          });
        } else {
          return finalize();
        }
      };
    }
    return state;
  }
  get(atom3) {
    let state = super.get(atom3);
    if (state === void 0) {
      super.set(atom3, state = this.init(atom3));
    }
    return state.stale ? state.refresh() : state.value;
  }
  set(atom3, ...args) {
    if (atom3.write) {
      return atom3.write(this.get, this.set, ...args);
    } else if (atom3.read === void 0) {
      const value = args[0];
      if (value?.then) {
        return value?.then((value2) => this.set(atom3, value2));
      }
      let state = super.get(atom3);
      if (state === void 0) {
        super.set(atom3, state = this.init(atom3));
      }
      if (!Object.is(value, state.value)) {
        state.value = value;
        const pending = [];
        if (state.observers) {
          for (const observer of state.observers)
            notify(observer, pending);
        }
        if (state.listeners) {
          for (const listener of state.listeners)
            listener(state.value);
        }
        for (const state2 of pending) {
          if (state2.stale)
            state2.refresh();
        }
      }
      return state.value;
    }
  }
  bind(atom3, listener) {
    let state = super.get(atom3);
    if (!state) {
      const value = this.get(atom3);
      if (value?.then) {
        return value.then(() => this.#mount(super.get(atom3), listener));
      }
    }
    return this.#mount(super.get(atom3), listener);
  }
  #mount(state, listener) {
    if (state.listeners === null) {
      state.listeners = /* @__PURE__ */ new Set();
      this.bound.set(state, state.atom.onbind?.(this.get, this.set));
    }
    state.listeners.add(listener);
    if (state.dependencies) {
      for (const dependency of state.dependencies)
        this.#mount(dependency, state.refresh);
    }
    return () => this.#unbind(state, listener);
  }
  #unbind(state, listener) {
    if (state.listeners?.delete(listener) && !state.listeners.size) {
      if (state.dependencies) {
        for (const dependency of state.dependencies) {
          remove(dependency, state);
          this.#unbind(dependency, state.refresh);
        }
      }
      state.listeners = null;
      this.bound.get(state)?.();
      return this.bound.delete(state);
    }
  }
  unbind(atom3, listener) {
    let state = super.get(atom3);
    if (state) {
      if (listener) {
        return this.#unbind(state, listener);
      } else {
        if (state.listeners) {
          for (const listener2 of state.listeners)
            this.#unbind(state, listener2);
        }
        return true;
      }
    }
  }
  dismiss() {
    if (this.bound.size) {
      for (const [state] of this.bound) {
        if (state.listeners) {
          for (const listener of state.listeners)
            this.#unbind(state, listener);
        }
      }
      return true;
    }
  }
};
var counter = 0;
function Atom(name, init, read, write) {
  this.name = name;
  this[init] = read;
  this.write = write;
}
function atom2(read, write) {
  return new Atom(
    this ?? `atom<${counter++}>`,
    typeof read === "function" ? "read" : "init",
    read,
    write
  );
}
var globalScope = new Scope();

// ../toolkit/html/css.mjs
function setProperty(style, property, value) {
  const type = typeof value;
  if (type === "function") {
    return setProperty.call(this, style, property, value(this, style, property));
  }
  if (type === "object") {
    if (value instanceof Atom) {
      return setProperty.call(this, style, property, this.get(value));
    }
    if (value[Symbol.iterator]) {
      const parts = [];
      for (let item of value) {
        if (item instanceof Atom) {
          item = this.get(item);
        }
        const type2 = typeof item;
        if (type2 === "bigint" || type2 === "number" || type2 === "string") {
          parts.push(item);
        }
      }
      return style.setProperty(property, parts.join(" "));
    }
    return style.setProperty(property, "auto");
  }
  if (type === "bigint" || type === "number" || type === "string") {
    return style.setProperty(property, String(value));
  }
  return style.removeProperty(property);
}
function setStyle(style, value) {
  const type = typeof value;
  if (type === "function") {
    return setStyle.call(this, value.call(this, style));
  }
  if (type === "string") {
    for (const entry of value.split(";")) {
      const [property, value2] = entry.split(":");
      style.setProperty(property.trim(), value2.trim());
    }
    return;
  }
  if (type === "object") {
    if (value instanceof Atom) {
      return setStyle.call(this, style, this.get(atom));
    }
    if (value) {
      const entries = Object.entries(value);
      for (const [property, value2] of entries) {
        setProperty.call(this, style, property, value2);
      }
      return;
    }
  }
  for (const property of style) {
    style.removeProperty(property);
  }
}
var HOLE = "";
function css(strings) {
  let text = strings.join(HOLE);
  const rules = [];
  const path = [];
  let p = 0;
  let property;
  let index = 0;
  let from = 0, selector = "";
  text = text.replace(/\s+|[\x01{};:]/g, (ch, offset) => {
    switch (ch) {
      case ":":
        property = text.slice(from, offset);
        return ch;
      case ";":
        property = void 0;
        from = offset + 1;
        return ch;
      case "{":
        path.push(p);
        p = 0;
        selector = text.slice(from, offset);
        from = offset + 1;
        return ch;
      case "}":
        p = path.pop() + 1;
        from = offset + 1;
        selector = "";
        return ch;
      case HOLE:
        let value = arguments[++index];
        switch (typeof value) {
          case "bigint":
          case "number":
          case "string":
            return String(value);
          case "boolean":
          case "symbol":
            return "unset";
          default:
            if (value) {
              rules.push({
                path: Uint8Array.from(path),
                property,
                value
              });
            }
            return "unset";
        }
      default:
        from = offset + ch.length;
        return " ";
    }
  });
  return (scope) => {
    const styleSheet2 = new CSSStyleSheet();
    styleSheet2.replaceSync(text);
    for (const { path: path2, property: property2, value } of rules) {
      let rule = styleSheet2;
      for (let i = 0; i < path2.length; i++) {
        rule = rule.cssRules[path2[i]];
      }
      const style = rule.style;
      if (property2) {
        if (value instanceof Atom) {
          bindAtom(scope, setProperty.bind(scope, style, property2), value);
        } else {
          setProperty.call(scope, style, property2, value);
        }
      } else {
        if (value instanceof Atom) {
          bindAtom(scope, setStyle.bind(scope, style), value);
        } else {
          setStyle(scope, style, value);
        }
      }
    }
    return styleSheet2;
  };
}
function bindAtom(scope, write, atom3) {
  let pending;
  const update = () => pending = write(scope.get(atom3));
  scope.bind(atom3, () => pending ||= requestAnimationFrame(update));
  update();
}
function styleSheet(css2) {
  return css2(this ?? globalScope);
}

// ../toolkit/html/render.mjs
var SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
var XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";
var PLACEHOLDER = document.createComment("");
function createNode(nsURI, parts) {
  const scope = this ?? globalScope;
  if (arguments.length < 2) {
    parts = nsURI;
    nsURI = null;
  }
  if (!Array.isArray(parts)) {
    parts = [null, null, parts];
  }
  const tag = parts[0];
  const attrs = parts[1];
  if (typeof tag === "function") {
    return tag({ attrs, children: parts.slice(2) });
  }
  const node = tag === null ? document.createDocumentFragment() : nsURI && nsURI !== XHTML_NAMESPACE_URI ? document.createElementNS(nsURI, tag) : tag === "svg" ? document.createElementNS(nsURI = SVG_NAMESPACE_URI, tag) : document.createElement(tag);
  if (attrs) {
    for (const name of Object.keys(attrs)) {
      const value = attrs[name];
      if (name === "class" || name === "className") {
        if (value instanceof Atom) {
          hookAttr(scope, (nsURI ? writeClass : writeClassName).bind(node), value);
        } else {
          (nsURI ? writeClass : writeClassName).call(node, value);
        }
        continue;
      }
      if (name === "style") {
        if (value instanceof Atom) {
          hookAttr(scope, writeStyle.bind(node), value);
        } else {
          writeStyle.call(node, value);
        }
        continue;
      }
      if (name[0] === "o" && name[1] === "n") {
        const event = name[2] === ":" ? name.slice(3) : name[2].toLowerCase() + name.slice(3);
        node.addEventListener(event, value);
        continue;
      }
      if (name === "ref") {
        if (value instanceof Atom) {
          scope.set(value, node);
        } else if (typeof value === "function") {
          value(node);
        }
        continue;
      }
      if (value instanceof Atom) {
        hookAttr(scope, writeAttr.bind(node, name), value);
      } else {
        writeAttr.call(node, name, value);
      }
    }
  }
  for (let i = 2; i < parts.length; i++) {
    const child = parts[i];
    if (Array.isArray(child)) {
      node.appendChild(createNode.call(this, nsURI, child));
    } else {
      appendNode(scope, node, child);
    }
  }
  return node;
}
function appendNode(scope, parent, value) {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "bigint") {
    return parent.appendChild(document.createTextNode(value));
  }
  if (type === "function") {
    return appendNode(scope, parent, value.call(scope, parent));
  }
  if (type === "object" && value !== null) {
    if (value instanceof Node) {
      return parent.appendChild(value);
    }
    if (value instanceof Atom) {
      let node = appendNode(scope, parent, scope.get(value));
      let pending;
      const update = () => {
        node = updateNode(scope, node, scope.get(value));
        pending = 0;
      };
      scope.bind(value, () => pending ||= requestAnimationFrame(update));
      return node;
    }
    if (value[Symbol.iterator]) {
      const slot = parent.appendChild(document.createElement("slot"));
      const $nodes = slot.$nodes = /* @__PURE__ */ new WeakMap();
      for (const item of value) {
        $nodes.set(item, appendNode(scope, parent, item));
      }
      return slot;
    }
  }
  return parent.appendChild(document.createTextNode(""));
}
function updateNode(scope, node, value) {
  if (value === null) {
    node.replaceWith(node = PLACEHOLDER.cloneNode());
    return node;
  }
  const type = typeof value;
  if (type === "boolean") {
    value = "";
    if (node.nodeType === 3) {
      node.data = value;
    } else {
      node.replaceWith(node = document.createTextNode(value));
    }
    return node;
  }
  if (type === "bigint" || type === "number" || type === "string") {
    if (node.nodeType === 3) {
      node.data = value;
    } else {
      node.replaceWith(node = document.createTextNode(value));
    }
    return node;
  }
  if (type === "function") {
    value = value.call(scope, node);
    return value !== void 0 ? updateNode(scope, node, value) : node;
  }
  if (type === "object") {
    if (value instanceof Atom) {
      return updateNode(scope, node, scope.get(value));
    }
    if (value[Symbol.iterator]) {
      if (node.tagName === "slot") {
        let childIndex = 0;
        for (const item of value) {
          let childNode = node.childNodes[childIndex++];
          if (childNode.$item !== item) {
            childNode = updateNode(scope, PLACEHOLDER.cloneNode(), item);
          }
          childNode.$item = item;
        }
      } else {
        const slot = document.createElement("slot");
        for (const item of value) {
          const childNode = updateNode(scope, slot.appendChild(PLACEHOLDER.cloneNode()), item);
          childNode.$item = item;
        }
        node.replaceWith(slot);
      }
      return node;
    }
    if (value.tag) {
      const { tag, attrs, children } = value;
      const nsURI = node.parentNode.namespaceURI;
      const el = nsURI && nsURI !== XHTML_NAMESPACE_URI ? document.createElementNS(nsURI, tag) : tag === "svg" ? document.createElementNS(SVG_NAMESPACE_URI, tag) : document.createElement(tag);
      if (attrs)
        for (const [name, value2] of Object.entries(attrs)) {
          setAttribute(scope, el, name, value2);
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
  }
  node.replaceWith(node = PLACEHOLDER.cloneNode());
  return node;
}
function hookAttr(scope, write, atom3) {
  let pending;
  const update = () => pending = write(scope.get(atom3));
  scope.bind(atom3, () => pending ||= requestAnimationFrame(update));
  update();
}
function writeClass(value) {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "bigint") {
    this.setAttribute("class", value);
    return;
  }
  if (value) {
    if (type === "object") {
      const parts = [];
      if (value[Symbol.iterator]) {
        for (const part of value) {
          if (typeof part === "string")
            parts.push(part);
        }
      } else {
        for (const [key, part] of Object.entries(value)) {
          if (part)
            parts.push(key);
        }
      }
      this.setAttribute("class", parts.join(" "));
      return;
    }
    this.setAttribute("class", String(value));
  } else {
    this.setAttribute("class", null);
  }
}
function writeClassName(value) {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "bigint") {
    this.className = value;
    return;
  }
  if (value) {
    if (type === "object") {
      const parts = [];
      if (value[Symbol.iterator]) {
        for (const part of value) {
          if (typeof part === "string")
            parts.push(part);
        }
      } else {
        for (const [key, part] of Object.entries(value)) {
          if (part)
            parts.push(key);
        }
      }
      this.className = parts.join(" ");
      return;
    }
    this.className = String(value);
  } else {
    this.className = null;
  }
}
function writeStyle(value) {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "bigint") {
    this.className = value;
    return;
  }
  if (value) {
    if (type === "object") {
      const parts = [];
      if (value[Symbol.iterator]) {
        for (const part of value) {
          if (typeof part === "string")
            parts.push(part);
        }
      } else {
        for (const [key, part] of Object.entries(value)) {
          if (part)
            parts.push(key);
        }
      }
      this.className = parts.join(" ");
      return;
    }
    this.className = String(value);
  } else {
    this.className = null;
  }
}
function writeAttr(name, value) {
  const type = typeof value;
  if (type === "boolean") {
    if (value) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
    return;
  }
  if (type === "string" || type === "number" || type === "bigint") {
    this.setAttribute(name, value);
    return;
  }
  if (value) {
    this.setAttribute(name, String(value));
  } else {
    this.removeAttribute(name);
  }
}

// src/dog.svg.jsx
var dog_svg_default = Array("svg", { class: "dog", viewBox: "50 60 160 134", width: "160", height: "134" }, Array("g", null, Array("path", { d: "M203.9,101.1c-0.2-0.8-0.4-1.4-0.5-2c-0.6-2.3-0.6-2.3-0.6-4c0-1.2-0.5-3.4-3.6-4.9c-1-0.5-1.9-0.7-2.4-0.8c-0.1-0.3-0.2-1-0.2-2.3c0.2-3.1-0.9-6.2-3.2-8.5c-1.9-2-5.3-4.3-11.2-4.3c-4.9,0-7.9,0.1-9.6,0.1c-0.8-1.7-2.2-4.1-3.7-5.4c-0.8-0.8-1.9-1.2-3-1.2c-0.6,0-1.2,0.1-1.7,0.3c-1.3-1.6-3.3-3.3-6.1-3.3v0h0c-1,0-2,0.2-2.9,0.7c-2.7,1.6-3.4,6-2.4,15.4c0.4,4.2,1.1,8.3,1.4,10.3c-2.1,2.2-7.4,7.7-9.6,10.9c-1.4,2-2.7,3.9-3.6,5.2c-0.4-0.1-0.8-0.2-1.3-0.2c-1.1,0-2.2,0.4-3.3,1.2c-0.6,0.4-1,0.9-1.3,1.3c-0.4-0.1-0.9-0.2-1.5-0.2c-1.3,0-2.7,0.5-4,1.5l-2.6,2.1c-4.6-0.2-23.9-1-32.7-1c-3,0-3.9,0.1-4.4,0.2c-1.6,0.3-3.2,0.7-4.4,1c-0.9-1.5-2.4-2.8-4.3-2.8c-0.1,0-0.2,0-0.3,0c-1.3,0.1-2.3,0.6-3.2,1.3c-0.7-0.4-1.4-0.7-2.3-0.7c-0.9,0-1.7,0.3-2.6,0.8c-1.2,0.8-2,1.7-2.4,2.5c-2.1,0.2-5.9,1.4-8.6,6.6c-0.6,1.1-0.3,2.4,0.7,3.2c0.2,0.2,1.3,1,3.1,1.6c-0.9,1.8-1.7,4.1-2.1,7.1c-0.4,3.1-0.4,4.6-0.4,5.7c0,1.1,0,1.2-0.9,3.2c-0.3,0.6-0.5,1-0.7,1.5c-1.7,3.4-2.2,4.7-2.6,10.3c-0.3,4.1-1.2,4.8-2.7,6c-0.3,0.2-0.6,0.5-0.9,0.7c-2.6,2.2-2,4.6-1.6,6c0.1,0.5,0.2,0.9,0.3,1.4c0.2,2.4-0.2,12.5-0.6,14.3c-0.6,2.6,0.9,4.7,1.9,6.1c0.2,0.3,0.5,0.7,0.6,1c1,2.3,4.2,2.3,5.4,2.3c1.2,0,2.4-0.1,3-0.2c0.7,0.1,2.5,0.3,4,0.3c1,0,1.8-0.1,2.4-0.3c2.2-0.6,2.6-2.3,2.6-2.8c0.2-1.7-0.6-3.7-2-5.3c0.6-0.1,1.2-0.2,1.6-0.4c0.1,0,0.2,0,0.5,0c0.2,0,0.5,0,0.7,0c0.3,0,0.6,0,0.9,0c0.7,0,2.6,0,3.8-1.3c0.5-0.6,1.1-1.6,0.9-3.3c-0.3-3.3-3.1-4.8-5.9-5.1c-0.1-0.1-0.2-0.2-0.2-0.4c-0.1-0.2,0.1-0.7,0.6-1.4c1.9-2.5,2.8-4.3,3.2-5.5L89,155.2c4.1,3.2,15.2,10.6,26.6,10.9c4,0.1,7.7,0.1,11.1,0.1c2.9,0,5,0,6.5-0.1l0.9,9c0,0.2,0.1,0.5,0.2,0.7c1.6,4,2.4,5.7,3,6.5c0,0.1,0.1,0.3,0.1,0.4c0.3,1.7,0.8,4.6,3.3,5.5c0.7,0.2,1.7,0.4,3.1,0.4c0.8,0,1.7,0,2.6-0.1c0.8,0,1.7-0.1,2.5-0.1c1.2,0,1.5,0.1,1.5,0.1c0.5,0.2,1.2,0.3,1.9,0.3c1.8,0,3.7-0.6,4.8-1c0.9,0.2,2.6,0.4,4.2,0.4c0.9,0,1.7-0.1,2.4-0.3c1.5-0.4,2.2-1.3,2.6-1.9c0.4-0.8,0.5-1.8,0.2-2.7c-0.3-0.8-1-1.6-2.1-2.3c1.5-0.5,2.5-1.6,2.7-3.1c0.2-2.2-1.5-4.4-4.5-5.6c-0.8-0.3-1.7-0.6-2.5-0.8c-3-0.9-4-1.3-4-3.9c0-4.1,0.8-8,1.3-9.7c1.3-0.8,3.7-2.5,6.2-4.5c5.1-4.2,7.9-8.2,8.3-11.7c0.2-2,0.2-4,0.2-6c0-5.6,0.2-9.1,3.1-11.1c5.7-3.9,14.2-7.8,17.3-8.6c2.3-0.6,8-2.5,10.6-7.1C204.3,106.6,204.6,104,203.9,101.1z M200.2,95.2c0,1.2,0,1.8,0.2,2.5c-0.9-0.4-2.1-1-2.6-2.1c-0.3-0.8-0.2-1.8,0.3-2.9C199.1,93.1,200.2,93.9,200.2,95.2z M191.7,113.6c-3.6,0.9-12.4,5-18.1,9c-5.7,3.9-3.6,12-4.4,18.9c-0.8,6.9-14.2,15-14.2,15s-1.6,5.5-1.6,11.3c0,5.8,4.6,5.7,8,7.1c3.5,1.4,3.6,3.8,1.7,4.1c-1.5,0.2-4.8,1.2-6.1,1.6c-0.7-0.5-1.3-1-1.8-1.6c-0.3-0.3-0.6-0.6-0.8-1c-0.2-0.3-0.5-0.7-0.7-1.1c-0.2-0.4-0.4-0.8-0.5-1.2c-0.1-0.4-0.2-0.8-0.3-1.3l-0.6-2.6c-0.4-1.8-0.7-3.6-1.1-5.4c-0.3-1.8-0.6-3.6-0.9-5.3c1.1-1.3,2.2-2.5,3.3-3.8l-0.1-0.1c-1.2,1.2-2.4,2.4-3.6,3.7l-0.1,0.1v0.1c0.2,1.9,0.4,3.7,0.6,5.5c0.2,1.8,0.5,3.7,0.7,5.5c0.1,0.9,0.3,1.8,0.6,2.8c0.1,0.4,0.2,0.9,0.4,1.4c0.2,0.5,0.4,0.9,0.7,1.3c0.5,0.8,1.2,1.5,2,2.1c0.4,0.3,0.8,0.5,1.2,0.8c0.2,0.1,0.5,0.2,0.8,0.4c-0.1,0-0.2,0.1-0.2,0.1s8.3,2.7,7.4,4.4c-0.3,0.7-1.4,0.8-2.7,0.8c-2,0-4.4-0.5-4.4-0.5s-2.6,1.1-4.6,1.1c-0.4,0-0.7,0-1.1-0.2c-0.5-0.2-1.3-0.2-2.3-0.2c-1.6,0-3.5,0.1-5,0.1c-0.9,0-1.8-0.1-2.2-0.2c-1.7-0.6-1.6-4.6-2-4.9c-0.5-0.3-2.8-6.1-2.8-6.1l-1.1-11.3c0,0,0,0-0.1,0c0-0.4,0-0.9,0-1.3c0-0.8,0-1.6,0-2.5c0-0.4,0-0.8-0.1-1.2c0-0.4,0-0.8-0.1-1.2c0-0.8-0.1-1.6-0.2-2.5l0-0.2l-0.1-0.2c-0.2-0.2-0.3-0.5-0.5-0.7c-0.2-0.2-0.3-0.5-0.4-0.8c-0.1-0.3-0.2-0.6-0.4-0.9c-0.1-0.3-0.2-0.6-0.3-0.9c-0.4-1.3-0.7-2.6-1-3.8c-0.3-1.3-0.5-2.6-0.7-3.9c-0.2-1.3-0.4-2.6-0.6-4h-0.1c0.1,1.3,0.2,2.7,0.3,4c0.1,1.3,0.3,2.7,0.5,4c0.2,1.3,0.5,2.7,0.8,4c0.2,0.7,0.4,1.3,0.6,2c0.1,0.3,0.2,0.6,0.4,1c0.1,0.2,0.3,0.5,0.4,0.7c0.1,0.7,0.1,1.5,0.2,2.3c0,0.4,0.1,0.8,0.2,1.2c0.1,0.4,0.1,0.8,0.2,1.2c0.1,0.8,0.2,1.6,0.4,2.5c0.1,0.4,0.2,0.8,0.2,1.3c-1.1,0-3.8,0.1-8.2,0.1c-2.9,0-6.6,0-11.1-0.1c-13.4-0.3-26.8-11.6-26.8-11.6l-14,12.1c0,0,0.2,1.4-2.8,5.3c-3,3.9,0.8,5.8,0.8,5.8s0,0,0.1,0c0.6,0,3.9,0.1,4.1,2.8c0.2,1.6-0.9,1.9-2.2,1.9c-0.5,0-1.1,0-1.6,0c-0.6,0-1.1,0-1.5,0.2c-0.8,0.3-2.2,0.4-3.6,0.4c-1.2,0-2.3-0.1-2.8-0.1l0.6-9.9c0.5-0.9,1.1-1.8,1.7-2.7c0.6-0.9,1.3-1.8,2-2.6c0.7-0.8,1.4-1.7,2.1-2.5c0.7-0.8,1.5-1.5,2.3-2.3c0.8-0.7,1.6-1.6,2.3-2.4c0.7-0.8,1.5-1.6,2.2-2.5c1.4-1.7,2.8-3.4,4.1-5.2l1-1.3l0.2-0.3l0.2-0.3L85,148c0.3-0.4,0.6-0.9,1-1.4c0.3-0.5,0.6-1,0.8-1.6c0.4-1.1,0.6-2.3,0.6-3.4c0.1-1.1,0-2.3-0.2-3.4l-0.1-0.8l0-0.4c0-0.1,0-0.3,0-0.4c0-0.5,0-1,0-1.5c0.1-0.5,0.2-1,0.2-1.5c0.1-0.5,0.3-1,0.5-1.5c0.4-1,1-1.9,1.6-2.7c0.6-0.8,1.4-1.6,2.3-2.3l-0.1-0.1c-1,0.5-1.8,1.3-2.6,2c-0.8,0.8-1.4,1.7-2,2.7c-0.2,0.5-0.5,1-0.7,1.6c-0.2,0.5-0.3,1.1-0.4,1.7c-0.1,0.6-0.1,1.1-0.1,1.7c0,0.3,0,0.6,0,0.8l0.1,0.8c0.1,1.1,0.1,2.1,0.1,3.2c-0.1,1-0.2,2.1-0.6,3c-0.2,0.5-0.4,0.9-0.6,1.4c-0.2,0.4-0.6,0.9-0.9,1.3l-0.5,0.7l-0.2,0.3l-0.2,0.3l-0.9,1.3c-1.3,1.8-2.6,3.5-4,5.2c-0.7,0.8-1.4,1.7-2.1,2.5s-1.4,1.6-2.2,2.4c-0.7,0.8-1.5,1.6-2.3,2.4c-0.7,0.8-1.4,1.7-2.1,2.6c-0.7,0.9-1.3,1.8-1.9,2.7c-0.6,0.9-1.2,1.9-1.7,2.9l0,0v0l-0.3,9.9c-0.1,0-0.1,0-0.1,0s-0.3,2,1.9,2.7c2.2,0.6,3.8,3.3,3.6,4.9c-0.1,0.7-1.2,0.8-2.5,0.8c-1.8,0-4-0.4-4-0.4s-1.5,0.2-3.1,0.2c-1.4,0-2.8-0.2-3.1-0.8c-0.6-1.4-2.8-3.3-2.4-5.5c0.5-2.2,0.8-12.6,0.6-15s-1.6-3.6,0.5-5.3c2-1.7,4.1-2.4,4.6-8.5c0.5-6.1,1.1-6.6,3.2-10.9c2-4.2,0.6-2.4,1.6-9.6c0.9-7.2,4.7-9.9,4.7-9.9c-0.7,0.3-1.4,0.5-2.1,0.5c-2.4,0-4.5-1.6-4.5-1.6c2.5-4.6,5.7-5.3,7.2-5.3c0.5,0,0.8,0.1,0.8,0.1s0.2-1.6,2.2-3c0.4-0.3,0.7-0.4,1.1-0.4c1.4,0,2.4,2,2.4,2s1.3-2.4,3.3-2.5c0,0,0.1,0,0.1,0c2,0,2.9,3.3,2.9,3.3s3-0.9,6.3-1.6c0.6-0.1,2-0.2,3.9-0.2c9.1,0,30.2,0.9,33.2,1.1c0.2,0.2,0.4,0.5,0.6,0.8c0.2,0.2,0.3,0.4,0.5,0.7c0.2,0.2,0.3,0.5,0.5,0.8c0.2,0.3,0.3,0.6,0.5,0.8c0.2,0.3,0.3,0.6,0.5,0.9c0.2,0.3,0.3,0.6,0.4,0.9c0.1,0.3,0.2,0.6,0.3,0.9c0.1,0.3,0.2,0.6,0.2,0.9c0.1,0.3,0.1,0.6,0.2,0.8c0,0.2,0,0.5,0.1,0.7c0,0.2,0,0.4,0,0.6c0,0.3,0,0.5,0,0.5s0-0.2,0.1-0.5c0-0.2,0.1-0.3,0.1-0.6s0-0.5,0-0.7c0-0.3,0-0.6-0.1-0.9c0-0.3-0.1-0.6-0.2-1c-0.1-0.3-0.2-0.6-0.2-1c-0.1-0.3-0.2-0.7-0.3-1c-0.1-0.3-0.2-0.7-0.4-1c-0.1-0.3-0.3-0.7-0.4-0.9c-0.2-0.3-0.3-0.6-0.4-0.9c-0.2-0.3-0.3-0.5-0.4-0.7c-0.2-0.3-0.3-0.5-0.5-0.7c0.5-0.4,1.3-1,2.6-2.1c0.9-0.7,1.7-1,2.4-1c0.6,0,1.1,0.2,1.5,0.5c0.1,0.2,0.2,0.3,0.3,0.6c0.2,0.3,0.4,0.7,0.6,1.2c0.1,0.2,0.2,0.5,0.3,0.7c0.1,0.3,0.2,0.6,0.3,0.8c0.1,0.3,0.2,0.6,0.3,0.9c0.1,0.2,0.1,0.3,0.2,0.5c0.1,0.2,0.1,0.3,0.2,0.5c0.1,0.2,0.1,0.3,0.2,0.5c0,0.2,0.1,0.4,0.1,0.6c0,0.2,0.1,0.4,0.1,0.6c0,0.2,0.1,0.4,0.1,0.6c0,0.2,0.1,0.4,0.1,0.6c0,0.2,0.1,0.4,0.1,0.6c0.1,0.4,0.1,0.8,0.1,1.2c0,0.8,0,1.7-0.2,2.5c-0.1,0.4-0.1,0.9-0.2,1.3c0,0.4,0,0.9,0,1.3c0,0.4,0,0.9,0.1,1.3c0.1,0.4,0.1,0.8,0.2,1.3c0.2,0.8,0.3,1.6,0.5,2.3c0.2,0.7,0.4,1.4,0.7,2c0.2,0.6,0.5,1.2,0.7,1.6c0.2,0.5,0.4,0.9,0.6,1.2c0.3,0.7,0.6,1,0.6,1s-0.2-0.4-0.5-1.1c-0.2-0.3-0.3-0.7-0.5-1.3c-0.2-0.5-0.4-1-0.6-1.7c-0.2-0.6-0.4-1.3-0.6-2c-0.2-0.7-0.3-1.5-0.4-2.3c-0.1-0.4-0.1-0.8-0.1-1.2c0-0.4,0-0.8,0-1.3c0-0.4,0.1-0.8,0.1-1.3c0.1-0.4,0.2-0.8,0.2-1.3c0.2-0.9,0.3-1.8,0.3-2.6c0-0.4,0-0.9,0-1.3c0-0.2,0-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.6c0-0.2-0.1-0.4-0.1-0.5c-0.1-0.2-0.1-0.3-0.2-0.5c-0.1-0.3-0.2-0.7-0.3-1c-0.1-0.3-0.2-0.6-0.3-0.9c-0.1-0.3-0.2-0.6-0.3-0.8c-0.2-0.5-0.4-0.9-0.5-1.3c0,0,0-0.1,0-0.1c0.2-0.6,0.5-1.4,1.5-2.1c0.6-0.5,1.2-0.6,1.7-0.6c0.6,0,1.2,0.3,1.5,0.6c0.1,0.1,0.1,0.2,0.2,0.3c0.2,0.3,0.5,0.8,0.8,1.4c0.2,0.3,0.3,0.6,0.5,1c0.2,0.3,0.4,0.7,0.5,1.1c0.2,0.4,0.3,0.8,0.5,1.2c0.2,0.4,0.3,0.8,0.5,1.3c0.2,0.4,0.3,0.8,0.4,1.3c0.1,0.4,0.2,0.8,0.3,1.3c0.1,0.4,0.2,0.8,0.2,1.2c0.1,0.4,0.1,0.7,0.2,1.1c0,0.3,0,0.6,0.1,0.9c0,0.3,0,0.5,0,0.7c0,0.4,0,0.6,0,0.6s0-0.2,0.1-0.6c0-0.2,0.1-0.4,0.1-0.7c0-0.3,0-0.6,0-0.9c0-0.3,0-0.7-0.1-1.1c0-0.4-0.1-0.8-0.2-1.3s-0.2-0.9-0.2-1.3c-0.1-0.4-0.2-0.9-0.3-1.3c-0.1-0.4-0.2-0.9-0.4-1.3c-0.2-0.4-0.3-0.9-0.4-1.3c-0.2-0.4-0.3-0.8-0.5-1.2c-0.2-0.4-0.3-0.7-0.4-1c-0.3-0.6-0.5-1.2-0.7-1.5c0,0,0-0.1-0.1-0.1c0.8-1.3,2.4-3.7,4.2-6.3C149.4,99.7,157,92,157,92s-4.2-22.2-0.5-24.4c0.6-0.3,1.1-0.5,1.7-0.5c2.6,0,4.7,3.1,5.3,4.1c0,0.1,0,0.1,0,0.2c-0.1,0.5-0.2,1-0.2,1.7c-0.1,0.3-0.1,0.7-0.2,1c-0.1,0.4-0.2,0.7-0.2,1.1c-0.2,0.8-0.3,1.6-0.5,2.6c-0.1,0.4-0.2,0.9-0.3,1.4c-0.1,0.5-0.2,0.9-0.3,1.4c-0.1,0.5-0.2,1-0.4,1.5c-0.1,0.5-0.2,1-0.4,1.5c-0.1,0.5-0.3,1-0.4,1.5l-0.2,0.8c-0.1,0.3-0.2,0.5-0.2,0.8c-0.2,1.1-0.4,2.2-0.4,3.3c0,1.1,0.2,2.2,0.5,3.2c0.3,1,0.8,1.9,1.3,2.7c0.5,0.8,1.1,1.5,1.7,2.1c1.2,1.2,2.3,2,3.2,2.5s1.3,0.7,1.3,0.7l0.1-0.1c0,0-0.5-0.2-1.3-0.8c-0.8-0.6-1.9-1.4-2.9-2.6c-1.1-1.2-2.1-2.8-2.6-4.7c-0.2-0.9-0.4-2-0.4-3c0-1,0.2-2.1,0.5-3.1c0.1-0.2,0.2-0.5,0.2-0.7l0.2-0.8c0.2-0.5,0.4-1,0.5-1.5c0.2-0.5,0.3-1,0.5-1.5c0.1-0.5,0.3-1,0.4-1.5c0.2-1,0.4-2,0.6-2.9c0.2-0.9,0.3-1.8,0.3-2.6c0.1-0.8,0.1-1.6,0.1-2.3c0-0.3,0-0.6,0-0.9c0-0.3,0-0.6,0-0.8c0,0,0-0.1,0-0.1c0.2-0.2,0.5-0.5,0.8-0.7c0,0.3,0.1,2,0.2,4.3c0,1.3,0.1,2.8,0.1,4.4c0,0.8,0.1,1.6,0.1,2.5s0.1,1.7,0,2.6c0,0.8,0,1.7-0.1,2.6c0,0.9,0,1.7,0,2.6c0.1,1.7,0.5,3.3,1.1,4.4c0.3,0.6,0.7,1.1,1.1,1.5c0.4,0.4,0.8,0.6,1.2,0.7c0.4,0.2,0.7,0.2,0.9,0.2c0.2,0,0.3,0,0.3,0v-0.1c0,0-0.1,0-0.3,0c-0.2,0-0.5-0.1-0.8-0.3c-0.3-0.2-0.7-0.4-1.1-0.8c-0.3-0.4-0.7-0.8-0.9-1.4c-0.5-1.2-0.7-2.6-0.8-4.2c0-0.8,0-1.6,0.1-2.5c0.1-0.9,0.2-1.7,0.2-2.6c0.1-0.9,0.1-1.8,0.1-2.6c0-0.9,0-1.7,0-2.6c0-0.4,0-0.8-0.1-1.2c0-0.4-0.1-0.8-0.1-1.2c-0.1-0.7-0.2-1.4-0.3-2.1c-0.1-0.6-0.2-1.3-0.3-1.8c-0.1-0.5-0.2-1-0.3-1.3c-0.2-0.7-0.3-1.1-0.4-1.2c0.3-0.2,0.7-0.3,1-0.3c0.4,0,0.8,0.2,1.3,0.5c1.7,1.6,3.8,6.1,3.8,6.1s3-0.2,11.2-0.2c8.2,0,12.1,5.3,11.8,10.2c-0.3,4.9,1.9,4.9,1.9,4.9s0.4,0.1,1,0.3c-0.7,1.4-0.8,2.7-0.3,3.9c0.7,1.9,2.9,2.7,4.1,3.1c0.2,0.6,0.4,1.5,0.7,2.6C203.5,109.3,195.3,112.6,191.7,113.6z" })));

// src/index.jsx
var { get, set, bind: bind2 } = globalScope;
var timeStringAtom = atom2((/* @__PURE__ */ new Date()).toLocaleTimeString());
setInterval(() => {
  set(timeStringAtom, (/* @__PURE__ */ new Date()).toLocaleTimeString());
}, 1e3);
var rgbAtom = atom2("rgb(0,0,0)");
setInterval(() => {
  const R = Math.floor(256 * Math.random());
  const G = Math.floor(256 * Math.random());
  const B = Math.floor(256 * Math.random());
  set(rgbAtom, `rgb(${R},${G},${B})`);
}, 1e3);
var navHeightAtom = atom2("2rem");
document.adoptedStyleSheets.push(styleSheet(css`
    body {
        margin: 0;
        height: 100vh;
    }

    @media print {
        body {
            margin: 0;
            height: ${200}vh;
        }

        ${".yellow"} {
            color: yellow;
        }
    }

    .nav-bar {
        font-family: Arial, sans-serif;
        height: ${navHeightAtom};
        background-color: cornflowerblue;
        color: white;
        display: flex;
        flex-direction: row;
        align-items: center;
        overflow: hidden;
    }

    .nav-item {
        padding: .5rem;
        border: none;
        border-right: 1px solid lightblue;
    }

    .nav-fill {
        flex-grow: 1;
    }

    .dog {
        fill: currentColor;
        color: ${rgbAtom};
    }
`));
document.getElementById("root").replaceWith(createNode(Array(null, null, Array(
  "div",
  {
    class: "nav-bar",
    "on:mouseenter": () => set(navHeightAtom, "5rem"),
    "on:mouseleave": () => set(navHeightAtom, "2rem")
  },
  Array("div", { class: "nav-item", slot: "nav-item" }, "Setup"),
  Array("div", { class: "nav-item", slot: "nav-item" }, "Docs"),
  Array("div", { class: "nav-item", slot: "nav-item" }, "Videos"),
  Array("div", { class: "nav-fill" }),
  Array("div", { class: "nav-item" }, timeStringAtom)
), dog_svg_default, Array("h1", null, "Welcome to nimble"), Array("h2", null, "quick to understand, think, devise, etc."))));
