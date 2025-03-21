import {computed} from "@nimble/toolkit";
import {batch, signal} from "@nimble/toolkit";
import {PsGridColumnLayout, PsGridLayout} from "./layout";
import {reactivify} from "./utils";
import {PsGridProps, DataItem} from "../ps-grid";
import {PsGridColumn} from "./columns";
import {PsGridViewPort} from "./viewport";

export type PsGridDnD<T extends DataItem> = {
    dragColumn: PsGridColumn<T> | null;
    dropColumn: PsGridColumn<T> | null;
    dragIndex: number;
    dropIndex: number;
    onDragStart: (column: PsGridColumn<T>, cell: HTMLDivElement, pageX: number, pageY: number) => void;
    onDragEnter: (dropColumn: PsGridColumn<T>, insert: boolean) => void
}

const dragIcon = `<svg viewBox="0 0 512 512"><path d="M352.2 425.8l-79.2 79.2c-9.4 9.4-24.6 9.4-33.9 0l-79.2-79.2c-15.1-15.1-4.4-41 17-41h51.2L228 284H127.2v51.2c0 21.4-25.9 32.1-41 17L7 272.9c-9.4-9.4-9.4-24.6 0-33.9L86.2 159.8c15.1-15.1 41-4.4 41 17V228H228V127.2h-51.2c-21.4 0-32.1-25.9-17-41l79.2-79.2c9.4-9.4 24.6-9.4 33.9 0l79.2 79.2c15.1 15.1 4.4 41-17 41h-51.2V228h100.8v-51.2c0-21.4 25.9-32.1 41-17l79.2 79.2c9.4 9.4 9.4 24.6 0 33.9L425.8 352.2c-15.1 15.1-41 4.4-41-17V284H284v100.8h51.2c21.4 0 32.1 25.9 17 41z"/></svg>`;

/**
 *
 * @param props
 * @param viewport
 * @param layout
 */
