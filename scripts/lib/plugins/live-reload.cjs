const {clients} = require("../middleware/live-reload.cjs");

/**
 *
 * @type {import("esbuild").Plugin}
 */
module.exports.plugin = {
    name: "live-reload",
    setup({onEnd}) {
        onEnd((result) => {
            for (const client of clients) {
                client.reload();
            }
        });
    }
};
