import {PsGridRow} from "./rows";
import {PsGridColumnDef, PsGridOnSort, PsGridProps, DataItem} from "../ps-grid";
import {PsGridColumnLayoutUpdate} from "./layout";
import {PsGridColumn} from "./columns";
import {PsGridState} from "./state";

export type PsGridCallbacks<T extends DataItem> = {
    onChange?: (event: PsGridChangeEvent<T>) => void;
    onScroll?: (gridElement: HTMLDivElement) => void;
    onSort: PsGridOnSort<T>;
    onLayout: ()=>void;

};

export type PsGridChangeEvent<T extends DataItem> = {
    column?: PsGridColumnDef<T>;
    layout?: PsGridColumnLayoutUpdate[];
    row?: PsGridRow<T>;
    type: "sort" | "size" | "grouping" | "pinned" | "layout";
};

/**
 *
 * @param props
 * @param state
 */
export const defineCallbacks = <T extends DataItem>(
    props: PsGridProps<T>,
    state: PsGridState<T>
): PsGridCallbacks<T> => {

    const onSort = ({field}: PsGridColumn<T>, {shiftKey}: React.MouseEvent<HTMLDivElement>) => {
        if (state.resizing) {
            return;
        }
        const sort = state.sort;
        if (!sort) {
            state.sort = [[field as keyof T, "asc"]];
        } else {
            const index = sort.findIndex((s) => field === s[0]);
            if (index >= 0) {
                if (sort[index][1] === "asc" && !shiftKey) {
                    state.sort = sort.map((entry) => {
                        if (entry[0] === field) {
                            return [field as keyof T, "desc"];
                        } else {
                            return entry;
                        }
                    });
                } else {
                    state.sort = sort.filter(((_: any, i: number) => index !== i) as any);
                }
            } else {
                if (shiftKey) {
                    state.sort = [...sort.slice(0, 1 + props.sortLimit), [field as keyof T, "asc"]];
                } else {
                    state.sort = [[field as keyof T, "asc"]];
                }
            }
        }
    };

    let af = 0; // NOTE: scroll is inherently global while layout updates need to be "per grid instance"
    const onLayout = () => {
        // if (props.onChange == null) {
        //     return;
        // }
        // af ||= requestAnimationFrame(() => {
        //     const layout = [] as PsGridColumnLayoutUpdate[];
        //     const columnDefs = props.columnDefs;
        //     const collect = ({index, width}: PsGridColumnLayout) => {
        //         layout.push({
        //             index,
        //             field: columnDefs[index].field ?? index,
        //             pinned: true,
        //             width: width - GRID_BORDER_WIDTH
        //         });
        //     };
        //     $pinnedColumns.peek().forEach(collect);
        //     $scrollColumns.peek().forEach(collect);
        //
        //     callbacks.onChange!({
        //         type: "layout",
        //         layout
        //     });
        //     af = 0;
        // });
    };


    return {
        onSort,
        onLayout
    };
};
