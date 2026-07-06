const EXTENSION_NAME = "SafariWebExtension";
const ENTITLEMENTS_FILE_NAME = `${EXTENSION_NAME}.entitlements`;
const INFO_PLIST_FILE_NAME = `${EXTENSION_NAME}-Info.plist`;
const HANDLER_SWIFT_FILE_NAME = "SafariWebExtensionHandler.swift";
// Web-extension payload files, shipped in the appex's Resources.
const RESOURCE_FILE_NAMES = [
  "manifest.json",
  "background.js",
  "content.js",
  "icon-48.png",
  "icon-96.png",
  "icon-128.png",
];

// Same App Group the other extensions use; the main app syncs
// url-reputation-snapshot.json into it (see mobile/app/lib/safariBlocklistSync.ts).
function getAppGroup(appIdentifier) {
  return `group.${appIdentifier}`;
}

function getExtensionBundleIdentifier(appIdentifier) {
  return `${appIdentifier}.safari-extension`;
}

module.exports = {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  HANDLER_SWIFT_FILE_NAME,
  RESOURCE_FILE_NAMES,
  getAppGroup,
  getExtensionBundleIdentifier,
};
