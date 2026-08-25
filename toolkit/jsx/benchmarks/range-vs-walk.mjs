/**
 * NodeGroup mutates a *range* of sibling nodes delimited by its groupStart/groupEnd comments.
 * Both of its range operations can be written two ways:
 *
 *   replaceChildren -> walk the siblings and removeChild each, or Range.deleteContents()
 *   remove          -> walk the siblings and appendChild each, or Range.extractContents()
 *
 * The walk is a plain loop; the Range hands the whole span to the engine in one call, which looks
 * like it should win on long spans. It does not, and the reason is not throughput.
 *
 * A Range stays *live* until it is garbage collected: the engine keeps every surviving Range
 * attached to the document and fixes up its boundary points on every mutation that could move
 * them. Nothing detaches a Range early — Range.detach() has been a no-op since DOM4 — so a Range
 * created per call piles up between collections, and every DOM mutation in the meantime pays for
 * all of them. Part A measures that tax; it is severe enough to settle the question on its own.
 * Part B compares raw throughput anyway, for completeness.
 *
 * Unlike the other benchmarks in this folder this one cannot run under node: it needs a real DOM,
 * and a shimmed one would answer the wrong question. Serve the repo and open range-vs-walk.html:
 *
 *     python -m http.server 4321
 *     # then open http://localhost:4321/toolkit/jsx/benchmarks/range-vs-walk.html
 *
 * Part B times a whole fill/clear (or mount/detach) cycle, because the operation is destructive and
 * needs its input rebuilt every time. The first half of each cycle is identical between the two
 * strategies, so the difference in cycle time is the difference between the strategies.
 */

import {NodeGroup} from "../jsx.mjs";

const LIVE_RANGES = [0, 100, 1_000, 5_000];
const SIZES = [1, 16, 256];
const SAMPLES = 7;

// super.appendChild as NodeGroup.remove() calls it, bypassing the group's own override
const nativeAppendChild = Node.prototype.appendChild;

//region strategies

/** mirrors NodeGroup.replaceChildren */
function clearWalk(group) {
    const {host, groupStart, groupEnd} = group;
    let node = groupStart.nextSibling;
    while (node !== groupEnd) {
        const nextSibling = node.nextSibling;
        host.removeChild(node);
        node = nextSibling;
    }
}

function clearRange(group) {
    const range = new Range();
    range.setStartAfter(group.groupStart);
    range.setEndBefore(group.groupEnd);
    range.deleteContents();
}

/** mirrors NodeGroup.remove */
function detachWalk(group) {
    let {groupStart: node, groupEnd} = group;
    while (node !== groupEnd) {
        const nextSibling = node.nextSibling;
        nativeAppendChild.call(group, node);
        node = nextSibling;
    }
    nativeAppendChild.call(group, groupEnd);
}

function detachRange(group) {
    const range = new Range();
    range.setStartBefore(group.groupStart);
    range.setEndAfter(group.groupEnd);
    nativeAppendChild.call(group, range.extractContents());
}

//endregion

//region fixtures

const fill = ({group, nodes}) => group.append(...nodes);
const mount = ({host, group}) => host.appendChild(group);

const OPERATIONS = {
    clear: {
        strategies: {walk: clearWalk, range: clearRange},
        // each cycle starts with the group mounted and empty
        prepare: () => undefined,
        before: fill
    },
    detach: {
        strategies: {walk: detachWalk, range: detachRange},
        // each cycle starts with the group detached, holding its children
        prepare: fixture => {
            fill(fixture);
            detachWalk(fixture.group);
        },
        before: mount
    }
};

function subject(operation, size) {
    const host = document.body.appendChild(document.createElement("div"));
    const group = new NodeGroup(undefined);
    host.appendChild(group);

    const nodes = [];
    for (let i = 0; i < size; i++) nodes.push(new Text(String(i)));

    const fixture = {host, group, nodes};
    OPERATIONS[operation].prepare(fixture);
    return fixture;
}

//endregion

//region harness

function time(unit, iterations) {
    const started = performance.now();
    for (let i = 0; i < iterations; i++) unit();
    return performance.now() - started;
}

/**
 * Fixed iteration counts, and the median of the samples rather than the mean: a GC pause landing
 * in one sample should not move the answer.
 */
function measure(unit, iterations) {
    time(unit, Math.min(iterations, 50));

    const means = [];
    for (let sample = 0; sample < SAMPLES; sample++) {
        means.push(time(unit, iterations) / iterations);
    }
    means.sort((a, b) => a - b);
    return {
        median: means[means.length >> 1],
        min: means[0],
        max: means[means.length - 1]
    };
}

