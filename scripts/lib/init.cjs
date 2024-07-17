const {resolve} = require("node:path");
const {existsSync} = require("node:fs")
const {mkdir, writeFile, readFile} = require("node:fs/promises");
const squirrelly = require("squirrelly");

module.exports.init = async ({name, force}) => {

    const basedir = resolve(__dirname, "template");

    const context = {
        name: name ?? "nimble-app",
        title: toCamelCase(name) ?? "Application",
        node_modules: existsSync("./node_modules") ? "../node_modules" : "./node_modules"
    };

    const copyAsset = async (path, it) => {
        console.log(">", path);
        try {
            const source = await readFile(resolve(basedir, path), "utf8");
            const target = it ? squirrelly.render(source, it) : source;
            await writeFile(path, target);
        } catch (e) {
            console.warn("error copying asset", path, e);
        }
    };

    const maybeOverride = e => {
        if (force && e.code === 'EEXIST') {
            console.log("found:", e.path, "overriding contents...")
            return
        }
        throw e
    }

    await mkdir(context.name).catch(maybeOverride);
    process.chdir(context.name);

    await copyAsset("package.json", context);
    await copyAsset("tsconfig.json", context);
    await mkdir("src").catch(maybeOverride);
    await copyAsset("src/index.jsx");
    await copyAsset("src/app.jsx");
    await mkdir("static").catch(maybeOverride);
    await copyAsset("static/favicon.svg");
    await copyAsset("static/index.html", context);
    await copyAsset("static/stories.html", context);
    await copyAsset("static/story.html", context);
    await copyAsset("static/styles.css", context);
    await copyAsset("static/pace.js");

    console.log("done, happy coding!");
};

function toCamelCase(text) {
    return text[0].toUpperCase() + text.slice(1).replace(/-./g, m => ' '+ m[1].toUpperCase());
}
