import ExpoModulesCore
import WidgetKit

// Writes the protection-stats snapshot into the shared App Group container
// that ShieldWidgets reads from, and asks WidgetKit to reload. See
// mobile/plugins/widget for the extension itself.
public class WidgetSyncModule: Module {
  private static let snapshotFileName = "widget-snapshot.json"

  public func definition() -> ModuleDefinition {
    Name("WidgetSync")

    AsyncFunction("writeSnapshot") { (snapshot: [String: Int]) -> Bool in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
      ) else {
        throw WidgetSyncException.missingAppGroup
      }
      let fileURL = containerURL.appendingPathComponent(Self.snapshotFileName)
      let data = try JSONSerialization.data(withJSONObject: snapshot)
      try data.write(to: fileURL, options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
      return true
    }
  }

  private static var appGroupIdentifier: String {
    "group.\(Bundle.main.bundleIdentifier ?? "com.shieldai.app")"
  }
}

enum WidgetSyncException: Error, LocalizedError {
  case missingAppGroup

  var errorDescription: String? {
    "Could not access the shared App Group container."
  }
}
