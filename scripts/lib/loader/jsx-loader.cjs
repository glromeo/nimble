module.exports.resolve = (specifier, context, nextResolve) => new Promise(resolve => {
    // TODO: use puppeteer (workshop/test-ui)
    resolve(nextResolve(specifier.slice(0, -3)+"js"))
})
