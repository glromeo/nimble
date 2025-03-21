import {PsgFC} from "./types";

export const PsGridTooltip:PsgFC = ({store}) => {
    const {hover} = store;
    const tooltip = hover.tooltip;
    return tooltip ? (
        <div
            class={`psg-tooltip ${tooltip.visible && "visible"}`}
            style={tooltip.style}
            data-message={undefined}
        >
            <div class="psg-tooltip-content">{tooltip.content}</div>
        </div>
    ) : null;
}
