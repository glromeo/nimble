const {build} = require("./build.cjs");
const {serve} = require("./serve.cjs");

module.exports.start = async ({debug, port}) => {
    await Promise.all([
        build({debug, watch: true}),
        serve({debug, port})
    ]);
    console.log("ready!");
};
