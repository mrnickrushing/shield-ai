import WidgetKit
import SwiftUI

// Reads the protection snapshot the main app writes into the shared App
// Group container (same group used by CallDirectorySync) and renders it
// across Home Screen, Lock Screen, and StandBy widget families.
struct ProtectionSnapshot: Codable {
  let scansThisWeek: Int
  let threatsBlocked: Int
  let callsProtected: Int
  // Epoch seconds of the last app-side sync; optional so snapshots written by
  // older app builds still decode.
  let lastSyncAt: Int?

  static let placeholder = ProtectionSnapshot(scansThisWeek: 0, threatsBlocked: 0, callsProtected: 0, lastSyncAt: nil)

  var lastSyncText: String? {
    guard let lastSyncAt else { return nil }
    let date = Date(timeIntervalSince1970: TimeInterval(lastSyncAt))
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .abbreviated
    return "Synced \(formatter.localizedString(for: date, relativeTo: Date()))"
  }

  static func load() -> ProtectionSnapshot {
    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "<APP_GROUP>"
      ),
      let data = try? Data(contentsOf: containerURL.appendingPathComponent("widget-snapshot.json")),
      let snapshot = try? JSONDecoder().decode(ProtectionSnapshot.self, from: data)
    else { return .placeholder }
    return snapshot
  }
}

struct ProtectionEntry: TimelineEntry {
  let date: Date
  let snapshot: ProtectionSnapshot
}

struct ProtectionProvider: TimelineProvider {
  func placeholder(in context: Context) -> ProtectionEntry {
    ProtectionEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (ProtectionEntry) -> Void) {
    completion(ProtectionEntry(date: Date(), snapshot: .load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ProtectionEntry>) -> Void) {
    let entry = ProtectionEntry(date: Date(), snapshot: .load())
    // The main app calls WidgetCenter.reloadAllTimelines() whenever it writes
    // a fresh snapshot, so this refresh is just a slow-decaying fallback.
    let nextUpdate = Calendar.current.date(byAdding: .hour, value: 4, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }
}

private let accent = Color(red: 0.23, green: 0.51, blue: 0.96) // matches colors.primaryBright

struct ShieldWidgetsSmallView: View {
  let snapshot: ProtectionSnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Image(systemName: "shield.checkerboard").foregroundColor(accent)
        Spacer()
        Text("ON").font(.system(size: 10, weight: .heavy)).foregroundColor(accent)
      }
      Spacer()
      Text("\(snapshot.threatsBlocked)").font(.system(size: 28, weight: .bold))
      Text("threats blocked").font(.caption2).foregroundColor(.secondary)
      if let synced = snapshot.lastSyncText {
        Text(synced).font(.system(size: 9)).foregroundColor(.secondary)
      }
    }
    .padding()
  }
}

struct ShieldWidgetsMediumView: View {
  let snapshot: ProtectionSnapshot
  var body: some View {
    VStack(spacing: 6) {
      HStack {
        Label("Protection on", systemImage: "shield.checkerboard")
          .font(.caption2.weight(.bold)).foregroundColor(accent)
        Spacer()
        if let synced = snapshot.lastSyncText {
          Text(synced).font(.system(size: 9)).foregroundColor(.secondary)
        }
      }
      HStack {
        stat("\(snapshot.scansThisWeek)", "Scans this week")
        Divider()
        stat("\(snapshot.threatsBlocked)", "Threats blocked")
        Divider()
        stat("\(snapshot.callsProtected)", "Calls protected")
      }
    }
    .padding()
  }

  private func stat(_ value: String, _ label: String) -> some View {
    VStack(spacing: 2) {
      Text(value).font(.system(size: 22, weight: .bold))
      Text(label).font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
    }.frame(maxWidth: .infinity)
  }
}

struct ShieldWidgetsAccessoryRectangularView: View {
  let snapshot: ProtectionSnapshot
  var body: some View {
    VStack(alignment: .leading) {
      Label("Shield AI", systemImage: "shield.checkerboard")
      Text("\(snapshot.threatsBlocked) threats blocked").font(.caption)
    }
  }
}

struct ShieldWidgetsAccessoryCircularView: View {
  let snapshot: ProtectionSnapshot
  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(systemName: "shield.checkerboard")
        Text("\(snapshot.threatsBlocked)").font(.system(size: 14, weight: .bold))
      }
    }
  }
}

struct ShieldWidgetsEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: ProtectionEntry

  var body: some View {
    switch family {
    case .systemMedium:
      ShieldWidgetsMediumView(snapshot: entry.snapshot)
    case .accessoryRectangular:
      ShieldWidgetsAccessoryRectangularView(snapshot: entry.snapshot)
    case .accessoryCircular:
      ShieldWidgetsAccessoryCircularView(snapshot: entry.snapshot)
    default:
      ShieldWidgetsSmallView(snapshot: entry.snapshot)
    }
  }
}

struct ShieldWidgets: Widget {
  let kind: String = "ShieldWidgets"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ProtectionProvider()) { entry in
      ShieldWidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Shield AI Protection")
    .description("See your scam-protection stats at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
  }
}

@main
struct ShieldWidgetsBundle: WidgetBundle {
  var body: some Widget {
    ShieldWidgets()
  }
}
