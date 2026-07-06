const { withEntitlementsPlist } = require("@expo/config-plugins");

const { FILTER_API_HOST, getAppGroup } = require("./constants");

// The main app needs:
//  - the shared App Group (so the extension can read the phone-reputation
//    snapshot the app syncs), merged defensively like the call-directory plugin
//  - the `messagefilter:` associated domain — iOS validates it against the
//    apple-app-site-association file the backend serves before deferring
//    SMS queries to ILMessageFilterExtensionNetworkURL.
function withMainAppEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    const appIdentifier = config.ios?.bundleIdentifier;
    const group = getAppGroup(appIdentifier);
    const groups = config.modResults["com.apple.security.application-groups"] || [];
    if (!groups.includes(group)) {
      config.modResults["com.apple.security.application-groups"] = [...groups, group];
    }

    const domain = `messagefilter:${FILTER_API_HOST}`;
    const domains = config.modResults["com.apple.developer.associated-domains"] || [];
    if (!domains.includes(domain)) {
      config.modResults["com.apple.developer.associated-domains"] = [...domains, domain];
    }
    return config;
  });
}

module.exports = { withMainAppEntitlements };
