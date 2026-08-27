import {expect} from "chai";
import type Sinon from "sinon";
import sinon from "sinon";
import {Fragment, errorBoundary, NodeGroup, SVG_NAMESPACE_URI, XHTML_NAMESPACE_URI} from "./jsx.mjs";
import {createDirective, directives} from "./directives.mjs";
import {computed, currentContext, effect as createEffect, signal} from "../signals/signals.mjs";
import {vsync} from "@nimble/testing";

declare module "@nimble/toolkit" {
    namespace JSX {
        interface Directives {
            ready: boolean;
        }
    }
}

suite("Nimble JSX", () => {

    /**
     * An effect outlives the test that created it, and a live effect keeps reacting to signals
     * written by later tests. Everything created here is disposed on teardown; a test that wants
     * to observe disposal can still call the dispose it gets back.
     */
    const running = [] as Array<() => void>;

    function effect(callback: () => unknown) {
        const dispose = createEffect(callback);
        running.push(dispose);
        return dispose;
    }

    teardown(() => {
        while (running.length) running.pop()!();
    });

    suite("Static Rendering", () => {

        suite("Elements", () => {
            test("creates basic DOM elements", () => {
                expect(<h1>Hello World</h1>)
                    .to.be.instanceOf(HTMLHeadingElement)
                    .and.have.tagName("h1")
                    .and.have.html("Hello World");
            });

            test("creates elements with attributes", () => {
                const p = <p class="sample">paragraph</p>;
                expect(p)
                    .to.be.instanceOf(HTMLParagraphElement)
                    .and.have.attr("class", "sample");
            });

            test("creates elements with text children", () => {
                const p = <p>paragraph</p>;
                expect(p.childNodes.length).to.equal(1);
                expect(p.firstChild)
                    .to.be.instanceOf(Text)
                    .and.have.property("data", "paragraph");
            });

            test("handles class as object", () => {
                expect(<div class={{alpha: true, beta: false}}>Hello</div>)
                    .to.equal(`<div class="alpha">Hello</div>`);
            });

            test("handles class as array", () => {
                expect(<div class={["alpha", "beta", "gamma"]}>Hello</div>)
                    .to.equal(`<div class="alpha beta gamma">Hello</div>`);
            });

            test("attaches event handlers", () => {
                let node;
                const onClickSpy = sinon.spy(e => {
                    expect(e.target).to.equal(node);
                });
                node = <div on:click={onClickSpy}></div>;
                node.click();
                expect(onClickSpy.callCount).to.equal(1);
            });
        });

        suite("Fragments", () => {
            test("creates empty fragment", () => {
                const fragment = <></>;
                expect(fragment)
                    .to.be.instanceOf(DocumentFragment)
                    .and.instanceOf(NodeGroup);
                expect(fragment.childNodes).to.have.length(2); // Start/end comments
                expect(fragment).to.equal("<!--<>--><!--</>-->");
            });

            test("<> and <Fragment> are equivalent", () => {
                expect(<></>).eq("<!--<>--><!--</>-->");
                expect(<Fragment></Fragment>).eq("<!--<>--><!--</>-->");
                expect((<></>).constructor).eq((<Fragment></Fragment>).constructor);
            });

            test("uses sentinel comments for boundaries", () => {
                expect(<div><>Hello</>
                </div>).eq("<div><!--<>-->Hello<!--</>--></div>");
                expect(<p><></>
                </p>).to.equal("<p><!--<>--><!--</>--></p>");
                expect(<><p></p></>).to.equal("<!--<>--><p></p><!--</>-->");
            });

            test("accepts mixed children", () => {
                expect(<><p>hello</p>to {"you"}{<br/>}friend</>)
                    .eq("<!--<>--><p>hello</p>to you<br></br>friend<!--</>-->");
            });

            test("can be moved between elements", () => {
                let f = <><p></p></> as DocumentFragment;
                let p1 = <div>{f}</div> as HTMLDivElement;
                expect(p1).eq("<div><!--<>--><p></p><!--</>--></div>");
                let p2 = <div>{f}</div> as HTMLDivElement;
                expect(p2).eq("<div><!--<>--><p></p><!--</>--></div>");
                expect(p1).eq("<div></div>");
            });

            test("handles nested fragments", () => {
                expect(<>
                    <p><></>
                    </p>
                </>).to.equal("<!--<>--><p><!--<>--><!--</>--></p><!--</>-->");
                expect(<>b<>l<p>m</p>r</>
                    a</>).to.equal("<!--<>-->b<!--<>-->l<p>m</p>r<!--</>-->a<!--</>-->");
            });
        });

        suite("Function Components", () => {
            test("renders unkeyed function component", () => {
                function FC(props: { counter: number }) {
                    return <p>{props.counter}</p>;
                }

                expect(<FC counter={42}/>).eq(`<p>42</p>`);
            });

            test("composes function components", () => {
                function FC(props: { counter: number }) {
                    return <p>{props.counter}</p>;
                }

                function PC(props: { counter: number }) {
                    return <div><FC counter={props.counter * 2}/>:<FC counter={props.counter / 2}/></div>;
                }

                expect(<PC counter={10}/>).eq(`<div><p>20</p>:<p>5</p></div>`);
            });

            test("passes children to components", () => {
                function FC(props: { message: string, children: any }) {
                    return <div>{props.message} {props.children}</div>;
                }

                expect(<FC message="Hello">World</FC>).eq(`<div>Hello World</div>`);
            });

            test("handles components returning null", () => {
                const NULL = () => null;
                expect(<NULL/>).to.eq(null);
                expect(<NULL key={undefined}/>).to.eq(null);
            });
        });

        suite("Value Rendering", () => {
            test("renders strings", () => {
                expect(<>{"Hello World"}</>).to.equal("<!--<>-->Hello World<!--</>-->");
                expect(<>{""}</>).to.equal("<!--<>--><!--</>-->");
            });

            test("renders numbers", () => {
                expect(<>{0}</>).to.equal("<!--<>-->0<!--</>-->");
                expect(<>{1}</>).to.equal("<!--<>-->1<!--</>-->");
                expect(<>{1_000_000_000.000_000_9}</>).to.equal("<!--<>-->1000000000.000001<!--</>-->");
            });

            test("renders BigInts", () => {
                expect(<>{BigInt(1234567890)}</>).to.equal("<!--<>-->1234567890<!--</>-->");
            });

            test("renders null and undefined as empty", () => {
                expect(<>{null}</>).to.equal("<!--<>--><!--</>-->");
                expect(<>{undefined}</>).to.equal("<!--<>--><!--</>-->");
            });

            test("renders booleans as comments", () => {
                expect(<>{true}</>).to.equal("<!--<>--><!--true--><!--</>-->");
                expect(<>{false}</>).to.equal("<!--<>--><!--false--><!--</>-->");
            });

            test("renders symbols as comments", () => {
                expect(<>{Symbol()}</>).to.equal("<!--<>--><!--Symbol()--><!--</>-->");
            });

            test("renders objects as comments", () => {
                expect(<>{{}}</>).to.equal("<!--<>--><!--[object Object]--><!--</>-->");
            });

            test("passes through DOM nodes", () => {
                const text = document.createTextNode("text");
                const node = <>{text}</>;
                expect(node.firstChild).to.equal(text);
                expect(node.childNodes.length).to.equal(3);
                expect(node).to.equal(`<!--<>-->text<!--</>-->`);
            });

            test("renders element descriptors", () => {
                expect(<>{{
                    tag: "div",
                    attrs: {name: "alpha"},
                    children: "Hello"
                }}</>).to.equal(`<!--<>--><div name="alpha">Hello</div><!--</>-->`);
            });

            test("renders empty arrays as empty", () => {
                expect(<>{[]}</>).to.equal("<!--<>--><!--</>-->");
            });
        });

        suite("Directives", () => {

            teardown(() => {
                delete (directives as Record<string, unknown>).ready;
            });

            test("executes directive on element creation", () => {
                let directive: Sinon.SinonSpy;

                createDirective("ready", directive = sinon.spy((el, props) => {
                    expect(props.class).to.eq("classy");
                }));

                let node = <div class="classy" is:ready={true}>Hello</div>;

                sinon.assert.calledOnce(directive);
                sinon.assert.calledWith(directive, node);
                expect(node).eq(`<div class="classy" is:ready="">Hello</div>`);
            });
        });
    });

    suite("Reactive Rendering", () => {

        suite("Signal Integration", () => {
            test("renders signal values", async () => {
                const message = signal("Hello");
                const node = <div>{message.value}</div>;
                expect(node).to.equal("<div>Hello</div>");

                message.set("Goodbye");
                await vsync();
                expect(node).to.equal("<div>Goodbye</div>");
            });

            test("updates on signal changes (different types)", async () => {
                const a = signal("Hello World");
                const node = <div>{a.value}</div>;

                expect(node).to.equal("<div>Hello World</div>");

                a.set(BigInt(1234567890));
                expect(node).to.equal("<div>1234567890</div>");

                a.set(0);
                await vsync();
                expect(node).to.equal("<div>0</div>");

                a.set(true);
                await vsync();
                expect(node).to.equal("<div><!--true--></div>");

                a.set(Symbol("xyz"));
                await vsync();
                expect(node).to.equal("<div><!--Symbol(xyz)--></div>");
            });

            test("renders computed signal values", async () => {
                const a = signal(5);
                const doubled = computed(() => a.value * 2);
                const node = <div>{doubled.value}</div>;

                expect(node).to.equal("<div>10</div>");

                a.set(10);
                await vsync();
                expect(node).to.equal("<div>20</div>");
            });

            test("switches computed dependencies dynamically", async () => {
                const left = signal("left");
                const right = signal("right");
                const selector = signal("l");
                const result = computed(() => selector.value === "l" ? left.value : right.value);
                const node = <div>{result.value}</div>;

                expect(node).to.equal("<div>left</div>");
                expect(selector.targets.target).to.eq(result);  // Changed
                expect(left.targets.target).to.eq(result);      // Changed
                expect(right.targets).to.be.undefined;

                selector.set("r");
                await vsync();
                expect(node).to.equal("<div>right</div>");
                expect(left.targets).to.be.undefined;
                expect(right.targets.target).to.eq(result);     // Changed

                right.set("right 2");
                await vsync();
                expect(node).to.equal("<div>right 2</div>");

                selector.set("l");
                await vsync();
                expect(node).to.equal("<div>left</div>");
                expect(left.targets.target).to.eq(result);      // Changed
                expect(right.targets).to.be.undefined;
            });
        });

        suite("Function Children", () => {
            test("evaluates function children reactively", async () => {
                const value = signal(42);
                const node = <div>{() => value.value}</div>;

                expect(node).to.equal("<div>42</div>");

                value.set(100);
                await vsync();
                expect(node).to.equal("<div>100</div>");
            });

            test("re-evaluates functions returning different types", async () => {
                const a = signal(() => "Hello World");
                const node = <div>{a.value}</div>;

                expect(node).to.equal("<div>Hello World</div>");

                a.set(function Hello() {
                    return "Hello World";
                });
                await vsync();
                expect(node).to.equal("<div>Hello World</div>");
            });
        });

        suite("Array Children Updates", () => {
            test("updates array children", async () => {
                const items = signal(["one", 2, true]);
                const node = <div>{items.value}</div>;

                expect(node).eq("<div>one2<!--true--></div>");

                items.value = ["a", "b", "c", "d", "e", "f"];
                await vsync();
                expect(node).eq("<div>abcdef</div>");
            });

            test("reconciles array children efficiently", async () => {
                const items = signal(["a", "b", "c", "d", "e", "f"]);
                const node = <div>{items.value}</div>;
                await vsync(); // Wait for initial render
                const originalNodes = [...node.childNodes];

                items.value = ["b", "c", "d", "e"];
                await vsync();

                expect(node).eq("<div>bcde</div>");
                // Verify nodes were reused, not recreated
                expect(originalNodes[1]).to.eq(node.childNodes[0]);
                expect(originalNodes[2]).to.eq(node.childNodes[1]);
                expect(originalNodes[3]).to.eq(node.childNodes[2]);
                expect(originalNodes[4]).to.eq(node.childNodes[3]);
            });

            test("handles complex array reconciliation", async () => {
                const items = signal(["a", "b", "c", "d", "e", "f"]);
                const node = <div>{() => items.value}</div>; // Wrap in function for reactivity
                await vsync();
                const cn = [...node.childNodes];

                items.value = ["d", "e", "f", "g", "h", "b", "c"];
                await vsync();

                expect(node).eq("<div>defghbc</div>");
                // With udomdiff reconciliation, nodes are moved efficiently
                // Check that some nodes were reused (not recreated)
                const newNodes = [...node.childNodes];
                expect(newNodes.some(n => cn.includes(n))).to.be.true;
            });
        });

        suite("Cleared Children Updates", () => {
            test("clears fragment children when the new list is empty", async () => {
                const items = signal(["a", "b"]);
                const node = <div><>{() => items.value}</></div>;

                expect(node).eq("<div><!--<>-->ab<!--</>--></div>");

                items.value = [];
                await vsync();
                expect(node).eq("<div><!--<>--><!--</>--></div>");

                // the sentinels survived, so the group still renders
                items.value = ["c"];
                await vsync();
                expect(node).eq("<div><!--<>-->c<!--</>--></div>");
            });

            test("replaces fragment array children with a single value", async () => {
                const items = signal(["a", "b"] as any);
                const node = <div><>{() => items.value}</></div>;

                items.value = "text";
                await vsync();
                expect(node).eq("<div><!--<>-->text<!--</>--></div>");
            });

            test("clears only its own range, not its siblings", async () => {
                const items = signal(["a", "b"]);
                const node = <div>before<>{() => items.value}</>after</div>;

                expect(node).eq("<div>before<!--<>-->ab<!--</>-->after</div>");

                items.value = [];
                await vsync();
                expect(node).eq("<div>before<!--<>--><!--</>-->after</div>");
            });

            test("clears nested fragment children", async () => {
                const items = signal([<>x</>, "y"] as any);
                const node = <div><>{() => items.value}</></div>;

                expect(node).eq("<div><!--<>--><!--<>-->x<!--</>-->y<!--</>--></div>");

                items.value = [];
                await vsync();
                expect(node).eq("<div><!--<>--><!--</>--></div>");
            });

            test("clears a detached fragment without losing its sentinels", async () => {
                const items = signal(["a", "b"]);
                const node = <>{() => items.value}</>;

                expect(node).eq("<!--<>-->ab<!--</>-->");

                items.value = [];
                await vsync();
                expect(node).eq("<!--<>--><!--</>-->");
            });

            test("clears element children when the new list is empty", async () => {
                const items = signal(["a", "b"]);
                const node = <div>{() => items.value}</div>;

                expect(node).eq("<div>ab</div>");

                items.value = [];
                await vsync();
                expect(node).eq("<div></div>");
            });
        });

        suite("Component Props Updates", () => {
            test("updates keyed component props via signal rewiring", async () => {
                function FC(props: { letter: string, counter: number }) {
                    return <div>{props.letter + ":" + props.counter}</div>;
                }

                const counter = signal(0);
                let node;

                effect(() => {
                    node = <FC key="0" letter={"A"} counter={counter.value}/>;
                });

                expect(node).eq(`<div>A:0</div>`);

                counter.value++;
                await vsync();
                expect(node).eq(`<div>A:1</div>`);
            });

            test("rewires from static to signal props", async () => {
                function FC(props: { letter: string, counter: number }) {
                    return <div>{props.letter + ":" + props.counter}</div>;
                }

                const negative = signal(-1);
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <FC key="0" letter={"A"} counter={0}/>;
                            break;
                        case 1:
                            node = <FC key="0" letter={"A"} counter={negative.value}/>;
                            break;
                    }
                });

                expect(node).eq(`<div>A:0</div>`);

                stage.value++;
                await vsync();
                expect(node).eq(`<div>A:-1</div>`);
            });

            test("rewires from signal to computed props", async () => {
                function FC(props: { letter: string, counter: number }) {
                    return <div>{props.letter + ":" + props.counter}</div>;
                }

                const value = signal(1);
                const computed_value = computed(() => value.value * 2);
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <FC key="0" letter={"A"} counter={value.value}/>;
                            break;
                        case 1:
                            node = <FC key="0" letter={"A"} counter={computed_value.value}/>;
                            break;
                    }
                });

                expect(node).eq(`<div>A:1</div>`);

                stage.value++;
                await vsync();
                expect(node).eq(`<div>A:2</div>`);

                value.value = 5;
                await vsync();
                expect(node).eq(`<div>A:10</div>`);
            });

            test("updates props from different signal sources", async () => {
                function FC(props: { letter: string, counter: number }) {
                    return <div>{props.letter + ":" + props.counter}</div>;
                }

                const letter = signal("C");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <FC key="0" letter={"A"} counter={0}/>;
                            break;
                        case 1:
                            node = <FC key="0" letter={letter.value} counter={3}/>;
                            break;
                    }
                });

                expect(node).eq(`<div>A:0</div>`);

                stage.value++;
                await vsync();
                expect(node).eq(`<div>C:3</div>`);

                letter.value = "D";
                await vsync();
                expect(node).eq(`<div>D:3</div>`);
            });
        });

        suite("Element Props Updates", () => {
            test("rewires an element prop from a signal to a static value", async () => {
                const dynamic = signal("A");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <div key="0" title={dynamic.value}/>;
                            break;
                        case 1:
                            node = <div key="0" title="static"/>;
                            break;
                    }
                });

                expect(node).eq('<div title="A"></div>');

                stage.value++;
                await vsync();
                expect(node).eq('<div title="static"></div>');
            });

            test("removes an element prop that disappears", async () => {
                const dynamic = signal("A");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <div key="0" title={dynamic.value}/>;
                            break;
                        case 1:
                            node = <div key="0"/>;
                            break;
                    }
                });

                expect(node).eq('<div title="A"></div>');

                stage.value++;
                await vsync();
                expect(node).eq('<div></div>');
            });

            test("rewires an element prop from one signal to another", async () => {
                const first = signal("A"), second = signal("B");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <div key="0" title={first.value}/>;
                            break;
                        case 1:
                            node = <div key="0" title={second.value}/>;
                            break;
                    }
                });

                expect(node).eq('<div title="A"></div>');

                stage.value++;
                await vsync();
                expect(node).eq('<div title="B"></div>');

                second.value = "B2";
                await vsync();
                expect(node).eq('<div title="B2"></div>');

                first.value = "A2"; // the abandoned source no longer drives the element
                await vsync();
                expect(node).eq('<div title="B2"></div>');
            });

            test("keeps an element prop reactive across parent re-renders", async () => {
                const dynamic = signal("X");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <div key="0" title="static"/>;
                            break;
                        default:
                            node = <div key="0" title={dynamic.value}/>;
                            break;
                    }
                });

                stage.value = 1; // the observer is created during update, not construction
                await vsync();
                expect(node).eq('<div title="X"></div>');

                stage.value = 2; // it has to survive the parent effect re-running
                await vsync();

                dynamic.value = "Z";
                await vsync();
                expect(node).eq('<div title="Z"></div>');
            });

            test("replaces static children when they become dynamic", async () => {
                const dynamic = signal("B");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <div key="0">A</div>;
                            break;
                        case 1:
                            node = <div key="0">{dynamic.value}</div>;
                            break;
                    }
                });

                expect(node).eq("<div>A</div>");

                stage.value++;
                await vsync();
                expect(node).eq("<div>B</div>");
            });
        });
    });

    suite("Keyed Rendering", () => {

        suite("Basic Keyed Components", () => {
            test("creates keyed fragment", async () => {
                let outer, inner, p, f;
                const dismiss = effect(() => {
                    outer = currentContext();
                    p = <p key="P">{(() => {
                        inner = currentContext();
                        return f = <Fragment key="F"></Fragment>;
                    })()}</p>;
                });

                expect(p).eq("<p><!--<>--><!--</>--></p>");
                await vsync();

                expect(outer.scope.live).to.be.instanceOf(Object);
                expect(Object.keys(outer.scope.live).length).to.eq(1);
                expect(outer.scope.live["P"].node).eq(p);
                expect(inner.scope.live["F"].node).to.eq(f);

                inner.scope.live["F"].update({children: "Hello"});
                await vsync();
                expect(p).eq("<p><!--<>-->Hello<!--</>--></p>");

                dismiss();
            });

            test("persists keyed components across parent re-renders", async () => {
                function FC(props: { value: number }) {
                    return <div>{props.value}</div>;
                }

                const trigger = signal(0);
                let node, scope;

                const dispose = effect(() => {
                    trigger.value; // Subscribe to trigger
                    node = <FC key="stable" value={42}/>;
                    scope = currentContext().scope;
                });

                await vsync();

                const firstNode = node;
                const firstState = scope?.get("stable");

                trigger.set(1); // Re-run parent
                await vsync();

                // Keyed component should persist
                expect(node).to.equal(firstNode);
                expect(scope.get("stable")).to.equal(firstState);

                dispose();
            });

            test("rewires fragment children from dynamic to static", async () => {
                const dynamic = signal("A");
                let stage = signal(0), node;

                effect(() => {
                    switch (stage.value) {
                        case 0:
                            node = <Fragment key="F">{dynamic.value}</Fragment>;
                            break;
                        case 1:
                            node = <Fragment key="F">static</Fragment>;
                            break;
                    }
                });

                expect(node).eq("<!--<>-->A<!--</>-->");

                stage.value++;
                await vsync();
                expect(node).eq("<!--<>-->static<!--</>-->");
            });
        });

        suite("Keyed Lists", () => {
            test("reorders a keyed list of fragments", async () => {
                const items = signal([1, 2, 3]);
                const starts = () => [...node.childNodes]
                    .filter(n => n.nodeType === Node.COMMENT_NODE && n.data === "<>");

                let node;
                effect(() => {
                    node = <div>{() => items.value.map(id =>
                        <Fragment key={id}>{String(id)}</Fragment>
                    )}</div>;
                });

                await vsync();
                expect(node).eq(
                    "<div>" +
                    "<!--<>-->1<!--</>-->" +
                    "<!--<>-->2<!--</>-->" +
                    "<!--<>-->3<!--</>-->" +
                    "</div>"
                );

                const [one, two, three] = starts();

                items.value = [3, 1, 2];
                await vsync();

                expect(node).eq(
                    "<div>" +
                    "<!--<>-->3<!--</>-->" +
                    "<!--<>-->1<!--</>-->" +
                    "<!--<>-->2<!--</>-->" +
                    "</div>"
                );

                // each key moved the group it already had, rather than rebuilding it
                expect(starts()).to.deep.equal([three, one, two]);
            });

            test("adds and removes fragments in a keyed list", async () => {
                const items = signal([1, 2, 3]);
                let node;
                effect(() => {
                    node = <div>{() => items.value.map(id =>
                        <Fragment key={id}>{String(id)}<b/></Fragment>
                    )}</div>;
                });

                await vsync();
                expect(node.textContent).to.equal("123");
                expect(node.querySelectorAll("b")).to.have.length(3);

                // a rotation that also introduces a key, so the diff inserts before a live group
                items.value = [2, 3, 4, 1];
                await vsync();
                expect(node.textContent).to.equal("2341");
                expect(node.querySelectorAll("b")).to.have.length(4);

                items.value = [];
                await vsync();
                expect(node).eq("<div></div>");
            });

            test("renders keyed list within reactive context", async () => {
                const entries = signal([
                    {id: 0, name: "Bowie"},
                    {id: 1, name: "Patsy"},
                    {id: 2, name: "Liliane"}
                ]);

                let node;
                const dismiss = effect(() => {
                    node = <div>{() => entries.value.map(({id, name}) =>
                        <div key={id}>{name}</div>
                    )}</div>;
                });

                await vsync();

                expect(node).to.equal(
                    "<div>" +
                    "<div>Bowie</div>" +
                    "<div>Patsy</div>" +
                    "<div>Liliane</div>" +
                    "</div>"
                );

                dismiss();
            });

            test("reorders keyed items efficiently", async () => {
                const entries = signal([
                    {id: 0, name: "Bowie"},
                    {id: 1, name: "Patsy"},
                    {id: 2, name: "Liliane"}
                ]);

                let node;
                effect(() => {
                    node = <div>{() => entries.value.map(({id, name}) =>
                        <div key={id}>{name}</div>
                    )}</div>;
                });

                await vsync();
                const originalChildren = [...node.childNodes];

                entries.set([
                    {id: 2, name: "Liliane"},
                    {id: 0, name: "Bowie"},
                    {id: 1, name: "Patsy"}
                ]);

                await vsync();

                // Nodes should be reused, not recreated
                // originalChildren: [Bowie, Patsy, Liliane]
                // After reorder: [Liliane, Bowie, Patsy]
                expect(node.childNodes[1]).to.equal(originalChildren[0]); // Bowie
                expect(node.childNodes[2]).to.equal(originalChildren[1]); // Patsy
                expect(node.childNodes[0]).to.equal(originalChildren[2]); // Liliane
            });

            test("adds and removes keyed items", async () => {
                const entries = signal([
                    {id: 0, name: "Bowie"},
                    {id: 1, name: "Patsy"},
                    {id: 2, name: "Liliane"}
                ]);

                let node;
                effect(() => {
                    node = <div>{() => entries.value.map(({id, name}) =>
                        <div key={id}>{name}</div>
                    )}</div>;
                });

                await vsync();

                entries.set([
                    {id: 0, name: "Bowie"},
                    {id: 3, name: "New"},      // New item
                    {id: 2, name: "Liliane"}
                    // id: 1 removed
                ]);

                await vsync();

                expect(node).to.equal(
                    "<div>" +
                    "<div>Bowie</div>" +
                    "<div>New</div>" +
                    "<div>Liliane</div>" +
                    "</div>"
                );
            });

            test("handles scrolling through lists", async () => {
                const names = ["First", "Second", "Third", "Fourth", "Fifth"];
                let items = signal([...names]);

                let node;
                effect(() => {
                    node = <div>{() => items.value.map(value =>
                        <div key={value}>{value}</div>
                    )}</div>;
                });

                await vsync();
                const zero = node.childNodes[1];
                const first = node.childNodes[2];
                const second = node.childNodes[3];

                // Scroll forward (move first item to end)
                items.set([...names.slice(1), names[0]]);
                await vsync();
                expect(first).to.equal(node.childNodes[1]);
                expect(second).to.equal(node.childNodes[2]);

                // Scroll backward (move last item to beginning)
                items.set([names[4], ...names.slice(0, 4)]);
                await vsync();
                expect(zero).to.equal(node.childNodes[2]);
                expect(first).to.equal(node.childNodes[3]);
            });

            test("updates keyed item content when its data changes", async () => {
                const entries = signal([
                    {id: 0, name: "Bowie"},
                    {id: 1, name: "Patsy"}
                ]);

                let node;
                const dismiss = effect(() => {
                    node = <div>{() => entries.value.map(entry =>
                        <div key={entry.id}>{entry.name}</div>
                    )}</div>;
                });

                await vsync();
                expect(node).eq("<div><div>Bowie</div><div>Patsy</div></div>");

                entries.set([
                    {id: 0, name: "Ziggy"},
                    {id: 1, name: "Patsy"}
                ]);

                await vsync();
                expect(node).eq("<div><div>Ziggy</div><div>Patsy</div></div>");

                dismiss();
            });

            test("supports non-string keys", async () => {
                const disposed = [] as string[];

                function Item(props: { k: number | symbol, text: string }) {
                    const key = String(props.k); // read in the body, so it is not tracked
                    effect(() => () => disposed.push(key));
                    return <div>{() => props.text}</div>;
                }

                const TWO = Symbol.for("two");
                const items = signal([
                    {k: 1 as number | symbol, text: "one"},
                    {k: TWO as number | symbol, text: "two"}
                ]);

                let node;
                const dismiss = effect(() => {
                    node = <div>{() => items.value.map(item =>
                        <Item key={item.k} k={item.k} text={item.text}/>
                    )}</div>;
                });

                await vsync();
                expect(node).eq("<div><div>one</div><div>two</div></div>");
                const [first, second] = [...node.childNodes];

                // both key types reconcile, keeping the node each key already had
                items.value = [{k: TWO, text: "two"}, {k: 1, text: "one"}];
                await vsync();

                expect(node).eq("<div><div>two</div><div>one</div></div>");
                expect(node.childNodes[0]).to.equal(second);
                expect(node.childNodes[1]).to.equal(first);
                expect(disposed).to.deep.equal([]);

                // and both are disposed when their key stops being rendered
                items.value = [];
                await vsync();

                expect(node).eq("<div></div>");
                expect(disposed.sort()).to.deep.equal(["1", "Symbol(two)"]);

                dismiss();
            });
        });

        suite("Nested Keyed Components", () => {
            test("handles nested keyed components with updates", async () => {
                const root = signal({  // Make root a signal
                    label: "root",
                    children: [
                        {label: "0:0", children: []},
                        {label: "0:1", children: []}
                    ]
                });

                function Tree(props) {
                    return (
                        <div data-label={props.label}>
                            {props.children?.map(({label, children}) =>
                                <Tree key={label} label={label} children={children}/>
                            )}
                        </div>
                    );
                }

                let tree;
                effect(() => {
                    tree = <Tree key="root" label={root.value.label} children={root.value.children}/>;
                });

                await vsync();

                expect(tree.getAttribute("data-label")).to.equal("root");
                expect(tree.children.length).to.equal(2);

                const firstChild = tree.children[0];

                // Update via signal to trigger reconciliation
                root.set({
                    label: "root",
                    children: [
                        {label: "0:0", children: []},  // Reused
                        {label: "0:2", children: []}   // New (0:1 removed)
                    ]
                });

                await vsync();

                // First child should be reused
                expect(tree.children[0]).to.equal(firstChild);
                expect(tree.children[0].getAttribute("data-label")).to.equal("0:0");
                // Second child is new
                expect(tree.children[1]).to.not.equal(firstChild);
                expect(tree.children[1].getAttribute("data-label")).to.equal("0:2");
            });
        });
    });

    suite("Effect Management", () => {

        suite("Ownership and Disposal", () => {
            test("disposes effects when keyed items removed", async () => {
                const suffix = signal("a");
                const items = signal([1, 2, 3]);
                const node = <div>{() => items.value.map(value => (
                    <div key={value} data-value={() => `${value}${suffix.value}`}>
                        {() => <p data-txt={() => `${value}${suffix.value}`}/>}
                    </div>
                ))}</div>;

                await vsync();

                expect(node).to.eq(
                    "<div>" +
                    "<div data-value=\"1a\"><p data-txt=\"1a\"></p></div>" +
                    "<div data-value=\"2a\"><p data-txt=\"2a\"></p></div>" +
                    "<div data-value=\"3a\"><p data-txt=\"3a\"></p></div>" +
                    "</div>"
                );

                const removed = node.childNodes[2];

                // Remove item 3, add item 4
                items.value = [1, 2, 4];
                await vsync();

                expect(node).to.eq(
                    "<div>" +
                    "<div data-value=\"1a\"><p data-txt=\"1a\"></p></div>" +
                    "<div data-value=\"2a\"><p data-txt=\"2a\"></p></div>" +
                    "<div data-value=\"4a\"><p data-txt=\"4a\"></p></div>" +
                    "</div>"
                );

                // item 3's observers are disposed, so its detached nodes no longer track the signal
                suffix.value = "b";
                await vsync();

                expect(node).to.eq(
                    "<div>" +
                    "<div data-value=\"1b\"><p data-txt=\"1b\"></p></div>" +
                    "<div data-value=\"2b\"><p data-txt=\"2b\"></p></div>" +
                    "<div data-value=\"4b\"><p data-txt=\"4b\"></p></div>" +
                    "</div>"
                );
                expect(removed).to.eq("<div data-value=\"3a\"><p data-txt=\"3a\"></p></div>");
            });
            test("disposes effects created inside a keyed component with its key", async () => {
                const log = [] as string[];

                function Item(props: { id: number }) {
                    effect(() => {
                        const id = props.id;
                        log.push(`mount ${id}`);
                        return () => log.push(`dispose ${id}`);
                    });
                    return <div>{() => props.id}</div>;
                }

                const items = signal([1, 2, 3]);
                let node;
                const dismiss = effect(() => {
                    node = <div>{() => items.value.map(id => <Item key={id} id={id}/>)}</div>;
                });

                await vsync();
                expect(node).eq("<div><div>1</div><div>2</div><div>3</div></div>");
                expect(log).to.deep.equal(["mount 1", "mount 2", "mount 3"]);

                log.length = 0;
                items.value = [1, 3];
                await vsync();

                // only the dropped key is torn down; its siblings keep the effects they already had
                expect(log).to.deep.equal(["dispose 2"]);

                log.length = 0;
                dismiss();
                expect(log).to.deep.equal(["dispose 1", "dispose 3"]);
            });

            test("disposes effects owned by a keyed node created in a component body", async () => {
                const disposed = [] as string[];

                function Leaf() {
                    effect(() => () => disposed.push("leaf"));
                    return <div>leaf</div>;
                }

                function Host() {
                    return <div><Leaf key="leaf"/></div>;
                }

                const items = signal([1]);
                let node;
                const dismiss = effect(() => {
                    node = <div>{() => items.value.map(id => <Host key={id}/>)}</div>;
                });

                await vsync();
                expect(node).eq("<div><div><div>leaf</div></div></div>");
                expect(disposed).to.deep.equal([]);

                items.value = [];
                await vsync();

                expect(node).eq("<div></div>");
                expect(disposed).to.deep.equal(["leaf"]);

                dismiss();
            });

            test("isolates keyed component effects from parent", async () => {
                const parentTrigger = signal(0);

                function Component(props: { value: number }) {
                    return <div>{props.value}</div>;
                }

                const value = signal(1);
                let node;

                effect(() => {
                    parentTrigger.value; // Parent subscribes
                    node = <Component key="comp" value={value.value}/>;
                });

                await vsync();
                expect(node).to.equal("<div>1</div>");

                // Parent re-runs - but prop value unchanged
                // DOM should remain stable
                parentTrigger.set(1);
                await vsync();
                expect(node).to.equal("<div>1</div>");

                // Component prop changes - DOM should update
                value.set(2);
                await vsync();
                expect(node).to.equal("<div>2</div>");
            });

            test("disposes scope when keyed component removed", async () => {
                const show = signal(true);
                const disposed = [] as string[];

                function Content() {
                    effect(() => () => disposed.push("content"));
                    return <div>content</div>;
                }

                let scopeRef, node;
                const dismiss = effect(() => {
                    node = show.value ? <Content key="test"/> : null;
                    scopeRef = currentContext().scope;
                });

                expect(node).eq("<div>content</div>");
                expect(scopeRef.live).to.have.property("test");
                expect(disposed).to.deep.equal([]);

                show.set(false);
                await vsync();

                // the key is gone, so the scope drops it and everything it owned goes with it
                expect(node).to.equal(null);
                expect(scopeRef.live).to.be.undefined;
                expect(disposed).to.deep.equal(["content"]);

                dismiss();
            });
        });

        suite("Scope Lifecycle", () => {
            test("preserves keyed nodes owned by a computed across refreshes", async () => {
                const trigger = signal(0);
                const view = computed(() => {
                    trigger.value;
                    return <div key="k"/>;
                });

                let node;
                const dismiss = effect(() => {
                    node = view.value;
                });

                const first = node;

                trigger.value = 1;
                await vsync();

                expect(node).to.equal(first);

                dismiss();
            });

            test("preserves keyed children rendered by a keyed element", async () => {
                const trigger = signal(0);
                let host;
                const dismiss = effect(() => {
                    trigger.value;
                    host = <div key="host" children={[{tag: "span", key: "s", children: "x"}]}/>;
                });

                expect(host).eq("<div><span>x</span></div>");
                const first = host.firstChild;

                trigger.value = 1;
                await vsync();

                expect(host).eq("<div><span>x</span></div>");
                expect(host.firstChild).to.equal(first);

                dismiss();
            });

            test("keeps keyed children alive when an update leaves them untouched", async () => {
                const disposed = [] as string[];

                function Leaf() {
                    effect(() => () => disposed.push("leaf"));
                    return <span>leaf</span>;
                }

                const children = [{tag: Leaf, key: "leaf"}]; // same reference on every render
                const trigger = signal(0);
                let host;
                const dismiss = effect(() => {
                    const title = trigger.value;
                    host = <div key="host" title={title} children={children}/>;
                });

                expect(host).eq('<div title="0"><span>leaf</span></div>');
                expect(disposed).to.deep.equal([]);

                trigger.value = 1;
                await vsync();

                // the update ran, but it never touched children, so the keyed child must survive
                expect(host).eq('<div title="1"><span>leaf</span></div>');
                expect(disposed).to.deep.equal([]);

                dismiss();
            });
        });
    });

    suite("Namespaces", () => {

        const namespaces = (node, selector) => [...node.querySelectorAll(selector)].map(el => el.namespaceURI);

        test("creates lexically nested children in the svg namespace", () => {
            const node = <svg viewBox="0 0 10 10">
                <g>
                    <circle cx={1}/>
                </g>
            </svg>;

            expect(node.namespaceURI).to.equal(SVG_NAMESPACE_URI);
            expect(namespaces(node, "g, circle")).to.deep.equal([SVG_NAMESPACE_URI, SVG_NAMESPACE_URI]);
        });

        test("keeps the svg namespace across a component boundary on update", async () => {
            const cxs = signal([1, 2]);

            function Circles() {
                return <>{() => cxs.value.map(cx => <circle cx={cx}/>)}</>;
            }

            const node = <svg><Circles/></svg>;

            expect(namespaces(node, "circle")).to.deep.equal([SVG_NAMESPACE_URI, SVG_NAMESPACE_URI]);

            cxs.value = [1, 2, 3];
            await vsync();

            expect(namespaces(node, "circle")).to.deep.equal([
                SVG_NAMESPACE_URI, SVG_NAMESPACE_URI, SVG_NAMESPACE_URI
            ]);
        });

        test("keeps the svg namespace for a function child declared outside the svg", async () => {
            const cxs = signal([1, 2]);
            const circles = () => cxs.value.map(cx => <circle cx={cx}/>);

            const node = <svg>
                <title>shapes</title>
                {circles}
            </svg>;

            expect(namespaces(node, "circle")).to.deep.equal([SVG_NAMESPACE_URI, SVG_NAMESPACE_URI]);

            cxs.value = [3, 2, 1];
            await vsync();

            expect(namespaces(node, "circle")).to.deep.equal([
                SVG_NAMESPACE_URI, SVG_NAMESPACE_URI, SVG_NAMESPACE_URI
            ]);
        });

        test("creates element descriptors in the svg namespace without leaking xmlns", async () => {
            const shape = signal("none" as any);

            const node = <svg>
                <title>shapes</title>
                {() => shape.value}
            </svg> as SVGSVGElement;

            shape.value = {tag: "circle", attrs: {cx: 1}};
            await vsync();

            const circle = node.querySelector("circle");
            expect(circle.namespaceURI).to.equal(SVG_NAMESPACE_URI);
            expect(circle.hasAttribute("xmlns")).to.equal(false);
        });

        test("keeps html children in the xhtml namespace on update", async () => {
            const flag = signal(true);
            const node = <div>{() => flag.value ? <span/> : <b/>}</div> as HTMLDivElement;

            expect(node.firstChild.namespaceURI).to.equal(XHTML_NAMESPACE_URI);

            flag.value = false;
            await vsync();

            expect(node.firstChild.namespaceURI).to.equal(XHTML_NAMESPACE_URI);
            expect(node.firstChild).to.have.tagName("b");
        });
    });

    suite("Error Boundaries", () => {

        setup(() => {
            errorBoundary.set("children", (node, err) => {
                node.innerHTML = `<error>${err.message}</error>`;
            });
        });

        teardown(() => {
            errorBoundary.reset("children");
        });

        test("handles errors in computed dependencies", async () => {
            const throws = signal(false);
            const comp = computed(() => {
                if (throws.value) throw new Error("boom");
                return "ok";
            });

            let node;
            effect(() => {
                node = <div>{comp.value}</div>;
            });

            throws.set(true);
            await vsync();
            expect(node).to.equal("<div><error>boom</error></div>");
        });
    });

    suite("Edge Cases", () => {

        test("handles rapid signal updates", async () => {
            const value = signal(0);
            const node = <div>{value.value}</div>;

            // Batch multiple updates
            for (let i = 1; i <= 5; i++) {
                value.set(i);
            }

            await vsync();
            expect(node).to.equal("<div>5</div>");
        });

        test("handles mixed static and dynamic children", async () => {
            const first = signal([0]);
            const second = signal("s");
            const node = <div>static {first.value}{second.value}</div>;

            expect(node).to.html("static <!--<>-->0<!--</>-->s");

            first.value = [0, 1];
            expect(node).to.html("static <!--<>-->01<!--</>-->s");
        });

        test("function values are not invoked as event handlers", async () => {
            const valueSpy = sinon.spy(() => "Input Text Value");
            const node = <input value={
                valueSpy as any // JSX expression computed signals are not explicitly typed!
            }/> as HTMLInputElement;

            expect(valueSpy.callCount).to.equal(1);
            expect(node.value).to.equal("Input Text Value");

            await vsync();
            expect(valueSpy.callCount).to.equal(1);

            node.dispatchEvent(new KeyboardEvent("keydown", {key: "e"}));
            expect(valueSpy.callCount).to.equal(1);
        });

    });
});