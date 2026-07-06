const { withXcodeProject } = require("@expo/config-plugins");

const { EXTENSION_NAME } = require("./constants");
const {
  getEntitlementsFilePath,
  getInfoPlistFilePath,
  getHandlerSwiftFilePath,
  writeMessageFilterExtensionFiles,
  getExtensionBundleIdentifier,
} = require("./writeFiles");

function withMessageFilterXcodeTarget(config) {
  return withXcodeProject(config, async (config) => {
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    const appIdentifier = config.ios.bundleIdentifier;
    const extensionIdentifier = getExtensionBundleIdentifier(appIdentifier);
    const currentProjectVersion = config.ios.buildNumber || "1";
    const marketingVersion = config.version;

    await writeMessageFilterExtensionFiles(platformProjectRoot, appIdentifier);

    const entitlementsFilePath = getEntitlementsFilePath(platformProjectRoot);
    const infoPlistFilePath = getInfoPlistFilePath(platformProjectRoot);
    const handlerSwiftFilePath = getHandlerSwiftFilePath(platformProjectRoot);

    const pbxProject = config.modResults;

    // Already added (re-running prebuild without --clean). The `xcode`
    // library stores target-name comments with literal quotes.
    if (pbxProject.pbxTargetByName(`"${EXTENSION_NAME}"`)) {
      return config;
    }

    const target = pbxProject.addTarget(EXTENSION_NAME, "app_extension", EXTENSION_NAME);
    pbxProject.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    pbxProject.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);

    const pbxGroupKey = pbxProject.pbxCreateGroup(EXTENSION_NAME, EXTENSION_NAME);
    pbxProject.addFile(infoPlistFilePath, pbxGroupKey);
    pbxProject.addSourceFile(handlerSwiftFilePath, { target: target.uuid }, pbxGroupKey);

    const configurations = pbxProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const buildSettingsObj = configurations[key].buildSettings;
      if (
        typeof buildSettingsObj !== "undefined" &&
        buildSettingsObj["PRODUCT_NAME"] === `"${EXTENSION_NAME}"`
      ) {
        buildSettingsObj["CLANG_ENABLE_MODULES"] = "YES";
        buildSettingsObj["INFOPLIST_FILE"] = `"${infoPlistFilePath}"`;
        buildSettingsObj["CODE_SIGN_ENTITLEMENTS"] = `"${entitlementsFilePath}"`;
        buildSettingsObj["CODE_SIGN_STYLE"] = "Automatic";
        buildSettingsObj["CURRENT_PROJECT_VERSION"] = `"${currentProjectVersion}"`;
        buildSettingsObj["GENERATE_INFOPLIST_FILE"] = "YES";
        buildSettingsObj["MARKETING_VERSION"] = `"${marketingVersion}"`;
        buildSettingsObj["PRODUCT_BUNDLE_IDENTIFIER"] = `"${extensionIdentifier}"`;
        buildSettingsObj["SWIFT_VERSION"] = "5.0";
        buildSettingsObj["TARGETED_DEVICE_FAMILY"] = `"1,2"`;
      }
    }

    return config;
  });
}

module.exports = { withMessageFilterXcodeTarget };
