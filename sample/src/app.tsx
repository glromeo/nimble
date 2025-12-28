import {adoptStyle, css, signal, computed} from "nimble";

import "nimble/directives/resizable";

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

const beta = signal('beta');

export const App = () => {
    return (
        <div class={computed(() => `alpha ${beta} gamma`)}>
            <h1 class={signal(["c1","2"])} resizable="bottom right">LEFT</h1>
            <div resizable="bottom right" on:resized={e => console.log("resized", e)} style="min-height: 30px;">
                <h1>Hello World!</h1>
            </div>
            <h1>RIGHT</h1>
        </div>
    );
};
