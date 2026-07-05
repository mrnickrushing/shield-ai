const { getAppGroup } = require("../callDirectory/constants");

const EXTENSION_NAME = "ShieldWidgets";
const ENTITLEMENTS_FILE_NAME = `${EXTENSION_NAME}.entitlements`;
const INFO_PLIST_FILE_NAME = `${EXTENSION_NAME}-Info.plist`;
const SWIFT_FILE_NAME = "ShieldWidgets.swift";

function getExtensionBundleIdentifier(appIdentifier) {
  return `${appIdentifier}.widget`;
}

module.exports = {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  SWIFT_FILE_NAME,
  getAppGroup,
  getExtensionBundleIdentifier,
};
