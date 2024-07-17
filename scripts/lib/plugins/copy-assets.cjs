const {resolve, relative, dirname} = require("path");
const {mkdirSync} = require("fs");
const {writeFile, readFile} = require("fs/promises");
const chokidar = require("chokidar");

const squirrelly = require("squirrelly");

const config = require("../../config.cjs");

/**
 *
 * @type {import("esbuild").Plugin}
 */
module.exports.plugin = {
    name: "copy-assets",
    setup: ({initialOptions: {outdir}, onDispose}) => {
        try {
            mkdirSync(outdir, {recursive: true});
        } catch (ignored) {
        }

        const basedir = resolve("public");

        const writeAsset = async (outfile, contents) => {
            if (outfile.endsWith(".html")) {
                contents = squirrelly.render(contents, config);
            }
            try {
                await writeFile(outfile, contents);
            } catch (e) {
                console.warn("error writing to", outfile, e);
            }
        };

        const copyAsset = async path => {
            console.log("copy-asset", path);
            try {
                const contents = await readFile(path, "utf8");
                const dir = dirname(path);
                const local = dir === "." ? path : relative(basedir, path);
                await writeAsset(resolve(outdir, local), contents);
            } catch (e) {
                console.warn("error copying asset", path, e);
            }
        };

        const watcher = chokidar.watch([
            "public",
            "package.json",
            "LICENCE"
        ], {
            cwd: process.cwd(),
            disableGlobbing: true,
            followSymlinks: true,
            persistent: true
        });
        watcher.on("add", copyAsset);
        watcher.on("change", copyAsset);

        onDispose(() => watcher.close());
    }
};
