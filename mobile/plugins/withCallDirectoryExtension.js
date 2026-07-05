const { withPlugins, createRunOncePlugin } = require("@expo/config-plugins");

const { withMainAppEntitlements } = require("./callDirectory/withMainAppEntitlements");
const { withCallDirectoryXcodeTarget } = require("./callDirectory/withXcodeTarget");

const pkg = { name: "withCallDirectoryExtension", version: "1.0.0" };

// Adds the CallDirectoryExtension target (labels/blocks scam calls from the
// phone-reputation snapshot synced by the main app — see
// backend/app/api/v1/phone_reputation.py and
// mobile/modules/call-directory-sync). Requires a matching App ID with the
// Call Directory Extension + App Groups capabilities and its own provisioning
// profile in CI — see docs/CALL_DIRECTORY_EXTENSION.md.
const withCallDirectoryExtension = (config) => {
  return withPlugins(config, [withMainAppEntitlements, withCallDirectoryXcodeTarget]);
};

module.exports = createRunOncePlugin(withCallDirectoryExtension, pkg.name, pkg.version);
