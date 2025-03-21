import {PsGridSortIcon} from "./ps-grid-sort-icon";
import {PsGridColumnResizer} from "./ps-grid-column-resizer";
import {PsGridColumn} from "./state/columns";
import {PsGridHeaderFilter} from "./ps-grid-header-filter";
import {PsgFC} from "./types";

function PsTooltip({children, title}:{title:any, children:any}) {
    return children;
}

const PsGridHeaderCell:PsgFC<{section: "pinned" | "visible", column: PsGridColumn}> = ({store, section, column}) => {
    const {state, dnd} = store;
    const hasSort = state.sort?.some(s => s[0] === column.field);
    return (
        <PsTooltip title={column.tooltip}>
            <div class={`psg-header-cell ${column.className} ${hasSort && " has-sort" || ""}`}
                 style={column.style}
                 column-index={column.index}
                 column-field={column.field}
                 column-label={column.label}
                 onDragOver={e => {
                     e.preventDefault();
                     return false;
                 }}
                 onDragEnter={e => {
                     e.currentTarget.setAttribute("drag-over", "");
                     const {x, width} = e.currentTarget.getBoundingClientRect();
                     dnd.onDragEnter(column, e.clientX < x + width / 2);
                 }}
                 onDragLeave={e => {
                     e.currentTarget.removeAttribute("drag-over");
                 }}
                 onClick={column.onSort}>
                <div
                    class="ps-grid-cell-content"
                    draggable={true}
                    onDragStart={e => {
                        dnd.onDragStart(column, e.currentTarget, e.pageX, e.pageY);
                    }}>
                    {column.label} ({column.index})
                </div>
                {column.onSort && <PsGridSortIcon store={store} column={column} onClick={column.onSort}/>}
                <PsGridColumnResizer store={store} column={column} section={section}/>
            </div>
        </PsTooltip>
    );
};

const PsGridHeaderRow:PsgFC<{section: "pinned" | "visible"}> = ({store, section}) => {
    const {props, columns} = store;
    return (
        <div class="psg-row psg-header-row">
            {columns[section].map((column) => (
                <PsGridHeaderCell key={column.index} store={store} section={section} column={column}/>
            ))}
            {props.fill && <div class="psg-header-cell filler" key="header-filler"/>}
        </div>
    );
};

const PsGridHeaderFilters:PsgFC<{section: "pinned" | "visible"}> = ({store, section}) => {
    const {props, columns} = store;
    return (
        <div class="psg-row ps-grid-filters-row">
            {columns[section].map((column) => (
                <PsGridHeaderFilter key={column.index} store={store} column={column}/>
            ))}
            {props.fill && <div class="psg-header-cell filler" key="header-filler"/>}
        </div>
    );
};

export const PsGridPinnedHeader:PsgFC = ({store}) => {
    const {state} = store;
    return (
        <div class="psg-section psg-corner-section psg-pinned">
            <div class="psg-header">
                <PsGridHeaderRow store={store} section="pinned" />
                {state.filters && <PsGridHeaderFilters store={store} section="pinned"/>}
            </div>
        </div>
    );
};

export const PsGridScrollHeader:PsgFC = ({store}) => {
    const {state} = store;
    return (
        <div class="psg-section psg-top-section psg-scroll">
            <div class="psg-header">
                <PsGridHeaderRow store={store} section="visible"/>
                {state.filters && <PsGridHeaderFilters store={store} section="visible"/>}
            </div>
        </div>
    );
};
