import {JSX} from "@nimble/toolkit";
import {createDirective} from "nimble";

import "./resizable.scss";

declare module "@nimble/toolkit" {
    namespace JSX {
        type Vertical = "top" | "bottom";
        type Horizontal = "right" | "left"
        type Placement = Vertical | Horizontal;

        interface CustomAttributes<T> {
            "is:resizable"?: boolean | Placement
                | `${Vertical} ${Horizontal}`
                | "top right bottom" | "top bottom left" | "right bottom left" | "top right left"
                | "top right bottom left"
                | "vertical" | "horizontal" | "vertical horizontal";
            "on:resized"?: (e: PointerEvent) => void;
        }
    }
}

function getPlacement(placement: any): JSX.Placement[] {
    if (placement === true) {
        return ["top", "right", "bottom", "left"];
    } else {
        const parts = new Set<any>(placement.split(" "));
        if (parts.delete("vertical")) {
            parts.add("top");
            parts.add("bottom");
        }
        if (parts.delete("horizontal")) {
            parts.add("left");
            parts.add("right");
        }
        return [...parts];
    }
}

createDirective("is:resizable", (el, directive, props) => {
    const resizable = directive.value;
    if (!resizable) {
        return;
    }
    let axes = getPlacement(resizable);
    let computedStyle = getComputedStyle(el);
    let computedMinWidth = parseInt(computedStyle.minWidth);
    let minWidth = !isNaN(computedMinWidth) ? computedMinWidth : 32;
    if (computedStyle.position === "static") {
        console.warn("resizable cannot be applied to statically positioned elements");
    }

    for (const position of axes) {
        el.insertBefore(
            <div class={"resize-handle " + position} onPointerDown={onPointerDown}/> as Node,
            el.firstChild
        );
    }
});

function onPointerDown(pointerDown: PointerEvent) {
    pointerDown.preventDefault();
    pointerDown.stopPropagation();
    const currentTarget = pointerDown.currentTarget as HTMLElement;
    const resizable = currentTarget.parentElement;
    if (!resizable) {
        return;
    }

    let {classList} = currentTarget;
    let axe: "pageX" | "pageY",
        dimension: "width" | "height";
    if (classList.contains("left") || classList.contains("right")) {
        axe = "pageX";
        dimension = "width";
    } else {
        axe = "pageY";
        dimension = "height";
    }

    const inverse = classList.contains("left") || classList.contains("top");

    const body = document.body;
    const cursor = body.style.cursor;

    const origin = pointerDown[axe];
    let boundingClientRect = resizable.getBoundingClientRect();
    let size: number = boundingClientRect[dimension];
    let update = 0;
    let af: number = 0;

    function dragHandler(pointerMove: PointerEvent) {
        if (pointerMove.buttons !== 1) {
            body.removeEventListener("pointermove", dragHandler);
            body.removeEventListener("pointerup", dragHandler);
            requestAnimationFrame(() => {
                resizable.style[dimension] = `${update}px`;
                body.style.cursor = cursor;
                body.classList.remove("resizing");
                resizable.dispatchEvent(new PointerEvent("resized"));
            });
        } else {
            let delta = inverse ? origin - pointerMove[axe] : pointerMove[axe] - origin;
            update = Math.round(size + delta);
            af ||= requestAnimationFrame(() => {
                resizable.style[dimension] = `${update}px`;
                af = 0;
            });
        }
    }

    body.style.cursor = axe === "pageX" ? "ew-resize" : "ns-resize";
    body.classList.add("resizing");

    body.addEventListener("pointermove", dragHandler);
    body.addEventListener("pointerup", dragHandler);
}
