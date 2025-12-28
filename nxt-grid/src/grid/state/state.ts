import {
    PsGridCellFormatter,
    PsGridCellFormatters, PsGridCellGetter, PsGridCellGetters,
    PsGridFilters,
    PsGridProps,
    PsGridSort,
    DataItem,
} from "../ps-grid";
import {effect, signal} from "@nimble/toolkit";
import {reactivify} from "./utils";
import {
    formatDate,
    formatDateTime,
    formatPercentage,
    formatPrice,
    formatQuantity,
    formatSpread,
    formatTime,
    formatYield,
} from "./format";
import {computed} from "@nimble/toolkit";

export type PsGridState<T extends DataItem> = {
    columnSelection: (keyof T)[] | null;
    rowSelection: any[] | null;
    fillX: boolean;
    fillY: boolean;
    filters: PsGridFilters<T> | null;
    formatters: PsGridCellFormatters<T>;
    getters: PsGridCellGetters<T>;
    maxHeight: number;
    maxWidth: number;
    resizing: boolean;
    sort: PsGridSort<T> | null;
    sortable: boolean;
};

/**
 *
 * @param props
 */
export function defineState<T extends DataItem>(props: PsGridProps<T>) {

    const $filters = signal<PsGridFilters<T> | null>(null);

    const $formatters = computed(() => ({
        ...DEFAULT_CELL_FORMATTERS,
        ...props.formatters,
        unknown: props.defaultFormatter ?? DEFAULT_CELL_FORMATTER
    } as PsGridCellFormatters<T>));

    const $getters = computed(() => ({
        ...DEFAULT_CELL_GETTERS,
        ...props.getters,
        unknown: props.defaultGetter ?? DEFAULT_CELL_GETTER
    } as PsGridCellFormatters<T>));

    const $sortable = computed(() => !!$sort.value);

    effect(() => {
        if (props.filters === "auto") {
            const filters = props.columnDefs.map(({field}, index) => [field || index, null]);
            $filters.value = Object.fromEntries(filters) as PsGridFilters<T>;
        } else {
            $filters.value = props.filters || null;
        }
    });

    const $sort = signal<PsGridSort<T> | null>(null);

    effect(() => {
        $sort.value = props.sort === "auto" ? [] as PsGridSort<T> : props.sort || null;
    });

    let $columnSelection = signal<number[]|null>(null);
    let $rowSelection = signal<number[]|null>(null);

    effect(() => {
        const selection = props.selection;
        if (selection === "both" || selection === "rows") {
            $rowSelection.value = [];
        }
        if (selection === "both" || selection === "columns") {
            $columnSelection.value = [];
        }
    });

    return reactivify<PsGridState<T>>({
        columnSelection: $columnSelection,
        rowSelection: $rowSelection,
        fillX: false,
        fillY: false,
        filters: $filters,
        formatters: $formatters,
        getters: $getters,
        sort: $sort,
        maxHeight: Number.MAX_SAFE_INTEGER,
        maxWidth: Number.MAX_SAFE_INTEGER,
        resizing: false,
        sortable: $sortable
    });
}

export const DEFAULT_CELL_FORMATTER: PsGridCellFormatter<any> = (data, field) => data[field]?.toString();

export const DEFAULT_CELL_FORMATTERS: PsGridCellFormatters<any> = {
    text: (data, field) => data[field] ?? "-",
    flag: (data, field) => (data[field] === true || data[field] === "true" ? "Y" : "N"),
    number: (data, field) => (isNaN(data[field]) ? "-" : data[field]),
    quantity: (data, field) => formatQuantity(data[field]),
    spread: (data, field) => formatSpread(data[field]),
    price: (data, field) => formatPrice(data[field]),
    yield: (data, field) => formatYield(data[field]),
    date: (data, field) => formatDate(data[field]),
    time: (data, field) => formatTime(data[field]),
    datetime: (data, field) => formatDateTime(data[field]),
    percentage: (data, field) => formatPercentage(data[field]),
    csv: (data, field) => data[field]?.map((text: any) => String(text) ?? "-").join(", "),
    unknown: DEFAULT_CELL_FORMATTER
};

export const DEFAULT_CELL_GETTER: PsGridCellGetter<any> = (data, field) => data[field];

const NUMBER_GETTER:PsGridCellGetter<any> = (data, field) => data[field] || 0;
const TIME_GETTER:PsGridCellGetter<any> = (data, field) => data[field]?.getTime();

export const DEFAULT_CELL_GETTERS: PsGridCellGetters<any> = {
    text: DEFAULT_CELL_GETTER,
    flag: DEFAULT_CELL_FORMATTERS["flag"],
    number: NUMBER_GETTER,
    quantity: NUMBER_GETTER,
    spread: NUMBER_GETTER,
    price: NUMBER_GETTER,
    yield: NUMBER_GETTER,
    date: TIME_GETTER,
    time: TIME_GETTER,
    datetime: TIME_GETTER,
    percentage: NUMBER_GETTER,
    csv: (data, field) => data[field]?.map((text: any) => String(text) ?? "-").join(", "),
    unknown: DEFAULT_CELL_GETTER
};
