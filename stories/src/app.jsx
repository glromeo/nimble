import {adoptStyle, css} from "nimble";
import {TkColumnResizer} from '@nimble/toolkit/components/tk-column-resizer'

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
        <div class="app">
            <h1>LEFT</h1>
            <h1 is={types}>Hello World!</h1>
            <h1>RIGHT</h1>
        </div>
    );
};
