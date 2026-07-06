import SafariServices

// Native message handler for the Shield AI Safari Web Extension.
//
// Answers "is this domain flagged?" from url-reputation-snapshot.json in the
// shared App Group (synced by the main app from GET /url-reputation/sync).
// Entirely offline: browsing activity never leaves the device, and any error
// resolves to not-flagged so Safari is never broken by this extension.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

  private static let snapshotFileName = "url-reputation-snapshot.json"
  private static var cachedDomains: Set<String>?
  private static var cachedAt: Date?
  private static let cacheTTL: TimeInterval = 300

  func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems.first as? NSExtensionItem
    let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any]

    var flagged = false
    if let type = message?["type"] as? String,
       type == "check-domain",
       let domain = (message?["domain"] as? String)?.lowercased(),
       !domain.isEmpty {
      flagged = Self.isFlagged(domain)
    }

    let response = NSExtensionItem()
    response.userInfo = [SFExtensionMessageKey: ["flagged": flagged]]
    context.completeRequest(returningItems: [response])
  }

  private static func isFlagged(_ domain: String) -> Bool {
    let domains = loadDomains()
    if domains.isEmpty { return false }
    if domains.contains(domain) { return true }
    // Match parent domains so sub.evil.example is caught by evil.example.
    var parts = domain.split(separator: ".").map(String.init)
    while parts.count > 2 {
      parts.removeFirst()
      if domains.contains(parts.joined(separator: ".")) { return true }
    }
    return false
  }

  private static func loadDomains() -> Set<String> {
    if let cached = cachedDomains, let at = cachedAt, Date().timeIntervalSince(at) < cacheTTL {
      return cached
    }
    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "<APP_GROUP>"
      ),
      let data = try? Data(contentsOf: containerURL.appendingPathComponent(snapshotFileName)),
      let parsed = try? JSONSerialization.jsonObject(with: data) as? [String]
    else {
      cachedDomains = []
      cachedAt = Date()
      return []
    }
    let set = Set(parsed.map { $0.lowercased() })
    cachedDomains = set
    cachedAt = Date()
    return set
  }
}
