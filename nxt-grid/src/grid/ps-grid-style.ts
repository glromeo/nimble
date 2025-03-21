import {effect} from "@nimble/toolkit";
import {PsGridStore} from "./state/store";
import {DataItem} from "./ps-grid";
import {computed} from "@nimble/toolkit";

export function styleSheetEffects<T extends DataItem>({gId, props, layout, data, viewport}: PsGridStore<T>) {

    const effects:any[] = [];

    const $pinnedRule = computed(() => {
        const left = props.inverse ? viewport.clientWidth - layout.pinnedWidth : 0;
        const width = layout.pinnedWidth;
        return `#${gId} .psg-pinned{left:${left}px;width:${width}px}\n`
            + `#${gId} .psg-pinned .psg-row{width:${width}px}\n`;
    });

    const $verticalRule = computed(() => {
        const {headerHeight, scrollHeight} = layout;
        const height = scrollHeight - headerHeight;
        const minHeight = Math.max(scrollHeight, viewport.clientHeight - headerHeight);
        return `#${gId} .psg-header{height:${headerHeight}px}\n`
            + `#${gId} .psg-body{height:${height}px;min-height:${minHeight}px}\n`;
    });

    const pinnedColumnsSheet = new CSSStyleSheet();
    effects.push(effect(() => { // static style (pinned columns, pinned rows, etc...)
        const pos = props.inverse ? "right" : "left";
        const {pinnedColumns} = layout;
        let text = $pinnedRule.value + $verticalRule.value;
        for (const {index, left, width} of pinnedColumns) {
            text += `.${gId}-c${index}{${pos}:${left}px;width:${width}px;}\n`;
        }
        pinnedColumnsSheet.replaceSync(text);
    }));

    const $scrollRule = computed(() => {
        const width = Math.max(layout.scrollWidth + layout.pinnedWidth, viewport.clientWidth);
        return `#${gId} .psg-scroll{width:${width}px}\n`;
    });

    const $scrollRowsRule = computed(() => {
        const pos = props.inverse ? "right" : "left";
        const width = layout.scrollWidth;
        return `#${gId} .psg-scroll .psg-row{${pos}:${layout.pinnedWidth}px;width:${width}px}`
    });

    const scrollColumnsSheet = new CSSStyleSheet();
    effects.push(effect(() => { // dynamic style X (columns)
        const pos = props.inverse ? "right" : "left";
        const {scrollColumns, leftIndex, rightIndex} = layout;
        let text = $scrollRule.value + $scrollRowsRule.value;
        for (let layoutIndex = leftIndex; layoutIndex < rightIndex; layoutIndex++) {
            const {index, left, width} = scrollColumns[layoutIndex];
            text += `.${gId}-c${index}{${pos}:${left}px;width:${width}px;}\n`;
        }
        scrollColumnsSheet.replaceSync(text);
    }));

    const $shading = computed(() => {
        const {gradient} = props;
        const {threshold} = data;
        if (gradient && threshold) {
            const RGB = gradient.join(",");
            return (index: number) => `background-color:rgba(${RGB},${threshold(index)});`;
        } else {
            return (index: number) => "";
        }
    });

    const scrollRowsSheet = new CSSStyleSheet();
    effects.push(effect(() => { // dynamic style Y (rows, shading...)
        const {scrollRows, topIndex, bottomIndex} = layout;
        const shading = $shading.value;
        let text = '';
        for (let layoutIndex = topIndex; layoutIndex < bottomIndex; layoutIndex++) {
            const {index, top, height} = scrollRows[layoutIndex];
            text += `.${gId}-r${index}{transform:translateY(${top}px);height:${height}px;${shading(index)}}\n`;
        }
        scrollRowsSheet.replaceSync(text);
    }));



    const spliceIndex = document.adoptedStyleSheets.length;
    const spliceLength = document.adoptedStyleSheets.push(pinnedColumnsSheet, scrollColumnsSheet, scrollRowsSheet) - spliceIndex;
    return () => {
        for (const dismiss of effects) {
            dismiss();
        }
        document.adoptedStyleSheets.splice(spliceIndex, spliceLength);
    };
}
