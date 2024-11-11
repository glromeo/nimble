import {batch, computed, effect, RenderEffect, Signal, signal, untracked} from "./signals.mjs";
import {expect, use} from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);

describe("render effects", () => {

    it("swapping computed function", () => {
        const fn = () => 1;
        const s = computed(fn);
        const stub = sinon.stub();
        const r = new RenderEffect(s, stub)

        expect(c.get()).to.equal(3);
    });
});
