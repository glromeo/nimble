import {createDirective} from "@nimble/toolkit/html";

import "./resizable.scss";

declare module "@nimble/toolkit" {
    namespace JSX {
        type Vertical = 'top' | 'bottom';
        type Horizontal = 'right' | 'left'
        type Placement = Vertical | Horizontal;

        interface CustomAttributes<T> {
            resizable?: boolean | Placement
                | `${Vertical} ${Horizontal}`
                | 'top right bottom' | 'top bottom left' | 'right bottom left' | 'top right left'
                | 'top right bottom left'
                | 'vertical' | 'horizontal' | 'vertical horizontal';
        }
    }
}

createDirective("resizable", (el, value) => {
    let computedStyle = getComputedStyle(el);
    let computedMinWidth = parseInt(computedStyle.minWidth);
    let minWidth = !isNaN(computedMinWidth) ? computedMinWidth : 32;
    if (computedStyle.position === "static") {
        console.warn("resizable cannot be applied to statically positioned elements");
    }
})
