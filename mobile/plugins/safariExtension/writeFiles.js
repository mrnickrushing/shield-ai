const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist").default;

const pluginDir = __dirname;

const {
  EXTENSION_NAME,
  ENTITLEMENTS_FILE_NAME,
  INFO_PLIST_FILE_NAME,
  HANDLER_SWIFT_FILE_NAME,
  RESOURCE_FILE_NAMES,
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

function getResourceFilePaths(platformProjectRoot) {
  return RESOURCE_FILE_NAMES.map((name) =>
    path.join(getExtensionDir(platformProjectRoot), name)
  );
}

function getEntitlementsContent(appIdentifier) {
  return plist.build({
    "com.apple.security.application-groups": [getAppGroup(appIdentifier)],
  });
}

function getInfoPlistContent() {
  return plist.build({
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundleDisplayName: "Shield AI Safe Browsing",
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleInfoDictionaryVersion: "6.0",
    CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    NSExtension: {
      NSExtensionPointIdentifier: "com.apple.Safari.web-extension",
      NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler",
    },
  });
}

async function writeSafariExtensionFiles(platformProjectRoot, appIdentifier) {
  const extensionDir = getExtensionDir(platformProjectRoot);
  await fs.promises.mkdir(extensionDir, { recursive: true });

  await fs.promises.writeFile(
    getEntitlementsFilePath(platformProjectRoot),
    getEntitlementsContent(appIdentifier)
  );
  await fs.promises.writeFile(getInfoPlistFilePath(platformProjectRoot), getInfoPlistContent());

  const handlerTemplate = fs.readFileSync(
    path.resolve(pluginDir, HANDLER_SWIFT_FILE_NAME),
    "utf8"
  );
  await fs.promises.writeFile(
    getHandlerSwiftFilePath(platformProjectRoot),
    handlerTemplate.replaceAll("<APP_GROUP>", getAppGroup(appIdentifier))
  );

  for (const name of RESOURCE_FILE_NAMES) {
    await fs.promises.copyFile(
      path.resolve(pluginDir, "resources", name),
      path.join(extensionDir, name)
    );
  }
}

module.exports = {
  getExtensionDir,
  getEntitlementsFilePath,
  getInfoPlistFilePath,
  getHandlerSwiftFilePath,
  getResourceFilePaths,
  writeSafariExtensionFiles,
  getExtensionBundleIdentifier,
};
