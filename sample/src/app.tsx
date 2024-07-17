import {adoptStyle, css} from "@nimble/toolkit";

import "@nimble/toolkit/directives/resizable";
import {signal} from "nimble/signals";

adoptStyle(css`
    .app {
        border: 2px solid var(--blue-300);
        padding: 2rem;   
        display: flex;
        flex-direction: row;
    }
    .app * {
        padding: 1rem;
    }
`);

export const App = () => {
    return (
        <div class={$`alpha ${beta} gamma`}>
            <h1 class={[signal("c1"),"2"]}>LEFT</h1>
            <div resizable="vertical horizontal">
                <h1>Hello World!</h1>
            </div>
            <h1>RIGHT</h1>
        </div>
    );
};
