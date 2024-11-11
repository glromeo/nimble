import {transformSync} from "esbuild";
import {transpiler} from "./lib/index.js";
import {fileURLToPath} from "node:url";
import {extname} from "node:path";
import {existsSync, readFileSync} from "node:fs";

function transpile(source, sourcefile) {
    const {code, map} = transpiler(source, {
        minified: false,
        sourceMaps: true,
        sourceFileName: sourcefile
    });
    const data = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
    return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${data}`;
}

function transform(sourcefile) {

    const source = readFileSync(sourcefile, "utf-8");

    const transpiled = transpile(source, sourcefile);

    const {code, warnings} = transformSync(transpiled, {
        loader: "ts",
        format: "esm",
        sourcefile,
        sourcemap: "inline",
        define: {
            "process.env": JSON.stringify({})
        }
    });

    if (warnings && warnings.length > 0) {
        for (const warning of warnings) {
            console.log(warning.location);
            console.log(warning.text);
        }
    }
    return code;
}

export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier);
    } catch (e) {
        return nextResolve(specifier + ".ts");
    }
}

export async function load(url, context, defaultLoad) {
    const ext = extname(url);
    if (ext === ".tsx" || ext === ".jsx" || ext === ".ts") {
        return {
            format: "module",
            source: transform(fileURLToPath(url)),
            shortCircuit: true
        };
    }
    return defaultLoad(url, context, defaultLoad);
}
