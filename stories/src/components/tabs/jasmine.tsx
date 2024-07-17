import { atom, useAtom } from "jotai";
import { useLayoutEffect } from "react";

export const specAtom = atom<string | null>(null);

export function Jasmine({ story }: { story: string }) {
    const spec = useAtom(specAtom);
    console.log("rendering Jasmine Tests tab");
    useLayoutEffect(() => {
        if (!spec) {
            return;
        }
    }, [spec]);
    return null;
}
