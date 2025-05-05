import {signal} from "@nimble/toolkit/signals/signals.mjs";
import dog from "./dog.svg.jsx";
import {css} from "@nimble/toolkit";
import {Code} from "./components/Code";

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
    <nav class="navbar navbar-expand navbar-dark bg-primary p-0 fixed-top">
        <div class="container-fluid">
            <a class="navbar-brand p-0" href="#">
                <img alt="brand" src="images/duck.png" style="height:56px"/>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarContent">
                <ul class="navbar-nav me-auto m-0">
                    <li class="nav-item border-0"><a class="nav-link active" href="#">Home</a></li>
                    <li class="nav-item border-0"><a class="nav-link" href="#">About</a></li>
                    <li class="nav-item border-0"><a class="nav-link" href="#">Services</a></li>
                    <li class="nav-item border-0"><a class="nav-link" href="#">Blog</a></li>
                    <li class="nav-item border-0"><a class="nav-link" href="#">Contact</a></li>
                </ul>
                <form class="d-flex" role="search">
                    <input class="form-control me-2" type="search" placeholder="Search"/>
                    <button class="btn btn-light" type="submit">Search</button>
                </form>
            </div>
        </div>
    </nav>
    <div class="container">
        <h1 class="p-2 display-1">Nimble</h1>
        <p class="m-0">Nimble is a little reactive library meant to help create and manipulate the DOM.</p>
        <p class="m-0">Nimble leaves you in control of your nodes, as much as possible,</p>
        <p>and promotes writing modern web applications by leaving you as close as possible to the platform.</p>
    </div>
    <div class="container">
        <h2>JSX</h2>
        <p class="m-0">JSX expressions create DOM nodes</p>
        <Code language="javascript" source={`
            const element = <div>Hello sailor!</div>;    // element is a HTMLDivElement
            
            document.body.append(element);
        `} />
    </div>
</>);


