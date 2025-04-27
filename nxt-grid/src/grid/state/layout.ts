import {batch, computed, effect, signal} from "@nimble/toolkit";
import {reactivify} from "./utils";
import {PsGridProps, DataItem} from "../index";
import {PsGridViewPort} from "./viewport";
import {PsGridData} from "./data";

export type PsGridHorizontalLayout = {
    pinnedColumns: PsGridColumnLayout[];
    scrollColumns: PsGridColumnLayout[];
    pinnedWidth: number;
    scrollWidth: number;
};

export type PsGridVerticalLayout = {
    pinnedRows: PsGridRowLayout[];
    scrollRows: PsGridRowLayout[];
    pinnedHeight: number;
    scrollHeight: number;
}

export type PsGridLayout = PsGridHorizontalLayout & PsGridVerticalLayout & {
    topIndex: number,
    bottomIndex: number
    leftIndex: number,
    rightIndex: number
    hasPinned: boolean;
    hasScroll: boolean;
    headerHeight: number;
    findByIndex: (layout: PsGridColumnLayout[], ref: { index: number }) => PsGridColumnLayout | undefined;
    findColumnIndex: (range: "pinnedColumns" | "scrollColumns", ref: { index: number }) => number;
    findRowIndex: (range: "pinnedColumns" | "scrollColumns", ref: { index: number }) => number;
}

export type PsGridColumnLayout = {
    index: number;
    width: number;
    left: number;
}

export type PsGridRowLayout = {
    index: number;
    top: number;
    height: number;
};

export const DEFAULT_COLUMN_WIDTH = 100;
export const DEFAULT_HEADER_HEIGHT = 32;
export const DEFAULT_ROW_HEIGHT = 28;

export const GRID_BORDER_WIDTH = 1;  // We do like html table and cater for the border size here...kind of...
export const GRID_BORDER_HEIGHT = 1;  // ...kind of

let FILTERS_ROW_HEIGHT = 28;

export type PsGridColumnLayoutUpdate = {
    index: number,
    field: string | number | symbol,
    pinned: boolean,
    width: number
};

const NO_VRT = location.search.indexOf("NO_VRT") >= 0;

const BUFFER_X = 0;
const BUFFER_Y = 0;

export function layoutColumns(columns: PsGridColumnLayout[]) {
    let left = 0;
    for (const column of columns) {
        column.left = left;
        left += column.width;
    }
    return left;
}

export function layoutRows(rows: PsGridRowLayout[]) {
    let top = 0;
    for (const row of rows) {
        row.top = top;
        top += row.height;
    }
    return top;
}

/**
 *
 * @param props
 * @param data
 * @param viewport
 */
