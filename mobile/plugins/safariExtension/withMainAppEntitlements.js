const { withEntitlementsPlist } = require("@expo/config-plugins");

const { getAppGroup } = require("./constants");

// Merge the shared App Group into the main app defensively (same pattern as
// the call-directory and message-filter plugins).
function withMainAppEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    const appIdentifier = config.ios?.bundleIdentifier;
    const group = getAppGroup(appIdentifier);
    const existing = config.modResults["com.apple.security.application-groups"] || [];
    if (!existing.includes(group)) {
      config.modResults["com.apple.security.application-groups"] = [...existing, group];
    }
    return config;
  });
}

module.exports = { withMainAppEntitlements };
