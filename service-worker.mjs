import {initialize, transform} from "./node_modules/esbuild-wasm/esm/browser.js";
import transpiler from "./plugin/esbuild-jsx-plugin/dist/transpiler.mjs";

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

function transpile(source, sourcefile) {
    const {code, map} = transpiler(source, {
        minified: false,
        sourceMaps: true,
        sourceFileName: sourcefile
    });
    return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${btoa(JSON.stringify(map))}`;
}

const cache = new Map();

self.addEventListener("fetch", (event) => {
    let url = event.request.url;
    let cached = cache.get(url);
    if (cached) {
        event.respondWith(cached);
        return;
    }
    if (url.endsWith(".ts") || url.endsWith(".tsx") || url.endsWith(".jsx")) {
        event.respondWith(fetch(event.request).then(async response => {
            if (!response.ok) {
                return response;
            }
            try {
                const source = await response.text();
                const transpiled = transpile(source, url);
                await initialized;
                const {code} = await transform(transpiled, {
                    loader: url[url.lastIndexOf(".") + 1].toLowerCase() === "j" ? "js" : "ts",
                    format: "esm",
                    sourcemap: "inline",
                    define: {
                        "process.env.NODE_ENV": JSON.stringify({})
                    }
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
