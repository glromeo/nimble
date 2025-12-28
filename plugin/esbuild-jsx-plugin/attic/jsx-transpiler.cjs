const {readFile} = require("fs").promises;
const {basename} = require("path");
const {parse} = require("@babel/parser");
const {default: template} = require("@babel/template");
const {default: generate} = require("@babel/generator");
const {default: traverse} = require("@babel/traverse");

const {
    identifier,
    jsxAttribute,
    jsxExpressionContainer,
    jsxIdentifier
} = require("@babel/types");

const createJsxnsAttr = id => ({
    id,
    ast: jsxAttribute(
        jsxIdentifier("jsxns"),
        jsxExpressionContainer(identifier(id))
    ),
    import: template.ast(`import {${id}} from "nimble"`)
});

const xmlnsMap = new Map([
    ["http://www.w3.org/1999/xhtml", createJsxnsAttr("xhtml")],
    ["http://www.w3.org/2000/svg", createJsxnsAttr("svg")]
]);

function toJsxnsAttr(path, attr) {
    let xmlns = attr.value;
    if (xmlns) {
        let ns = xmlnsMap.get(xmlns);
        if (ns) {
            if (!path.scope.hasBinding(ns.id)) {
                let program = path.findParent(path => path.type === "Program");
                let [importPath] = program.unshiftContainer("body", ns.import);
                let [specifier] = importPath.get("specifiers");
                program.scope.registerBinding(ns.ast, specifier);
            }
            return ns.ast;
        }
        return xmlns;
    } else if (attr.expression) {
        return jsxAttribute(jsxIdentifier("jsxns"), attr);
    } else {
        throw new Error("Unexpected xmlns", attr)
    }
}

const xmlnsVisitor = {
    JSXElement(path) {
        let {openingElement} = path.node;
        if (openingElement.name.name === "svg") {
            path.skip();
            return;
        }
        openingElement.attributes.push(this.jsxnsAttr);
    },
    JSXOpeningElement(path) {
        path.skip();
    }
};

const visitor = {
    JSXOpeningElement(path) {
        path.skip();
        for (let attr of path.node.attributes) {
            if (attr.name.name === "xmlns") {
                let jsxnsAttr = toJsxnsAttr(path, attr.value);
                path.parentPath.traverse(xmlnsVisitor, {jsxnsAttr});
                path.node.attributes.push(jsxnsAttr);
                return;
            }
        }
        if (path.node.name.name === "svg") {
            let jsxnsAttr = toJsxnsAttr(path, {value:"http://www.w3.org/2000/svg"});
            path.parentPath.traverse(xmlnsVisitor, {jsxnsAttr});
            path.node.attributes.push(jsxnsAttr);
        }
    },
    JSXAttribute(path) {
        console.log(path.node.name.name);
    }
};

module.exports.visitor = visitor;

/**
 *
 * @param path {string}
 * @param options {{minify: boolean}}
 */
const jsxTranspiler = async (path, {minify}) => {

    let source = await readFile(path, "utf8");

    let ast = parse(source, {
        sourceType: "module",
        plugins: ["jsx"]
    });

    traverse(ast, visitor);

    return generate(
        ast,
        {
            compact: false,
            minified: minify,
            sourceMaps: true,
            sourceFileName: basename(path) + " (orig)"
        },
        source
    );
};

/**
 * JSX Transpiler Plugin
 *
 * @type {import("esbuild").Plugin}
 */
module.exports.plugin = {
    name: "jsx-transpiler-plugin",
    setup: ({onLoad}) => {
        onLoad({filter: /\.jsx$/}, async ({path}) => {
            let {code, map} = await jsxTranspiler(path, {minify: true});
            if (map) {
                let data = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
                code = `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${data}`;
            }
            return {
                contents: code,
                loader: "jsx"
            };
        });
    }
};
