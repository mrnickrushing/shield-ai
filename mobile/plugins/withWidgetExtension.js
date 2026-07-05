const { withPlugins, createRunOncePlugin } = require("@expo/config-plugins");

const { withMainAppEntitlements } = require("./callDirectory/withMainAppEntitlements");
const { withWidgetXcodeTarget } = require("./widget/withXcodeTarget");

const pkg = { name: "withWidgetExtension", version: "1.0.0" };

// Adds the ShieldWidgets WidgetKit extension (Home Screen, Lock Screen, and
// StandBy widgets showing protection stats written by the main app into the
// shared App Group container). Requires a matching App ID with the App
// Groups capability and its own provisioning profile in CI — see
// scripts/setup_widget_extension_signing.py.
const withWidgetExtension = (config) => {
  return withPlugins(config, [withMainAppEntitlements, withWidgetXcodeTarget]);
};

module.exports = createRunOncePlugin(withWidgetExtension, pkg.name, pkg.version);
