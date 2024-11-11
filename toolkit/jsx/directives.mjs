export const directives = {};

export function createDirective(attr, callback) {
    directives[attr] = callback;
}
