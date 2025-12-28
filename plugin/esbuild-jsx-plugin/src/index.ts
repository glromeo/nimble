import {readFile} from "node:fs/promises";

import type {Plugin} from "esbuild";
import transpiler from "./transpiler";

export const jsxPlugin = (options: any = {minified: true}): Plugin => ({
    name: "esbuild-jsx-plugin",
    setup({onLoad}) {
        onLoad({filter: /\.[jt]sx$/}, async ({path}) => {
            const source = await readFile(path, "utf8");
            const {code, map} = transpiler(source, {
                ...options,
                sourceMaps: true,
                sourceFileName: path
            });
            const data = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
            const contents = `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${data}`;
            return {
                contents,
                loader: path.at(-3) === "j" ? "js" : "ts"
            };
        });
    }
});

export default jsxPlugin;
export { transpiler };
