import {readFile} from "node:fs/promises";
import {join} from "node:path";
import type {Plugin} from "esbuild";
import * as process from "node:process";
import postcss from "postcss";

function loadPlugins() {
    const plugins = new Set([
        require('postcss-simple-vars'),
        require('postcss-import'),
    ]);
    try {
        const config = require(join(process.cwd(), "postcss.config.cjs"));
        config.plugins?.forEach(plugin => plugins.add(plugin));
    } catch (ignored) {
    }
    return [...plugins];
}

const appendInlineSourceMap = (cssContent: string, sourceMap: postcss.SourceMap) => {
    if (sourceMap) {
        const encodedMap = Buffer.from(JSON.stringify(sourceMap), "utf-8").toString('base64');
        const sourceMapComment = `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodedMap} */`;
        return `${cssContent}\n${sourceMapComment}`;
    } else {
        return cssContent;
    }
};

function getWatchFiles(messages:postcss.Message[]) {
    return [...new Set(messages.filter(msg => msg.type === "dependency").map(msg => msg.file))];
}

export const postcssPlugin = (options: any = {loader: "css"}): Plugin => ({
    name: "esbuild-postcss-plugin",
    setup({onLoad}) {
        const plugins = loadPlugins();
        onLoad({filter: /\.css$/}, async ({path}) => {
            let source = await readFile(path, "utf8");
            const {css, messages, map} = await postcss(plugins).process(source, {from: path, to: path});
            return {
                contents: appendInlineSourceMap(css, map),
                loader: options.loader,
                watchFiles: getWatchFiles(messages)
            };
        });
    }
});

export default postcssPlugin;
