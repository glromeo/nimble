const {register} = require("node:module");
const {pathToFileURL} = require("node:url");

register("./lib/loader/jsx-loader.cjs", pathToFileURL(__filename));
