const EXTENSION_NAME = "CallDirectoryExtension";
const ENTITLEMENTS_FILE_NAME = `${EXTENSION_NAME}.entitlements`;
const INFO_PLIST_FILE_NAME = `${EXTENSION_NAME}-Info.plist`;
const HANDLER_SWIFT_FILE_NAME = "CallDirectoryHandler.swift";

// Same App Group expo-share-intent already provisions for the main app
// (defaults to `group.<bundleIdentifier>` since app.json doesn't override
// iosAppGroupIdentifier) — reused here so the main app and this extension
// can both read/write the same shared snapshot file.
function getAppGroup(appIdentifier) {
  return `group.${appIdentifier}`;
}

function getExtensionBundleIdentifier(appIdentifier) {
  return `${appIdentifier}.calldirectory`;
}

module.exports = {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  HANDLER_SWIFT_FILE_NAME,
  getAppGroup,
  getExtensionBundleIdentifier,
};
