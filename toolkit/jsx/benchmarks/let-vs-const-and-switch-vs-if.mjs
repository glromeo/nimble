import Benchmark from 'benchmark';

let n = 0, acc = 0;

const bigSwitch = {
    "boolean": (value, parent) => {
        acc = parent + value;
    },
    "bigint": (value, parent) => {
        acc = parent + value;
    },
    "number": (value, parent) => {
        acc = parent + value;
    },
    "string": (value, parent) => {
        acc = parent + value;
    },
    "function": (value, parent) => {
        acc = parent + value;
    },
    "object": (value, parent) => {
        acc = parent + value;
    },
    "symbol": (value, parent) => {
        acc = parent + value;
    },
    "undefined": (value, parent) => {
        acc = parent + value;
    }
}

const items = [
    true,
    BigInt(0),
    12.3,
    "xyz",
    () => {
    },
    {},
    null,
    undefined,
    Symbol("x"),
]

function useSwitch(value, parent) {
    switch (typeof value) {
        case "boolean":
            acc = parent + value;
            break;
        case "bigint":
            acc = parent + value;
            break;
        case "number":
            acc = parent + value;
            break;
        case "string":
            acc = parent + value;
            break;
        case "function":
            acc = parent + value;
            break;
        case "object":
            acc = parent + value;
            break;
        case "symbol":
            acc = parent + value;
            break;
        case "undefined":
            acc = parent + value;
            break;
    }
}

function useIf(value, parent) {
    let type = typeof value;
    if (type === "boolean") {
        acc = parent + value;
    } else if (type === "bigint") {
        acc = parent + value;
    } else if (type === "number") {
        acc = parent + value;
    } else if (type === "string") {
        acc = parent + value;
    } else if (type === "function") {
        acc = parent + value;
    } else if (type === "object") {
        acc = parent + value;
    } else if (type === "symbol") {
        acc = parent + value;
    } else if (type === "undefined") {
        acc = parent + value;
    }
}

new Benchmark.Suite()
    .add('let', function () {
        let x = 10;
    })
    .add('const', function () {
        const x = 10;
    })
    .add('switch', function () {
        const value = typeof items[n++ % 9];
        useSwitch(value, "switch")
    })
    .add('if', function () {
        const value = typeof items[n++ % 9];
        useIf(value, "switch")
    })
    .add('object', function () {
        const value = typeof items[n++ % 9];
        bigSwitch[value](value, "object")
    })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('fastest is ' + this.filter('fastest').map('name'));
    })
    .run();