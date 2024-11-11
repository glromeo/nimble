import Benchmark from 'benchmark';

const ref = {
    Alpha: "Αα",
    Beta: "Ββ",
    Gamma: "Γγ",
    Delta: "Δδ",
    Epsilon: "Εε",
    Zeta: "Ζζ",
    Eta: "Ηη",
    Theta	: "Θθ",
    Iota: "Ιι",
    Kappa: "Κκ",
    Lambda: "Λλ",
    Mu: "Μμ",
    Nu: "Νν",
    Xi: "Ξξ",
    Omicron: "Οο",
    Pi: "Ππ",
    Rho: "Ρρ",
    Sigma: "Σσ,ς",
    Tau: "Ττ",
    Upsilon: "Υυ",
    Phi	: "Φφ",
    Chi	: "Χχ",
    Psi	: "Ψψ",
    Ome: "Ωω"
}

new Benchmark.Suite()
    .add('entries', function () {
        let o = {};
        let q = ref;
        for (const [key, value] of Object.entries(q)) {
            try {
                o[key] = value;
            } catch (e) {
                o[key] = null;
            }
        }
    })
    .add('entries descs', function () {
        let o = {};
        let q = Object.getOwnPropertyDescriptors(ref);
        for (const [key, value] of Object.entries(q)) {
            try {
                o[key] = value;
            } catch (e) {
                o[key] = null;
            }
        }
    })
    .add('keys', function () {
        let o = {};
        let q = ref;
        for (const key of Object.keys(q)) {
            try {
                o[key] = q[key];
            } catch (e) {
                o[key] = null;
            }
        }
    })
    .add('key descs', function () {
        let o = {};
        let q = ref;
        for (const key of Object.keys(q)) {
            try {
                o[key] = Object.getOwnPropertyDescriptor(q, key);
            } catch (e) {
                o[key] = null;
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
