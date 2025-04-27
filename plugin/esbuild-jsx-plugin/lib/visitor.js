"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitor = void 0;
const types_1 = require("@babel/types");
const template_1 = __importDefault(require("@babel/template"));
const NIMBLE_MODULE = "@nimble/toolkit/index.mjs";
const JSX_RUNTIME_MODULE = "@nimble/toolkit/jsx-runtime.js";
const template = template_1.default.ast ? template_1.default : template_1.default.default;
function importIdentifier(root, name, module) {
    let ast;
    for (const node of root.node.body) {
        if (node.type !== "ImportDeclaration")
            break;
        if (node.source.value === module) {
            ast = node;
            break;
        }
    }
    let nameIdentifier = (0, types_1.identifier)(name);
    if (ast) {
        ast.specifiers = [(0, types_1.importSpecifier)(nameIdentifier, nameIdentifier), ...ast.specifiers];
    }
    else {
        root.unshiftContainer("body", template.ast `import {${name}} from "${module}";`);
    }
    Object.defineProperty(this, name, { value: nameIdentifier });
    return this[name];
}
function getterMethod(prop, expression) {
    return (0, types_1.objectMethod)("get", prop, [], (0, types_1.blockStatement)([(0, types_1.returnStatement)(expression)]), prop.type === "StringLiteral");
}
const CHILDREN = (0, types_1.identifier)("children");
function isHandler(id) {
    const name = id.name ?? id.value;
    return name[0] === "o" && name[1] === "n";
}
function isDirective(id) {
    const name = id.name ?? id.value;
    return name[2] === ":" && name[0] === "i" && name[1] === "s";
}
function tagIdentifier(tag) {
    if (tag.type === "JSXIdentifier") {
        const cc = tag.name.charCodeAt(0);
        return cc >= 65 && cc <= 90 && (0, types_1.isValidIdentifier)(tag.name)
            ? (0, types_1.identifier)(tag.name)
            : (0, types_1.stringLiteral)(tag.name);
    }
    else {
        return parseJSXMemberExpression(tag);
    }
}
function parseJSXMemberExpression({ object, property }) {
    return (0, types_1.memberExpression)(object.object
        ? parseJSXMemberExpression(object)
        : (0, types_1.identifier)(object.name), (0, types_1.identifier)(property.name));
}
function jsxExpression(callee, tag, props) {
    return (0, types_1.callExpression)(callee, [tag, (0, types_1.objectExpression)(props)]);
}
function reactiveProperty(useArrow, key, expression) {
    if (useArrow) {
        return (0, types_1.objectProperty)(key, (0, types_1.arrowFunctionExpression)([], expression));
    }
    else {
        return getterMethod(key, expression);
    }
}
const nodeVisitor = {
    exit(path, { imports }) {
        const props = [];
        let transpiled;
        let isIntrinsic = true;
        if (path.node.type === "JSXElement") {
            const { name: tag, attributes } = path.node.openingElement;
            if (tag.type === "JSXNamespacedName") {
                const { namespace, name } = tag;
                const callee = imports[namespace.name] ?? (0, types_1.identifier)(namespace.name);
                transpiled = jsxExpression(callee, (0, types_1.stringLiteral)(name.name), props);
            }
            else {
                const tagName = tagIdentifier(tag);
                transpiled = jsxExpression(imports.jsx, tagName, props);
                isIntrinsic = (0, types_1.isStringLiteral)(tagName);
            }
            for (const attr of attributes) {
                if (attr.type === "JSXSpreadAttribute") {
                    props.push((0, types_1.spreadElement)(attr.argument));
                }
                else {
                    let key;
                    let { name, value } = attr;
                    if (name.type === "JSXNamespacedName") {
                        key = (0, types_1.stringLiteral)(`${name.namespace.name}:${name.name.name}`);
                    }
                    else {
                        name = name.name;
                        if (name === "key") {
                            transpiled.arguments.push(attr.value?.expression ?? attr.value);
                            continue;
                        }
                        key = name === "class" || name === "style" || (0, types_1.isValidIdentifier)(name)
                            ? (0, types_1.identifier)(name)
                            : (0, types_1.stringLiteral)(name);
                    }
                    if (value?.type === "JSXExpressionContainer") {
                        const expression = value.expression;
                        if (value.isReactive && !isHandler(key)) {
                            props.push(reactiveProperty(isIntrinsic && !isDirective(key), key, expression));
                        }
                        else {
                            props.push((0, types_1.objectProperty)(key, expression));
                        }
                    }
                    else {
                        props.push((0, types_1.objectProperty)(key, value));
                    }
                }
            }
        }
        else {
            transpiled = jsxExpression(imports.jsx, imports.Fragment, props);
        }
        const children = [];
        const reactive = [];
        for (const child of path.node.children) {
            const { type, isReactive } = child;
            if (isReactive) {
                reactive.push(children.length);
            }
            if (type === "CallExpression") {
                children.push(child);
            }
            else if (type === "JSXText") {
                const lines = child.value.split("\n");
                let value = lines[0];
                for (let l = 1; l < lines.length; l++) {
                    value += lines[l].trim();
                }
                if (value) {
                    children.push((0, types_1.stringLiteral)(value));
                }
            }
            else if (type === "JSXExpressionContainer") {
                if (child.expression.type !== "JSXEmptyExpression") {
                    children.push(child.expression);
                }
            }
            else if (type === "JSXSpreadChild") {
                children.push((0, types_1.spreadElement)(child.expression));
            }
        }
        if (children.length) {
            const isSpread = children.some(({ type }) => type === "SpreadElement");
            const value = children.length > 1 || isSpread
                ? (0, types_1.arrayExpression)(children)
                : children[0];
            if (reactive.length === 0 || isIntrinsic && children.length > 1 && !isSpread) {
                for (const i of reactive) {
                    children[i] = (0, types_1.arrowFunctionExpression)([], children[i]);
                }
                props.push((0, types_1.objectProperty)(CHILDREN, value));
            }
            else {
                props.push(reactiveProperty(isIntrinsic, CHILDREN, value));
            }
        }
        path.replaceWith(transpiled);
        path.skip();
    }
};
const skipSubTree = (path) => {
    path.skip();
};
const markReactive = (path, rootNode) => {
    rootNode.isReactive = true;
    path.stop();
};
const jsxExpressionVisitor = {
    CallExpression: markReactive,
    MemberExpression: markReactive,
    NewExpression: skipSubTree,
    ArrowFunctionExpression: skipSubTree,
    FunctionExpression: skipSubTree
};
const jsxContainerVisitor = {
    exit(path) {
        path.traverse(jsxExpressionVisitor, path.node);
    }
};
exports.visitor = {
    Program(root, state) {
        state.imports = {
            get jsx() {
                return importIdentifier.call(this, root, "jsx", JSX_RUNTIME_MODULE);
            },
            get svg() {
                return importIdentifier.call(this, root, "svg", JSX_RUNTIME_MODULE);
            },
            get xhtml() {
                return importIdentifier.call(this, root, "xhtml", JSX_RUNTIME_MODULE);
            },
            get Fragment() {
                return importIdentifier.call(this, root, "Fragment", JSX_RUNTIME_MODULE);
            }
        };
    },
    ImportDeclaration(path) {
        if (path.node.source.value === "nimble") {
            path.node.source.value = NIMBLE_MODULE;
        }
        if (path.node.source.value === "nimble/jsx-runtime") {
            path.node.source.value = JSX_RUNTIME_MODULE;
        }
    },
    JSXFragment: nodeVisitor,
    JSXElement: nodeVisitor,
    JSXExpressionContainer: jsxContainerVisitor,
    JSXSpreadAttribute: jsxContainerVisitor,
    JSXSpreadChild: jsxContainerVisitor
};
//# sourceMappingURL=visitor.js.map