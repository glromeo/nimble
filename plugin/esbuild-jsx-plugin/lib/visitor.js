"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitor = void 0;
const types_1 = require("@babel/types");
const template_1 = __importDefault(require("@babel/template"));
const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";
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
function jsxCallExpression(callee, tag, props, key) {
    const args = [tag, (0, types_1.objectExpression)(props)];
    if (key !== undefined) {
        args.push(key);
    }
    return (0, types_1.callExpression)(callee, args);
}
function reactiveProperty(useArrow, key, expression) {
    if (useArrow) {
        return (0, types_1.objectProperty)(key, (0, types_1.arrowFunctionExpression)([], expression));
    }
    else {
        return getterMethod(key, expression);
    }
}
const isReactive = (() => {
    const skipSubTree = (path) => {
        path.skip();
    };
    const markReactive = (path, state) => {
        state.isReactive = true;
        path.stop();
    };
    const jsxExpressionVisitor = {
        CallExpression: markReactive,
        MemberExpression: markReactive,
        NewExpression: skipSubTree,
        ArrowFunctionExpression: skipSubTree,
        FunctionExpression: skipSubTree
    };
    return (path) => {
        const state = { isReactive: false };
        path.traverse(jsxExpressionVisitor, state);
        return state.isReactive;
    };
})();
const CHILDREN = (0, types_1.identifier)("children");
function isIntrinsic(tagName) {
    return (0, types_1.isStringLiteral)(tagName) || tagName.name === "Fragment";
}
const jsxNodeVisitor = {
    enter(path, state) {
        state.ctx = {
            __proto__: state.ctx,
            tagName: undefined,
            key: undefined,
            props: []
        };
    },
    exit(path, state) {
        const { factory = state.factories.jsx, tagName, key, props } = state.ctx;
        state.ctx = state.ctx.__proto__;
        const childrenPath = path.get("children");
        const children = [];
        const reactive = [];
        path.node.children.forEach((child, index) => {
            const { type } = child;
            if (type === "JSXText") {
                const text = child.value.replace(/^\n\s+/, "").replace(/\n\s+$/, "").replace(/\s+/g, " ");
                if (text) {
                    children.push((0, types_1.stringLiteral)(text));
                }
            }
            else if (type === "JSXExpressionContainer") {
                if (child.expression.type !== "JSXEmptyExpression") {
                    if (isReactive(childrenPath[index])) {
                        reactive.push(children.length);
                    }
                    children.push(child.expression);
                }
            }
            else if (type === "JSXSpreadChild") {
                if (isReactive(childrenPath[index])) {
                    reactive.push(children.length);
                }
                children.push((0, types_1.spreadElement)(child.expression));
            }
            else {
                children.push(child);
            }
        });
        if (children.length) {
            const isSpread = children.some(({ type }) => type === "SpreadElement");
            const value = children.length > 1 || isSpread
                ? (0, types_1.arrayExpression)(children)
                : children[0];
            if (reactive.length === 0 || isIntrinsic(tagName) && children.length > 1 && !isSpread) {
                for (const i of reactive) {
                    children[i] = (0, types_1.arrowFunctionExpression)([], children[i]);
                }
                props.push((0, types_1.objectProperty)(CHILDREN, value));
            }
            else {
                props.push(reactiveProperty(isIntrinsic(tagName), CHILDREN, value));
            }
        }
        path.replaceWith(jsxCallExpression(factory, tagName, props, key));
        path.skip();
    }
};
exports.visitor = {
    Program(root, state) {
        Object.defineProperty(state, "factories", {
            enumerable: false,
            value: {
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
            }
        });
        state.ctx = {
            xmlns: XHTML_NAMESPACE_URI
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
    JSXFragment: jsxNodeVisitor,
    JSXElement: jsxNodeVisitor,
    JSXOpeningElement(path, { factories, ctx }) {
        const tag = path.node.name;
        if (tag.type === "JSXNamespacedName") {
            const { namespace, name } = tag;
            switch (namespace.name) {
                case "svg":
                    ctx.xmlns = SVG_NAMESPACE_URI;
                    ctx.factory = factories.svg;
                    break;
                case "xhtml":
                    ctx.xmlns = XHTML_NAMESPACE_URI;
                    ctx.factory = factories.xhtml;
                    break;
                default:
                    ctx.factory = (0, types_1.identifier)(namespace.name);
            }
            ctx.tagName = (0, types_1.stringLiteral)(name.name);
        }
        else {
            ctx.tagName = tagIdentifier(tag);
            if (ctx.tagName.value === "svg") {
                ctx.xmlns = SVG_NAMESPACE_URI;
                ctx.factory = factories.svg;
            }
        }
    },
    JSXOpeningFragment(path, { factories, ctx }) {
        ctx.tagName = factories.Fragment;
    },
    JSXSpreadAttribute(path, { ctx }) {
        ctx.props.push((0, types_1.spreadElement)(path.node.argument));
    },
    JSXAttribute: {
        enter(path, { factories, ctx }) {
            if (path.node.name.type === "JSXNamespacedName") {
                const { namespace, name } = path.node.name;
                ctx.attr = (0, types_1.stringLiteral)(`${namespace.name}:${name.name}`);
            }
            else {
                const { name: { name }, value } = path.node;
                if (name === "key") {
                    ctx.key = value?.expression ?? value;
                    path.skip();
                }
                if (name === "xmlns") {
                    const { type, value: xmlns } = value;
                    if (type === "StringLiteral") {
                        ctx.xmlns = xmlns;
                        if (xmlns === SVG_NAMESPACE_URI) {
                            ctx.factory = factories.svg;
                        }
                        else if (xmlns === XHTML_NAMESPACE_URI) {
                            ctx.factory = factories.xhtml;
                        }
                        else {
                            throw path.buildCodeFrameError(`invalid xmlns value: "${xmlns}"`);
                        }
                    }
                    else {
                        throw path.buildCodeFrameError(`invalid xmlns type: ${type}`);
                    }
                    path.skip();
                }
                ctx.attr = name === "class" || name === "style" || (0, types_1.isValidIdentifier)(name)
                    ? (0, types_1.identifier)(name)
                    : (0, types_1.stringLiteral)(name);
            }
        },
        exit(path, { ctx }) {
            const key = ctx.attr;
            const value = path.node.value;
            if (value?.type === "JSXExpressionContainer") {
                const expression = value.expression;
                if (!isHandler(key) && isReactive(path.get("value"))) {
                    const useArrow = isIntrinsic(ctx.tagName) && !isDirective(key);
                    ctx.props.push(reactiveProperty(useArrow, key, expression));
                }
                else {
                    ctx.props.push((0, types_1.objectProperty)(key, expression));
                }
            }
            else {
                ctx.props.push((0, types_1.objectProperty)(key, value));
            }
        }
    }
};
//# sourceMappingURL=visitor.js.map