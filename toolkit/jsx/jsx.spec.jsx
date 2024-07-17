import {expect, suite, test} from "@nimble/testing";
import {computed, signal} from "../signals/signals.mjs";

const specs = suite("JSX spec", (before, after) => {

    before.each(() => {
    });

    test("fragments", () => {

        expect(<></>).html.eq("");
        expect(<><a>anchor</a></>).html.eq("<a>anchor</a>");
        expect(<><a>anchor</a><p>paragraph</p></>).html.eq("<a>anchor</a><p>paragraph</p>");
        expect(<> text before {1} {"string after"} </>).html.eq(` text before 1 string after `);

        expect(<>{""}</>).html.eq("");
        expect(<>Hello World</>).html.eq("Hello World");
        expect(<>{"Hello World"}</>).html.eq("Hello World");
        expect(<>{0}</>).html.eq("0"); // To make sure 0 is not treated as falsy
        expect(<>{1}</>).html.eq("1");
        expect(<>{BigInt(1234567890)}</>).html.eq("1234567890");
        expect(<>{1_000_000_000.000_000_9}</>).html.eq("1000000000.000001");

        expect(<>{parent => document.createComment(parent.constructor.name)}</>).html.eq("<!--DocumentFragment-->");

        expect(<>{document.createTextNode("text")}</>).html.eq(`text`);
        expect(<>{signal(document.createTextNode("text"))}</>).html.eq(`text`);
        expect(<>{[]}</>).html.eq("<slot></slot>"); // iterables result in slots containing the items
        expect(<>{{tag: "div", attrs: {name: "alpha"}, children: "Hello"}}</>).html.eq(`<div name="alpha">Hello</div>`);

        expect(<>{true}</>).html.eq(""); // To make sure true is ignored
        expect(<>{false}</>).html.eq(""); // To make sure false is ignored
        expect(<>{Symbol()}</>).html.eq("");
        expect(<>{undefined}</>).html.eq("");
        expect(<>{null}</>).html.eq("");
        expect(<>{{}}</>).html.eq("");
    });

    test("elements", () => {
        expect(<div>Hello World</div>).html.eq(`<div>Hello World</div>`);
        expect(<div class="message">Hello World</div>).html.eq(`<div class="message">Hello World</div>`);
        expect(
            <div class={{alpha: true, beta: false}}>Hello World</div>
        ).html.eq(`<div class="alpha">Hello World</div>`);
        expect(
            <div class={["alpha", "beta", "gamma"]}>Hello World</div>
        ).html.eq(`<div class="alpha beta gamma">Hello World</div>`);
        const beta = signal("beta");
        expect(
            <div class={computed(() => `alpha ${beta.get()} gamma`)}>Hello World</div>
        ).html.eq(`<div class="alpha beta gamma">Hello World</div>`);
    });

    test("simple atoms", () => {
        expect(<>{signal("Hello World")}</>).html.eq("Hello World");
        expect(<>{signal(BigInt(1234567890))}</>).html.eq("1234567890");
        expect(<>{signal(0)}</>).html.eq("0");
        expect(<>{signal(1)}</>).html.eq("1");
        expect(<>{signal(1_000_000_000.000_000_9)}</>).html.eq("1000000000.000001");
        expect(<>{signal(true)}</>).html.eq("");
        expect(<>{signal(false)}</>).html.eq("");
        expect(<>{signal(Symbol())}</>).html.eq("");
    });

    const nextFrame = async () => await new Promise(resolve => requestAnimationFrame(resolve));

    test("signal updates", async () => {
        let a = signal("Hello World");
        let node = <div>{a}</div>;
        expect(node).html.eq("<div>Hello World</div>");
        a.set(BigInt(1234567890));
        expect(node).html.eq("<div>Hello World</div>");
        await nextFrame();
        expect(node).html.eq("<div>1234567890</div>");
        a.set(0);
        await nextFrame();
        expect(node).html.eq("<div>0</div>");
        a.set(1);
        await nextFrame();
        expect(node).html.eq("<div>1</div>");
        a.set(1_000_000_000.000_000_9);
        await nextFrame();
        expect(node).html.eq("<div>1000000000.000001</div>");
        a.set(true);
        await nextFrame();
        expect(node).html.eq("<div></div>");
        a.set(false);
        await nextFrame();
        expect(node).html.eq("<div></div>");
        a.set(Symbol());
        await nextFrame();
        expect(node).html.eq("<div></div>");
        a.set(() => "Hello World");
        await nextFrame();
        expect(node).html.eq("<div>Hello World</div>");
        a.set(() => "Hello World");
        await nextFrame();
        expect(node).html.eq("<div>Hello World</div>");
    });

    test("text content (atoms changing)", async () => {
        let items = signal([]);
        let node = <div>{items}</div>;
        expect(node).html.eq("<div><!--Array--></div>");
        items.set(["Hello", "World"]);
        await nextFrame();
        expect(node).html.eq("<div><!--Array-->HelloWorld</div>");
    });

});

specs.run();
