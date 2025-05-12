import {signal} from "@nimble/toolkit/signals/signals.mjs";
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
        <h1 class="p-1 display-1">Nimble</h1>
        <p class="m-0 px-3">Nimble is a little reactive library meant to help create and manipulate the DOM.</p>
        <p class="m-0 px-3">
            Nimble leaves you in control of your nodes, as much as possible, and promotes writing modern web applications
            by leaving you as close as possible to the platform.
        </p>
    </div>
    <div class="container">
        <h2 class="p-2">JSX</h2>
        <p class="m-0 px-3">
            JSX Elements create DOM nodes that can be appended anywhere in the dom using vanilla Javascript.
        </p>
        <Code language="javascript" source={`
            const element = <div>Hello sailor!</div>;  // NOTE: This is an HTMLDivElement
            
            document.body.append(element);
        `} />
        <p class="m-0 px-3">
            JSX expressions can be either plain or reactive, depending on whether they include function calls or
            property access. If a signal is used within the expression, the corresponding property or attribute
            will automatically update when the signal changes.
        </p>
        <Code language="javascript" source={`
            import {signal} from "@nimble/signals"; 

            const colors = ["red", "green", "blue"]; 
            const color = signal(0);

            document.body.replaceChildren(
                <div class="simple" style={\`color:\${colors[color.value]\}\`}>
                    <h1>Hello {colors[color.value]} sailor!</h1>
                    <button class="rounded-2" onclick={()=>color.value++}>
                        {color.value < colors.length ? "click me" : "ahoy!"}
                    </button>
                </div>
            );
        `} />
        <p class="m-0 px-3">
            <b>colors</b> is a plain array of CSS color names.<br/>
            <b>color</b> is a signal,
            <div class="border-left-2 border-info">
                you can read/write its with the <b>get/set</b> methods or the <b>value</b> property.
            </div>
        </p>
    </div>
</>
);


