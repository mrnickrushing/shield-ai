const EXTENSION_NAME = "MessageFilterExtension";
const ENTITLEMENTS_FILE_NAME = `${EXTENSION_NAME}.entitlements`;
const INFO_PLIST_FILE_NAME = `${EXTENSION_NAME}-Info.plist`;
const HANDLER_SWIFT_FILE_NAME = "MessageFilterHandler.swift";

// The backend endpoint iOS defers unknown-sender texts to. Must be HTTPS and
// live on the same host as the `messagefilter:` associated domain below.
const FILTER_API_HOST = "api.shieldai.rushingtechnologies.com";
const FILTER_NETWORK_URL = `https://${FILTER_API_HOST}/api/v1/message-filter`;

// Same App Group the call-directory extension uses, so this extension can
// read the phone-reputation snapshot the main app already syncs.
function getAppGroup(appIdentifier) {
  return `group.${appIdentifier}`;
}

function getExtensionBundleIdentifier(appIdentifier) {
  return `${appIdentifier}.messagefilter`;
}

module.exports = {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  HANDLER_SWIFT_FILE_NAME,
  FILTER_API_HOST,
  FILTER_NETWORK_URL,
  getAppGroup,
  getExtensionBundleIdentifier,
};
