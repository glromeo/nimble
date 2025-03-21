import {MouseEventHandler, ReactNode} from "react";
import {batch, effect, signal} from "@nimble/toolkit";
import {PsGridCellType, PsGridProps, DataItem} from "../ps-grid";
import {reactivify} from "./utils";
import {PsGridViewPort} from "./viewport";
import {PsGridState} from "./state";

type PsGridTooltip = {
    visible: boolean;
    style: {
        left: number;
        top: number;
    };
    content: ReactNode | null;
};

export type PsGridHover<T extends DataItem> = {
    hoverCell: HTMLDivElement | null;
    mouseX: number;
    mouseY: number;
    tooltip: PsGridTooltip | null
    onMouseOver: MouseEventHandler<HTMLDivElement>;
    onMouseOut: MouseEventHandler<HTMLDivElement>;
}

/**
 *
 * @param props
 * @param state
 * @param viewport
 */
export function defineHover<T extends DataItem>(
    props: PsGridProps<T>,
    state: PsGridState<T>,
    viewport: PsGridViewPort
) {

    const $hoverCell = signal<HTMLDivElement | null>(null);
    const $mouseX = signal(0);
    const $mouseY = signal(0);

    effect(() => {
        const grid = viewport.grid;
        if (grid) {
            let af: number = 0;
            const listener = (event: MouseEvent) => af ||= requestAnimationFrame(() => batch(() => {
                const {pageX, pageY} = event;
                const {left, top} = grid.getBoundingClientRect();
                $mouseX.value = grid.scrollLeft + pageX! - left;
                $mouseY.value = grid.scrollTop + pageY! - top;
                af = 0;
            }));
            grid.addEventListener("mousemove", listener);
            return () => {
                grid.removeEventListener("mousemove", listener);
            };
        }
    });

    let pinnedHover: HTMLDivElement | null = null;
    let scrollHover: HTMLDivElement | null = null;

    const onMouseOver: MouseEventHandler<HTMLDivElement> = ({target, currentTarget, pageX, pageY}) => {
        const hoverCell = ((target as HTMLDivElement).closest(".ps-grid-cell") as HTMLDivElement) ?? null;
        if (hoverCell !== $hoverCell.value) {
            if (hoverCell) {
                const grid = viewport.grid!;

                pinnedHover?.removeAttribute("hover");
                scrollHover?.removeAttribute("hover");

                const targetRow = hoverCell.closest(".psg-row") as HTMLDivElement;
                const rowIndex = targetRow.getAttribute("row-index");
                if (currentTarget.classList.contains("psg-scroll")) {
                    pinnedHover = grid.querySelector(`.psg-pinned [row-index="${rowIndex}"]`);
                    scrollHover = targetRow;
                } else {
                    pinnedHover = targetRow;
                    scrollHover = grid.querySelector(`.psg-scroll [row-index="${rowIndex}"]`);
                }
                pinnedHover?.setAttribute("hover", "");
                scrollHover?.setAttribute("hover", "");

                $hoverCell.value = hoverCell;
            } else {
                $hoverCell.value = null;
            }
        }
    };

    const onMouseOut: MouseEventHandler<HTMLDivElement> = ({target, currentTarget}) => {
        if ((target as HTMLDivElement).closest(".ps-grid-cell") === $hoverCell.value) {
            pinnedHover?.removeAttribute("hover");
            scrollHover?.removeAttribute("hover");
            $hoverCell.value = null;
        }
    };

    const $tooltip = signal<PsGridTooltip | null>(null);

    let tooltipTimeout: any;

    effect(() => {
        const hoverCell = $hoverCell.value;
        if (hoverCell) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => {
                if (typeof props.tooltip === "function") {
                    const mouseX = $mouseX.value, mouseY = $mouseY.value;
                    // @ts-ignore
                    $tooltip.value = {
                        style: {
                            left: mouseX + 8,
                            top: mouseY + 12
                        },
                        visible: false,
                        content: props.tooltip({
                            hasClass(token: string): boolean {
                                return hoverCell.classList.contains(token);
                            },
                            hasRowClass(token: string): boolean {
                                return hoverCell.parentElement!.classList.contains(token);
                            },
                            get type() {
                                return hoverCell.getAttribute("data-type") as PsGridCellType;
                            },
                            get field() {
                                return hoverCell.getAttribute("data-field") as string;
                            },
                            get group() {
                                return hoverCell.getAttribute("data-group") as any;
                            },
                            get rowIndex(): number {
                                return Number(hoverCell.parentElement!.getAttribute("row-index"));
                            },
                            get columnIndex(): number {
                                return Number(hoverCell.getAttribute("column-index"));
                            },
                            get innerText() {
                                return hoverCell.querySelector<HTMLDivElement>(".ps-grid-cell-content")!.innerText;
                            }
                        })
                    };
                    requestAnimationFrame(() => {
                        if ($tooltip.value) {
                            $tooltip.value = { ...$tooltip.value, visible: true } as PsGridTooltip;
                        }
                    });
                } else {
                    if ($tooltip.value) {
                        $tooltip.value = { ...$tooltip.value, visible: false } as PsGridTooltip;
                        tooltipTimeout = setTimeout(() => {
                            $tooltip.value = null;
                        }, props.tooltipDelay);
                    }
                }
            }, props.tooltipDelay);
        }
        return () => clearTimeout(tooltipTimeout);
    });

    return reactivify<PsGridHover<T>>({
        hoverCell: $hoverCell,
        mouseX: $mouseX,
        mouseY: $mouseY,
        tooltip: $tooltip,
        onMouseOver,
        onMouseOut
    });
}
