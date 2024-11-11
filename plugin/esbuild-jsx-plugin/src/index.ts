import {readFile} from "node:fs/promises";

import type {Plugin} from "esbuild";
import transpiler from "./transpiler";

export const jsxPlugin = (options: any = {minified: true}): Plugin => ({
    name: "esbuild-jsx-plugin",
    setup({onLoad}) {
        onLoad({filter: /\.[jt]sx$/}, async ({path}) => {
            let source = await readFile(path, "utf8");
            let {code, map} = transpiler(source, {
                ...options,
                sourceFileName: path
            });
            let data = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
            let contents = `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${data}`;
            return {
                contents,
                loader: path.at(-3) === "j" ? "js" : "ts"
            };
        });
    }
});

export default jsxPlugin;
export { transpiler };
