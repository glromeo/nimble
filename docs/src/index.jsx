import {signal} from "@nimble/toolkit/signals/signals.mjs";
import dog from "./dog.svg.jsx";
import {css} from "@nimble/toolkit";

const timeString = signal(new Date().toLocaleTimeString());

setInterval(() => {
    timeString.set(new Date().toLocaleTimeString());
}, 1000);

const rgb = signal("rgb(0,0,0)");

setInterval(() => {
    const R = Math.floor(256 * Math.random());
    const G = Math.floor(256 * Math.random());
    const B = Math.floor(256 * Math.random());
    rgb.set(`rgb(${R},${G},${B})`);
}, 1000);

const navHeight = signal("2rem");

document.adoptedStyleSheets.push(css`
    body {
        margin: 0;
        height: 100vh;
    }

    @media print {
        body {
            margin: 0;
            height: ${200}vh;
        }

        ${".yellow"} {
            color: yellow;
        }
    }

    .nav-bar {
        font-family: Arial, sans-serif;
        height: ${navHeight};
        background-color: cornflowerblue;
        color: white;
        display: flex;
        flex-direction: row;
        align-items: center;
        overflow: hidden;
    }

    .nav-item {
        padding: .5rem;
        border: none;
        border-right: 1px solid lightblue;
    }

    .nav-fill {
        flex-grow: 1;
    }

    .dog {
        fill: currentColor;
        color: ${rgb};
    }
`);

document.body.append(<>
    <div class="nav-bar"
         on:mouseenter={() => navHeight.set("5rem")}
         on:mouseleave={() => navHeight.set("2rem")}
    >
        <div class="nav-item" slot="nav-item">Setup</div>
        <div class="nav-item" slot="nav-item">Docs</div>
        <div class="nav-item" slot="nav-item">Videos</div>
        <div class="nav-fill"></div>
        <div class="nav-item">{[timeString]}</div>
    </div>
    {dog}
    <h1>Welcome to nimble</h1>
    <h2>quick to understand, <br/> think, devise, etc.</h2>
</>);
