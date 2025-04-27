import {PsGridColumn} from "./state/columns";
import {PsgFC} from "./types";
import {computed} from "@nimble/toolkit";

export type PsGridColumnSortHandler = (event: { shiftKey: boolean }) => void

const ArrowUp = (
    <svg class="icon arrow-up" aria-hidden="true" focusable="false" viewBox="0 0 256 512">
        <path
            fill="currentColor"
            d="M3.515 168.97l7.07 7.071c4.686 4.686 12.284 4.686 16.971 0L111 92.113V468c0 6.627 5.373 12 12 12h10c6.627 0 12-5.373 12-12V92.113l83.444 83.928c4.686 4.686 12.284 4.686 16.971 0l7.07-7.071c4.686-4.686 4.686-12.284 0-16.97l-116-116.485c-4.686-4.686-12.284-4.686-16.971 0L3.515 152c-4.687 4.686-4.687 12.284 0 16.97z"
        />
    </svg>
);

const ArrowDown = (
    <svg class="icon arrow-down" aria-hidden="true" focusable="false" viewBox="0 0 256 512">
        <path
            fill="currentColor"
            d="M252.485 343.03l-7.07-7.071c-4.686-4.686-12.284-4.686-16.971 0L145 419.887V44c0-6.627-5.373-12-12-12h-10c-6.627 0-12 5.373-12 12v375.887l-83.444-83.928c-4.686-4.686-12.284-4.686-16.971 0l-7.07 7.071c-4.686 4.686-4.686 12.284 0 16.97l116 116.485c4.686 4.686 12.284 4.686 16.971 0l116-116.485c4.686-4.686 4.686-12.284-.001-16.97z"
        />
    </svg>
);

export const PsGridSortIcon:PsgFC<{
    column: PsGridColumn<any>,
    onClick: PsGridColumnSortHandler
}> = ({store, column, onClick}) => {
    return <>{() => {
        const {sort} = store.state;
        if (sort) {
            let sortOrder = 0;
            for (const [field, dir] of sort) {
                if (field === column.field) {
                    return (
                        <div class={`sort _${sortOrder}`} onClick={onClick}>
                            <div class="order">{sortOrder || ""}</div>
                            {dir === "asc" ? ArrowUp : ArrowDown}
                        </div>
                    );
                }
                sortOrder++;
            }
        }
        return null;
    }}</>;
}
