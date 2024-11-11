"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const visitor_1 = require("./visitor");
const traverse = traverse_1.default.default ?? traverse_1.default;
const generate = generator_1.default.default ?? generator_1.default;
exports.default = (source, { compact = false, minified = false, sourceMaps = true, sourceFileName, defaultExt } = {}) => {
    const ast = (0, parser_1.parse)(source, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    });
    traverse(ast, visitor_1.visitor, undefined, { defaultExt });
    return generate(ast, {
        compact,
        minified,
        sourceMaps,
        sourceFileName
    }, source);
};
//# sourceMappingURL=transpiler.js.map