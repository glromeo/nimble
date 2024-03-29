import {atom, css, createNode, globalScope, styleSheet} from '@nimble/toolkit'
import dog from './dog.svg.jsx'

const {get, set, bind} = globalScope

const timeStringAtom = atom(new Date().toLocaleTimeString())

setInterval(()=>{
    set(timeStringAtom, new Date().toLocaleTimeString())
}, 1000)

const rgbAtom = atom('rgb(0,0,0)')

setInterval(() => {
    const R = Math.floor(256 * Math.random())
    const G = Math.floor(256 * Math.random())
    const B = Math.floor(256 * Math.random())
    set(rgbAtom, `rgb(${R},${G},${B})`)
}, 1000)

const navHeightAtom = atom('2rem')

document.adoptedStyleSheets.push(styleSheet(css`
    body {
        margin: 0;
        height: 100vh;
    }

    @media print {
        body {
            margin: 0;
            height: ${200}vh;
        }

        ${'.yellow'} {
            color: yellow;
        }
    }

    .nav-bar {
        font-family: Arial, sans-serif;
        height: ${navHeightAtom};
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
        color: ${rgbAtom};
    }
`))

document.body.append(createNode(<>
    <div class="nav-bar"
         on:mouseenter={() => set(navHeightAtom, '5rem')}
         on:mouseleave={() => set(navHeightAtom, '2rem')}
    >
        <div class="nav-item" slot="nav-item">Setup</div>
        <div class="nav-item" slot="nav-item">Docs</div>
        <div class="nav-item" slot="nav-item">Videos</div>
        <div class="nav-fill"></div>
        <div class="nav-item">{timeStringAtom}</div>
    </div>
    {dog}
    <h1>Welcome to nimble</h1>
    <h2>quick to understand, think, devise, etc.</h2>
</>))