export const defineDnD = <T extends DataItem>(
    props: PsGridProps<T>,
    viewport: PsGridViewPort,
    layout: PsGridLayout,
) => {

    const $dragColumn = signal<PsGridColumn<T> | null>(null);
    const $dropColumn = signal<PsGridColumn<T> | null>(null);

    const $dragScroll = computed(() => {
        let af: number;
        let x0: number, x1: number, dX: number;
        let y0: number, y1: number, dY: number;
        let isHeader = true;

        const grid = viewport.grid!;

        function dragOver({pageX, pageY}: { pageX: number; pageY: number }) {
            dX = Math.round(pageX < x0 ? pageX - x0 : pageX > x1 ? pageX - x1 : 0);
            if (dX < -32 || dX > 32) {
                dX = 0;
            }
            dY = isHeader ? 0 : Math.round(pageY < y0 ? pageY - y0 : pageY > y1 ? pageY - y1 : 0);
        }

        /**
         * document.getElementById('debug-info')!.innerText = `x: ${dX}, y: ${dY}    ${new Date().toLocaleTimeString()}`
         */
        function eachFrame() {
            if (dX) {
                grid!.scrollLeft += dX;
            }
            if (dY) {
                grid!.scrollTop += dY;
            }
            af = requestAnimationFrame(eachFrame);
        }

        let cleanUp: Function;

        /**
         * document.body.insertAdjacentHTML('beforeend', `<div id="debug-info" style="pointer-events: none; position:fixed; left:${x0}px; top:${y0}px; border: 1px solid black; width: ${x1 - x0}px; height: ${y1 - y0}px; padding: 8px; background:white; color: black; font-size: 2rem;"></div>`)
         *
         * @param headerCell
         * @param pageX
         * @param pageY
         */
        const startDragScroll = (headerCell: HTMLDivElement, pageX: number, pageY: number) => {
            const scrollBody = grid!.querySelector(".psg-body.scroll") as HTMLDivElement;
            isHeader = headerCell.classList.contains("header");

            const {left, top} = scrollBody.getBoundingClientRect();
            const {scrollLeft, scrollTop} = grid!;
            if (props.inverse) {
                x1 = scrollLeft + left + viewport.clientWidth - layout.pinnedWidth - 32;
                x0 = scrollLeft + left + 32;
            } else {
                x0 = scrollLeft + left + layout.pinnedWidth + 32;
                x1 = scrollLeft + left + viewport.clientWidth - 32;
            }
            y0 = scrollTop + top + 16;
            y1 = scrollTop + top + viewport.clientHeight - 40;

            dragOver({pageX, pageY});

            af = requestAnimationFrame(eachFrame);

            window.addEventListener("dragover", dragOver);
            window.addEventListener("mouseleave", stopDragScroll);
            headerCell.addEventListener("dragend", stopDragScroll);

            cleanUp = () => {
                window.removeEventListener("dragover", dragOver);
                window.removeEventListener("mouseleave", stopDragScroll);
                headerCell.removeEventListener("dragend", stopDragScroll);
            };
        };

        /**
         * document.getElementById('debug-info')?.remove()
         */
        function stopDragScroll() {
            cleanUp();
            cancelAnimationFrame(af);
        }

        return {grid, startDragScroll, stopDragScroll};
    });

    const snapshot = {
        pinnedColumns: null as PsGridColumnLayout[] | null,
        scrollColumns: null as PsGridColumnLayout[] | null,
    };

    const onDragStart = (column: PsGridColumn<T>, cell: HTMLDivElement, pageX: number, pageY: number) => {
        const {grid, startDragScroll, stopDragScroll} = $dragScroll.value;

        cell.parentElement!.setAttribute("drag-active", "");
        cell.insertAdjacentHTML("afterbegin", dragIcon);
        cell.setAttribute("drag-start", "");
        requestAnimationFrame(() => {
            cell.firstElementChild!.remove();
            cell.removeAttribute("drag-start");
            cell.style.opacity = "0.4";
            batch(() => {
                $dragColumn.value = column;
                $dropColumn.value = null;
                snapshot.pinnedColumns = layout.pinnedColumns.map(c => ({...c}));
                snapshot.scrollColumns = layout.scrollColumns.map(c => ({...c}));
            });
        });

        startDragScroll(cell, pageX, pageY);

        const onDragEnd = () => {
            stopDragScroll();
            for (const el of grid.querySelectorAll("[drag-over]")) {
                el.removeAttribute("drag-over");
            }
            cell.parentElement!.removeAttribute("drag-active");
            cell.removeEventListener("dragend", onDragEnd);
            cell.style.opacity = "1";
            batch(() => {
                if (!$dropColumn.value) {
                    layout.scrollColumns = snapshot.scrollColumns!;
                    layout.pinnedColumns = snapshot.pinnedColumns!;
                }
                snapshot.pinnedColumns = null;
                snapshot.scrollColumns = null;
                $dragColumn.value = null;
                $dropColumn.value = null;
                //layout.onChange();
            });
        };

        cell.addEventListener("dragend", onDragEnd);
    };

    let dragIndex = 0,
        dropIndex = 0;

    const onDragEnter = (dropColumn: PsGridColumn<T>, insert: boolean): void => {
        const dragColumnIndex = $dragColumn.value?.index ?? -1;
        const dropColumnIndex = dropColumn?.index ?? -1;
        if (dragColumnIndex >= 0 && dropColumnIndex >= 0 && dragColumnIndex !== dropColumnIndex) {
            let {pinnedColumns, scrollColumns} = layout;

            dragIndex = pinnedColumns.findIndex(({index}) => index === dragColumnIndex);
            let dragFrom;
            if (dragIndex >= 0) {
                dragFrom = pinnedColumns;
            } else {
                dragIndex = scrollColumns.findIndex(({index}) => index === dragColumnIndex);
                dragFrom = scrollColumns;
            }

            dropIndex = pinnedColumns.findIndex(({index}) => index === dropColumnIndex);
            let dropTo;
            if (dropIndex >= 0) {
                dropTo = pinnedColumns;
            } else {
                dropIndex = scrollColumns.findIndex(({index}) => index === dropColumnIndex);
                if (dragFrom === pinnedColumns) {
                    dropIndex--;
                }
                dropTo = scrollColumns;
            }

            const [dragCL] = dragFrom.splice(dragIndex, 1);
            dropTo.splice(dropIndex, 0, dragCL);

            batch(() => {
                layout.pinnedColumns = [...pinnedColumns];
                layout.scrollColumns = [...scrollColumns];
                $dropColumn.value = dropColumn;
            });
        }
    };

    return reactivify<PsGridDnD<T>>({
        dragColumn: $dragColumn,
        dropColumn: $dropColumn,
        get dragIndex() {
            return dragIndex;
        },
        get dropIndex() {
            return dropIndex;
        },
        onDragStart,
        onDragEnter,
    });
};
