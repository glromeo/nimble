import {PsGridColumnLayout, DEFAULT_COLUMN_WIDTH} from "./state/layout";
import {PsGridColumn} from "./state/columns";
import {DataItem} from "./ps-grid";
import {effect} from "@nimble/toolkit";
import {PsgFC} from "./types";

function preferredWidth<T extends DataItem>(grid: HTMLDivElement, column: PsGridColumn<T>) {
    let targetWidth = 0;
    for (const cell of grid.querySelectorAll(`.psg-body .ps-grid-cell[column-index='${column.index}']`)) {
        const {scrollWidth = 0} = cell.firstElementChild ?? {};
        if (scrollWidth > targetWidth) {
            targetWidth = scrollWidth;
        }
    }
    return targetWidth === 0 ? undefined : targetWidth + 12;
}

export const PsGridColumnResizer:PsgFC<{column: PsGridColumn, section: "pinned" | "visible"}> = ({store, column, section}) => {
    const {props, state, viewport, layout, callbacks} = store;
    const range = section === "pinned" ? "pinnedColumns" : "scrollColumns";

    function commit(update: PsGridColumnLayout[], layoutIndex: number, deltaWidth: number) {
        update[layoutIndex].width += deltaWidth;
        while (++layoutIndex < update.length) {
            (update[layoutIndex] = {...update[layoutIndex]}).left += deltaWidth;
        }
        layout[range] = update;
    }

    function defaultWidth() {
        return props.columnDefs[column.index].width ?? props.defaultWidth ?? DEFAULT_COLUMN_WIDTH;
    }

    let headerCellElement:HTMLDivElement;

    function widthLimiter(trigger: MouseEvent) {
        const cs = window.getComputedStyle(headerCellElement);
        const minWidthPx = parseInt(cs.minWidth) || 0;
        const maxWidthPx = parseInt(cs.maxWidth) || Number.MAX_SAFE_INTEGER;
        return (width: number) => Math.max(minWidthPx, Math.min(maxWidthPx, width));
    }

    return column.resizable ? (
        <div ref={el => headerCellElement = el.closest(".psg-header-cell")!}
            class={props.inverse ? "resizer inverse" : "resizer"}
            onMouseDown={(trigger: MouseEvent) => {

                trigger.preventDefault();
                trigger.stopPropagation();

                document.body.addEventListener("mousemove", dragHandler);
                document.body.addEventListener("mouseup", dragHandler);

                const initialX = trigger.pageX;

                state.resizing = true;

                const grid = viewport.grid!;
                const layoutIndex = layout.findColumnIndex(range, column);
                const initialLayout = layout[range];
                const initialWidth = layout[range][layoutIndex].width;
                const limitWidth = widthLimiter(trigger);
                const initialScrollLeft = grid.scrollLeft;

                const dismissInverseEffect = effect(() => {
                    if (props.inverse) {
                        const deltaWidth = layout[range][layoutIndex].width - initialWidth;
                        grid.scrollLeft = initialScrollLeft + deltaWidth;
                    }
                })

                let af = 0, deltaX = 0;

                function dragHandler({buttons, pageX}: MouseEvent) {
                    if (buttons !== 1) {
                        document.body.removeEventListener("mousemove", dragHandler);
                        document.body.removeEventListener("mouseup", dragHandler);
                        dismissInverseEffect();
                        requestAnimationFrame(function () {
                            state.resizing = false;
                            callbacks.onLayout();
                        });
                    } else {
                        deltaX = props.inverse ? initialX - pageX : pageX - initialX;
                        af ||= requestAnimationFrame(function () {
                            const update = [...initialLayout];
                            update[layoutIndex].width = Math.round(limitWidth(initialWidth + deltaX));
                            layout[range] = update;
                            af = 0;
                        });
                    }
                }
            }}
            onDblClick={() => requestAnimationFrame(function () {
                const grid = viewport.grid!;
                const update = [...layout[range]];
                const layoutIndex = layout.findColumnIndex(range, column);
                update[layoutIndex].width = preferredWidth(grid, column) ?? defaultWidth();
                layout[range] = update;
                callbacks.onLayout();
            })}
        />
    ) : null;
}
