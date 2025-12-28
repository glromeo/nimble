import {PsGridFilters} from "./ps-grid";
import {PsGridColumn} from "./state/columns";
import {PsgFC} from "./types";

export const PsGridHeaderFilter:PsgFC<{ column: PsGridColumn }> = ({store, column}) => {
    const {state} = store;
    const filter = state.filters?.[column.field];
    return (
        <div class={`psg-header-cell ${column.className}`}>
            {typeof filter === "string" ? (
                <input
                    type="search"
                    value={filter}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onChange={(text) => {
                        state.filters = {
                            ...state.filters,
                            [column.field]: text
                        } as PsGridFilters<any>;
                    }}
                />
            ) : null}
        </div>
    );
}
