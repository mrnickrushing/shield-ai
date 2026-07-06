const { withPlugins, createRunOncePlugin } = require("@expo/config-plugins");

const { withMainAppEntitlements } = require("./safariExtension/withMainAppEntitlements");
const { withSafariXcodeTarget } = require("./safariExtension/withXcodeTarget");

const pkg = { name: "withSafariExtension", version: "1.0.0" };

// Adds the SafariWebExtension target: system-wide Safari protection that
// overlays a warning on community-flagged domains. Fully offline — the
// native handler answers from the url-reputation snapshot the main app syncs
// into the shared App Group (see backend/app/api/v1/url_reputation.py and
// mobile/app/lib/safariBlocklistSync.ts). Requires a matching App ID with
// App Groups + its own provisioning profile in CI, like the other extensions.
const withSafariExtension = (config) => {
  return withPlugins(config, [withMainAppEntitlements, withSafariXcodeTarget]);
};

module.exports = createRunOncePlugin(withSafariExtension, pkg.name, pkg.version);
