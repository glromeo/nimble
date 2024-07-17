const esbuild = require('esbuild');
const mock = require('mock-fs');

let fakeStoriesTsx = `
import * as x from "./fake-api"; // TODO: not handled yet
import {echo} from "./fake-api";

mock(echo, ()=>"MOCKED!");

export default 1 + 1;

export default () => {
return <div>{echo("HELLO")}</div>
}

export default function () {
return <div>{echo("HELLO")}</div>
}

export const s0 = () => <div>Hello</div>; 
export const s1 = function () { return <div>Hello</div> }; 
export function s2() { return <div>Hello</div> }; 
`;

let fakeApiTs = `
export const echo = (message:string) => message;
`;

const mockFilesystem = () => mock({
    'x:/fake/src': {
        'fake.stories.tsx': fakeStoriesTsx,
        'fake-api.ts': fakeApiTs
    }
});

describe("parsing", () => {
    it("parsing spec", async () => {
        const { outputFiles } = await esbuild.build({
            entryPoints: ["main.ts"],
            bundle: true,
            write: false,
            outdir: 'out',
            plugins: [
                {
                    name: "mock-fs",
                    setup({ onResolve, onLoad }) {
                        onResolve({ filter: /main.ts$/ }, ({path}) => {
                            mockFilesystem();
                            return { path, namespace: "mock-fs" }
                        })
                        onResolve({ filter: /^fake\/src\/fake.stories.tsx$/ }, ({path}) => {
                            return { path: "x:/fake/src/fake.stories.tsx" }
                        })
                        onLoad({ filter: /main.ts$/, namespace: "mock-fs" }, ({pluginData}) => {
                            return {
                                contents: `import "fake/src/fake.stories.tsx"`,
                                loader: "ts",
                                resolveDir: "/"
                            }
                        })
                    }
                },
                require("./mocking.plugin")({})
            ]
        });

        for (const outputFile of outputFiles) {
            console.log(outputFile.path, outputFile.contents);
        }
    });
});
