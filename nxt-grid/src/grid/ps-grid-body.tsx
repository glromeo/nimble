import {PsGridCell} from "./ps-grid-cell";
import {PsGridRow} from "./state/rows";
import {PsgFC} from "./types";

const PsGridBodyRow:PsgFC<{row: PsGridRow, section: "pinned" | "visible"}> = ({store, row, section}) => {
    const {gId, columns} = store;
    return (
        <div class={`psg-row ${gId}-r${row.index} ${row.className} ${row.index % 2 ? "odd" : "even"}`}
             selected={row.selected}
             row-id={row.id}
             row-index={row.index}
             row-state={row.state}>
            {columns[section].map(column => <PsGridCell key={column.index} store={store} row={row} column={column}/>)}
        </div>
    );
}


export const PsGridPinnedBody:PsgFC = ({store}) => {
    const {hover, rows} = store;
    return (
        <div class="psg-section psg-left-section psg-pinned">
            <div class="psg-body"
                 onMouseOver={hover.onMouseOver}
                 onMouseOut={hover.onMouseOut}>
                {rows.visible.map(row => <PsGridBodyRow key={row.id} store={store} row={row} section="pinned"/>)}
            </div>
        </div>
    );
}

export const PsGridScrollBody:PsgFC = ({store}) => {
    const {hover, rows} = store;
    return (
        <div class="psg-body psg-scroll"
             onMouseOver={hover.onMouseOver}
             onMouseOut={hover.onMouseOut}>
            {rows.visible.map(row => <PsGridBodyRow key={row.index} store={store} row={row} section="visible"/>)}
        </div>
    );
}

// if (rowDetails) {
// const details = rowDetails.render!(row);
// if (details) {
//     const cellsHeight = row.height - details.props.style.height;
//     return (
//         <div className={className} row-id={id} row-index={index}>
//             <div style={{height: cellsHeight, position: "absolute"}}>
//                 <PsGridBodyCells row={row} Columns={Columns}/>
//             </div>
//             {details}
//         </div>
//     );
// }
// }
