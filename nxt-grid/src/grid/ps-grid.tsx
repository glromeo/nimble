import {PsGridContainer} from "./ps-grid-container";
import {createPsGridStore, DEFAULT_PROPS, PsGridStore} from "./state/store";
import {PsColumnTotals, PsGridSelection} from "./types";
import {PsGridColumn} from "./state/columns";
import {PsGridRow} from "./state/rows";
import {PsGridCallbacks} from "./state/callbacks";
import {PsCellAPI, PsGridCellRenderer, DEFAULT_CELL_RENDERER} from "./ps-grid-cell";
import {DEFAULT_COLUMN_WIDTH, DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_HEIGHT} from "./state/layout";
import {DEFAULT_CELL_FORMATTER, DEFAULT_CELL_FORMATTERS} from "./state/state";
import { JSX } from "@nimble/toolkit";

import "./style.css";

export type DataItem = Record<string | number, any> | Array<any> & { groupBy?: string | number };

export type PsGridProps<T extends DataItem, K extends keyof DataItem = any> = {
    className: JSX.HTMLAttributes<HTMLDivElement>["class"];
    columnDefs: PsGridColumnDef<T>[];
    dataSource?: PsGridDataSource<K, T>; // A class name to be added to the root grid element
    defaultCellRenderer: PsGridCellRenderer<T>;
    defaultCellStyle?: JSX.HTMLAttributes<HTMLDivElement>["style"];
    defaultFormatter: PsGridCellFormatter<T>;
    defaultGetter: PsGridCellGetter<T>;
    defaultJustify: PsGridColumnDef<T>["justify"];
    defaultWidth: number;
    fill: boolean;
    filters?: PsGridFilters<T> | "auto";
    formatters: PsGridCellFormatters<T>;
    getters?: PsGridCellGetters<T>;
    groupBy?: Array<Omit<keyof T, "symbol">>;
    headerHeight: number;
    gradient: [number, number, number] | undefined;
    inverse: boolean;
    resizable: boolean;
    rowClassName?: (item: T, index: number) => (string | undefined);
    rowData: T[];
    rowDetails?: (row: PsGridRow<T>) => JSX.Element | null;
    rowHeight: number | ((data: T, index: number) => number);
    rowId?: ((item: T) => string | number) | keyof T;
    selection?: PsGridSelection<T> | "rows" | "columns" | "both";
    sort?: PsGridSort<T> | "auto";
    sortLimit: number;
    stripes: boolean;
    style: JSX.HTMLAttributes<HTMLDivElement>["style"];
    tooltip: (cellApi: PsCellAPI) => JSX.Element;
    tooltipDelay: number;
};

// TODO: style should be implemented as dynamic style, concatenating it in the for loop of PsGridScrollStyleX
// I have to ponder the performance implications and this will probably be better of postponed until I
// refactor the dynamic classes to be signal updated CSSProperties

export type PsGridColumnDef<T extends DataItem> = {
    type?: PsGridCellType;
    field?: keyof T;
    className?: JSX.HTMLAttributes<HTMLDivElement>["class"];
    style?: JSX.HTMLAttributes<HTMLDivElement>["style"]
    width?: number;
    justify?: AywGridCellJustify;
    formatter?: PsGridCellFormatter<T>;
    getter?: PsGridCellGetter<T>;
    renderer?: PsGridCellRenderer<T>;
    hidden?: boolean;
    key?: (item: T) => string;
    label?: string;
    pinned?: boolean;
    resizable?: boolean;
    sortable?: boolean;
    tooltip?: string;
    totals?: PsColumnTotals<T>;
};

export type PsGridCellType =
    | "csv"
    | "date"
    | "datetime"
    | "flag"
    | "number"
    | "percentage"
    | "price"
    | "quantity"
    | "spread"
    | "text"
    | "time"
    | "unknown"
    | "yield";

export type PsGridCellFormatters<T extends DataItem> = Record<PsGridCellType, PsGridCellFormatter<T>>;
export type PsGridCellFormatter<T extends DataItem> = (data: T, field: keyof T) => string;
export type PsGridCellGetters<T extends DataItem> = Record<PsGridCellType, PsGridCellGetter<T>>;
export type PsGridCellGetter<T extends DataItem> = (data: T, field: keyof T) => number | string | boolean | Date;
export type AywGridCellJustify = "left" | "right" | "center";
export type PsGridFilters<T extends DataItem> = Record<keyof T, string | null | ((data: T) => boolean)>;
export type PsGridSort<T extends DataItem> = Array<[keyof T, "asc" | "desc"]>;
export type PsGridOnSort<T extends DataItem> = (column: PsGridColumn<T>, e: MouseEvent) => void;

export type PsGridDataSource<K extends string | number | symbol, T extends DataItem> = {
    keys: K[]
    rowHeight: (key: K) => number;
    fetch(fromIndex: number, toIndex: number, write: (values: Array<T> | Record<K, T>) => void): void;
}

/**
 *
 * @param columnDefs
 * @param children
 * @param onSort
 * @param props
 * @constructor
 */
export function PsGrid<T extends DataItem>({columnDefs, onSort, ...props}: Partial<PsGridCallbacks<T> & PsGridProps<T>>) {
    const store = createPsGridStore<T>();

    store.props.columnDefs = columnDefs ?? [];
    if (onSort) {
        store.callbacks.onSort = onSort;
    }
    for (const [key, value] of Object.entries(props)) {
        (store.props as any)[key] = value === undefined ? (DEFAULT_PROPS as any)[key] : value;
    }

    return <PsGridContainer store={store as PsGridStore<DataItem>} />;
}

PsGrid.CellFormatter = DEFAULT_CELL_FORMATTER;
PsGrid.CellFormatters = DEFAULT_CELL_FORMATTERS;
PsGrid.CellRenderer = DEFAULT_CELL_RENDERER;
PsGrid.ColumnWidth = DEFAULT_COLUMN_WIDTH;
PsGrid.RowHeight = DEFAULT_ROW_HEIGHT;
PsGrid.HeaderHeight = DEFAULT_HEADER_HEIGHT;
