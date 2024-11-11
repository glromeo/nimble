
export function useStore(props) {
    for (const key of Object.keys(props)) {
        let value = props[key];
        if (value instanceof Signal) {
            props[key] = {value};
            continue;
        }
        value = signal(value);
        props[key] = {
            get: value.get.bind(value),
            set: value.set.bind(value)
        };
    }
    return Object.defineProperties(new Map(), props);
}
