// @ts-nocheck

import {
    arrayExpression,
    arrowFunctionExpression,
    blockStatement,
    callExpression,
    Identifier,
    identifier,
    ImportDeclaration,
    importSpecifier,
    isStringLiteral,
    isValidIdentifier,
    memberExpression,
    objectExpression,
    objectMethod,
    objectProperty,
    Program,
    returnStatement,
    spreadElement,
    stringLiteral
} from "@babel/types";
import __template from "@babel/template";
import {NodePath, Visitor} from "@babel/traverse";

const NIMBLE_MODULE = "@nimble/toolkit/index.mjs";
const JSX_RUNTIME_MODULE = "@nimble/toolkit/jsx-runtime.js";

const template = __template.ast ? __template : __template.default;

export type State = {
    imports: {
        jsx: Identifier,
        svg: Identifier,
        xhtml: Identifier,
        Fragment: Identifier
    },
    isReactive?: boolean,
    defaultExt?: string
};

function importIdentifier(this: State["imports"], root: NodePath<Program>, name: string, module: string) {
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

function getterMethod(prop: Identifier | StringLiteral, expression: ArrayExpression) {
    return objectMethod("get", prop, [], blockStatement([returnStatement(expression)]), prop.type === "StringLiteral");
}

const CHILDREN = identifier("children");

function isHandler(id: Identifier | StringLiteral) {
    const name = id.name ?? id.value;
    return name[0] === "o" && name[1] === "n";
}

function isDirective(id: Identifier | StringLiteral) {
    const name = id.name ?? id.value;
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
        object.object
            ? parseJSXMemberExpression(object)
            : identifier(object.name),
        identifier(property.name)
    );
}

function jsxExpression(callee, tag, props) {
    return callExpression(callee, [tag, objectExpression(props)]);
}

function reactiveProperty(useArrow: boolean, key: any, expression: Expression) {
    if (useArrow) {
        return objectProperty(key, arrowFunctionExpression([], expression));
    } else {
        return getterMethod(key, expression);
    }
}

const nodeVisitor = {
    exit(path: NodePath<JSXFragment | JSXElement>, {imports}: State) {
        const props = [];
        let transpiled;
        let isIntrinsic = true;

        if (path.node.type === "JSXElement") {
            const {name: tag, attributes} = path.node.openingElement;
            if (tag.type === "JSXNamespacedName") {
                const {namespace, name} = tag;
                const callee = imports[namespace.name] ?? identifier(namespace.name);
                transpiled = jsxExpression(callee, stringLiteral(name.name), props);
            } else {
                const tagName = tagIdentifier(tag);
                transpiled = jsxExpression(imports.jsx, tagName, props);
                isIntrinsic = isStringLiteral(tagName);
            }
            for (const attr of attributes) {
                if (attr.type === "JSXSpreadAttribute") {
                    props.push(spreadElement(attr.argument));
                } else {
                    let key: Identifier | StringLiteral;
                    let {name, value} = attr;
                    if (name.type === "JSXNamespacedName") {
                        key = stringLiteral(`${name.namespace.name}:${name.name.name}`);
                    } else {
                        name = name.name;
                        if (name === "key") {
                            transpiled.arguments.push(attr.value?.expression ?? attr.value);
                            // TODO: Throw an error if the type is reactive
                            continue;
                        }
                        key = name === "class" || name === "style" || isValidIdentifier(name)
                            ? identifier(name)
                            : stringLiteral(name);
                    }
                    if (value?.type === "JSXExpressionContainer") {
                        const expression = value.expression;
                        if (value.isReactive && !isHandler(key)) {
                            props.push(reactiveProperty(isIntrinsic && !isDirective(key), key, expression));
                        } else {
                            props.push(objectProperty(key, expression));
                        }
                    } else {
                        props.push(objectProperty(key, value));
                    }
                }
            }
        } else {
            transpiled = jsxExpression(imports.jsx, imports.Fragment, props);
        }
        const children = [];
        let isReactive = false;
        for (const child of path.node.children) {
            const {type} = child;
            if (type === "CallExpression") {
                children.push(child);
            } else if (type === "JSXText") {
                const lines = child.value.split("\n");
                let value = lines[0];
                for (let l = 1; l < lines.length; l++) {
                    value += lines[l].trim();
                }
                if (value) {
                    children.push(stringLiteral(value));
                }
            } else if (type === "JSXExpressionContainer") {
                if (child.expression.type !== "JSXEmptyExpression") {
                    isReactive ||= child.isReactive;
                    children.push(isIntrinsic && child.isReactive ? arrowFunctionExpression([], child.expression) : child.expression);
                }
            } else if (type === "JSXSpreadChild") {
                isReactive ||= child.isReactive;
                children.push(spreadElement(child.expression));
            }
        }
        if (children.length) {
            const value = children.length === 1 && children[0].type !== "SpreadElement"
                ? children[0]
                : arrayExpression(children);
            if (isReactive && !isIntrinsic) {
                props.push(reactiveProperty(false, CHILDREN, value));
            } else {
                props.push(objectProperty(CHILDREN, value));
            }
        }
        path.replaceWith(transpiled);
        path.skip();
    }
};

const skipSubTree = path => path.skip();

const jsxExpressionVisitor = {
    MemberExpression(path, rootNode) {
        rootNode.isReactive = true;
        path.stop();
    },
    NewExpression: skipSubTree,
    ArrowFunctionExpression: skipSubTree,
    FunctionExpression: skipSubTree
};

const jsxContainerVisitor = {
    exit(path) {
        path.traverse(jsxExpressionVisitor, path.node);
    }
};

export const visitor: Visitor<State> = {
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
