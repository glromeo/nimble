const {sassPlugin} = require("esbuild-sass-plugin");
/**
 * @type {import("esbuild").BuildOptions}
 */
module.exports = {
    plugins: [
        sassPlugin({
            sourceMap: false,
            logger: require("sass").Logger.silent
        })
    ]
};
