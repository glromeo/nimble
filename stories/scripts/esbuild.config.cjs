const { storiesPlugin } = require("./stories.plugin.cjs");
const { mockingPlugin } = require("./mocking.plugin.cjs");

const modules = new Map();

/**
 * @type {import("esbuild").BuildOptions}
 */
module.exports = {
    entryPoints: [
        {in: "@nimble/stories/src/stories", out: "stories"},
        {in: "@nimble/stories/src/story", out: "story"}
    ],
    plugins: [
        storiesPlugin({modules}),
        mockingPlugin({modules})
    ]
}
