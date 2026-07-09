import CallKit
import Foundation

// Reads the scam-number snapshot the main app synced from
// GET /api/v1/phone-reputation/sync into the shared App Group container, and
// hands it to iOS as identification/blocking entries.
//
// Deliberately does no networking here: Call Directory extensions get a tight
// execution window from the system, and a live HTTPS round-trip is a common
// cause of CXCallDirectoryManager reload failures. The main app (normal
// background execution, real network access) does the sync; this only reads
// the local file it already wrote.
class CallDirectoryHandler: CXCallDirectoryProvider {

  struct Entry: Codable {
    let number: String
    let label: String
  }

  override func beginRequest(with context: CXCallDirectoryExtensionContext) {
    context.delegate = self

    let entries = loadEntries()
      .compactMap { entry -> (CXCallDirectoryPhoneNumber, String)? in
        guard let phoneNumber = CXCallDirectoryPhoneNumber(entry.number) else { return nil }
        return (phoneNumber, entry.label)
      }
      // CallKit requires each entry sequence added in strictly ascending
      // numeric order — blocking and identification are separate sequences.
      .sorted { $0.0 < $1.0 }

    // The snapshot is the curated scam/spam list (community-corroborated
    // numbers plus a complaint feed with known-legit lines excluded), so every
    // number is blocked outright — it never rings. This is what a spam-blocker
    // is for; the in-app "report wrong label" flow removes any false positive.
    for (phoneNumber, _) in entries {
      context.addBlockingEntry(withNextSequentialPhoneNumber: phoneNumber)
    }

    // Also label them, so if the user leaves blocking off but identification on
    // (Settings → Phone → Call Blocking & Identification), the call still shows
    // "Scam Likely" / "Spam Risk" instead of ringing anonymously.
    for (phoneNumber, label) in entries {
      context.addIdentificationEntry(withNextSequentialPhoneNumber: phoneNumber, label: label)
    }

    context.completeRequest()
  }

  private func loadEntries() -> [Entry] {
    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "<APP_GROUP>"
      )
    else { return [] }

    let fileURL = containerURL.appendingPathComponent("phone-reputation-snapshot.json")
    guard let data = try? Data(contentsOf: fileURL) else { return [] }
    return (try? JSONDecoder().decode([Entry].self, from: data)) ?? []
  }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
  func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
    // Nothing to recover here — the next successful main-app sync + reload
    // will retry the full snapshot on the next system-triggered request.
  }
}
