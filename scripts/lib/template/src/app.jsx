import {adoptStyle, css} from "nimble";

adoptStyle(css`
    .app {
        border: 2px solid var(--blue-300);
        padding: 2rem;   
    }
`);

export const App = () => {
    return (
        <div class="app"><h1>Hello World!</h1></div>
    );
};
