import React, { useLayoutEffect, useMemo } from "react";
import { useStore } from "jotai";
import { ParametersBridge, parametersFamily } from "../hooks/parameters";

import { iframe } from "../hooks/fixture";

import "./iframe.scss";

export function IFrame({ story, titles }: { story: string; titles: string[] }) {
    const id = story + titles.join();
    useLayoutEffect(() => {
        return () => titles.forEach((title) => parametersFamily.remove(title));
    }, [id]);

    const src = useMemo(() => {
        if (titles.length) {
            const url = new URL("./story.html", location as any);
            url.hash = `#/${story}`;
            if (titles.length === 1) {
                url.searchParams.append("fixture", titles[0]);
            }
            url.searchParams.append("hash", Date.now().toString(16).slice(-6));
            return url.toString();
        }
    }, [id]);

    const store = useStore();
    const iframeRef = (iframe: HTMLIFrameElement | null) => {
        if (iframe) {
            const parameters = {} as Record<string, ParametersBridge<any>>;
            for (const title of titles) {
                parameters[title] = new ParametersBridge(title, store, parametersFamily(title));
            }
            Object.defineProperty(iframe, "parameters", { configurable: true, value: parameters });
        }
    };

    console.debug("iframe", src);

    const key = useMemo(Math.random, [titles]);
    return src ? <iframe key={key} ref={iframeRef} className="fixtures" src={src} /> : <div className="fixtures" />;
}
