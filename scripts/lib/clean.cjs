const {rm} = require("node:fs/promises");

const rmrf = async pathname => {
    try {
        await rm(pathname, {recursive: true, force: true});
        console.log(`cleaned '${pathname}'`);
    } catch ({message}) {
        throw new Error(`unable to clean '${pathname}': ${message}`);
    }
};

const {
    outdir
} = require("../config.cjs");

module.exports.clean = () => Promise.all([
    rmrf(outdir),
    rmrf(".nyc_output")
]);
