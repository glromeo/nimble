"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
exports.traverse = traverse;
exports.generate = generate;
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const visitor_1 = require("./visitor");
const babelTraverse = traverse_1.default.default ?? traverse_1.default;
const babelGenerate = generator_1.default.default ?? generator_1.default;
exports.default = (source, options = {}) => {
    return generate(traverse(parse(source)), options, source);
};
function parse(source) {
    return (0, parser_1.parse)(source, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    });
}
function traverse(ast, opt) {
    babelTraverse(ast, opt ? { ...opt, ...visitor_1.visitor } : visitor_1.visitor, undefined, {});
    return ast;
}
function generate(ast, options, source) {
    return babelGenerate(ast, options, source);
}
//# sourceMappingURL=transpiler.js.map