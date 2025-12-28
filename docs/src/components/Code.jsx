import {generate, parse, traverse} from "../../../node_modules/esbuild-jsx-plugin/dist/transpiler.mjs"
import {computed, effect, signal} from "@nimble/toolkit/signals/signals.mjs";
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
        bottom: .5rem;
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

function indentCode(source) {
    const lines = (source || "").split("\n");
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
}

export function Code(props) {

    const source = signal("");

    const transpiled = computed(() => {
        const { value } = source;
        if (!value) {
            return {code: value}
        }
        const ast = traverse(parse(value));
        return generate(ast, {
            minified: false,
            sourceMaps: true,
            sourceFileName: props.filename || "unknown"
        }, value);
    });

    const code = computed(() => {
        const {code, map} = transpiled.value;
        return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${btoa(JSON.stringify(map))}`;
    });

    const mode = signal("source");

    return (
        <code-box>
            <div class="editor" style={`display:${mode.value === "source" ? "block" : "none"}`} ref={parent => {
                const historyCompartment = new Compartment();
                let hasChanged = false;
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
                        EditorView.updateListener.of(update => {
                            if (update.docChanged) {
                                hasChanged = true;
                            }
                        }),
                        EditorView.domEventHandlers({
                            blur(event, view) {
                                if (hasChanged) {
                                    source.value = view.state.doc.toString();
                                    hasChanged = false;
                                }
                            }
                        }),
                        javascript({typescript: true, jsx: true})
                    ]
                })
                return effect(() => {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: source.value = indentCode(props.source)
                        },
                        effects: [
                            historyCompartment.reconfigure([])
                        ]
                    });
                });
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"
                     class="toggle-mode view-source bi bi-filetype-tsx"
                     onclick={() => mode.value = "code"}>
                    <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2h-1v-1h1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5zM3.172 14.841a1.13 1.13 0 0 0 .401.823q.193.162.478.252.283.091.665.091.507 0 .858-.158.354-.158.54-.44a1.17 1.17 0 0 0 .187-.656q0-.336-.135-.56a1 1 0 0 0-.375-.357 2 2 0 0 0-.566-.21l-.62-.144a1 1 0 0 1-.405-.176.37.37 0 0 1-.144-.299q0-.234.185-.384.188-.152.513-.152.213 0 .369.068a.6.6 0 0 1 .246.181.56.56 0 0 1 .12.258h.75a1.1 1.1 0 0 0-.2-.566 1.2 1.2 0 0 0-.5-.41 1.8 1.8 0 0 0-.78-.152q-.438 0-.776.15-.336.149-.527.421-.19.273-.19.639 0 .302.122.524.124.223.352.367.228.143.54.213l.617.144q.311.073.463.193a.39.39 0 0 1 .152.326.5.5 0 0 1-.084.29.56.56 0 0 1-.255.193 1.1 1.1 0 0 1-.413.07q-.177 0-.32-.04a.8.8 0 0 1-.249-.115.58.58 0 0 1-.255-.384zm-1.244 1.09v-3.337h1.136v-.662H0v.662h1.134v3.337zm7.076-3.999h.893l-1.274 2.007 1.254 1.992h-.909l-.85-1.415h-.034l-.853 1.415H6.37l1.239-2.016-1.228-1.983h.932l.832 1.438h.035z"/>
                </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"
                     class="toggle-mode view-code bi bi-filetype-js"
                     onclick={() => mode.value = "source"}>
                    <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H8v-1h4a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5zM3.186 15.29a1.2 1.2 0 0 1-.111-.449h.765a.58.58 0 0 0 .255.384q.105.073.249.114.143.041.319.041.246 0 .413-.07a.56.56 0 0 0 .255-.193.5.5 0 0 0 .085-.29.39.39 0 0 0-.153-.326q-.151-.12-.462-.193l-.619-.143a1.7 1.7 0 0 1-.539-.214 1 1 0 0 1-.351-.367 1.1 1.1 0 0 1-.123-.524q0-.366.19-.639.19-.272.528-.422.336-.15.776-.149.457 0 .78.152.324.153.5.41.18.255.2.566h-.75a.56.56 0 0 0-.12-.258.6.6 0 0 0-.247-.181.9.9 0 0 0-.369-.068q-.325 0-.513.152a.47.47 0 0 0-.184.384q0 .18.143.3a1 1 0 0 0 .405.175l.62.143q.327.075.566.211.24.136.375.358t.135.56q0 .37-.188.656a1.2 1.2 0 0 1-.539.439q-.351.158-.858.158-.381 0-.665-.09a1.4 1.4 0 0 1-.478-.252 1.1 1.1 0 0 1-.29-.375m-3.104-.033A1.3 1.3 0 0 1 0 14.791h.765a.6.6 0 0 0 .073.27.5.5 0 0 0 .454.246q.285 0 .422-.164.138-.165.138-.466v-2.745h.79v2.725q0 .66-.357 1.005-.354.345-.984.345a1.6 1.6 0 0 1-.569-.094 1.15 1.15 0 0 1-.407-.266 1.1 1.1 0 0 1-.243-.39"/>
                </svg>
            </div>
            <iframe class="preview" src="/sandbox.html" onload={({target}) => {
                return effect(() => {
                    target.contentWindow.postMessage({code: code.value});
                });
            }}/>
        </code-box>
    )
}
