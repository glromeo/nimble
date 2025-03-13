/**
 * @type {import("esbuild").BuildOptions}
 */
module.exports = {
    plugins: [
        require("esbuild-sass-plugin").sassPlugin({filter: /\.scss$/})
    ]
}
