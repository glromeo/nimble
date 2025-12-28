import {use} from "chai";

use(function chaiDom({Assertion}, utils) {
    const {slice, forEach, map, some, every} = Array.prototype;
    const flag = utils.flag;

    function elToString(el) {
        let desc;
        if (isNodeList(el)) {
            if (el.length === 0) {
                return "empty NodeList";
            }

            desc = slice.call(el, 0, 5).map(elToString).join(", ");
            return el.length > 5 ? desc + "... (+" + (el.length - 5) + " more)" : desc;
        }
        if (!isHTMLElement(el)) {
            return String(el);
        }

        desc = el.tagName.toLowerCase();
        if (el.id) {
            desc += "#" + el.id;
        }
        if (el.className) {
            desc += "." + String(el.className).replace(/\s+/g, ".");
        }
        forEach.call(el.attributes, function (attr) {
            if (attr.name !== "class" && attr.name !== "id") {
                desc += "[" + attr.name + (attr.value ? "=\"" + attr.value + "\"]" : "]");
            }
        });
        return desc;
    }

    function attrAssert(name, val) {
        const el = flag(this, "object"), actual = el.getAttribute(name);

        if (!flag(this, "negate") || undefined === val) {
            this.assert(
                !!el.attributes[name]
                , "expected " + elToString(el) + " to have an attribute #{exp}"
                , "expected " + elToString(el) + " not to have an attribute #{exp}"
                , name
            );
        }

        if (undefined !== val) {
            this.assert(
                val === actual
                , "expected " + elToString(el) + " to have an attribute " + utils.inspect(name) + " with the value #{exp}, but the value was #{act}"
                , "expected " + elToString(el) + " not to have an attribute " + utils.inspect(name) + " with the value #{act}"
                , val
                , actual
            );
        }

        flag(this, "object", actual);
    }

    function isHTMLElement(el) {
        return el.nodeType === 1; // window.Node.ELEMENT_NODE
    }

    function isNodeList(obj) {
        return Object.prototype.toString.call(obj) === "[object NodeList]";
    }

    utils.elToString = elToString;

    Assertion.addMethod("attr", attrAssert);
    Assertion.addMethod("attribute", attrAssert);

    Assertion.addMethod("class", function (className) {
        const el = flag(this, "object");

        if (className instanceof RegExp) {
            return this.assert(
                Array.from(el.classList).some(function (cls) {
                    return className.test(cls);
                })
                , "expected " + elToString(el) + " to have class matching #{exp}"
                , "expected " + elToString(el) + " not to have class matching #{exp}"
                , className
            );
        }

        this.assert(
            el.classList.contains(className)
            , "expected " + elToString(el) + " to have class #{exp}"
            , "expected " + elToString(el) + " not to have class #{exp}"
            , className
        );
    });

    Assertion.addMethod("id", function (id) {
        const el = flag(this, "object");
        this.assert(
            el.id == id
            , "expected " + elToString(el) + " to have id #{exp}"
            , "expected " + elToString(el) + " not to have id #{exp}"
            , id
        );
    });

    Assertion.addMethod("html", function (html) {
        const el = flag(this, "object"), actual = flag(this, "object").innerHTML;

        if (flag(this, "contains")) {
            this.assert(
                actual.indexOf(html) >= 0
                , "expected #{act} to contain HTML #{exp}"
                , "expected #{act} not to contain HTML #{exp}"
                , html
                , actual
            );
        } else {
            this.assert(
                actual === html
                , "expected " + elToString(el) + " to have HTML #{exp}, but the HTML was #{act}"
                , "expected " + elToString(el) + " not to have HTML #{exp}"
                , html
                , actual
            );
        }
    });

    Assertion.addChainableMethod("trimmed", null, function () {
        flag(this, "trim-text", true);
    });

    Assertion.addProperty("rendered", function () {
        flag(this, "rendered-text", true);
    });

    Assertion.addMethod("text", function (text) {
        let obj = flag(this, "object"), contains = flag(this, "contains"),
            trim = flag(this, "trim-text"), actual, result;
        const property = flag(this, "rendered-text") ? "innerText" : "textContent";

        if (isNodeList(obj)) {
            actual = map.call(obj, function (el) {
                return trim ? el[property].trim() : el[property];
            });
            if (Array.isArray(text)) {
                result = contains ?
                    text[flag(this, "negate") ? "some" : "every"](function (t) {
                        return some.call(obj, function (el) {
                            return (trim ? el[property].trim() : el[property]) === t;
                        });
                    })
                    :
                    utils.eql(actual, text);

                actual = actual.join();
                text = text.join();
            } else {
                actual = actual.join("");
                result = contains ? actual.indexOf(text) >= 0 : actual === text;
            }
        } else {
            actual = trim ? obj[property].trim() : obj[property];
            result = contains ? actual.indexOf(text) >= 0 : actual === text;
        }

        let objDesc = elToString(obj);
        let textMsg = "";

        if (trim) {
            textMsg += "trimmed ";
        }
        if (flag(this, "rendered-text")) {
            textMsg += "rendered ";
        }
        textMsg += "text";

        if (contains) {
            this.assert(
                result
                , "expected " + objDesc + " to contain #{exp}, but the " + textMsg + " was #{act}"
                , "expected " + objDesc + " not to contain #{exp}, but the " + textMsg + " was #{act}"
                , text
                , actual
            );
        } else {
            this.assert(
                result
                , "expected " + objDesc + " to have " + textMsg + " #{exp}, but the " + textMsg + " was #{act}"
                , "expected " + objDesc + " not to have " + textMsg + " #{exp}"
                , text
                , actual
            );
        }
    });

    Assertion.addMethod("value", function (value) {
        const el = flag(this, "object"), actual = flag(this, "object").value;
        this.assert(
            flag(this, "object").value === value
            , "expected " + elToString(el) + " to have value #{exp}, but the value was #{act}"
            , "expected " + elToString(el) + " not to have value #{exp}"
            , value
            , actual
        );
    });

    Assertion.overwriteProperty("exist", function (_super) {
        return function () {
            const obj = flag(this, "object");
            if (isNodeList(obj)) {
                this.assert(
                    obj.length > 0
                    , "expected an empty NodeList to have nodes"
                    , "expected " + elToString(obj) + " to not exist");
            } else {
                _super.apply(this, arguments);
            }
        };
    });

    Assertion.overwriteProperty("empty", function (_super) {
        return function () {
            const obj = flag(this, "object");
            if (isHTMLElement(obj)) {
                this.assert(
                    obj.children.length === 0
                    , "expected " + elToString(obj) + " to be empty"
                    , "expected " + elToString(obj) + " to not be empty");
            } else if (isNodeList(obj)) {
                this.assert(
                    obj.length === 0
                    , "expected " + elToString(obj) + " to be empty"
                    , "expected " + elToString(obj) + " to not be empty");
            } else {
                _super.apply(this, arguments);
            }
        };
    });

    Assertion.overwriteChainableMethod("length",
        function (_super) {
            return function (length) {
                const obj = flag(this, "object");
                if (isNodeList(obj) || isHTMLElement(obj)) {
                    const actualLength = obj.children ? obj.children.length : obj.length;
                    this.assert(
                        actualLength === length
                        , "expected " + elToString(obj) + " to have #{exp} children but it had #{act} children"
                        , "expected " + elToString(obj) + " to not have #{exp} children"
                        , length
                        , actualLength
                    );
                } else {
                    _super.apply(this, arguments);
                }
            };
        },
        function (_super) {
            return function () {
                _super.call(this);
            };
        }
    );

    Assertion.overwriteMethod("match", function (_super) {
        return function (selector) {
            const obj = flag(this, "object");
            if (isHTMLElement(obj)) {
                this.assert(
                    obj.matches(selector)
                    , "expected " + elToString(obj) + " to match #{exp}"
                    , "expected " + elToString(obj) + " to not match #{exp}"
                    , selector
                );
            } else if (isNodeList(obj)) {
                this.assert(
                    (!!obj.length && every.call(obj, function (el) {
                        return el.matches(selector);
                    }))
                    , "expected " + elToString(obj) + " to match #{exp}"
                    , "expected " + elToString(obj) + " to not match #{exp}"
                    , selector
                );
            } else {
                _super.apply(this, arguments);
            }
        };
    });

    Assertion.overwriteChainableMethod("contain",
        function (_super) {
            return function (subitem) {
                const obj = flag(this, "object");
                if (isHTMLElement(obj)) {
                    if (typeof subitem === "string") {
                        this.assert(
                            !!obj.querySelector(subitem)
                            , "expected " + elToString(obj) + " to contain #{exp}"
                            , "expected " + elToString(obj) + " to not contain #{exp}"
                            , subitem);
                    } else {
                        this.assert(
                            obj.contains(subitem)
                            , "expected " + elToString(obj) + " to contain " + elToString(subitem)
                            , "expected " + elToString(obj) + " to not contain " + elToString(subitem));
                    }
                } else {
                    _super.apply(this, arguments);
                }
            };
        },
        function (_super) {
            return function () {
                _super.call(this);
            };
        }
    );

    Assertion.addMethod("descendant", function (subitem) {
        let obj = flag(this, "object"), actual = subitem;

        if (typeof subitem === "string") {
            actual = obj.querySelector(subitem);
            this.assert(
                !!actual
                , "expected " + elToString(obj) + " to have descendant #{exp}"
                , "expected " + elToString(obj) + " to not have descendant #{exp}"
                , subitem);
        } else {
            this.assert(
                obj.contains(subitem)
                , "expected " + elToString(obj) + " to contain " + elToString(subitem)
                , "expected " + elToString(obj) + " to not contain " + elToString(subitem));
        }

        flag(this, "object", actual);
    });

    Assertion.addMethod("descendants", function (selector) {
        const obj = flag(this, "object"),
            actual = obj.querySelectorAll(selector);
        this.assert(
            !!actual.length
            , "expected " + elToString(obj) + " to have descendants #{exp}"
            , "expected " + elToString(obj) + " to not have descendants #{exp}"
            , selector);
        flag(this, "object", actual);
    });

    Assertion.addProperty("displayed", function () {
        const el = flag(this, "object"),
            actual = el.getRootNode({composed: true}) === document ? window.getComputedStyle(el).display : el.style.display;

        this.assert(
            actual !== "none"
            , "expected " + elToString(el) + " to be displayed, but it was not"
            , "expected " + elToString(el) + " to not be displayed, but it was as " + actual
            , actual
        );
    });

    Assertion.addProperty("visible", function () {
        const el = flag(this, "object"),
            actual = document.body.contains(el) ? window.getComputedStyle(el).visibility : el.style.visibility;

        this.assert(
            actual !== "hidden" && actual !== "collapse"
            , "expected " + elToString(el) + " to be visible, but it was " + (actual === "hidden" ? "hidden" : "collapsed")
            , "expected " + elToString(el) + " to not be visible, but it was"
            , actual
        );
    });

    Assertion.addMethod("tagName", function (tagName) {
        const el = flag(this, "object"),
            actual = el.tagName;

        this.assert(
            actual.toUpperCase() === tagName.toUpperCase()
            , "expected " + elToString(el) + " to have tagName " + tagName + ", but it was " + actual
            , "expected " + elToString(el) + " to not have tagName " + tagName + ", but it was " + actual
            , actual
        );
    });

    Assertion.addMethod("style", function (styleProp, styleValue) {
        const el = flag(this, "object"),
            style = window.getComputedStyle(el),
            actual = style.getPropertyValue(styleProp).trim();

        this.assert(
            actual === styleValue
            , "expected " + elToString(el) + " to have style property " + styleProp + " equal to " + styleValue + ", but it was equal to " + actual
            , "expected " + elToString(el) + " to not have style property " + styleProp + " equal to " + styleValue + ", but it was equal to " + actual
            , actual
        );
    });

    Assertion.overwriteProperty("focus", function () {
        return function () {
            const el = flag(this, "object"), actual = el.ownerDocument.activeElement;

            this.assert(
                el === el.ownerDocument.activeElement
                , "expected #{this} to have focus"
                , "expected #{this} not to have focus"
                , el
                , actual
            );

        };
    });

    Assertion.overwriteProperty("checked", function () {
        return function () {
            const el = flag(this, "object");

            if (!(el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"))) {
                throw new TypeError(elToString(el) + " is not a checkbox or radio input");
            }

            this.assert(
                el.checked
                , "expected " + elToString(el) + " to be checked"
                , "expected " + elToString(el) + " to not be checked");
        };
    });
})
