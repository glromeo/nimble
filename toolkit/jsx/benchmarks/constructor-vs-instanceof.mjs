import Benchmark from "benchmark";

import {computed, Computed, Signal, signal} from "../../signals/signals.mjs";

const s = signal(0);
const c = computed(() => s.value);
const o = {};
const d = Object.create(Object.create(Object.create(Object.create({}), {a: {value: 1}}), {b: {value: 2}}), {c: {value: 3}});
const e = Object.create(Object.create(Object.create(Object.create({})), {b: {value: 2}}), {c: {value: 3}});
const f = Object.create(Object.create(Object.create(Object.create({}))),{c: {value: 3}});
const g = Object.create(Object.create(Object.create(Object.create({}))));
const set = [s, c, o, d, e, f, g];

new Benchmark.Suite()
    .add("constructor", function () {
        for (const x of set) {
            if (x.constructor === Computed || x.constructor === Signal) {
                x.peek();
            }
        }
    })
    .add("peek", function () {
        for (const x of set) {
            if (x.peek) {
                x.peek();
            }
        }
    })
    .add("peek in", function () {
        for (const x of set) {
            if ("peek" in x) {
                x.peek();
            }
        }
    })
    .add("typeof peek", function () {
        for (const x of set) {
            if (typeof x.peek === "function") {
                x.peek();
            }
        }
    })
    .add("instanceof", function () {
        for (const x of set) {
            if (x instanceof Signal) {
                x.peek();
            }
        }
    })
    .add("constructor name", function () {
        for (const x of set) {
            let name = x.constructor.name;
            if (name === "Computed" || name === "Signal") {
                x.peek();
            }
        }
    })
    .on("cycle", function (event) {
        console.log(String(event.target));
    })
    .on("complete", function () {
        console.log("fastest is " + this.filter("fastest").map("name"));
    })
    .run();
