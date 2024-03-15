import {html, css, atom, molecule} from '@nimble/toolkit'
import dog from './dog.svg.js'
import './nav-bar.js'

const {get, set, sub} = molecule();

const timeStringAtom = atom(new Date().toLocaleTimeString())

// setInterval(()=>{
//     timeStringAtom.value = new Date().toLocaleTimeString()
// }, 1000)

const rgbAtom = atom("rgb(0,0,0)")

setInterval(()=>{
    const R = Math.floor(256*Math.random())
    const G = Math.floor(256*Math.random())
    const B = Math.floor(256*Math.random())
    rgbAtom.value = `rgb(${R},${G},${B})`
}, 1000)

// sub(rgbAtom, () =>{
//     requestAnimationFrame(()=>{
//         document.styleSheets[0].cssRules[4].style.color = rgbAtom.value
//     })
// })

const navHeightAtom = atom("2rem")

css`
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
`

render(html`
${}
    <div class="nav-bar" 
         onmouseenter=${() => set(navHeightAtom, "5rem")}
         onmouseleave=${() => set(navHeightAtom, "2rem")}
    >
        <div class="nav-item" slot="nav-item">Setup</div>
        <div class="nav-item" slot="nav-item">Docs</div>
        <div class="nav-item" slot="nav-item">Videos</div>
        <div class="nav-fill"></div>
        <div class="nav-item">${timeStringAtom}</div>
    </div>
    ${dog}
    <h1>Welcome to nimble</h1>
    <h2>quick to understand, think, devise, etc.</h2>
`)

