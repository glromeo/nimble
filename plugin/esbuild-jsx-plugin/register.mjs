import {register} from "node:module";

import "./happy-dom.mjs";

register("./loader.mjs", import.meta.url);
