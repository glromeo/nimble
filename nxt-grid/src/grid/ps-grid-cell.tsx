import {PsGridColumn} from "./state/columns";
import {PsGridRow} from "./state/rows";
import {DataItem} from "./ps-grid";
import {JSX} from "@nimble/toolkit";

export function DEFAULT_CELL_RENDERER<T extends DataItem>(
    row: PsGridRow<T>,
    column: PsGridColumn<T>
): JSX.Element {
    const value = column.formatter(row.data, column.field);
    const text = column.filter;
    let content = value as any;
    if (text) {
        let start = content.toLowerCase().indexOf(text.toLowerCase());
        if (start >= 0) {
            let end = start + text.length;
            content = <>{content.slice(0, start)}<em>{content.slice(start, end)}</em>{content.slice(end)}</>;
        }
    }
    return (
        <div class="ps-grid-cell-content" data-field={column.field} data-value={value}>{content}</div>
    );
}

export const cellJustify: Record<string, "left" | "right" | "center"> = {
    text: "left",
    flag: "left",
    number: "right",
    quantity: "right",
    spread: "right",
    price: "right",
    yield: "right",
    date: "right",
    time: "right",
    datetime: "right",
    percentage: "right",
    csv: "left",
    unknown: "center"
};

type SVGIconProps = { onClick: (e:MouseEvent) => void };

export type PsGridChevronProps = SVGIconProps & {
    isCollapsed: boolean | undefined;
};

export function Chevron({isCollapsed, onClick}: PsGridChevronProps) {
    if (isCollapsed) {
        return (
            <svg class="svg-icon chevron-collapsed" viewBox="0 0 16 16" onClick={onClick}>
                <path
                    fill-rule="evenodd"
                    d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"
                />
            </svg>
        );
    } else {
        return (
            <svg class="svg-icon chevron-expanded" viewBox="0 0 16 16" onClick={onClick}>
                <path
                    fill-rule="evenodd"
                    d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
                />
            </svg>
        );
    }
}

export const PsGridCell = <T extends DataItem>({row, column}: { row: PsGridRow<T>; column: PsGridColumn<T>; }) => {
    return (
        <div
            class={column.className}
            style={column.style}
            selected={column.selected}
            column-type={column.type}
            column-index={column.index}
            column-field={column.field}
        >
            {column.renderer(row, column)}
        </div>
    );
};

export type PsGridCellRenderer<T extends DataItem> = (row: PsGridRow<T>, column: PsGridColumn<T>) => JSX.Element;
export type PsCellAPI = {
    hasClass(token: string): boolean;
    hasRowClass(token: string): boolean;

    get gtype(): PsCellDataType;
    get field(): string;
    get rowIndex(): number;
    get columnIndex(): number;
    get innerText(): string;
    get group(): PsCellFieldType;
};
export type PsCellDataType = "summary-group" | "summary-cell" | "aggregated-value" | "cell-value";
export type PsCellFieldType = "date" | "cpty";
