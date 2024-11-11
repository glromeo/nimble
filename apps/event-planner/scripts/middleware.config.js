const express = require("express");
const fs = require("fs/promises");

module.exports = app => {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const home = express.Router();
    app.use(home);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const guests = express.Router();
    guests.use(express.static("public"));
    guests.use(express.static("build"));
    app.use("/guests", guests);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const seating = express.Router();
    seating.use(express.static("public"));
    seating.use(express.static("build"));
    for (const path of ["/floorplan.svg", "/guests.json"]) {
        const filepath = `./data/${path}`;
        app.use(path, require("body-parser").text({limit: "512kb"}));
        app.get(path, async (req, res) => {
            try {
                const data = await fs.readFile(filepath, "utf8");
                res.set("Content-Type", "image/svg+xml");
                res.send(data);
            } catch (err) {
                if (err.code === "ENOENT") {
                    try {
                        const data = await fs.readFile(`./data/${path}.bak`, "utf8");
                        await fs.writeFile(filepath, data);
                        if (path.endsWith("svg")) {
                            res.set("Content-Type", "image/svg+xml");
                        } else {
                            res.set("Content-Type", "application/json");
                        }
                        res.send(data);
                    } catch (err) {
                        res.status(500).send("Failed to read original XML file");
                    }
                    return;
                }
                res.status(500).send("Failed to read XML file");
            }
        });
        app.put(path, async (req, res) => {
            try {
                await fs.writeFile(filepath, req.body);
                res.send("XML file saved successfully");
            } catch (err) {
                res.status(500).send("Failed to save XML");
            }
        });
        app.delete(path, async (req, res) => {
            try {
                await fs.delete(filepath);
            } catch (err) {
                res.status(500).send("Failed to delete XML");
            }
        });
    }
    app.use("/seating", seating);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const flyers = express.Router();
    flyers.use(express.static("public"));
    flyers.use(express.static("build"));
    app.use("/flyers", flyers);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
};
