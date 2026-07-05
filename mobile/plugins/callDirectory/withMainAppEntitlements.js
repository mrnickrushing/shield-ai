const { withEntitlementsPlist } = require("@expo/config-plugins");

const { getAppGroup } = require("./constants");

// expo-share-intent already sets this same App Group on the main app
// entitlements (default `group.<bundleIdentifier>`), but this plugin doesn't
// assume that — it merges its own requirement in defensively so it keeps
// working even if that plugin's config ever changes.
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
