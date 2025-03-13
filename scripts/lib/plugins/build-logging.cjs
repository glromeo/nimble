const {name} = require("../../config.cjs");

/**
 * Build Logging Plugin
 *
 * @type {import("esbuild").Plugin}
 */
module.exports.plugin = {
    name: "build-logging",
    setup: build => {
        const BUILD_MSG = `...done in`;
        build.onStart(() => {
            console.time(BUILD_MSG);
            console.log(`re-building '${name}'...`);
        });
        build.onEnd(({errors, warnings}) => {
            console.timeEnd(BUILD_MSG);
            console.log(`with ${errors.length} errors and ${warnings.length} warnings`);
        });
    }
};
