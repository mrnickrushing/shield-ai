import IdentityLookup

// Screens texts from unknown senders (Apple never routes texts from saved
// contacts, or any message after you reply, through message filters).
//
// Two passes:
//  1. Offline: the phone-reputation snapshot the main app synced into the
//     shared App Group (same file the Call Directory extension reads). A
//     match files the text as junk with no network round-trip.
//  2. Deferred: everything else goes to the Shield AI backend via Apple's
//     anonymizing proxy (ILMessageFilterExtensionNetworkURL in Info.plist).
//
// Anything ambiguous — missing snapshot, network failure, malformed reply —
// resolves to `.none` so a real text is never hidden by an error.
final class MessageFilterHandler: ILMessageFilterExtension {}

extension MessageFilterHandler: ILMessageFilterQueryHandling {

  func handle(
    _ queryRequest: ILMessageFilterQueryRequest,
    context: ILMessageFilterExtensionContext,
    completion: @escaping (ILMessageFilterQueryResponse) -> Void
  ) {
    if senderIsKnownScammer(queryRequest.sender) {
      let response = ILMessageFilterQueryResponse()
      response.action = .junk
      completion(response)
      return
    }

    // Defer to the backend through Apple's proxy.
    context.deferQueryRequestToNetwork { networkResponse, _ in
      let response = ILMessageFilterQueryResponse()
      response.action = .none

      if let data = networkResponse?.urlResponse.statusCode == 200 ? networkResponse?.data : nil,
         let verdict = try? JSONDecoder().decode(NetworkVerdict.self, from: data) {
        switch verdict.action {
        case "junk": response.action = .junk
        case "promotion": response.action = .promotion
        case "transaction": response.action = .transaction
        default: response.action = .none
        }
      }
      completion(response)
    }
  }

  private struct NetworkVerdict: Decodable {
    let action: String
  }

  private struct SnapshotEntry: Decodable {
    let number: String
    let label: String
  }

  private func senderIsKnownScammer(_ sender: String?) -> Bool {
    guard let sender = sender, !sender.isEmpty else { return false }
    let digits = sender.filter(\.isNumber)
    guard digits.count >= 7 else { return false }

    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "<APP_GROUP>"
      ),
      let data = try? Data(
        contentsOf: containerURL.appendingPathComponent("phone-reputation-snapshot.json")
      ),
      let entries = try? JSONDecoder().decode([SnapshotEntry].self, from: data)
    else { return false }

    return entries.contains { $0.number == digits }
  }
}
