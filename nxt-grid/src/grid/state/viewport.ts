import {batch, effect, Signal, signal} from "@nimble/toolkit";

import {reactivify} from "./utils";
import {PsGridCallbacks} from "./callbacks";
import {PsGridProps, DataItem} from "../ps-grid";

export type PsGridViewPort = {
    grid: HTMLDivElement | null;
    scrollLeft: number
    scrollTop: number
    clientLeft: number
    clientTop: number
    clientWidth: number
    clientHeight: number
}

/**
 *
 * @param props
 * @param state
 * @param callbacks
 */
export const defineViewport = <T extends DataItem>(
    props: PsGridProps<T>,
    callbacks: PsGridCallbacks<T>
): PsGridViewPort => {

    const $grid = signal<HTMLDivElement | null>(null);

    const $clientLeft = signal(0);
    const $clientTop = signal(0);
    const $scrollLeft = signal(0);
    const $scrollTop = signal(0);
    const $clientWidth = signal(0);
    const $clientHeight = signal(0);

    let af = 0;

    effect(() => {
        const grid = $grid.value;
        if (grid) {
            grid.scrollLeft = props.inverse ? Number.MAX_SAFE_INTEGER : 0;

            const refreshViewPort = batch.bind(null, () => {
                $scrollLeft.value = grid.scrollLeft;
                $scrollTop.value = grid.scrollTop;
                $clientLeft.value = grid.clientLeft;
                $clientTop.value = grid.clientTop;
                $clientWidth.value = grid.clientWidth;
                $clientHeight.value = grid.clientHeight;
                af = 0;
            });
            af ||= requestAnimationFrame(refreshViewPort);

            const mutationObserver = () => {
                const deltaX = $clientWidth.value - grid.clientWidth;
                af ||= requestAnimationFrame(refreshViewPort);
                if (props.inverse && deltaX) {
                    grid.scrollLeft += deltaX;
                }
            }

            const scrollListener = () => {
                af ||= requestAnimationFrame(refreshViewPort);
                callbacks.onScroll?.(grid);
            };

            const observer = new ResizeObserver(mutationObserver);
            observer.observe(grid);
            grid.addEventListener("scroll", scrollListener, {capture: true, passive: true});

            return () => {
                grid.removeEventListener("scroll", scrollListener);
                observer.disconnect();
            };
        }
    });

    return reactivify({
        grid: $grid as Signal<HTMLDivElement>,
        scrollLeft: $scrollLeft,
        scrollTop: $scrollTop,
        clientLeft: $clientLeft,
        clientTop: $clientTop,
        clientWidth: $clientWidth,
        clientHeight: $clientHeight
    });
};
