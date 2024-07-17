const ws = require("ws");
const clients = [];

module.exports.with = (server) => {

    const wss = new ws.Server({noServer: true});

    wss.on("connection", (socket) => {
        socket.send("hello");
        clients.push({
            reload() {
                try {
                    socket.send("reload");
                } catch (e) {
                    clients.splice(clients.indexOf(this), 1);
                }
            }
        });
    });

    server.on("upgrade", (req, socket, head) => {
        if (req.url === "/live-reload") {
            wss.handleUpgrade(req, socket, head, (socket) => {
                wss.emit("connection", socket, req, head);
            });
        }
    });

    return (req, res, next) => {
        if (req.url === "/live-reload") {
            res.status(200).end();
        } else {
            return next();
        }
    };
};

module.exports.clients = clients;
