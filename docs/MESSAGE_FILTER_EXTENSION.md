# Message Filter Extension (live SMS scam filtering)

`MessageFilterExtension` (`com.shieldai.app.messagefilter`) is an iOS
ILMessageFilter app extension that screens texts from **unknown senders**
(Apple never routes messages from saved contacts, or threads you've replied
to, through filters) and files scam texts into Messages → Junk.

## How a text gets classified

1. **Offline pass** — the extension reads `phone-reputation-snapshot.json`
   from the shared App Group (`group.com.shieldai.app`), the same file the
   Call Directory extension uses. A sender match → junk, no network.
2. **Deferred pass** — everything else is deferred to
   `POST /api/v1/message-filter` (see `backend/app/api/v1/message_filter.py`)
   **through Apple's anonymizing proxy**: the backend never sees who received
   the text. Scoring reuses `message_analyzer` + `risk_engine` + the fast
   `url_check` verdict on any embedded link; score ≥ 60 → junk.
3. Anything ambiguous or any error → `none` (fail open) so real texts are
   never hidden.

## Moving pieces

| Piece | Where |
| --- | --- |
| Config plugin (Xcode target, entitlements) | `mobile/plugins/withMessageFilterExtension.js` + `mobile/plugins/messageFilter/` |
| Swift handler template | `mobile/plugins/messageFilter/MessageFilterHandler.swift` |
| Backend classifier endpoint | `backend/app/api/v1/message_filter.py` (unauthenticated by design, fail-open) |
| AASA file | served by FastAPI at `/.well-known/apple-app-site-association` (`main.py`) |
| Deferral URL | `ILMessageFilterExtensionNetworkURL` in the extension Info.plist → `https://api.shieldai.rushingtechnologies.com/api/v1/message-filter` |
| Main-app entitlement | `messagefilter:api.shieldai.rushingtechnologies.com` associated domain |

## Signing / CI

Mirrors the Call Directory extension exactly:

- One-time setup (already run): `scripts/setup_message_filter_extension_signing.py`
  creates the App ID with App Groups, enables Associated Domains on the main
  App ID, and saves `scripts/message_filter_extension.mobileprovision`.
  The **app-group assignment** (`group.com.shieldai.app` → App ID) is not
  exposed by the ASC API and was done in the developer portal UI.
- CI (`codemagic.yaml`): `fetch-signing-files "$BUNDLE_ID.messagefilter"` +
  `scripts/patch_message_filter_extension_profile.py` pins the profile on the
  extension target after `xcode-project use-profiles`.

## User-facing setup

iOS requires the user to opt in: Settings → Messages → Unknown & Spam →
SMS Filtering → Shield AI. The in-app instructions live on the
"Call & Text Protection" screen (`mobile/app/call-protection.tsx`).

## Verifying

1. TestFlight build on a physical iPhone; enable the filter in Settings.
2. From a number **not** in contacts, send yourself a scammy text
   (e.g. the E-ZPass unpaid-toll template in `backend/tests/test_message_filter.py`).
3. It should land in Messages → Filters → Junk. A benign text ("hey, running
   late") from the same unknown number must stay in Unknown Senders.
4. Backend logs: the deferred query POSTs arrive with no auth header from
   Apple's proxy IPs.
