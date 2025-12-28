import {cellJustify, PsGridCellRenderer} from "../ps-grid-cell";
import {computed, effect, JSX, Signal} from "@nimble/toolkit";
import {defineReactiveProperty, reactivify} from "./utils";
import {PsGridColumnLayout, PsGridLayout} from "./layout";
import {DataItem, PsGridCellFormatter, PsGridColumnDef, PsGridProps} from "../ps-grid";
import {PsGridDnD} from "./dnd";
import {PsGridCallbacks} from "./callbacks";
import {PsGridColumnSortHandler} from "../ps-grid-sort-icon";
import {PsGridState} from "./state";

export type PsGridColumns<T extends DataItem = DataItem> = {
    pinned: PsGridColumn<T>[];
    visible: PsGridColumn<T>[];
}

export type PsGridColumn<T extends DataItem = DataItem> = {
    aggregate?: boolean;
    className?: JSX.HTMLAttributes<HTMLDivElement>["class"];
    comparator?: (a: T, b: T) => -1 | 0 | 1;
    field: keyof T;
    formatter: PsGridCellFormatter<T>
    index: number;
    label: string;
    renderer: PsGridCellRenderer<T>;
    resizable?: boolean;
    sortable?: boolean;
    selected: Signal<boolean>;
    style?: PsGridColumnDef<T>["style"];
    tooltip?: string;
    type: string;
    filter?: string | null;
    onSort?: PsGridColumnSortHandler;
};

/**
 *
 * @param gId
 * @param props
 * @param state
 * @param dnd
 * @param layout
 * @param callbacks
 */
export const defineColumns = <T extends DataItem = DataItem>(
    gId: string,
    props: PsGridProps<T>,
    state: PsGridState<T>,
    dnd: PsGridDnD<T>,
    layout: PsGridLayout,
    callbacks: PsGridCallbacks<T>
) => {

    const $createColumn = computed(() => {
        const cache = new WeakMap<PsGridColumnLayout, PsGridColumn<T>>();
        const columnDefs = props.columnDefs;
        const formatters = state.formatters;
        const defaultRenderer = props.defaultCellRenderer;
        const defaultResizable = props.resizable ?? false;
        const defaultSortable = state.sortable;
        const defaultCellStyle = props.defaultCellStyle;
        const groupBy = props.groupBy;
        const defaultJustify = props.defaultJustify;
        const onSort = callbacks.onSort;
        return function (layoutColumn: PsGridColumnLayout): PsGridColumn<T> {
            let column = cache.get(layoutColumn);
            if (column === undefined) {
                const index = layoutColumn.index;
                const {
                    className,
                    field = index,
                    formatter,
                    justify = defaultJustify,
                    label,
                    renderer = defaultRenderer,
                    resizable = defaultResizable,
                    sortable = defaultSortable,
                    style = defaultCellStyle,
                    tooltip,
                    type = "unknown"
                } = columnDefs[index];
                column = {
                    className: `ps-grid-cell ${gId}-c${index} ${type} justify-${justify ?? cellJustify[type]} ${className ?? ""}`,
                    field,
                    formatter: formatter ?? (type && formatters[type] || formatters.unknown),
                    index,
                    label: label ?? String(field),
                    renderer,
                    resizable,
                    selected: false, // computed(()=> state.columnSelection?.includes(field) ?? false),
                    style,
                    tooltip,
                    type,
                    filter: null
                };
                if (groupBy?.includes(field!)) {
                    column!.aggregate = true;
                }
                if (sortable) {
                    column!.onSort = onSort.bind(null, column!) as any;
                }
                defineReactiveProperty(column!, "filter", computed(() => {
                    const text = state.filters?.[field];
                    return typeof text === "string" && text || null;
                }));
                cache.set(layoutColumn, column!);
            }
            return column!;
        };
    });

    function unshift(columns: PsGridColumn<T>[]) {
        if (dnd.dragColumn) {
            let {dragColumn, dropIndex} = dnd;
            if (dropIndex > 0 && dropIndex < columns.length && columns[dropIndex] === dragColumn) {
                do {
                    columns[dropIndex--] = columns[dropIndex];
                } while (dropIndex > 0);
                columns[0] = dragColumn;
            }
        }
        return columns;
    }

    const $pinnedColumns = computed(() => {
        return unshift(layout.pinnedColumns.map($createColumn.value));
    });

    const $visibleColumns = computed(() => {
        const createColumn = $createColumn.value;
        const {leftIndex, rightIndex, scrollColumns} = layout;
        const columns = new Array<PsGridColumn<T>>();
        for (let layoutIndex = leftIndex; layoutIndex < rightIndex; layoutIndex++) {
            columns[layoutIndex-leftIndex] = createColumn(scrollColumns[layoutIndex]);
        }
        return unshift(columns);
    });

    return reactivify<PsGridColumns<T>>({
        pinned: $pinnedColumns,
        visible: $visibleColumns
    });
};
