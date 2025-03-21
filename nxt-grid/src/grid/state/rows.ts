import {batch, Signal, signal} from "@nimble/toolkit";
import {computed} from "@nimble/toolkit";
import {defineReactiveProperty, reactivify} from "./utils";
import {PsGridDataSource, PsGridProps, DataItem} from "../ps-grid";
import {PsGridLayout} from "./layout";
import {PsGridState} from "./state";
import {PsGridData} from "./data";

export type PsGridRows<T extends DataItem = DataItem> = {
    pinned: PsGridRow<T>[];
    visible: PsGridRow<T>[];
}

export type PsGridRow<T extends DataItem = DataItem> = {
    index: number;
    id: any;
    className?: string;
    state?: string;
    selected: boolean;
    data: T
}

const EMPTY = Object.freeze({} as any);

/**
 *
 * @param gId
 * @param props
 * @param state
 * @param data
 * @param layout
 */
export const defineRows = <T extends DataItem = DataItem>(
    gId: string,
    props: PsGridProps<T>,
    state: PsGridState<T>,
    data: PsGridData<T>,
    layout: PsGridLayout,
) => {
    const $pinnedRows = computed(() => [] as PsGridRow<T>[]);

    let rowCache = {} as Record<any, PsGridRow<T>>;
    const $createRow = computed(() => {
        const {rowClassName} = props;
        return function createRow(row: PsGridRow<T>): PsGridRow<T> {
            defineReactiveProperty(row, "data", signal(row.data));
            if (row.state !== undefined) {
                defineReactiveProperty(row, "state", signal(row.state));
            }
            defineReactiveProperty(row, "className", signal(rowClassName?.(row.data!, row.index!)));
            return row as PsGridRow<T>;
        };
    });

    const $visibleRows = computed(() => {
        const createRow = $createRow.value;
        const {topIndex, bottomIndex} = layout;
        const visible = new Array(bottomIndex - topIndex);
        const dataSource = props.dataSource as PsGridDataSource<any, T>;
        if (dataSource) {
            const {keys} = dataSource;
            for (let index = topIndex; index < bottomIndex; index++) {
                const key = keys[index];
                let row = rowCache[key];
                if (row !== undefined) {
                    row.state = "pending";
                } else {
                    row = createRow({
                        id: key,
                        index,
                        state: "pending",
                        selected: false,
                        data: EMPTY,
                    });
                    // defineReactiveProperty(row, "selected", computed(() => state.rowSelection?.includes(index) ?? false));
                }
                visible[index - topIndex] = row;
            }
            dataSource.fetch(topIndex, bottomIndex, (data) => batch(() => {
                let row;
                if (data instanceof Array) {
                    let i = bottomIndex - topIndex;
                    while (--i >= 0) if (row = visible[i]) {
                        row.state = "ready";
                        row.data = data[i];
                    }
                } else {
                    for (const key of Object.keys(data)) if (row = rowCache[key]) {
                        row.state = "ready";
                        row.data = data[key];
                    }
                }
            }));
            rowCache = {} as typeof rowCache;
            for (const row of visible) {
                rowCache[row.id] = row;
            }
        } else {
            const rows = data.aggregated;
            const {rowId} = props;
            let index: number;
            const getId = typeof rowId === "function" ? rowId : rowId ? (data: T) => data[rowId] : () => index;
            for (index = topIndex; index < bottomIndex; index++) {
                const data = rows![index];
                const id = getId(data);
                visible[index - topIndex] = createRow({
                    id,
                    index,
                    selected: false,
                    data,
                });
                // defineReactiveProperty(visible[index - topIndex], "selected", computed(() => state.rowSelection?.includes(id) ?? false));
            }
        }
        return visible;
    });

    return reactivify<PsGridRows<T>>({
        pinned: $pinnedRows,
        visible: $visibleRows
    });
};
