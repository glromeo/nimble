import {parse, traverse, generate} from "../../../node_modules/esbuild-jsx-plugin/dist/transpiler.mjs"
import {signal, computed} from "@nimble/toolkit/signals/signals.mjs";
import {css} from "@nimble/toolkit";

document.adoptedStyleSheets.push(css`
    .code-box {
        position: relative;
        overflow: hidden;
        padding: 1rem;
        margin-top: 0.5rem;
        border: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color);
        border-radius: var(--bs-border-radius);
        background-color: #f4f8ff;
    }
    .code-box-tabs {
        position: absolute;
        overflow: hidden;
        top: 0;
        right: 0;
        background-color: #f4f8ff;
        color: rgb(var(--bs-white-rgb));
        display: flex;
        border-bottom-left-radius: var(--bs-border-radius);
        font-size: .875em;
    }
    .code-box-tab {
        opacity: .33;
        border-right: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color);
    }
    .code-box pre {
        height: 128px;
    }
    .code-box iframe {
        border: none;
        width: 100%;
        height: 138px;
    }
`);

function transpile(source, sourcefile) {
    const ast = traverse(parse(source, false), {
        enter(path) {
            delete path.node.leadingComments;
            delete path.node.trailingComments;
            delete path.node.innerComments;
        },
    });
    console.log(ast);
    const {code, map} = generate(ast, {
        minified: false,
        sourceMaps: true,
        sourceFileName: sourcefile
    }, source);
    return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${btoa(JSON.stringify(map))}`;
}

function indent(prefix, code) {
    return `\n${code}`.split("\n").join(`\n${prefix}`);
}

function iframeHTML(module) {
    module = indent('\t\t\t\t', module);
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>nimble</title>
            <script type="importmap">{"imports":{
                "@nimble/testing/": "../node_modules/@nimble/testing/",
                "@nimble/toolkit/": "../node_modules/@nimble/toolkit/",
                "@nimble/jsx-runtime": "../node_modules/@nimble/toolkit/jsx-runtime.js",
                "chai": "../node_modules/@nimble/testing/node_modules/chai/chai.js",
                "sinon": "../node_modules/@nimble/testing/node_modules/sinon/pkg/sinon-esm.js"
            }}</script>
            <script type="module">${module}</script>
            <style>
                :root {
                    font-family: sans-serif;
                    font-size: 16px;
                }
            </style>
        </head>
        <body></body>
        </html>
    `;
}

export function Code(props) {

    const source = computed(() => {
        const lines = (props.source || "").split("\n");
        const indent = lines[1].match(/^\s+/)?.[0].length ?? 0;
        return lines.slice(1).map(line => line.slice(indent)).join("\n");
    });

    const transformed = computed(() => {
        return transpile(source.value, props.filename || "unknown");
    });

    const stripped = computed(() => {
        return transformed.value.split("\n").filter(line => line.indexOf("import ") < 0 && line.indexOf("//# ") < 0).join(`\n`);
    });

    const tab = signal("tsx");

    const Tab = props => (
        <div class={`code-box-tab px-4 py-1 ${tab.value === props.name ? "bg-primary" : "bg-dark"}`}
             onClick={() => tab.value = props.name} >
            {props.name}
        </div>
    )

    const highlight = code => hljs.highlight(code, { language: 'typescript' }).value;

    return (
        <div class="code-box">
            <slot type={tab.value}>{() => {
                switch (tab.value) {
                    case "tsx":
                        return <pre><code ref={el => el.innerHTML = highlight(source.value)} /></pre>;
                    case "js":
                        return <pre><code ref={el => el.innerHTML = highlight(stripped.value)} /></pre>;
                    case "DOM":
                        return <iframe src="about:blank" srcdoc={iframeHTML(transformed.value)}/>;
                }
            }}</slot>
            <div class="code-box-tabs">
                <Tab name="tsx" />
                <Tab name="js" />
                <Tab name="DOM" />
            </div>
        </div>
    )
}
