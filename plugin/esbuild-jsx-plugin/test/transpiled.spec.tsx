import {expect, suite, test} from "@nimble/testing/index.mjs";

import sinon from "sinon";

import "nimble/jsx-runtime";

suite("transpiled tests", ({before, after}) => {

    before.each(() => {
    });

    after.each(() => {
        sinon.restore();
    });

    test("fragment", () => {
        expect(<></>).to.be.instanceof(DocumentFragment);
    });
});
