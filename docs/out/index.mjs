// src/index.jsx
var attrs = { alpha: 1, beta: "2" };
document.getElementById("root").replaceChildren(Array(null, null, Array("div", { ...attrs, class: "hello", style: { color: "red" } }, Array("p", null, "Hello"), " ", Array("em", null, "wold!"))));
