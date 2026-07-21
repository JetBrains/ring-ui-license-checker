// Expose the plugin factory as the module export (Babel keeps the named
// `packageNameFromId` export, so add-module-exports won't collapse it).
const {default: licenseChecker, packageNameFromId} = require('./lib/vite')

licenseChecker.packageNameFromId = packageNameFromId
module.exports = licenseChecker
