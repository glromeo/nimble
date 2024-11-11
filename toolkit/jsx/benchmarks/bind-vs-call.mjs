import Benchmark from "benchmark";

const one = {}
const two = "xyz"
const three = 123;

const fn = function (one, two, three) {
    try {
        return one[two] = three + this;
    } catch(ignored) {
        return this === null;
    }
}

const bound = fn.bind(null, one, two);

const lambda = (three) => fn(one, two, three)

new Benchmark.Suite()
    .add('invocation', function () {
        fn(one, two, three);
    })
    .add('stupid bind', function () {
        fn.bind(null, one, two)(three);
    })
    .add('clever bind', function () {
        bound(three);
    })
    .add('stupid lambda', function () {
        fn(one, two, three)
    })
    .add('lambda', function () {
        lambda(three);
    })
    .add('call', function () {
        fn.call(null, one, two, three);
    })
    .add('apply', function () {
        fn.apply(null, [one, two, three]);
    })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('fastest is ' + this.filter('fastest').map('name'));
    })
    .run();
