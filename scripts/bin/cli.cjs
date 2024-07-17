#! /usr/bin/env node

process.on("SIGINT", () => {
    console.log("terminated by CTRL+C...");
    process.exit(0);
});

const filename = "nimble";

const {init} = require("../lib/init.cjs");
const {clean} = require("../lib/clean.cjs");
const {build} = require("../lib/build.cjs");
const {serve} = require("../lib/serve.cjs");
const {start} = require("../lib/start.cjs");

(async () => {
    const command = process.argv[2];

    const name = command === "init" ? process.argv[3] : undefined;
    const environment = process.argv.some(arg => arg === "--release") ? "production" : "development";
    const force = process.argv.some(arg => arg === "--force");
    const watch = process.argv.some(arg => arg === "--watch");
    const debug = process.argv.some(arg => arg === "--debug");

    let port = undefined // TODO

    switch (command) {
        case "clean": {
            await clean();
            return;
        }
        case "init": {
            await init({name, force});
            return;
        }
        case "build": {
            await build({debug, watch, environment});
            return;
        }
        case "serve": {
            await serve({debug, port});
            return;
        }
        case "start": {
            await clean();
            await start({debug, port});
            return;
        }
        default:
            console.log(`usage: ${filename} <command> [args...]`);
            console.log("");
            console.log("\tinit - initializes the project");
            console.log("\tbuild - builds the \"development\" or \"production\" bundle");
            console.log("\tclean - cleans the build output (not really necessary, build and start do clean)");
            console.log("\tserve - starts local development server");
            console.log("\tstart - shortcut for build and serve");
            return;
    }
})().catch(({errors, warnings, message}) => {
    const command = process.argv[2];
    console.error(`${filename} '${command}' failed`);
    if (!errors) {
        console.error(message);
    }
    process.exit(-1);
});
