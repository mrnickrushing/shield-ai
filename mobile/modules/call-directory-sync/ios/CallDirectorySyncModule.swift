import CallKit
import ExpoModulesCore

// Writes the phone-reputation snapshot (from GET /api/v1/phone-reputation/sync)
// into the App Group container that CallDirectoryHandler reads from, and asks
// iOS to reload that extension. See mobile/plugins/callDirectory for the
// extension target itself.
public class CallDirectorySyncModule: Module {
  private static let snapshotFileName = "phone-reputation-snapshot.json"

  public func definition() -> ModuleDefinition {
    Name("CallDirectorySync")

    AsyncFunction("writeBlocklistSnapshot") { (entries: [[String: String]]) -> Bool in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
      ) else {
        throw CallDirectorySyncException.missingAppGroup
      }
      let fileURL = containerURL.appendingPathComponent(Self.snapshotFileName)
      let data = try JSONSerialization.data(withJSONObject: entries)
      try data.write(to: fileURL, options: .atomic)
      return true
    }

    // Also used by the Safari Web Extension: writes the flagged-domain list
    // (from GET /url-reputation/sync) where SafariWebExtensionHandler reads it.
    AsyncFunction("writeUrlBlocklistSnapshot") { (domains: [String]) -> Bool in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
      ) else {
        throw CallDirectorySyncException.missingAppGroup
      }
      let fileURL = containerURL.appendingPathComponent("url-reputation-snapshot.json")
      let data = try JSONSerialization.data(withJSONObject: domains)
      try data.write(to: fileURL, options: .atomic)
      return true
    }

    AsyncFunction("reloadCallDirectoryExtension") { (promise: Promise) in
      CXCallDirectoryManager.sharedInstance.reloadExtension(
        withIdentifier: Self.extensionBundleIdentifier
      ) { error in
        if let error = error {
          promise.reject(CallDirectorySyncException.reloadFailed(error))
        } else {
          promise.resolve(true)
        }
      }
    }
  }

  private static var appGroupIdentifier: String {
    "group.\(Bundle.main.bundleIdentifier ?? "com.shieldai.app")"
  }

  private static var extensionBundleIdentifier: String {
    "\(Bundle.main.bundleIdentifier ?? "com.shieldai.app").calldirectory"
  }
}

enum CallDirectorySyncException: Error, LocalizedError {
  case missingAppGroup
  case reloadFailed(Error)

  var errorDescription: String? {
    switch self {
    case .missingAppGroup:
      return "Could not access the shared App Group container."
    case .reloadFailed(let error):
      return "Failed to reload the Call Directory extension: \(error.localizedDescription)"
    }
  }
}
