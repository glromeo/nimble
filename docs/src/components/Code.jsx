import {generate, parse, traverse} from "../../../node_modules/esbuild-jsx-plugin/dist/transpiler.mjs"
import {computed, signal, effect} from "@nimble/toolkit/signals/signals.mjs";
import {css} from "@nimble/toolkit";

import {javascript} from "@codemirror/lang-javascript"
import {Compartment, EditorState} from "@codemirror/state"
import {
    drawSelection,
    dropCursor,
    EditorView,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    rectangularSelection
} from "@codemirror/view"
import {
    bracketMatching,
    defaultHighlightStyle,
    foldKeymap,
    indentOnInput,
    syntaxHighlighting
} from "@codemirror/language"
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands"
import {searchKeymap} from "@codemirror/search"
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete"
import {lintKeymap} from "@codemirror/lint"

document.adoptedStyleSheets.push(css`
    code-box {
        display: flex;
        margin: 0.5rem auto 1rem auto;
        border: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color);
        border-radius: var(--bs-border-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    code-box .editor {
        position: relative;
        flex-grow: 1;
        min-width: 0;
        border-top-left-radius: var(--bs-border-radius);
        border-bottom-left-radius: var(--bs-border-radius);
    }

    code-box .toggle-mode {
        position: absolute;
        top: .5rem;
        right: .5rem;
        opacity: .5;
    }

    code-box .toggle-mode:hover {
        position: absolute;
        color: blue;
    }

    code-box .cm-editor {
        height: 100%;
        font-size: .5rem;
        font-family: Menlo, Monaco, Lucida Console, monospace;
        border-radius: inherit;
    }

    code-box .cm-editor .cm-scroller {
        border-radius: inherit;
    }

    code-box .cm-gutters {
        opacity: .5;
    }

    code-box .preview {
        width: 33%;
        display: block;
        border-left: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color);
        border-top-right-radius: var(--bs-border-radius);
        border-bottom-right-radius: var(--bs-border-radius);
    }

`);

export function Code(props) {

    const source = computed(() => {
        const lines = (props.source || "").split("\n");
        const regex = /^\s*/;
        let indent = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const {length} = regex.exec(line)[0];
            if (length < indent && length < line.length) {
                indent = length;
            }
        }
        return lines.slice(1).map(line => line.slice(indent)).join("\n").trim();
    });

    const transpiled = computed(() => {
        const ast = traverse(parse(source.value));
        return generate(ast, {
            minified: false,
            sourceMaps: true,
            sourceFileName: props.filename || "unknown"
        }, source.value);
    });

    const code = computed(() => {
        const {code, map} = transpiled.value;
        return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${btoa(JSON.stringify(map))}`;
    });

    const mode = signal("source");

    const ViewSource = () => {
        return (
            <svg class="toggle-mode view-source bi bi-eye-slash" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                 viewBox="0 0 16 16" onclick={() => mode.value = "source"}>
                <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/>
                <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/>
                <path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/>
            </svg>
        )
    }

    const ViewCode = () => {
        return (
            <svg class="toggle-mode view-code bi bi-eye" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                 viewBox="0 0 16 16" onclick={() => mode.value = "code"}>
                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/>
                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/>
            </svg>
        )
    }

    return (
        <code-box>
            <div class="editor" style={`display:${mode.value === "source" ? "block" : "none"}`} ref={parent => {
                const historyCompartment = new Compartment();
                const view = new EditorView({
                    parent,
                    extensions: [
                        lineNumbers(),
                        highlightSpecialChars(),
                        historyCompartment.of(history()),
                        drawSelection(),
                        dropCursor(),
                        EditorState.allowMultipleSelections.of(true),
                        indentOnInput(),
                        syntaxHighlighting(defaultHighlightStyle),
                        bracketMatching(),
                        closeBrackets(),
                        autocompletion(),
                        rectangularSelection(),
                        keymap.of([
                            ...closeBracketsKeymap,
                            ...defaultKeymap,
                            ...searchKeymap,
                            ...historyKeymap,
                            ...foldKeymap,
                            ...completionKeymap,
                            ...lintKeymap
                        ]),
                        javascript({typescript: true, jsx: true})
                    ]
                })
                return effect(() => {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: source.value
                        },
                        effects: [
                            historyCompartment.reconfigure([])
                        ]
                    });
                });
            }}>
                <ViewCode />
            </div>
            <div class="editor" style={`display:${mode.value === "code" ? "block" : "none"}`} ref={parent => {
                const view = new EditorView({
                    parent,
                    extensions: [
                        EditorState.readOnly.of(true),
                        EditorView.editable.of(false),
                        lineNumbers(),
                        highlightSpecialChars(),
                        syntaxHighlighting(defaultHighlightStyle),
                        javascript({typescript: false, jsx: false})
                    ]
                })
                return effect(() => {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: transpiled.value.code
                        }
                    });
                });
            }}>
                <ViewSource />
            </div>
            <iframe class="preview" src="/sandbox.html" onload={({target}) => {
                target.contentWindow.postMessage({code: code.value});
            }}/>
        </code-box>
    )
}