export const defineLayout = <T extends DataItem>(
    props: PsGridProps<T>,
    data: PsGridData<T>,
    viewport: PsGridViewPort
) => {

    const $pinnedColumns = signal([] as PsGridColumnLayout[]);
    const $scrollColumns = signal([] as PsGridColumnLayout[]);

    const $pinnedWidth = signal(0);
    const $scrollWidth = signal(0);

    const $hasPinned = computed(() => $pinnedColumns.value.length > 0);
    const $hasScroll = computed(() => $scrollColumns.value.length > 0);

    effect(() => {
        const {columnDefs, defaultWidth} = props;
        const pinned = [] as PsGridColumnLayout[];
        const scroll = [] as PsGridColumnLayout[];
        if (columnDefs?.length) {
            let index = 0;
            for (const column of columnDefs) (column.pinned ? pinned : scroll).push({
                index: index++,
                left: 0,
                width: (column.width ?? defaultWidth) + GRID_BORDER_WIDTH // NOTE: grid cells use border-box
            });
        }
        $pinnedColumns.value = pinned;
        $scrollColumns.value = scroll;
    });

    effect(() => {
        $pinnedWidth.value = layoutColumns($pinnedColumns.value);
    });

    const $headerHeight = computed(() => (
        GRID_BORDER_HEIGHT + (props.headerHeight ?? DEFAULT_HEADER_HEIGHT)
        + (props.filters && FILTERS_ROW_HEIGHT || 0)
    ));

    const $pinnedRows = signal<PsGridRowLayout[]>([]);
    const $pinnedHeight = signal(0);

    const $scrollRows = signal<PsGridRowLayout[]>([]);
    const $scrollHeight = signal(0);

    effect(() => {
        const {rowHeight = DEFAULT_ROW_HEIGHT, dataSource} = props;
        const items = dataSource?.keys ?? data.filtered;
        const scroll = [];
        if (items?.length) {
            const constantHeight = typeof rowHeight !== "function" ? rowHeight + GRID_BORDER_HEIGHT : null;
            const computeHeight = typeof rowHeight === "function" ? rowHeight : Number;
            let top = 0, index = 0;
            for (const item of items) {
                const height = constantHeight ?? computeHeight(item, index) + GRID_BORDER_HEIGHT; // NOTE: grid rows use border-box
                scroll.push({
                    index: index++,
                    top,
                    height
                });
                top += height;
            }
        }
        $scrollRows.value = scroll;
    });

    const $topIndex = signal(0);
    const $bottomIndex = signal(0);
    const $leftIndex = signal(0);
    const $rightIndex = signal(0);

    effect(batch.bind(null, NO_VRT ? () => {
        $leftIndex.value = 0;
        $rightIndex.value = $scrollColumns.value.length;
        $scrollWidth.value = layoutColumns($scrollColumns.value);
    } : () => {
        const scrollColumns = $scrollColumns.value;
        let leftIndex, rightIndex;
        const minX = props.inverse
            ? $scrollWidth.value - viewport.clientWidth - viewport.scrollLeft
            : viewport.scrollLeft;
        let left = 0;
        for (leftIndex = 0; leftIndex < scrollColumns.length; leftIndex++) {
            const column = scrollColumns[leftIndex];
            column.left = left;
            left += column.width;
            if (left >= minX) {
                left -= column.width;
                break;
            }
        }
        const maxX = minX + viewport.clientWidth;
        for (rightIndex = leftIndex; rightIndex < scrollColumns.length; rightIndex++) {
            const column = scrollColumns[rightIndex];
            column.left = left;
            if (left > maxX) {
                break;
            }
            left += column.width;
        }
        for (let index = rightIndex; index < scrollColumns.length; index++) {
            const column = scrollColumns[index];
            column.left = left;
            left += column.width;
        }
        $scrollWidth.value = left;
        $leftIndex.value = Math.max(leftIndex - BUFFER_X, 0);
        $rightIndex.value = Math.min(rightIndex + BUFFER_X, scrollColumns.length);
    }) as () => void);

    effect(batch.bind(null, NO_VRT ? () => {
        $topIndex.value = 0;
        $bottomIndex.value = $scrollRows.value.length;
        $scrollHeight.value = layoutRows($scrollRows.value);
    } : () => {
        const scrollRows = $scrollRows.value;
        let topIndex, bottomIndex;
        const minY = viewport.scrollTop;
        let top = 0;
        for (topIndex = 0; topIndex < scrollRows.length; topIndex++) {
            const row = scrollRows[topIndex];
            row.top = top;
            top += row.height;
            if (top >= minY) {
                top -= row.height;
                break;
            }
        }
        const maxY = minY + viewport.clientHeight;
        for (bottomIndex = topIndex; bottomIndex < scrollRows.length; bottomIndex++) {
            const row = scrollRows[bottomIndex];
            row.top = top;
            if (top > maxY) {
                break;
            }
            top += row.height;
        }
        for (let index = bottomIndex; index < scrollRows.length; index++) {
            const row = scrollRows[index];
            row.top = top;
            top += row.height;
        }
        $scrollHeight.value = top;
        $topIndex.value = Math.max(topIndex - BUFFER_Y, 0);
        $bottomIndex.value = Math.min(bottomIndex + BUFFER_Y, scrollRows.length);
    }) as () => void);

    function findColumnIndex(range: "pinnedColumns" | "scrollColumns", ref: { index: number }) {
        const $layout = range === "pinnedColumns" ? $pinnedColumns : $scrollColumns;
        return $layout.value.findIndex(item => item.index === ref.index);
    }

    function findRowIndex(range: "pinnedColumns" | "scrollColumns", ref: { index: number }) {
        const $layout = range === "pinnedColumns" ? $pinnedRows : $scrollRows;
        return $layout.value.findIndex(item => item.index === ref.index);
    }

    return reactivify<PsGridLayout>({
        pinnedColumns: $pinnedColumns,
        pinnedWidth: $pinnedWidth,
        hasPinned: $hasPinned,
        scrollColumns: $scrollColumns,
        scrollWidth: $scrollWidth,
        hasScroll: $hasScroll,
        headerHeight: $headerHeight,
        pinnedRows: [],
        pinnedHeight: 0,
        scrollRows: $scrollRows,
        scrollHeight: $scrollHeight,
        topIndex: $topIndex,
        bottomIndex: $bottomIndex,
        leftIndex: $leftIndex,
        rightIndex: $rightIndex,
        findByIndex: (layout, ref) => layout.find(item => item.index === ref.index),
        findColumnIndex,
        findRowIndex
    });
};
