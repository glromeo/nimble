import Benchmark from "benchmark";

const obj = {}

new Benchmark.Suite()
    .add('[]', function () {
        const array = [];
        for (let i = 0; i < 1000; i++) {
            array[i] = null;
        }
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++) for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('Array', function () {
        const array = Array(1000);
        for (let i = 0; i < 1000; i++) {
            array[i] = null;
        }
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('[...Array]', function () {
        const array = [...Array(1000)];
        for (let i = 0; i < 1000; i++) {
            array[i] = null;
        }
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('new Array', function () {
        const array = new Array(1000);
        for (let i = 0; i < 1000; i++) {
            array[i] = null;
        }
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('[...new Array]', function () {
        const array = [...new Array(1000)];
        for (let i = 0; i < 1000; i++) {
            array[i] = null;
        }
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('Array.fill', function () {
        const array = new Array(1000).fill(undefined);
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .add('Array.from', function () {
        const array = Array.from({length: 1000});
        for (let i = 1; i < 1000; i+=2) array[i] = obj
        for(let j=0; j<10; j++)  for (let i = 1; i < 1000; i+=2) {
            array[i] = array[i-1];
        }
    })
    .on('cycle', function (event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('fastest is ' + this.filter('fastest').map('name'));
    })
    .run();
