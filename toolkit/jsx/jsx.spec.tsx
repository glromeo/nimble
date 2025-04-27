import {assert, expect} from "chai";
import type Sinon from "sinon";
import sinon from "sinon";
import {checkJsx, Fragment, NodeGroup} from "./jsx.mjs";
import {createDirective} from "./directives.mjs";
import {contextScope, computed, ownerScope, Effect, signal, tracked, currentContext, effect} from "../signals/signals.mjs";
import {vsync} from "@nimble/testing";

declare module "@nimble/toolkit" {
    namespace JSX {
        interface Directives {
            ready: boolean;
        }
    }
}

function outerHTML(node: Node) {
    const div = document.createElement("div");
    div.appendChild(node);
    return div.innerHTML;
}

suite("Nimble JSX", ({before}) => {

    before.each(async () => {
        if (currentContext() != undefined) {
            assert.fail("invalid signals state: " + currentContext());
        }
        checkJsx();
    });

    test(`jsx syntax creates DOM elements and Text nodes`, () => {

        expect(<h1>Hello World</h1>)
            .to.be.instanceof(HTMLHeadingElement)
            .and.have.tagName("h1")
            .and.have.html("Hello World");

        const node = <p class="sample">paragraph</p>;
        expect(node)
            .to.be.instanceof(HTMLParagraphElement)
            .and.have.attr("class", "sample");
        expect(node.childNodes.length).to.equal(1);
        expect(node.firstChild)
            .to.be.instanceof(Text)
            .and.have.property("data", "paragraph");
    });

    test("fragments <>...</> are persistent groups of nodes", () => {

        expect(<></>)
            .to.be.instanceof(DocumentFragment)
            .and.instanceof(NodeGroup);

        const fragment = <></>;
        expect(fragment.childNodes)
            .to.have.length(2);
        expect(fragment)
            .to.have.html(undefined)
            .to.have.text("")
            .to.equal("<!--<>--><!--</>-->");

        expect(<p><></>
        </p>).to.equal("<p><!--<>--><!--</>--></p>");
        expect(<><p></p></>).to.equal("<!--<>--><p></p><!--</>-->");
        expect(<>
            <p><></>
            </p>
        </>).to.equal("<!--<>--><p><!--<>--><!--</>--></p><!--</>-->");
        expect(<>b<>l<p>m</p>r</>
            a</>).to.equal("<!--<>-->b<!--<>-->l<p>m</p>r<!--</>-->a<!--</>-->");
    });

    test("<> and <Fragment> are equivalent", () => {
        expect((<></>).constructor).eq((<Fragment></Fragment>).constructor);
        expect(outerHTML(<>Hello</>)).eq(outerHTML(<Fragment>Hello</Fragment>));
    });

    test("fragments use two comments to determine the node group boundaries", () => {
        const wrapper = <div><>Hello</>
        </div> as HTMLDivElement;
        expect(wrapper).eq("<div><!--<>-->Hello<!--</>--></div>");
        expect(wrapper.children).to.have.length(0);
        expect(wrapper.childNodes).to.have.length(3);
        expect(<Fragment></Fragment>).eq("<!--<>--><!--</>-->");
    });

    test("fragments accept any kind of children", () => {
        expect((<>hello world</>).textContent).eq((<Fragment>{["hello", " ", "world"]}</Fragment>).textContent);
        const d = <div><><a></a>B{"C"}{<br/>}</>
        </div> as HTMLDivElement;
        expect(d).eq("<div><!--<>--><a></a>BC<br><!--</>--></div>");
    });

    test("jsx expression let you move fragments from one element to another", async () => {
        let f = <><p></p></> as DocumentFragment;
        let p1 = <div>{f}</div> as HTMLDivElement;
        expect(p1).eq("<div><!--<>--><p></p><!--</>--></div>");
        let p2 = <div>{f}</div> as HTMLDivElement;
        expect(p2).eq("<div><!--<>--><p></p><!--</>--></div>");
        expect(p1).eq("<div></div>");
    });

    test("fragments can have keys", async () => {
        let scope;
        tracked({}, function () {
            scope = contextScope();
            let f;
            expect(<p key="P">{f = <Fragment key="F"></Fragment>}</p>).eq("<p><!--<>--><!--</>--></p>");
            expect(scope.get("P")).not.to.be.undefined; // P ends up in global scope here
            expect(scope.get("F")).not.to.be.undefined; // F is within the scope of P's children

            const state = scope.get("F");
            expect(state.node).to.eq(f);
            state.update({children: "Hello"});
        });
        await vsync();
        expect(scope.get("P").node).eq("<p><!--<>-->Hello<!--</>--></p>");
    });

    test("directives", () => {

        let directive: Sinon.SinonSpy;

        createDirective("ready", directive = sinon.spy((el, props) => {
            expect(props.class).to.eq("classy");
        }));

        let node = <div class="classy" is:ready={true}>Hello</div>;

        sinon.assert.calledOnce(directive);
        sinon.assert.calledWith(directive, node);

        expect(node).eq(`<div class="classy" is:ready="">Hello</div>`);
    });

    test("children", async () => {
        const message = signal("Hello");

        function FC(props: { message: string, children: any }) {
            return <div>{props.message} {props.children}</div>;
        }

        const node = <FC message={message.get()}>World</FC>;
        expect(node).eq(`<div>Hello World</div>`);
        message.set("Goodbye");
        await vsync();
        expect(node).eq(`<div>Goodbye World</div>`);
    });

    test("unkeyed function components", async () => {
        function FC(props: { counter: number }) {
            return <p>{props.counter}</p>;
        }

        function PC(props: { counter: number }) {
            return <div><FC counter={props.counter * 2}/>:<FC counter={props.counter / 2}/></div>;
        }

        const parentNode = <PC counter={0}/>;
        expect(parentNode).eq(`<div><p>0</p>:<p>0</p></div>`);
    });

    test("keyed functions can be updated thanks to signal rewiring", async () => {

        function FC(props: { letter: string, counter: number }) {
            return <div>{props.letter + ":" + props.counter}</div>;
        }

        const counter = signal(0);

        const ctx = new Effect(() => {
        });

        const node = tracked(ctx, () => <FC key="0" letter={"A"} counter={counter.value}/>);
        expect(node).eq(`<div>A:0</div>`);
        counter.value++;
        await vsync();
        expect(node).eq(`<div>A:1</div>`);

        const negative = signal(-1);
        const node2 = tracked(ctx, () => <FC key="0" letter={"A"} counter={negative.value}/>);
        await vsync();
        expect(node2).to.equal(node);
        expect(node).eq(`<div>A:-1</div>`);

        tracked(ctx, () => <FC key="0" letter={"B"} counter={negative.value}/>);
        await vsync();
        expect(node).eq(`<div>B:-1</div>`);

        const letter = signal("C");
        tracked(ctx, () => <FC key="0" letter={letter.value} counter={3}/>);
        await vsync();
        expect(node).eq(`<div>C:3</div>`);

        letter.value = "D";
        await vsync();
        expect(node).eq(`<div>D:3</div>`);

        const cmp = computed(() => 0);
        tracked(ctx, () => <FC key="0" letter={"E"} counter={cmp.value}/>);
        await vsync();
        expect(node).eq(`<div>E:0</div>`);
    });

    test("elements are passed through as they are", () => {
        expect(<>Hello World</>).to.equal("<!--<>-->Hello World<!--</>-->");
        expect(<><p>para</p></>).to.equal("<!--<>--><p>para</p><!--</>-->");
        const text = document.createTextNode("text");
        const node = <>{text}</>;
        expect(node.firstChild).to.equal(text);
        expect(node.childNodes.length).to.equal(3);
        expect(node).to.equal(`<!--<>-->text<!--</>-->`);
    });

    test("strings, numbers and BigInts are wrapped in Text nodes", () => {
        expect(<>{""}</>).to.equal("<!--<>--><!--</>-->");
        expect(<>{"Hello World"}</>).to.equal("<!--<>-->Hello World<!--</>-->");
        expect(<>{0}</>).to.equal("<!--<>-->0<!--</>-->"); // To make sure 0 is not treated as falsy
        expect(<>{1}</>).to.equal("<!--<>-->1<!--</>-->");
        expect(<>{BigInt(1234567890)}</>).to.equal("<!--<>-->1234567890<!--</>-->");
        expect(<>{1_000_000_000.000_000_9}</>).to.equal("<!--<>-->1000000000.000001<!--</>-->");
        expect(<>{null}</>).to.equal("<!--<>--><!--</>-->");
        expect(<>{undefined}</>).to.equal("<!--<>--><!--</>-->");
    });

    test("...all remaining types are turned into comments", () => {
        expect(<>{true}</>).to.equal("<!--<>--><!--true--><!--</>-->"); // true leaves a debugging comment
        expect(<>{false}</>).to.equal("<!--<>--><!--false--><!--</>-->"); // false leaves a debugging comment
        expect(<>{Symbol()}</>).to.equal("<!--<>--><!--Symbol()--><!--</>-->"); // Symbol leaves a debugging comment
        expect(<>{{}}</>).to.equal("<!--<>--><!--[object Object]--><!--</>-->");
    });

    test("...rest", () => {
        const s = signal(document.createTextNode("text"));
        expect(<>{() => <></>}</>).to.equal("<!--<>--><!--<>--><!--</>--><!--</>-->");
        expect(<>{s.value}</>).to.equal(`<!--<>-->text<!--</>-->`);
        expect(<>{[]}</>).to.equal("<!--<>--><!--</>-->");
        expect(<>{{
            tag: "div",
            attrs: {name: "alpha"},
            children: "Hello"
        }}</>).to.equal(`<!--<>--><div name="alpha">Hello</div><!--</>-->`);
    });

    test("simple signals", () => {
        const s1 = signal("Hello World");
        const s2 = signal(BigInt(1234567890));
        const s3 = signal(0);
        const s4 = signal(1);
        const s5 = signal(1_000_000_000.000_000_9);
        const s6 = signal(true);
        const s7 = signal(false);
        const s8 = signal(Symbol());
        expect(<p>{s1.value}</p>).to.html("Hello World");
        expect(<p>{s2.value}</p>).to.html("1234567890");
        expect(<p>{s3.value}</p>).to.html("0");
        expect(<p>{s4.value}</p>).to.html("1");
        expect(<p>{s5.value}</p>).to.html("1000000000.000001");
        expect(<p>{s6.value}</p>).to.html("<!--true-->");
        expect(<p>{s7.value}</p>).to.html("<!--false-->");
        expect(<p>{s8.value}</p>).to.html("<!--Symbol()-->");
    });

    test("simple signals (arrow functions)", () => {
        expect(<p>{() => "Hello World"}</p>).to.html("Hello World");
        expect(<p>{() => BigInt(1234567890)}</p>).to.html("1234567890");
        expect(<p>{() => 0}</p>).to.html("0");
        expect(<p>{() => 1}</p>).to.html("1");
        expect(<p>{() => 1_000_000_000.000_000_9}</p>).to.html("1000000000.000001");
        expect(<p>{() => true}</p>).to.html("<!--true-->");
        expect(<p>{() => false}</p>).to.html("<!--false-->");
        expect(<p>{() => Symbol()}</p>).to.html("<!--Symbol()-->");
    });

    test("elements", () => {
        expect(<div>Hello World</div>).to.equal(`<div>Hello World</div>`);
        expect(<div class="message">Hello World</div>).to.equal(`<div class="message">Hello World</div>`);
        expect(<div class={{alpha: true, beta: false}}>Hello World</div>
        ).to.equal(`<div class="alpha">Hello World</div>`);
        expect(<div class={["alpha", "beta", "gamma"]}>Hello World</div>
        ).to.equal(`<div class="alpha beta gamma">Hello World</div>`);
        const beta = signal("beta");
        expect(<div class={computed(() => `alpha ${beta.get()} gamma`).value}>Hello World</div>
        ).to.equal(`<div class="alpha beta gamma">Hello World</div>`);
    });

    test("children update", async () => {
        const items = signal(["one", 2, true]);
        const node = <div>{items.value}</div>;
        expect(node).eq("<div>one2<!--true--></div>");
        items.value = ["a", "b", "c", "d", "e", "f"];
        await vsync();
        expect(node).eq("<div>abcdef</div>");
        let cn = [...node.childNodes];
        items.value = ["b", "c", "d", "e"];
        await vsync();
        expect(node).eq("<div>bcde</div>");
        expect(cn[1]).to.eq(node.childNodes[0]);
        expect(cn[2]).to.eq(node.childNodes[1]);
        expect(cn[3]).to.eq(node.childNodes[2]);
        expect(cn[4]).to.eq(node.childNodes[3]);
        cn = [...node.childNodes];
        items.value = ["d", "e", "f", "g", "h", "b", "c"];
        await vsync();
        expect(node).eq("<div>defghbc</div>");
        expect(cn[0]).to.not.eq(node.childNodes[5]); // b is re-created
        expect(cn[1]).to.eq(node.childNodes[6]);
        expect(cn[2]).to.not.eq(node.childNodes[0]); // d is re-created
        expect(cn[3]).to.eq(node.childNodes[1]);
    });

    test("scrolling", async () => {
        let items = signal([]);
        let node = <div>{items.value?.map((value: string) => <div key={value} data-value={() => value}>{value}</div>)}</div>;
        expect(node).to.equal("<div></div>");
        let sn = [...names];
        items.set(sn);
        await vsync();
        expect(node.firstChild).have.text("Annabela");
        let zero = node.childNodes[0];
        let first = node.childNodes[1];
        let second = node.childNodes[2];
        let third = node.childNodes[3];
        sn = [...sn.slice(1), sn[0]];
        items.set(sn);
        await vsync();
        expect(Object.is(first, node.childNodes[0])).to.be.true;
        expect(Object.is(second, node.childNodes[1])).to.be.true;
        sn = [...sn.slice(1), sn[0]];
        items.set(sn);
        await vsync();
        expect(Object.is(second, node.childNodes[0])).to.be.true;
        expect(Object.is(third, node.childNodes[1])).to.be.true;
        sn = [sn[sn.length - 1], ...sn.slice(0, -1)];
        items.set(sn);
        await vsync();
        expect(Object.is(first, node.childNodes[0])).to.be.true;
        expect(Object.is(second, node.childNodes[1])).to.be.true;
        sn = [sn[sn.length - 1], ...sn.slice(0, -1)];
        items.set(sn);
        await vsync();
        expect(Object.is(zero, node.childNodes[0])).to.be.true;
        expect(Object.is(first, node.childNodes[1])).to.be.true;
    });

    test("signal updates", async () => {
        let a = signal("Hello World");
        let node = <div>{a.value}</div>;
        expect(node).to.equal("<div>Hello World</div>");
        a.set(BigInt(1234567890));
        // expect(node).to.equal("<div>Hello World</div>");
        // await vsync();
        expect(node).to.equal("<div>1234567890</div>");
        a.set(0);
        await vsync();
        expect(node).to.equal("<div>0</div>");
        a.set(1);
        await vsync();
        expect(node).to.equal("<div>1</div>");
        a.set(1_000_000_000.000_000_9);
        await vsync();
        expect(node).to.equal("<div>1000000000.000001</div>");
        a.set(true);
        await vsync();
        expect(node).to.equal("<div><!--true--></div>");
        a.set(false);
        await vsync();
        expect(node).to.equal("<div><!--false--></div>");
        a.set(Symbol("xyz"));
        await vsync();
        expect(node).to.equal("<div><!--Symbol(xyz)--></div>");
        a.set(() => "Hello World");
        await vsync();
        expect(node).to.equal("<div>Hello World</div>");
        a.set(function Hello() {
            return "Hello World";
        });
        await vsync();
        expect(node).to.equal("<div>Hello World</div>");
    });

    const names = [
        "Annabela", "Darleen", "Emyle", "Esme", "Julianna", "Luce", "Nada", "Nickie", "Sile", "Trish", "Warren",
        "Ann-marie", "Claudius", "Demeter", "Ebony", "Emmalynne", "Gerhard", "Iolanthe", "Nonna", "Rosy", "Trueman",
        "Andeee", "Ario", "Connor", "Donni", "Gussi", "Jerrold", "Neel", "Rudd", "Stefania", "Tedman", "Teresita",
        "Allix", "Darnell", "Emmett", "Farah", "Gibbie", "Hamnet", "Kale", "Letti", "Melamie", "Paten", "Quinn", "Trev",
        "Antonie", "Beatrice", "Belicia", "Brynne", "Cathlene", "Conrade", "Melly", "Simone", "Theodora", "Wildon",
        "Aili", "Almeda", "Chad", "Dory", "George", "Gris", "Jorry", "Korry", "Rickie", "Susanne", "Town", "Tucker",
        "Almira", "Aloysia", "Bendicty", "Berk", "Cyndia", "Ettore", "Ilyse", "Kelby", "Kerry", "Ulrika", "Valerye",
        "Alwin", "Amabel", "Glenna", "Johnnie", "Lindie", "Marilyn", "Stacy", "Storm", "Suzann", "Sydney", "Weylin",
        "Alfie", "Allene", "Dom", "Elmore", "Gwen", "Hartley", "Manolo", "Rabi", "Roderich", "Roosevelt", "Sara-ann"
    ];

    test("text content (signals changing)", async () => {
        let items = signal([]);
        let node = <div>{items.value}</div>;
        expect(node).to.equal("<div></div>");
        items.set(["Hello", "World"]);
        await vsync();
        expect(node).to.equal("<div>HelloWorld</div>");
        items.set(names);
        await vsync();
        expect(node.childNodes[0].textContent).eq("Annabela");
        expect(node.childNodes[2].textContent).eq("Emyle");
        expect(node.childNodes[4].textContent).eq("Julianna");
        expect(node.childNodes[names.indexOf("Alfie")].textContent).eq("Alfie");
        expect(node.childNodes[names.indexOf("Manolo")].textContent).eq("Manolo");
        const reversed = [...names].reverse();
        items.set(reversed);
        await vsync();
        expect(node.childNodes[0].textContent).eq("Sara-ann");
        expect(node.childNodes[2].textContent).eq("Roderich");
        expect(node.childNodes[4].textContent).eq("Manolo");
        expect(node.childNodes[reversed.indexOf("Alfie")].textContent).eq("Alfie");
        expect(node.childNodes[reversed.indexOf("Gussi")].textContent).eq("Gussi");
    });

    test("functions are computed", async () => {
        const sample = signal(null);
        const props = Object.create(null, {
            sample: {
                get: () => sample.get(),
                set: (value) => sample.set(value)
            } // TODO: set/write is not implemented in the plugin yet!
        });
        const getter = computed(() => props.sample);
        expect(getter.get()).to.be.null;
        let value = [];
        sample.set(value);
        expect(getter.get()).to.equal(value);

        sample.set("Hello");
        let node = <div>{props.sample}</div>;
        expect(node).to.equal(`<div>Hello</div>`);
        sample.set("Bye");
        await vsync();
        expect(node).to.equal(`<div>Bye</div>`);

        let color = signal("red");
        Object.defineProperty(props, "color", {
            get: () => color.get()
        });
        let light = <div style={`color: ${props.color}`}>I am {props.color}</div>;
        expect(light).to.equal(`<div style="color: red">I am red</div>`);
        color.set("green");
        await vsync();
        expect(light).to.equal(`<div style="color: green">I am green</div>`);
        color.set("blue");
        await vsync();
        expect(light).to.equal(`<div style="color: blue">I am blue</div>`);
    });

    test("keyed access", async () => {

        const entries = signal([
            {"id": 0, "name": "Bowie"},
            {"id": 1, "name": "Patsy"},
            {"id": 2, "name": "Liliane"},
            {"id": 3, "name": "Allyn"},
            {"id": 4, "name": "Vikky"},
            {"id": 5, "name": "Raynor"},
            {"id": 6, "name": "Dona"},
            {"id": 7, "name": "Alain"},
            {"id": 8, "name": "Wallie"},
            {"id": 9, "name": "Whitney"}]);

        function Comp(props) {

            let scope: Map<any, any>;

            const fragment = <>{props.entries.map(({id, name}) => {
                scope = contextScope();
                return <div key={id}>{name}</div>;
            })}</>;

            expect(fragment.parentNode).to.equal(null);
            expect(fragment.childNodes).to.have.length(10 + 2);

            const {node} = scope.get(6);
            expect(node.constructor.name).to.equal("HTMLDivElement");
            expect(node.innerText).to.equal("Dona");

            return fragment;
        }

        let node = <div name="wrapper"><Comp entries={entries.value}/></div>;

        expect(node).to.equal(`
            <div name="wrapper">
                <!--<>-->
                <div>Bowie</div>
                <div>Patsy</div>
                <div>Liliane</div>
                <div>Allyn</div>
                <div>Vikky</div>
                <div>Raynor</div>
                <div>Dona</div>
                <div>Alain</div>
                <div>Wallie</div>
                <div>Whitney</div>
                <!--</>-->
            </div>
        `.replace(/\s*\n\s*/g, ""));

        const previousChildNodes = [...node.childNodes];

        entries.set([
            {"id": 7, "name": "Alain"},
            {"id": 8, "name": "Wallie"},
            {"id": 9, "name": "Whitney"},
            {"id": 3, "name": "Allyn"},
            {"id": 4, "name": "Vikky"},
            {"id": 5, "name": "Raynor"},
            {"id": 6, "name": "Dona"},
            {"id": 0, "name": "Bowie"},
            {"id": 1, "name": "Patsy"},
            {"id": 2, "name": "Liliane"}
        ]);

        await vsync();

        expect(node).to.equal(`
             <div name="wrapper">
                <!--<>-->
                <div>Alain</div>
                <div>Wallie</div>
                <div>Whitney</div>
                <div>Allyn</div>
                <div>Vikky</div>
                <div>Raynor</div>
                <div>Dona</div>
                <div>Bowie</div>
                <div>Patsy</div>
                <div>Liliane</div>
                <!--</>-->
            </div>
        `.replace(/\s*\n\s*/g, ""));

        expect(node.childNodes[1]).to.equal(previousChildNodes[8]);
        expect(node.childNodes[2]).to.equal(previousChildNodes[9]);
        expect(node.childNodes[3]).to.equal(previousChildNodes[10]);

        expect(node.childNodes[4]).to.equal(previousChildNodes[4]);
        expect(node.childNodes[5]).to.equal(previousChildNodes[5]);
        expect(node.childNodes[6]).to.equal(previousChildNodes[6]);
        expect(node.childNodes[7]).to.equal(previousChildNodes[7]);

        expect(node.childNodes[8]).to.equal(previousChildNodes[1]);
        expect(node.childNodes[9]).to.equal(previousChildNodes[2]);
        expect(node.childNodes[10]).to.equal(previousChildNodes[3]);
    });

    test("event handlers", () => {
        let node;
        const onClickSpy = sinon.spy(e => {
            expect(e.target).to.equal(node);
        });
        node = <div on:click={onClickSpy}></div>;
        node.click();
        expect(onClickSpy.callCount).to.equal(1);
    });

    test("functions and computed signals are used only to supply values", async () => {
        let node;
        const valueSpy = sinon.spy((...args) => {
            expect(args.length).to.equal(0);
            return "Input Text Value";
        });
        node = <input value={valueSpy}></input>;
        expect(valueSpy.callCount).to.equal(1);
        expect(node.value).to.equal("Input Text Value");
        await vsync();
        expect(node.value).to.equal("Input Text Value");
        expect(valueSpy.callCount).to.equal(1);
        node.dispatchEvent(new KeyboardEvent("keydown", {
            key: "e",
            keyCode: 69,
            code: "KeyE",
            which: 69,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        }));
        expect(valueSpy.callCount).to.equal(1);
    });

    test("signals resolution recursion", async () => {
        const l = signal("left");
        const r = signal("right");
        const s = signal("l");
        const c = computed(() => s.value === "l" ? l.value : r.value);
        const node = <div>{c.value}</div>;
        expect(node).to.equal("<div>left</div>");
        expect(s.targets.target).to.eq(c);
        expect(l.targets.target).not.to.eq(c);
        s.set("r");
        await vsync();
        expect(node).to.equal("<div>right</div>");
        expect(r.targets).not.to.be.undefined; // r is bound
        expect(r.targets.target).not.eq(c); // ...but not to c, r is bound to a dynamic node
        r.set("right 2");
        await vsync();
        expect(node).to.equal("<div>right 2</div>"); // and indeed the node changes
        s.set("l");
        await vsync();
        expect(node).to.equal("<div>left</div>");
        await vsync();
        expect(l.targets.target).not.eq(c); // the signal returned from c is bound to a dynamic node
        expect(c.sources.source).to.eq(s); // c is still linked to s
        expect(c.sources.nextSource).to.be.undefined; // ...and nothing else
        await vsync();
        expect(r.targets).to.be.undefined; // r is not bound anymore
    });

    test("FC", () => tracked({}, () => {
        const NULL = () => null;
        expect(<NULL/>).to.eq(null);
        expect(<NULL key={undefined}/>).to.eq(null);
    }));

    test("tree of nodes (implicit signals)", async () => {
        const root = {
            label: "root",
            children: (function createChildren(level) {
                if (level < 3) {
                    return Array(6).fill(null).map((_, index) => ({
                        label: `${level}:${index}`,
                        children: createChildren(level + 1)
                    }));
                }
            })(0)
        };

        function Tree(props) {
            return (
                <div data-label={props.label}>
                    {props.children?.map(({label, children}) => <Tree key={label} label={label} children={children}/>)}
                </div>
            );
        }

        let scope;

        const tree = tracked({}, () => {
            scope = contextScope();
            return <Tree key={0} label={root.label} children={root.children}/> as HTMLDivElement;
        });

        function collect(nodes, map, l = 0) {
            for (const node of nodes) {
                map.set(`[${l}] ${node.getAttribute("data-label")}`, node);
                collect(node.children, map, l + 1);
            }
            return map;
        }

        const before = collect(tree.children, new Map());

        scope.get(0).update({
            label: "root",
            children: (function createChildren(level) {
                if (level < 3) {
                    return Array(3).fill(null).map((_, index) => ({
                        label: `${level}:${index * 2}`,
                        children: createChildren(level + 1)
                    }));
                }
            })(0)
        });

        await vsync();

        const after = collect(tree.children, new Map());

        for (const [label, node] of after) {
            expect(before.get(label)).to.equal(node);
        }
    });

    test("tree of nodes (explicit signals)", async () => {

        const root = signal({
            label: "root",
            children: (function createChildren(level) {
                if (level < 3) {
                    return Array(3).fill(null).map((_, index) => ({
                        label: `${level}:${index}`,
                        children: createChildren(level + 1)
                    }));
                }
            })(0)
        });

        let count = 0;

        function Tree(props: { node: { label: string, children: any[] } }) {
            return (
                <div data-label={props.node.label}>
                    {props.node.children?.map(child => {
                        return <Tree key={child.label} node={child}/>;
                    })}
                </div>
            );
        }

        const tree = <Tree node={root.value}/> as HTMLDivElement;

        expect(tree)
            .to.be.instanceof(HTMLDivElement)
            .to.eq(
            `
<div data-label="root">
    <div data-label="0:0">
        <div data-label="1:0">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:1">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:2">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
    </div>
    <div data-label="0:1">
        <div data-label="1:0">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:1">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:2">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
    </div>
    <div data-label="0:2">
        <div data-label="1:0">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:1">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
        <div data-label="1:2">
            <div data-label="2:0"></div>
            <div data-label="2:1"></div>
            <div data-label="2:2"></div>
        </div>
    </div>
</div>`.replace(/\n\s*/gi, "")
        );

        function collect(nodes, list, l = 0) {
            for (const node of nodes) {
                list.push(node);
                collect(node.childNodes, list, l + 1);
            }
            return list;
        }

        const before = collect(tree.childNodes, []);

        expect(before.length).to.eq(3 + 3 * 3 + 3 * 3 * 3);

        root.set({
            label: "root",
            children: (function createChildren(level) {
                if (level < 2) {
                    return Array(2).fill(null).map((_, index) => ({
                        label: `${level}:${index * 2}`,
                        children: createChildren(level + 1)
                    }));
                }
            })(0)
        });

        await vsync();

        expect(tree)
            .to.be.instanceof(HTMLDivElement)
            .to.eq(
            "<div data-label=\"root\">" +
            "<div data-label=\"0:0\">" +
            "<div data-label=\"1:0\"></div>" +
            "<div data-label=\"1:2\"></div>" +
            "</div>" +
            "<div data-label=\"0:2\">" +
            "<div data-label=\"1:0\"></div>" +
            "<div data-label=\"1:2\"></div>" +
            "</div>" +
            "</div>"
        );

        const after = collect(tree.childNodes, []);

        expect(after.length).to.eq(2 + 2 * 2);

        expect(Object.is(before[0], after[0])).to.be.true;
        expect(Object.is(before[1], after[1])).to.be.true;
        expect(Object.is(before[9], after[2])).to.be.true;
        expect(Object.is(before[9], after[5])).not.to.be.true;
    });

    test("node effects", () => {
        const first = signal([0]);
        const second = signal("s");
        let node = <div>{first.value}{second.value}</div>
        expect(node).to.html("<!--<>-->0<!--</>-->s");
        first.value = [0,1];
        expect(node).to.html("<!--<>-->01<!--</>-->s");
    });

    test("effects disposal", () => { // todo: improve me pleeeease
        const items = signal([1, 2, 3, 4, 5]);
        const node = <div>{items.value.map(value => (
            <div key={value} data-value={() => value}>{() => <p data-txt={()=> value}>{value}</p>}</div>
        ))}</div>;
        expect(node).to.eq(
            '<div>' +
                '<div data-value="1"><p data-txt="1">1</p></div>' +
                '<div data-value="2"><p data-txt="2">2</p></div>' +
                '<div data-value="3"><p data-txt="3">3</p></div>' +
                '<div data-value="4"><p data-txt="4">4</p></div>' +
                '<div data-value="5"><p data-txt="5">5</p></div>' +
            '</div>'
        );
        items.value = [1, 2, 3, 4, 6];
        expect(node).to.eq(
            '<div>' +
                '<div data-value="1"><p data-txt="1">1</p></div>' +
                '<div data-value="2"><p data-txt="2">2</p></div>' +
                '<div data-value="3"><p data-txt="3">3</p></div>' +
                '<div data-value="4"><p data-txt="4">4</p></div>' +
                '<div data-value="6"><p data-txt="6">6</p></div>' +
            '</div>'
        );
    });
});
