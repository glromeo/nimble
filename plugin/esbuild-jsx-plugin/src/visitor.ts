import {
    arrayExpression,
    arrowFunctionExpression,
    blockStatement,
    callExpression,
    Expression,
    Identifier,
    identifier,
    ImportDeclaration,
    importSpecifier,
    isStringLiteral,
    isValidIdentifier,
    JSXAttribute,
    JSXElement,
    JSXExpressionContainer,
    JSXFragment,
    JSXIdentifier,
    JSXMemberExpression,
    JSXOpeningElement,
    JSXOpeningFragment,
    JSXSpreadAttribute, JSXSpreadChild,
    memberExpression,
    objectExpression,
    objectMethod,
    objectProperty,
    Program,
    returnStatement,
    SpreadElement,
    spreadElement,
    StringLiteral,
    stringLiteral
} from "@babel/types";
import {NodePath, VisitNodeObject, Visitor} from "@babel/traverse";
import __template from "@babel/template";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

const NIMBLE_MODULE = "@nimble/toolkit/index.mjs";
const JSX_RUNTIME_MODULE = "@nimble/toolkit/jsx-runtime.js";

// @ts-ignore
const template = __template.ast ? __template : __template.default;

type Context = {
    __proto__: Context,
    xmlns?: string,
    factory?: Identifier,
    tagName: Identifier | StringLiteral,
    key: Expression,
    props: any[],
    attr?: Identifier | StringLiteral
};

export type State = {
    factories: {
        jsx: Identifier,
        svg: Identifier,
        xhtml: Identifier,
        Fragment: Identifier
    },
    ctx: Context,
};

function importIdentifier(this: State["factories"], root: NodePath<Program>, name: string, module: string) {
    let ast: ImportDeclaration | undefined;
    for (const node of root.node.body) {
        if (node.type !== "ImportDeclaration") break;
        if (node.source.value === module) {
            ast = node;
            break;
        }
    }
    let nameIdentifier = identifier(name);
    if (ast) {
        ast.specifiers = [importSpecifier(nameIdentifier, nameIdentifier), ...ast.specifiers];
    } else {
        root.unshiftContainer("body", template.ast`import {${name}} from "${module}";`);
    }
    Object.defineProperty(this, name, {value: nameIdentifier});
    return this[name];
}

function getterMethod(prop: Identifier | StringLiteral, expression: Expression) {
    return objectMethod("get", prop, [], blockStatement([returnStatement(expression)]), prop.type === "StringLiteral");
}

function isHandler(id: Identifier | StringLiteral) {
    const name = (id as Identifier).name ?? (id as StringLiteral).value;
    return name[0] === "o" && name[1] === "n";
}

function isDirective(id: Identifier | StringLiteral) {
    const name = (id as Identifier).name ?? (id as StringLiteral).value;
    return name[2] === ":" && name[0] === "i" && name[1] === "s";
}

function tagIdentifier(tag) {
    if (tag.type === "JSXIdentifier") {
        const cc = tag.name.charCodeAt(0);
        return cc >= 65 && cc <= 90 && isValidIdentifier(tag.name)
            ? identifier(tag.name)
            : stringLiteral(tag.name);
    } else {
        return parseJSXMemberExpression(tag);
    }
}

function parseJSXMemberExpression({object, property}: JSXMemberExpression) {
    return memberExpression(
        (object as JSXMemberExpression).object
            ? parseJSXMemberExpression(object as JSXMemberExpression)
            : identifier((object as JSXIdentifier).name),
        identifier(property.name)
    );
}

function jsxCallExpression(callee, tag, props, key) {
    const args = [tag, objectExpression(props)];
    if (key !== undefined) {
        args.push(key);
    }
    return callExpression(callee, args);
}

function reactiveProperty(useArrow: boolean, key: any, expression: Expression) {
    if (useArrow) {
        return objectProperty(key, arrowFunctionExpression([], expression));
    } else {
        return getterMethod(key, expression);
    }
}

const isReactive = (() => {
    const skipSubTree = (path: NodePath) => {
        path.skip();
    };
    const markReactive = (path: NodePath, state: { isReactive: boolean }) => {
        state.isReactive = true;
        path.stop();
    };
    const jsxExpressionVisitor: Visitor<{ isReactive: boolean }> = {
        CallExpression: markReactive,
        MemberExpression: markReactive,
        NewExpression: skipSubTree,
        ArrowFunctionExpression: skipSubTree,
        FunctionExpression: skipSubTree
    };
    return (path: NodePath<JSXExpressionContainer|JSXSpreadChild>) => {
        const state = {isReactive: false};
        path.traverse(jsxExpressionVisitor, state);
        return state.isReactive;
    };
})();

const CHILDREN = identifier("children");

function isIntrinsic(tagName: Identifier | StringLiteral) {
    return isStringLiteral(tagName) || tagName.name === "Fragment";
}

