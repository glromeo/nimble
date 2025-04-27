import {styleSheetEffects} from "./ps-grid-style";
import {PsGridPinnedHeader, PsGridScrollHeader} from "./ps-grid-header";
import {PsGridPinnedBody, PsGridScrollBody} from "./ps-grid-body";
import {PsGridTooltip} from "./ps-grid-tooltip";
import {computed} from "@nimble/toolkit";
import {PsgFC} from "./types";

export const PsGridContainer:PsgFC = ({store}) => {
    const {gId, props, state, layout, dnd, columns, rows, viewport} = store;

    const fillX = computed(() => layout.scrollWidth <= viewport.clientWidth - layout.pinnedWidth);
    const fillY = computed(() => layout.scrollHeight <= viewport.clientHeight - layout.headerHeight);

    const className = () => [
        props.inverse ? "ps-grid psg-rtl" : "ps-grid psg-ltr",
        props.fill && "fill-width",
        props.stripes && "stripes",
        fillX.value && "fill-x",
        fillY.value && "fill-y",
        dnd.dragColumn && "drag-n-drop",
        props.className,
    ].filter(Boolean).join(" ");

    const style = () => ((props.style ? `${props.style};` : "") +
        `--ps-grid-max-width:${props.fill ? "100%" : `${layout.pinnedWidth + layout.scrollWidth + 10}px`};` +
        `--psg-header-width:${layout.pinnedWidth - 0.5}px;` +
        `--psg-header-height:${layout.headerHeight - 0.5}px;`
    );

    styleSheetEffects(store);

    return (
        <div id={gId}
             ref={el => viewport.grid = el}
             class={className}
             style={style}
             onClick={({target, shiftKey, ctrlKey}) => {
                 const targetElement = target as HTMLElement;
                 const targetCell = targetElement.closest<HTMLElement>(".ps-grid-cell");
                 if (!targetCell || targetCell.classList.contains("psg-header-cell")) {
                     return;
                 }
                 const targetRow = targetCell.closest<HTMLElement>(".psg-row")!;

                 const isContent = targetElement.classList.contains("ps-grid-cell-content") ||
                     targetCell.classList.contains("text");

                 if ((target === targetCell || isContent) && targetCell.parentElement === targetRow) {
                     const columnIndex = parseInt(targetCell.getAttribute("column-index")!);
                     const rowIndex = parseInt(targetRow.getAttribute("row-index")!);
                     if (state.rowSelection !== null) {
                         let {id} = rows.visible[rowIndex];
                         if (shiftKey && state.rowSelection) {

                         } else {
                             const currentSelection = ctrlKey && state.rowSelection || [];
                             state.rowSelection = [...currentSelection, id];
                         }
                     }
                     if (state.columnSelection !== null) {
                         let {field} = columns.visible[columnIndex];
                         if (shiftKey && state.columnSelection) {

                         } else {
                             const currentSelection = ctrlKey && state.columnSelection || [];
                             state.columnSelection = [...currentSelection, field];
                         }
                     }
                 }
             }}
        >
            {layout.hasPinned && <PsGridPinnedHeader store={store}/>}
            {layout.hasScroll && <PsGridScrollHeader store={store}/>}
            {layout.hasPinned && <PsGridPinnedBody store={store}/>}
            {layout.hasScroll && <PsGridScrollBody store={store}/>}
            <PsGridTooltip store={store} />
        </div>
    );
};