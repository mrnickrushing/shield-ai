const { withPlugins, createRunOncePlugin } = require("@expo/config-plugins");

const { withMainAppEntitlements } = require("./messageFilter/withMainAppEntitlements");
const { withMessageFilterXcodeTarget } = require("./messageFilter/withXcodeTarget");

const pkg = { name: "withMessageFilterExtension", version: "1.0.0" };

// Adds the MessageFilterExtension target (files scam texts from unknown
// senders into Junk — offline pass against the phone-reputation snapshot,
// then deferral to backend/app/api/v1/message_filter.py through Apple's
// anonymizing proxy). Requires a matching App ID with the App Groups
// capability, the messagefilter associated domain on the main app, and its
// own provisioning profile in CI — see docs/MESSAGE_FILTER_EXTENSION.md.
const withMessageFilterExtension = (config) => {
  return withPlugins(config, [withMainAppEntitlements, withMessageFilterXcodeTarget]);
};

module.exports = createRunOncePlugin(withMessageFilterExtension, pkg.name, pkg.version);
