import {initialize, transform} from "./node_modules/esbuild-wasm/esm/browser.js";

const initialized = initialize({
    wasmURL: `./node_modules/esbuild-wasm/esbuild.wasm`,
    worker: false
});

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
    if (event.request.url.endsWith(".jsx")) {
        event.respondWith(fetch(event.request).then(async response => {
            if (!response.ok) {
                return response;
            }
            try {
                const source = await response.text();
                await initialized;
                const {code} = await transform(source, {
                    loader: "jsx",
                    format: "esm",
                    jsx: "automatic",
                    jsxImportSource: "nimble",
                    jsxSideEffects: true,
                    sourcemap: true
                });
                return new Response(code, {
                    status: 200,
                    headers: {
                        ...response.headers,
                        "Content-Type": "application/javascript; charset=UTF-8"
                    }
                });
            } catch (error) {
                console.error("error transpiling", error);
                return new Response("Transpile error", {
                    status: 408,
                    headers: {"Content-Type": "text/plain"}
                });
            }
        }));
    } else {
        event.respondWith(fetch(event.request));
    }
});
