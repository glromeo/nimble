import {JSX, Signal} from "@nimble/toolkit";
import {DataItem} from "./ps-grid";
import {PsGridStore} from "./state/store";

export type PsgFC<P = {}, T extends DataItem = DataItem> = (props: P & { store: PsGridStore<T>, children?: JSX.Element | JSX.Element[] | null }) => JSX.Element | null;

export type PsColumnTotals<T extends DataItem> = (data: T[], field: keyof T, selected?: boolean) => JSX.Element | string | number | null;

export type PsGridSelection<T extends DataItem> = Signal<PsGridSelectionFilter<T> | T | null>;

export type PsGridSelectionFilter<T extends DataItem> = (data: T, index: number) => boolean;

export type Bucket<T extends DataItem> = Map<string, Bucket<T>> & {
    collapsed?: boolean;
    data: T[];
    depth: number;
    field: keyof T;
    items?: T[];
    toggle: ({shiftKey}: MouseEvent) => void;
    totals: T;
};

export type Nullable<T> = T | null | undefined;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];
