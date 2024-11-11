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
            import { Fragment, jsx } from "@nimble/toolkit/jsx-runtime.js";
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
                children: "\\t"
            });
        `);
        expect(ts`<> \n \t {"\t"} \n \t </>`).to.eq(trim`
            jsx(Fragment, {
                children: [" ", "\t", " "]
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
        expect(ts`<>{["Hello","World"]}</>`).to.eq(trim`
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
        `);
    });

    it("fragments & signals", () => {
        expect(tx`
            let DEFINITELY = () => {}, MAYBE = {value: "unknown"};
            <><p/></>;
            <><p>NO</p></>;
            <><p>NO{DEFINITELY}</p></>;
            <><p>{DEFINITELY()}</p></>;
            <>{MAYBE}</>;
            <>{MAYBE.value}</>;
            <>{"Hello"}{"World"}</>;
            <>{["Hello","World"]}</>;
            <>{...["Hello","World"]}</>;
        `).to.eq(trim`import { Fragment, jsx } from "@nimble/toolkit/jsx-runtime.js";
            let DEFINITELY = () => {},
                MAYBE = {
                    value: "unknown"
                };
            jsx(Fragment, {
                children: jsx("p", {})
            });
            jsx(Fragment, {
                children: jsx("p", {
                    children: "NO"
                })
            });
            jsx(Fragment, {
                children: jsx("p", {
                    children: ["NO", DEFINITELY]
                })
            });
            jsx(Fragment, {
                children: jsx("p", {
                    children: () => DEFINITELY()
                })
            });
            jsx(Fragment, {
                children: MAYBE
            });
            jsx(Fragment, {
                children: () => MAYBE.value
            });
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
            jsx(Fragment, {
                children: ["Hello", "World"]
            });
            jsx(Fragment, {
                children: [...["Hello", "World"]]
            });
        `);
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
                 reactive:fn={fn()}
                 property_access={obj.value}
                 indexed_access={obj[0]}
                 methodCall={obj.get()}
                 nested={<div not={fn} yes={fn()}>{obj}{obj.value}</div>}
             >A B C {...new Set([1, 2, 3])}</FC>
        `).to.eq(trim`
            import { jsx } from "@nimble/toolkit/jsx-runtime.js";
            let FC = () => {};
            let value, fn, obj;
            jsx(FC, {
                class: "one", 
                style: "color: red;", 
                "data-field": value,
                arrow_expr: () => {},
                get ["reactive:fn"]() {
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
                nested: jsx("div", { 
                    not: fn,
                    yes: () => fn(),
                    children: () => [obj, obj.value]
                }),
                children: ["A B C ", ...new Set([1, 2, 3])]
            });
        `);
    });

    it("element", () => {
        expect(ts`<div el={<p>{fn()}</p>}/>`).to.eq(trim`
            jsx("div", {
                el: jsx("p", {
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
                el: jsx("p", {})
            });
        `);
        expect(tx`
            let value, fn, obj;
            <div class="one" style="color: red;" 
                 data-field={value} 
                 arrow_expr={()=>{}} 
                 reactive:fn={fn()}
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
                "reactive:fn": () => fn(),
                property_access: () => obj.value,
                indexed_access: () => obj[0],
                methodCall: () => obj.get(),
                nested: jsx("div", {
                    not: fn,
                    yes: () => fn(),
                    children: () => [obj, obj.value]
                }),
                children: ["A B C ", ...new Set([1, 2, 3])]
            });
        `);
        expect(ts`
            let axis = () => "north south";
            <div is:resizable={axis()}></div>
        `).to.eq(trim`
            let axis = () => "north south";
            jsx("div", {
                get ["is:resizable"]() {
                    return axis();
                }
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
                    children: x = jsx(Fragment, {})
                });
            }
        `);
        expect(ts`
            <div>{new Computed(() => props.message)}</div>
        `).to.eq(trim`
            jsx("div", {
                children: new Computed(() => props.message)
            });
        `);
        expect(ts`
            <div>{computed(() => props.message)}</div>
        `).to.eq(trim`
                jsx("div", {
                    children: computed(() => props.message)
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
    })
});
