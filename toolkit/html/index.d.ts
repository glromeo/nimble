export function css(
    strings: TemplateStringsArray,
    ...values: Array<string | number | bigint | boolean | symbol | object | null | undefined>
): CSSStyleSheet;

export function adoptStyle(styleSheet: CSSStyleSheet): void;
