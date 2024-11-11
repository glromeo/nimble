import Benchmark from "benchmark";

const sym = "_i_"; // Symbol();
const nodes = Array.from({length: 100}, (index) => index % 2 ? {_i_:{index}} : {[sym]: {}});

const weakmap = new WeakMap(nodes.filter((_,i)=>i%2).map((n,index) => [n, {index}]));
const map = new Map(nodes.filter((_,i)=>i%2).map((n,index) => [n, {index}]));

let c = 0;

new Benchmark.Suite()
    .add('? symbol', function () {
        for (const node of nodes) {
            if (node[sym] !== undefined) {
                c++;
            }
        }
    })
    .add('? field', function () {
        for (const node of nodes) {
            if (node._i_ !== undefined) {
                c++;
            }
        }
    })
    .add('? symbol in', function () {
        for (const node of nodes) {
            if (sym in node) {
                c++;
            }
        }
    })
    .add('? field in', function () {
        for (const node of nodes) {
            if ("_i_" in node) {
                c++;
            }
        }
    })
    .add('weakmap field', function () {
        for (const node of nodes) {
            if (weakmap.has(node)) {
                c++;
            }
        }
    })
    .add('map field', function () {
        for (const node of nodes) {
            if (map.has(node)) {
                c++;
            }
        }
    })
    .add('symbol', function () {
        for (let i = 0; i < 5; i++) {
            for (const node of nodes) {
                let opts = node[sym];
                if (opts === undefined) {
                    node[sym] = {}
                }
            }
        }
    })
    .add('weakmap', function () {
        for (let i = 0; i < 5; i++) {
            for (const node of nodes) {
                let opts = weakmap.get(node);
                if (opts === undefined) {
                    weakmap.set(node, {})
                }
            }
        }
    })
    .add('map', function () {
        for (let i = 0; i < 5; i++) {
            for (const node of nodes) {
                let opts = map.get(node);
                if (opts === undefined) {
                    map.set(node, {})
                }
            }
        }
    })
    .add('object', function () {
        for (let i = 0; i < 5; i++) {
            for (const node of nodes) {
                let opts = node._i_;
                if (opts === undefined) {
                    node._i_ = {}
                }
            }
        }
    })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('fastest is ' + this.filter('fastest').map('name'));
    })
    .run();
