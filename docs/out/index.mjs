// ../jsx-runtime/index.mjs
function jsx(tag, props) {
  if (typeof tag === "function") {
    return tag(props);
  }
  const el = document.createElement(tag);
  for (const name of Object.keys(props)) {
    if (name === "children") {
      el.replaceChildren(props.children);
      continue;
    }
    const value = props[name];
    const type = typeof value;
    if (type === "object") {
      if (name === "style") {
        Object.assign(el.style, value);
        continue;
      }
    }
    if (type === "string") {
      el.setAttribute(name, value);
    }
  }
  return el;
}
function Fragment({ children }) {
  const fragment = document.createDocumentFragment();
  fragment.append(children);
  return fragment;
}

// src/index.jsx
document.getElementById("root").replaceChildren(jsx(Fragment, { children: jsx("div", { class: "hello", style: { color: "red" }, children: "Hello wold!" }) }));