const micros = ms => `${(ms * 1000).toFixed(2)}µs`;

const report = (name, {median, min, max}) =>
    `    ${name.padEnd(14)} ${micros(median).padStart(10)} per cycle ` +
    `(${median > 0 ? Math.round(1000 / median).toLocaleString("en-US") : "?"} ops/sec, ` +
    `${micros(min)}..${micros(max)})`;

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

//endregion

/**
 * Both strategies have to leave the DOM in the same state, otherwise the comparison is meaningless.
 */
function verify(operation, size) {
    const {strategies, before} = OPERATIONS[operation];
    let expected;
    for (const [name, strategy] of Object.entries(strategies)) {
        const fixture = subject(operation, size);
        before(fixture);
        strategy(fixture.group);
        const outcome = `host:${fixture.host.innerHTML} group:${fixture.group.childNodes.length}`;
        fixture.host.remove();
        if (expected === undefined) {
            expected = outcome;
        } else if (outcome !== expected) {
            throw new Error(`${operation} x${size}: ${name} left ${outcome}, expected ${expected}`);
        }
    }
}

/**
 * Part A: what a population of live Ranges costs every *other* mutation on the same container.
 */
async function rangeTax(log) {
    log("B. cost of one appendChild/removeChild cycle while N Ranges are live in the document\n");

    // A fresh iframe, because the tax is per-document and part A has already leaked into this one.
    // Nothing here needs NodeGroup, so borrowing the frame's document costs nothing.
    const frame = document.body.appendChild(document.createElement("iframe"));
    const {contentDocument: doc, contentWindow: view} = frame;

    const host = doc.body.appendChild(doc.createElement("div"));
    const nodes = Array.from({length: 16}, (_, i) => doc.createTextNode(String(i)));
    const churn = () => {
        for (const node of nodes) host.appendChild(node);
        for (const node of nodes) host.removeChild(node);
    };

    const live = [];
    let baseline;
    for (const target of LIVE_RANGES) {
        while (live.length < target) {
            const range = new view.Range();
            range.setStart(host, 0);
            range.setEnd(host, 0);
            live.push(range);
        }
        const result = measure(churn, 100);
        baseline ??= result.median;
        log(report(`${target} live`, result) +
            `  ->  ${(result.median / baseline).toFixed(1)}x baseline`);
        await tick();
    }

    live.length = 0;
    frame.remove();
    log("\n    Nothing in the source has to hold these Ranges for this to bite: they survive until\n" +
        "    the next collection, and every mutation in between pays for all of them.\n");
}

/**
 * Part A: raw throughput. This runs first, on a document with no Ranges in it yet, and walk is
 * measured before range so that range's leakage cannot contaminate it. The iteration budgets are
 * kept deliberately small for the same reason. Range's own figures still include whatever tax its
 * leaked Ranges accrued while it was being measured, because there is no way to use a Range and
 * avoid that — which is what part B is about.
 */
async function throughput(log) {
    log("A. throughput per fill/clear and mount/detach cycle (walk first; range carries its own leakage)\n");
    log("    Absolute figures drift upward down this table as leaked Ranges accumulate, and walk is\n" +
        "    always measured before range in a row, so the bias runs against range. Compare within a\n" +
        "    row, not between rows.\n");

    for (const operation of Object.keys(OPERATIONS)) {
        const {strategies, before} = OPERATIONS[operation];

        for (const size of SIZES) {
            verify(operation, size);
            log(`  ${operation}, ${size} text ${size === 1 ? "node" : "nodes"}`);

            const results = {};
            for (const [name, strategy] of Object.entries(strategies)) {
                const fixture = subject(operation, size);
                results[name] = measure(() => {
                    before(fixture);
                    strategy(fixture.group);
                }, Math.min(200, Math.max(20, Math.round(2_000 / size))));
                fixture.host.remove();
                log(report(name, results[name]));
                await tick();
            }

            const [winner, loser] = results.walk.median < results.range.median
                ? ["walk", "range"]
                : ["range", "walk"];
            const ratio = results[winner].median > 0
                ? ` (${(results[loser].median / results[winner].median).toFixed(2)}x)`
                : "";
            log(`    -> ${winner} by ${micros(results[loser].median - results[winner].median)}${ratio}\n`);
        }
    }
}

export async function benchmark(log = console.log) {
    // throughput first: part B leaves thousands of live Ranges behind, and the tax is per-document
    await throughput(log);
    await rangeTax(log);
}
