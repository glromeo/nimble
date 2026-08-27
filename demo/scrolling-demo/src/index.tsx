import {adoptStyle, computed, css, signal} from "@nimble/toolkit";

import data from "./data.csv";

adoptStyle(css`
    .main {
        width: 100%;
        height: 100%;
        background: lightgoldenrodyellow;
        border-radius: 20px;
        display: grid;
        grid-template-columns: 20px 1fr 20px 1fr 20px;
        grid-template-rows: 20px 1fr 20px;
    }
    .list {
        border: 4px solid #0ea5e9;
        border-radius: 10px;
        background: white;
        padding: 4px;
        grid-column-start: 2;
        grid-row-start: 2;
        overflow-y: scroll;
        /* the window is driven from scrollTop: let the browser's scroll anchoring stay out of it */
        overflow-anchor: none;
    }
    .content {
        position: relative;
        contain: layout style;
    }
    .item {
        position: absolute;
        width: 100%;
        height: 28px;
        border-bottom: 2px solid #0ea5e9;
        font-weight: bold;
        /* a row never paints outside its own box, so re-rendering one cannot dirty its neighbours */
        contain: layout paint style;
    }
`);

const rows = data.slice(1);

function ScrollingDemo() {
    const range = signal([0, 0]);
    let minY = 0;
    const names = computed(() => rows.slice(...range.value).map(item => item[1] + " " + item[2]));

    const updateWindow = (window:HTMLDivElement) => {
        const {
            scrollTop,
            clientHeight
        } = window;
        const minIndex = Math.floor(scrollTop / 30);
        const maxIndex = Math.min(Math.ceil((scrollTop + clientHeight) / 30), rows.length)
        minY = minIndex * 30;
        range.value = [minIndex, maxIndex];
    };

    return (
        <div class="main">
            <div class="list" ref={div => setTimeout(() => updateWindow(div))} onScroll={e => updateWindow(e.currentTarget)}>
                <div class="content" style={`height: ${rows.length * 30}px`}>
                    {names.value.map((name, i) => (
                        <div class="item" key={name} data-index={range.peek()[0]+i} style={`top: ${minY + i * 30}px`}>{name}</div>
                    ))}
                </div>
            </div>
        </div>
    )
}

document.body.append(<ScrollingDemo/>);