const jsxNodeVisitor: VisitNodeObject<State, JSXElement | JSXFragment> = {
    enter(path, state) {
        state.ctx = {
            __proto__: state.ctx,
            tagName: undefined,
            key: undefined,
            props: []
        } as any;
    },
    exit(path, state) {
        const {factory = state.factories.jsx, tagName, key, props} = state.ctx;
        state.ctx = state.ctx.__proto__;

        const childrenPath = path.get("children");
        const children = [] as Array<StringLiteral | Expression | SpreadElement>;
        const reactive = [] as number[];

        path.node.children.forEach((child, index) => {
            const {type} = child;
            if (type === "JSXText") {
                const text = child.value.replace(/^\n\s+/, "").replace(/\n\s+$/, "").replace(/\s+/g, " ");
                if (text) {
                    children.push(stringLiteral(text));
                }
            } else if (type === "JSXExpressionContainer") {
                if (child.expression.type !== "JSXEmptyExpression") {
                    if (isReactive(childrenPath[index] as NodePath<JSXExpressionContainer>)) {
                        reactive.push(children.length);
                    }
                    children.push(child.expression);
                }
            } else if (type === "JSXSpreadChild") {
                if (isReactive(childrenPath[index] as NodePath<JSXSpreadChild>)) {
                    reactive.push(children.length);
                }
                children.push(spreadElement(child.expression));
            } else {
                children.push(child);
            }
        });

        if (children.length) {
            const isSpread = children.some(({type}) => type === "SpreadElement");
            const value = children.length > 1 || isSpread
                ? arrayExpression(children)
                : children[0];
            if (reactive.length === 0 || isIntrinsic(tagName) && children.length > 1 && !isSpread) {
                for (const i of reactive) {
                    children[i] = arrowFunctionExpression([], children[i] as Expression);
                }
                props.push(objectProperty(CHILDREN, value as Expression));
            } else {
                props.push(reactiveProperty(isIntrinsic(tagName), CHILDREN, value as Expression));
            }
        }

        path.replaceWith(jsxCallExpression(factory, tagName, props, key));
        path.skip();
    }
};

export const visitor: Visitor<State> = {
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
        } as any;
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
    JSXOpeningElement(path: NodePath<JSXOpeningElement>, {factories, ctx}: State) {
        const tag = path.node.name;
        if (tag.type === "JSXNamespacedName") {
            const {namespace, name} = tag;
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
                    ctx.factory = identifier(namespace.name);
            }
            ctx.tagName = stringLiteral(name.name);
        } else {
            ctx.tagName = tagIdentifier(tag);
            if ((ctx.tagName as StringLiteral).value === "svg") {
                ctx.xmlns = SVG_NAMESPACE_URI;
                ctx.factory = factories.svg;
            }
        }
    },
    JSXOpeningFragment(path: NodePath<JSXOpeningFragment>, {factories, ctx}: State) {
        ctx.tagName = factories.Fragment;
    },
    JSXSpreadAttribute(path: NodePath<JSXSpreadAttribute>, {ctx}: State) {
        ctx.props.push(spreadElement(path.node.argument));
    },
    JSXAttribute: {
        enter(path: NodePath<JSXAttribute>, {factories, ctx}: State) {
            if (path.node.name.type === "JSXNamespacedName") {
                const {namespace, name} = path.node.name;
                ctx.attr = stringLiteral(`${namespace.name}:${name.name}`);
            } else {
                const {name: {name}, value} = path.node;
                if (name === "key") {
                    ctx.key = (value as JSXExpressionContainer)?.expression as Expression ?? value;
                    // TODO: Throw an error if the type is reactive
                    path.skip();
                }
                if (name === "xmlns") {
                    const {type, value: xmlns} = value as StringLiteral;
                    if (type === "StringLiteral") {
                        ctx.xmlns = xmlns;
                        if (xmlns === SVG_NAMESPACE_URI) {
                            ctx.factory = factories.svg;
                        } else if (xmlns === XHTML_NAMESPACE_URI) {
                            ctx.factory = factories.xhtml;
                        } else {
                            throw path.buildCodeFrameError(`invalid xmlns value: "${xmlns}"`);
                        }
                    } else {
                        throw path.buildCodeFrameError(`invalid xmlns type: ${type}`);
                    }
                    path.skip();
                }
                ctx.attr = name === "class" || name === "style" || isValidIdentifier(name)
                    ? identifier(name)
                    : stringLiteral(name);
            }
        },
        exit(path: NodePath<JSXAttribute>, {ctx}: State) {
            const key = ctx.attr!;
            const value = path.node.value;
            if (value?.type === "JSXExpressionContainer") {
                const expression = value.expression;
                if (!isHandler(key) && isReactive(path.get("value") as NodePath<JSXExpressionContainer>)) {
                    const useArrow = isIntrinsic(ctx.tagName) && !isDirective(key);
                    ctx.props.push(reactiveProperty(useArrow, key, expression as Expression));
                } else {
                    ctx.props.push(objectProperty(key, expression as Expression));
                }
            } else {
                ctx.props.push(objectProperty(key, value as Expression));
            }
        }
    }
};
