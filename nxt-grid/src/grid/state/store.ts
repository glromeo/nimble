import {reactivify} from "./utils";
import {batch, signal} from "@nimble/toolkit";
import {PsGridViewPort, defineViewport} from "./viewport";
import {PsGridColumns, defineColumns} from "./columns";
import {PsGridRows, defineRows} from "./rows";
import {PsGridCallbacks, defineCallbacks} from "./callbacks";
import {PsGridLayout, DEFAULT_COLUMN_WIDTH, DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_HEIGHT, defineLayout} from "./layout";
import {DEFAULT_CELL_RENDERER} from "../ps-grid-cell";
import {PsGridDnD, defineDnD} from "./dnd";
import {PsGridProps, DataItem} from "../ps-grid";
import {PsGridState, DEFAULT_CELL_FORMATTERS, defineState, DEFAULT_CELL_GETTER} from "./state";
import {PsGridData, defineData} from "./data";
import {PsGridHover, defineHover} from "./hover";

export type PsGridStore<T extends DataItem> = {
    gId: string;
    props: PsGridProps<T>
    state: PsGridState<T>;
    viewport: PsGridViewPort;
    layout: PsGridLayout;
    data: PsGridData<T>;
    columns: PsGridColumns<T>;
    rows: PsGridRows<T>;
    dnd: PsGridDnD<T>;
    hover: PsGridHover<T>;
    callbacks: PsGridCallbacks<T>;
};

let sequence = 0;

export const DEFAULT_PROPS:PsGridProps<DataItem> = {
    className: undefined,
    columnDefs: [],
    dataSource: undefined,
    defaultCellRenderer: DEFAULT_CELL_RENDERER,
    defaultCellStyle: undefined,
    defaultFormatter: DEFAULT_CELL_FORMATTERS.unknown,
    defaultGetter: DEFAULT_CELL_GETTER,
    defaultJustify: "center",
    defaultWidth: DEFAULT_COLUMN_WIDTH,
    fill: false,
    filters: undefined,
    formatters: DEFAULT_CELL_FORMATTERS,
    getters: undefined,
    groupBy: undefined,
    headerHeight: DEFAULT_HEADER_HEIGHT,
    gradient: undefined,
    inverse: false,
    resizable: false,
    rowClassName: undefined,
    rowData: [],
    rowDetails: undefined,
    rowHeight: DEFAULT_ROW_HEIGHT,
    rowId: undefined,
    selection: undefined,
    sort: undefined,
    sortLimit: 3,
    stripes: false,
    style: undefined,
    tooltip: (cell) => new Text(cell.innerText),
    tooltipDelay: 250
};

export const createPsGridStore = <T extends DataItem>(): PsGridStore<T> => batch(() => {

    const props = reactivify<PsGridProps<T>>(Object.fromEntries(
        Object.entries(DEFAULT_PROPS).map(([key, value]) => [key, signal(value)])
    ) as any);

    const gId = `ps-g${sequence++}`;
    const state = defineState(props);
    const callbacks = defineCallbacks(props, state);
    const viewport = defineViewport(props, callbacks);
    const hover = defineHover(props, state, viewport);
    const data = defineData(props, state);
    const layout = defineLayout(props, data, viewport);
    const dnd = defineDnD(props, viewport, layout);
    const columns = defineColumns(gId, props, state, dnd, layout, callbacks);
    const rows = defineRows(gId, props, state, data, layout);

    return reactivify<PsGridStore<T>>({
        gId,
        props,
        state,
        viewport,
        layout,
        data,
        columns,
        rows,
        dnd,
        hover,
        callbacks
    });
});
