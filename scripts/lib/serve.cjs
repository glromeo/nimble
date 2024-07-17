const express = require("express");
const http = require("http");
const compression = require("compression");

/**
 *
 * @param options {{middleware?: Array<(server: import("http").Server) => import("express").RequestHandler>}}
 * @returns {Promise<unknown>}
 */
module.exports.serve = async ({debug, port}) => {
    let {
        name,
        baseUrl,
        middleware
    } = require("../config.cjs");

    if (port) {
        baseUrl = {...baseUrl, port};
    }

    const app = express();

    app.get("/hello", function (req, res) {
        res.status(200).end("hello");
    });

    app.use(compression());

    middleware.forEach(fn => app.use(fn));

    app.use(baseUrl.pathname, express.static("build"), express.static("static"));
    app.use(express.static("node_modules"));

    const server = http.createServer(app);

    app.use(require("./middleware/live-reload.cjs").with(server))

    await new Promise((ok, fail) => {
        server.listen(baseUrl.port || 80, e => {
            e ? fail(e) : ok();
        })
    });

    console.log(`'${name}' is available at ${baseUrl.href}`);

    return server;
};
