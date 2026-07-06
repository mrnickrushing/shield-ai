const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist").default;

const {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  HANDLER_SWIFT_FILE_NAME,
  FILTER_NETWORK_URL,
  getAppGroup,
  getExtensionBundleIdentifier,
} = require("./constants");

function getExtensionDir(platformProjectRoot) {
  return path.join(platformProjectRoot, EXTENSION_NAME);
}

function getEntitlementsFilePath(platformProjectRoot) {
  return path.join(getExtensionDir(platformProjectRoot), ENTITLEMENTS_FILE_NAME);
}

function getInfoPlistFilePath(platformProjectRoot) {
  return path.join(getExtensionDir(platformProjectRoot), INFO_PLIST_FILE_NAME);
}

function getHandlerSwiftFilePath(platformProjectRoot) {
  return path.join(getExtensionDir(platformProjectRoot), HANDLER_SWIFT_FILE_NAME);
}

function getEntitlementsContent(appIdentifier) {
  return plist.build({
    "com.apple.security.application-groups": [getAppGroup(appIdentifier)],
  });
}

function getInfoPlistContent() {
  return plist.build({
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundleDisplayName: "Shield AI Text Filter",
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleInfoDictionaryVersion: "6.0",
    CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    NSExtension: {
      NSExtensionPointIdentifier: "com.apple.identitylookup.message-filter",
      NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).MessageFilterHandler",
      NSExtensionAttributes: {
        ILMessageFilterExtensionNetworkURL: FILTER_NETWORK_URL,
      },
    },
  });
}

async function writeMessageFilterExtensionFiles(platformProjectRoot, appIdentifier) {
  const extensionDir = getExtensionDir(platformProjectRoot);
  await fs.promises.mkdir(extensionDir, { recursive: true });

  await fs.promises.writeFile(
    getEntitlementsFilePath(platformProjectRoot),
    getEntitlementsContent(appIdentifier)
  );
  await fs.promises.writeFile(getInfoPlistFilePath(platformProjectRoot), getInfoPlistContent());

  const handlerTemplate = fs.readFileSync(
    path.resolve(__dirname, "./MessageFilterHandler.swift"),
    "utf8"
  );
  const handlerContent = handlerTemplate.replaceAll(
    "<APP_GROUP>",
    getAppGroup(appIdentifier)
  );
  await fs.promises.writeFile(getHandlerSwiftFilePath(platformProjectRoot), handlerContent);
}

module.exports = {
  getExtensionDir,
  getEntitlementsFilePath,
  getInfoPlistFilePath,
  getHandlerSwiftFilePath,
  writeMessageFilterExtensionFiles,
  getExtensionBundleIdentifier,
};
