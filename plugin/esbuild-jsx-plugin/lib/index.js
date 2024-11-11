"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transpiler = exports.jsxPlugin = void 0;
const promises_1 = require("node:fs/promises");
const transpiler_1 = __importDefault(require("./transpiler"));
exports.transpiler = transpiler_1.default;
const jsxPlugin = (options = { minified: true }) => ({
    name: "esbuild-jsx-plugin",
    setup({ onLoad }) {
        onLoad({ filter: /\.[jt]sx$/ }, async ({ path }) => {
            let source = await (0, promises_1.readFile)(path, "utf8");
            let { code, map } = (0, transpiler_1.default)(source, {
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
exports.jsxPlugin = jsxPlugin;
exports.default = exports.jsxPlugin;
//# sourceMappingURL=index.js.map