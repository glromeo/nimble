import {PsGridCellGetter, PsGridProps, DataItem} from "../ps-grid";
import {PsGridState, DEFAULT_CELL_GETTER} from "./state";
import {reactivify} from "./utils";
import {computed} from "@nimble/toolkit";

export type Bucket<T> = {
    [K in keyof T]: T[K][] | Bucket<T>;
};

export type PsGridData<T extends DataItem> = {
    aggregated: T[];
    filtered: T[];
    sorted: T[];
    threshold: null | ((index: number) => number);
}

type SortStage<T extends DataItem> = {
    field: keyof T,
    get: PsGridCellGetter<T>,
    sign: 1 | -1
};

/**
 *
 * @param props
 * @param state
 */
export function defineData<T extends DataItem>(
    props: PsGridProps<T>,
    state: PsGridState<T>,
) {
    const $sortFields = computed(() => {
        const fields = [] as Array<keyof T>;
        if (state.sort) {
            for (const [field] of state.sort) {
                fields.push(field);
            }
        }
        return fields;
    });

    const $sortStages = computed(() => {
        const columnDefs = props.columnDefs;
        const { formatters, getters }  = state;
        const fieldGetter = {} as Record<keyof T, (data: T, field: keyof T) => any>;
        let index = 0;
        let fields = $sortFields.value;
        if (fields.length > 0) {
            for (const columnDef of columnDefs) {
                const field = columnDef.field ?? index;
                index++;
                if (fields.includes(field)) {
                    const {getter, formatter, type = "unknown"} = columnDef;
                    fieldGetter[field] = getter ?? getters[type] ?? formatter ?? formatters[type] ?? DEFAULT_CELL_GETTER;
                    if ((fields = fields.filter(i => i !== field)).length === 0) break;
                }
            }
            return state.sort!.map(([field, dir]) => ({
                field,
                get: fieldGetter[field],
                sign: dir === "asc" ? 1 : -1,
            }));
        }
    });

    const $sorted = computed(() => {
        const stages = $sortStages.value;
        const data = props.rowData;
        if (stages) {
            const {field, get, sign} = stages[0];
            const mapped = props.rowData.map((data, i) => {
                return {i, v: get(data, field)} as any;
            });
            mapped.sort((a, b): number => {
                let l = a.v, r = b.v;
                if (l > r) {
                    return sign;
                }
                if (l < r) {
                    return -sign;
                }
                for (let s = 1; s < stages.length; s++) {
                    const {get, field, sign} = stages[s];
                    l = a[s] ??= get(data[a.i], field);
                    r = b[s] ??= get(data[b.i], field);
                    if (l > r) {
                        return sign;
                    }
                    if (l < r) {
                        return -sign;
                    }
                }
                return 0;
            });
            for (let j = 0; j < mapped.length; j++) {
                mapped[j] = data[mapped[j].i];
            }
            return mapped;
        }
        return data;
    });

    const $threshold = computed(() => {
        const stages = $sortStages.value;
        if (stages?.length === 1) {
            const {get, sign} = stages[0];
            const values = $sorted.value.map(get);
            const buckets = new Map();
            values.forEach(buckets.set, buckets);
            const range = buckets.size;
            let grade = sign > 0 ? 0 : range;
            for (const key of buckets.keys()) {
                buckets.set(key, grade / range);
                grade += sign;
            }
            return (index: number) => buckets.get(values[index]);
        }
        return null;
    });

    const defaultFilter = (datum?: T) => datum != null;

    const $filter = computed(() => {
        const filters = state.filters;
        if (filters) {
            const fns: Array<(data: T) => boolean> = [];
            const columnDefs = props.columnDefs;
            const formatters = state.formatters;
            let index = 0;
            for (const columnDef of columnDefs) {
                const field = columnDef.field ?? index;
                index++;
                const filter = filters[field];
                if (typeof filter === "string") {
                    const re = new RegExp(filter, "i");
                    let {type, formatter} = columnDef;
                    formatter ??= (type && formatters[type] || formatters.unknown);
                    fns.push((data: T) => re.test(formatter(data, field)));
                } else if (typeof filter === "function") {
                    fns.push(filter);
                }
            }
            if (fns.length) {
                return (datum: T) => {
                    for (let i = 0; i < fns.length; i++) {
                        if (!fns[i](datum)) return false;
                    }
                    return true;
                };
            }
        }
        return defaultFilter;
    });

    const $filtered = computed(() => {
        const filter = $filter.value;
        return filter ? $sorted.value.filter(filter) : $sorted.value;
    });

    const $groupByReducer = computed(() => {
        const {groupBy} = props;
        if (groupBy?.length) {
            const last = groupBy.length - 1;
            let body = "let k,n,b=a;\n";
            for (let g = 0; g < last; g++) {
                body = `${body}if (undefined === (b=(n=b)[k=String(d["${groupBy[g]}"])])) b=n[k]={};\n`;
            }
            body = `${body}if (undefined === (b=(n=b)[k=String(d["${groupBy[last]}"])])) n[k]=[i]; else b.push(i);\nreturn a;`;
            return new Function("a", "d", "i", body) as <R = Record<keyof T, any[]>>(a: R, d: T, i: number) => R;
        }
    });

    const $aggregate = computed(() => {
        const {columnDefs} = props;
        let index = 0;
        let body = "return {\n\t'groupBy':key,[key]:items[0][key],\n", fns = [] as any[];
        for (const {field = index, totals} of columnDefs) if (totals) {
            body = `${body}\t"${field as any}":this[${fns.length}](items),\n`;
            fns.push(totals);
            index++;
        }
        body += "};\n";
        return (new Function("key", "items", body)).bind(fns);
    });

    const $flatten = computed(() => {
        const {groupBy} = props;
        if (groupBy?.length) {
            const aggregate = $aggregate.value;
            const rows = [] as T[];
            return function merge(bucket: Bucket<T>, depth: number) {
                const buckets = Object.values(bucket);
                const field = groupBy[depth];
                if (++depth === groupBy.length) {
                    for (let i = 0; i < buckets.length; i++){
                        const children = buckets[i];
                        rows.push(buckets[i] = aggregate(field, children));
                        children.forEach(Array.prototype.push, rows);
                    }
                } else {
                    for (let i = 0; i < buckets.length; i++){
                        const bucket = buckets[i];
                        const rowIndex = rows.length;
                        rows.push(null as any);
                        rows[rowIndex] = buckets[i] = aggregate(field, merge(bucket.values, depth));
                    }
                }
                return buckets;
            }
        }
    });

    const $aggregated = computed(() => {
        const filtered = $filtered.value;
        const groupByReducer = $groupByReducer.value;
        if (groupByReducer !== undefined) {
            return $flatten.value!(filtered.reduce(groupByReducer, {}), 0);
        }
        return filtered;
    });

    return reactivify<PsGridData<T>>({
        aggregated: $aggregated,
        filtered: $filtered,
        sorted: $sorted,
        threshold: $threshold,
    });
}
