const { readFile } = require("fs").promises;
const {parse} = require("papaparse");

/**
 * CSV Files Plugin
 *
 * @type {import("esbuild").Plugin}
 */
module.exports.plugin = {
    name: "csv-files",
    setup({onLoad}) {
        onLoad({ filter: /\.csv$/ }, async ({path}) => {
            const text = await readFile(path, "utf8");
            const {data} = parse(text);
            const contents = `module.exports = ${JSON.stringify(data, null, "  ")};`;
            return {contents, loader: "js"}
        })
    }
}
