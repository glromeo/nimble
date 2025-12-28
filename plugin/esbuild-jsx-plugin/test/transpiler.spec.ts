import transpiler from "../src/transpiler";
import {expect} from "chai";

const transpile = (source: TemplateStringsArray, ...args: any[]) => {
    let {code, map} = transpiler(source.join(""), {minified: false});
    if (args.includes("sourcemap")) {
        code += "\n//# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(JSON.stringify(map));
    }
    return code.split("\n").map(line => line.trim());
};
const trim = (code: TemplateStringsArray, ...args) => code.join("").split("\n").map(line => line.trim()).filter(line => line).join("\n");
const tm = (source: TemplateStringsArray) => transpile(source, ["sourcemap"]).filter(line => line).join("\n");
const tx = (source: TemplateStringsArray) => transpile(source).filter(line => line).join("\n");
const ts = (source: TemplateStringsArray) => transpile(source).filter(line => line && !line.match(/import/)).join("\n");

describe("transpiler tests", () => {
    it("fragment", () => {
        expect(tx`<></>`).to.eq(trim`
            import { jsx, Fragment } from "@nimble/toolkit/jsx-runtime.js";
            jsx(Fragment, {});
        `);
        expect(ts`<> </>`).to.eq(trim`
            jsx(Fragment, {
                children: " "
            });
        `);
        expect(ts`<>undefined</>`).to.eq(trim`
            jsx(Fragment, {
                children: "undefined"
            });
        `);
        expect(ts`<>null</>`).to.eq(trim`
            jsx(Fragment, {
                children: "null"
            });
        `);
        expect(ts`<>0</>`).to.eq(trim`
            jsx(Fragment, {
                children: "0"
            });
        `);
        expect(ts`<>1</>`).to.eq(trim`
            jsx(Fragment, {
                children: "1"
            });
        `);
        expect(ts`<>false</>`).to.eq(trim`
            jsx(Fragment, {
                children: "false"
            });
        `);
        expect(ts`<>true</>`).to.eq(trim`
            jsx(Fragment, {
                children: "true"
            });
        `);
        expect(ts`<>Hello</>`).to.eq(trim`
            jsx(Fragment, {
                children: "Hello"
            });
        `);
        expect(ts`<>Hello World</>`).to.eq(trim`
            jsx(Fragment, {
                children: "Hello World"
            });
        `);
        expect(ts`<>{}</>`).to.eq(trim`
            jsx(Fragment, {});
        `);
        expect(ts`<> {} </>`).to.eq(trim`
            jsx(Fragment, {
                children: [" ", " "]
            });
        `);
        expect(ts`<>\t</>`).to.eq(trim`
            jsx(Fragment, {
                children: " "
            });
        `);
        expect(ts`<> \n\t {"\t"} \n </>`).to.eq(trim`
            jsx(Fragment, {
                children: [" ", "\t", " "]
            });
        `);
        expect(ts`<> \na {"\t"} b\n </>`).to.eq(trim`
            jsx(Fragment, {
                children: [" a ", "\t", " b"]
            });
        `);
        expect(ts`<>Hello{}World</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
        `);
        expect(ts`<>{undefined}</>`).to.eq(trim`
            jsx(Fragment, {
                children: undefined
            });
        `);
        expect(ts`<>{null}</>`).to.eq(trim`
            jsx(Fragment, {
                children: null
            });
        `);
        expect(ts`<>{0}</>`).to.eq(trim`
            jsx(Fragment, {
                children: 0
            });
        `);
        expect(ts`<>{1}</>`).to.eq(trim`
            jsx(Fragment, {
                children: 1
            });
        `);
        expect(ts`<>{false}</>`).to.eq(trim`
            jsx(Fragment, {
                children: false
            });
        `);
        expect(ts`<>{true}</>`).to.eq(trim`
            jsx(Fragment, {
                children: true
            });
        `);
        expect(ts`<>{"Hello"}</>`).to.eq(trim`
            jsx(Fragment, {
                children: "Hello"
            });
        `);
        expect(ts`<>{"Hello"}{"World"}</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
        `);
        expect(ts`<>{["Hello","World"]}</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
        `);
    });

    it("fragments & signals", () => {
        expect(ts`<p>{}</p>`).to.eq(trim`jsx("p", {});`);
        expect(ts`<p>{fn}</p>`).to.eq(trim`jsx("p", {
            children: fn
        });`);
        expect(ts`<><p/></>`).to.eq(trim`
            jsx(Fragment, {
                children: jsx("p", {})
            });`);
        expect(ts`<><p>NO</p></>`).to.eq(trim`
            jsx(Fragment, {
                children: jsx("p", {
                   children: "NO"
                })
            });`);
        expect(ts`<><p>NO{fn}</p></>`).to.eq(trim`
            jsx(Fragment, {
                children: jsx("p", {
                  children: ["NO", fn]
                })
            });`);
        expect(ts`<p>{fn()}</p>`).to.eq(trim`jsx("p", {
            children: () => fn()
        });`);
        expect(ts`<>{fn()}{fn()}</>`).to.eq(trim`
            jsx(Fragment, {
              children: [() => fn(), () => fn()]
            });`);
        expect(ts`<p>{...fn()}</p>`).to.eq(trim`jsx("p", { 
            children: () => [...fn()] 
        });`);
        expect(ts`<p>{0}{...fn()}{gn()}</p>`).to.eq(trim`jsx("p", { 
            children: () => [0, ...fn(), gn()]
        });`);
        // actual jsx expressions are not reactive because they are created after the visit
        expect(ts`<><p>{jsx()}</p></>`).to.eq(trim`
            jsx(Fragment, {
                children: jsx("p", {
                  children: () => jsx()
                })
            });`);
        expect(ts`<>{$s}</>`).to.eq(trim`
            jsx(Fragment, {
                children: $s
            });`);
        expect(ts`<>{$s.value}</>`).to.eq(trim`
            jsx(Fragment, {
                children: () => $s.value
            });`);
        expect(ts`<>{$s.value}{$s.value}</>`).to.eq(trim`
            jsx(Fragment, {
                children: [() => $s.value, () => $s.value]
            });`);
        expect(ts`<>{"Hello"}{"World"}</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });`);
        expect(ts`<>{["Hello","World"]}</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });`);
        expect(ts`<>{...["Hello","World"]}</>`).to.eq(trim`
            jsx(Fragment, {
                children: [...["Hello", "World"]]
            });`);
    });

    it("FC", () => {
        expect(tx`
            let FC = () => {}, div = <div/>;
            <FC></FC>;
            <CF></CF>;
            <div></div>;
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            let FC = () => {},
                div = jsx("div", {});
            jsx(FC, {});
            jsx(CF, {});
            jsx("div", {});
        `);
        expect(tx`
            let FC = () => {};
            <FC></FC>;
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            let FC = () => {};
            jsx(FC, {});
        `);
        expect(tx`
            import { Fragment } from "@nimble/toolkit/jsx-runtime.js";
            function FO() {
                let FC = () => {};
                <FC>
                    <Fragment><div></div></Fragment>
                </FC>;
            }
        `).to.eq(trim`
            import { jsx, Fragment } from "@nimble/toolkit/jsx-runtime.js";
            function FO() {
                let FC = () => {};
                jsx(FC, {
                    children: jsx(Fragment, {
                        children: jsx("div", {})
                    })
                });
            }
        `);

        expect(ts`<FC class={"cx"} {...unknown}></FC>`).to.eq(trim`
            jsx(FC, {
                class: "cx",
                ...unknown
            });
        `);
        expect(ts`<FC>{['a', ...unknown.value]}</FC>`).to.eq(trim`
            jsx(FC, {
                get children() {
                    return ['a', ...unknown.value];
                }
            });
        `);
        expect(ts`<FC>{['a', ...unknown]}</FC>`).to.eq(trim`
            jsx(FC, {
                children: ['a', ...unknown]
            });
        `);
        expect(tx`
            let FC = () => {};
            let value, fn, obj;
            <FC class="one" style="color: red;" 
                 data-field={value} 
                 arrow_expr={()=>{}} 
                 kall:fn={fn()}
                 property_access={obj.value}
                 indexed_access={obj[0]}
                 methodCall={obj.get()}
                 nested={<div not={fn} yes={fn.call()}>{obj}{obj.value}</div>}
             >A B C {...new Set([1, 2, 3])} {fn()} {jsx()}</FC>
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            let FC = () => {};
            let value, fn, obj;
            jsx(FC, {
                class: "one", 
                style: "color: red;", 
                "data-field": value,
                arrow_expr: () => {},
                get ["kall:fn"]() {
                    return fn();
                },
                get property_access() {
                    return obj.value;
                },
                get indexed_access() {
                    return obj[0];
                },
                get methodCall() {
                    return obj.get();
                },
                get nested() {
                    return jsx("div", {
                        not: fn,
                        yes: () => fn.call(),
                        children: [obj, () => obj.value]
                    });
                },
                get children() {
                    return ["A B C ", ...new Set([1, 2, 3]), " ", fn(), " ", jsx()];
                }
            });
        `);
    });

    it("elements", () => {
        expect(ts`<div>Hello Sailor!</div>`).to.eq(trim`
            jsx("div", {
                children: "Hello Sailor!"
            });
        `);
        expect(ts`<div>Hello {"Great"} Sailor!</div>`).to.eq(trim`
            jsx("div", {
                children: ["Hello ", "Great", " Sailor!"]
            });
        `);
        expect(ts`<div>\n\t  Hello {"Great"} Sailor!\n  </div>`).to.eq(trim`
            jsx("div", {
                children: ["Hello ", "Great", " Sailor!"]
            });
        `);
        expect(ts`<div el={<p>{fn()}</p>}/>`).to.eq(trim`
            jsx("div", {
                el: () => jsx("p", {
                    children: () => fn()
                })
            });
        `);
        expect(tx`
            <img src="url://" data-test-id={0} />
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            jsx("img", {
                src: "url://",
                "data-test-id": 0
            });
        `);
        expect(tx`<p 
            onClick={handler} 
            onclick={() => handler()} 
            onclick={handler()}/>
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            jsx("p", {
                onClick: handler,
                onclick: () => handler(),
                onclick: handler()
            });
        `);
        expect(tx`<svg:g></svg:g>`).to.eq(trim`
            import { svg } from "@nimble/toolkit/jsx-runtime.js";
            svg("g", {});
        `);
        expect(tx`<xhtml:a></xhtml:a>`).to.eq(trim`
            import { xhtml } from "@nimble/toolkit/jsx-runtime.js";
            xhtml("a", {});
        `);
        expect(tx`
            let h = () => {};
            <h:a></h:a>
        `).to.eq(trim`
            let h = () => {};
            h("a", {});
        `);
        expect(tx`
            const Namespace = {
                Component: () => {}
            };
            <Namespace.Component></Namespace.Component>
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            const Namespace = {
                Component: () => {}
            };
            jsx(Namespace.Component, {});
        `);
        expect(tx`<div class={"cx"} {...{class: "cy", style: "color: red"}}></div>`).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            jsx("div", {
                class: "cx",
                ...{
                    class: "cy",
                    style: "color: red"
                }
            });
        `);
        expect(ts`<div class={"cx"} {...unknown}></div>`).to.eq(trim`
            jsx("div", {
                class: "cx",
                ...unknown
            });
        `);
        expect(ts`<div>{['a', ...unknown.value]}</div>`).to.eq(trim`
            jsx("div", {
                children: () => ['a', ...unknown.value]
            });
        `);
        expect(ts`<div>{['a', ...unknown]}</div>`).to.eq(trim`
            jsx("div", {
                children: ['a', ...unknown]
            });
        `);
        expect(ts`<div el={<p></p>}/>`).to.eq(trim`
            jsx("div", {
                el: () => jsx("p", {})
            });
        `);
        expect(tx`
            let value, fn, obj;
            <div class="one" style="color: red;" 
                 data-field={value} 
                 arrow_expr={()=>{}} 
                 kall:fn={fn()}
                 property_access={obj.value}
                 indexed_access={obj[0]}
                 methodCall={obj.get()}
                 nested={<div not={fn} yes={fn()}>{obj}{obj.value}</div>}
             >A B C {...new Set([1, 2, 3])}</div>
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            let value, fn, obj;
            jsx("div", {
                class: "one", 
                style: "color: red;", 
                "data-field": value,
                arrow_expr: () => {},
                "kall:fn": () => fn(),
                property_access: () => obj.value,
                indexed_access: () => obj[0],
                methodCall: () => obj.get(),
                nested: () => jsx("div", {
                    not: fn,
                    yes: () => fn(),
                    children: [obj, () => obj.value]
                }),
                children: ["A B C ", ...new Set([1, 2, 3])]
            });
        `);
        expect(ts`
            let axis = {value: "north south"};
            <div is:resizable={axis.value}></div>
        `).to.eq(trim`
            let axis = {
                value: "north south"
            };
            jsx("div", {
                get ["is:resizable"]() {
                    return axis.value;
                }
            });
        `);
    });

    it("reactive props", () => {
        expect(ts`
            <div class="editor" style={\`display:\${mode.value === "source" ? "block" : "none"}\`} />
        `).to.eq(trim`
            jsx("div", {
                class: "editor",
                style: () => \`display:\${mode.value === "source" ? "block" : "none"}\`
            });
        `);
    })

    it("elements with xmlns", () => {
        expect(ts`
            <svg width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88
                 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465
                  1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/>
            </svg>
        `).to.eq(trim`
            svg("svg", {
                width: "16",
                height: "16",
                fill: "currentColor",
                class: "bi bi-eye",
                viewBox: "0 0 16 16",
                children: svg("path", {
                    d: "M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88
                    3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465
                    1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"
                })
            });
        `);
        expect(ts`
            <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
              <foreignObject x="10" y="10" width="280" height="180">
                <div xmlns="http://www.w3.org/1999/xhtml" 
                     style="width: 100%; height: 100%">
                  <strong>Hello from inside a div!</strong><br/>
                  This is HTML content rendered inside an SVG.
                </div>
              </foreignObject>
            </svg>
        `).to.eq(trim`
            svg("svg", {
                width: "300",
                height: "200",
                children: svg("foreignObject", {
                    x: "10",
                    y: "10",
                    width: "280",
                    height: "180",
                    children: xhtml("div", {
                        style: "width: 100%; height: 100%",
                        children: [xhtml("strong", {
                            children: "Hello from inside a div!"
                        }), xhtml("br", {}), "This is HTML content rendered inside an SVG."]
                    })
                })
            });
        `);
    });

    it("expressions", () => {
        expect(ts`
            function FC(props: { letter: string, counter: number }) {
                return <div>{props.letter + ":" + props.counter}</div>;
            }
        `).to.eq(trim`
            function FC(props: {
                letter: string;
                counter: number;
            }) {
                return jsx("div", {
                    children: () => props.letter + ":" + props.counter
                });
            }
        `);
        expect(ts`
            function FC(props) {
                return <div k={y = props.z} w={y[0] = 0}>{x = <Fragment></Fragment>}</div>
            }
        `).to.eq(trim`
            function FC(props) {
                return jsx("div", {
                    k: () => y = props.z,
                    w: () => y[0] = 0,
                    children: () => x = jsx(Fragment, {})
                });
            }
        `);
        expect(ts`
            <div>{new Computed(() => props.message).value}</div>
        `).to.eq(trim`
            jsx("div", {
                children: () => new Computed(() => props.message).value
            });
        `);
        expect(ts`
            <div>{computed(() => props.message).value}</div>
        `).to.eq(trim`
            jsx("div", {
                children: () => computed(() => props.message).value
            });
        `);
        expect(ts`
            <div>{function X() { return props.message }}</div>
        `).to.eq(trim`
            jsx("div", {
                children: function X() { 
                    return props.message; 
                }
            });
        `);
        expect(ts`
            <div>{(function X() { return props.message })()}</div>
        `).to.eq(trim`
            jsx("div", {
                children: () => function X() {
                    return props.message;
                }()
            });
        `);
    });
});
