"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postcssPlugin = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const process = __importStar(require("node:process"));
const postcss_1 = __importDefault(require("postcss"));
function loadPlugins() {
    const plugins = new Set([
        require('postcss-simple-vars'),
        require('postcss-import'),
    ]);
    try {
        const config = require((0, node_path_1.join)(process.cwd(), "postcss.config.cjs"));
        config.plugins?.forEach(plugin => plugins.add(plugin));
    }
    catch (ignored) {
    }
    return [...plugins];
}
const appendInlineSourceMap = (cssContent, sourceMap) => {
    if (sourceMap) {
        const encodedMap = Buffer.from(JSON.stringify(sourceMap), "utf-8").toString('base64');
        const sourceMapComment = `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodedMap} */`;
        return `${cssContent}\n${sourceMapComment}`;
    }
    else {
        return cssContent;
    }
};
function getWatchFiles(messages) {
    return [...new Set(messages.filter(msg => msg.type === "dependency").map(msg => msg.file))];
}
const postcssPlugin = (options = { loader: "css" }) => ({
    name: "esbuild-postcss-plugin",
    setup({ onLoad }) {
        const plugins = loadPlugins();
        onLoad({ filter: /\.css$/ }, async ({ path }) => {
            let source = await (0, promises_1.readFile)(path, "utf8");
            const { css, messages, map } = await (0, postcss_1.default)(plugins).process(source, { from: path, to: path });
            return {
                contents: appendInlineSourceMap(css, map),
                loader: options.loader,
                watchFiles: getWatchFiles(messages)
            };
        });
    }
});
exports.postcssPlugin = postcssPlugin;
exports.default = exports.postcssPlugin;
//# sourceMappingURL=index.js.map