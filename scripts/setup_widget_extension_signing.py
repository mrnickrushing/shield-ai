"""
Idempotent setup for the WidgetExtension provisioning profile.

Steps:
  1. Ensure App ID com.shieldai.app.widget exists with App Groups capability.
  2. Find the team's App Store distribution certificate.
  3. Delete any stale distribution profile for the widget App ID.
  4. Create a fresh profile (including App Groups) and save it to
     scripts/widget_extension.mobileprovision for commit to the repo.

Unlike setup_share_extension_signing.py (which runs conceptually on the
Codemagic Mac instance and uses the macOS `security` tool), this is meant to
be run once, locally, wherever App Store Connect API credentials are
available — it decodes the returned profile with `openssl cms` instead, so it
works on any OS. The committed .mobileprovision it produces is what CI
actually consumes (see the "Set up code signing" step in codemagic.yaml),
exactly like the share-extension profile.

Requires env vars:
  APP_STORE_CONNECT_KEY_IDENTIFIER
  APP_STORE_CONNECT_ISSUER_ID
  APP_STORE_CONNECT_PRIVATE_KEY   (raw .p8 contents, or a path — see _load_key)
  BUNDLE_ID                       (e.g. com.shieldai.app)
"""

import base64
import json
import os
import plistlib
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://api.appstoreconnect.apple.com"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── auth ──────────────────────────────────────────────────────────────────────

def _ensure_pyjwt():
    try:
        import jwt  # noqa: F401
    except ImportError:
        print("[setup] Installing PyJWT + cryptography...", flush=True)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "PyJWT", "cryptography"],
            check=True,
        )


def _load_key():
    raw = os.environ.get("APP_STORE_CONNECT_PRIVATE_KEY", "").strip()
    if not raw:
        raise RuntimeError("APP_STORE_CONNECT_PRIVATE_KEY is not set")
    # Accept either the raw PEM contents or a path to the .p8 file.
    if raw.startswith("-----BEGIN"):
        key = raw
    else:
        with open(raw) as f:
            key = f.read()
    if "\\n" in key and "\n" not in key:
        key = key.replace("\\n", "\n")
    return key


def _jwt_token():
    _ensure_pyjwt()
    import jwt

    kid = os.environ.get("APP_STORE_CONNECT_KEY_IDENTIFIER", "").strip()
    iss = os.environ.get("APP_STORE_CONNECT_ISSUER_ID", "").strip()
    if not kid:
        raise RuntimeError("APP_STORE_CONNECT_KEY_IDENTIFIER is not set")
    if not iss:
        raise RuntimeError("APP_STORE_CONNECT_ISSUER_ID is not set")

    key = _load_key()
    now = int(time.time())
    tok = jwt.encode(
        {"iss": iss, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": kid},
    )
    return tok if isinstance(tok, str) else tok.decode()


def api(method, path, body=None):
    req = Request(
        BASE + path,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Authorization": f"Bearer {_jwt_token()}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        body_text = e.read().decode()[:600]
        raise RuntimeError(f"HTTP {e.code} {method} {path}: {body_text}") from None


# ── helpers ───────────────────────────────────────────────────────────────────

def find_or_create_bundle_id(identifier):
    res = api("GET", f"/v1/bundleIds?filter[identifier]={identifier}")
    if res.get("data"):
        bid_id = res["data"][0]["id"]
        print(f"  bundle ID found: {bid_id}", flush=True)
        return bid_id

    print("  bundle ID not found, creating...", flush=True)
    res = api("POST", "/v1/bundleIds", {
        "data": {
            "type": "bundleIds",
            "attributes": {
                "identifier": identifier,
                "name": "Shield AI Widget",
                "platform": "IOS",
            },
        }
    })
    bid_id = res["data"]["id"]
    print(f"  bundle ID created: {bid_id}", flush=True)
    return bid_id


def ensure_app_groups(bid_id):
    caps = api("GET", f"/v1/bundleIds/{bid_id}/bundleIdCapabilities")
    if any(
        c["attributes"]["capabilityType"] == "APP_GROUPS"
        for c in caps.get("data", [])
    ):
        print("  App Groups: already enabled", flush=True)
        return

    print("  App Groups: enabling...", flush=True)
    api("POST", "/v1/bundleIdCapabilities", {
        "data": {
            "type": "bundleIdCapabilities",
            "attributes": {"capabilityType": "APP_GROUPS", "settings": []},
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bid_id}}
            },
        }
    })
    print("  App Groups: enabled", flush=True)


def delete_stale_profiles(bid_id):
    profs = api("GET", f"/v1/bundleIds/{bid_id}/profiles")
    deleted = 0
    for p in profs.get("data", []):
        if p["attributes"].get("profileType") != "IOS_APP_STORE":
            continue
        pid, name = p["id"], p["attributes"]["name"]
        api("DELETE", f"/v1/profiles/{pid}")
        print(f"  deleted stale profile: {name} ({pid})", flush=True)
        deleted += 1
    if not deleted:
        print("  no stale profiles to delete", flush=True)


def find_distribution_cert():
    certs = api(
        "GET",
        "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=10",
    )
    if not certs.get("data"):
        raise RuntimeError("No DISTRIBUTION certificate found in App Store Connect")
    cert = certs["data"][0]
    print(f"  certificate: {cert['attributes']['name']} ({cert['id']})", flush=True)
    return cert["id"]


def _decode_profile_plist(profile_data: bytes) -> dict:
    """Decode a CMS-signed .mobileprovision into its embedded plist, without
    verifying the signature (we trust it — it just came straight from the App
    Store Connect API response)."""
    with tempfile.NamedTemporaryFile(suffix=".mobileprovision") as der_f, \
         tempfile.NamedTemporaryFile(suffix=".plist") as plist_f:
        der_f.write(profile_data)
        der_f.flush()
        subprocess.run(
            [
                "openssl", "cms", "-verify", "-noverify",
                "-inform", "DER",
                "-in", der_f.name,
                "-out", plist_f.name,
            ],
            check=True,
            capture_output=True,
        )
        return plistlib.loads(plist_f.read())


def create_and_install_profile(bid_id, cert_id, profile_name, dest_path):
    print(f"  creating profile '{profile_name}'...", flush=True)
    res = api("POST", "/v1/profiles", {
        "data": {
            "type": "profiles",
            "attributes": {
                "name": profile_name,
                "profileType": "IOS_APP_STORE",
            },
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bid_id}},
                "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
                "devices": {"data": []},
            },
        }
    })

    attrs = res["data"]["attributes"]
    profile_b64 = attrs["profileContent"]
    profile_data = base64.b64decode(profile_b64)
    profile_state = attrs.get("profileState", "?")
    print(f"  profile state: {profile_state}", flush=True)

    plist = _decode_profile_plist(profile_data)
    uuid = plist["UUID"]
    ents = plist.get("Entitlements", {})
    ag = ents.get("com.apple.security.application-groups", [])
    print(f"  profile UUID: {uuid}", flush=True)
    print(f"  profile app-groups: {ag}", flush=True)

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(profile_data)
    print(f"  saved to: {dest_path}", flush=True)

    return uuid, ag


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    bundle_id = os.environ.get("BUNDLE_ID", "").strip()
    if not bundle_id:
        raise RuntimeError("BUNDLE_ID environment variable is not set")

    widget_bundle = f"{bundle_id}.widget"
    print(f"\n=== widget-extension signing setup: {widget_bundle} ===", flush=True)

    bid_id = find_or_create_bundle_id(widget_bundle)
    ensure_app_groups(bid_id)
    delete_stale_profiles(bid_id)
    cert_id = find_distribution_cert()
    dest_path = os.path.join(REPO_ROOT, "scripts", "widget_extension.mobileprovision")
    uuid, app_groups = create_and_install_profile(
        bid_id, cert_id, "Shield AI Widget AppStore", dest_path
    )

    if not app_groups:
        raise RuntimeError(
            f"Profile {uuid} does not include com.apple.security.application-groups. "
            "Ensure App Groups is enabled on the App ID in App Store Connect."
        )

    print(f"\n✓ Widget extension profile ready (UUID={uuid})", flush=True)


if __name__ == "__main__":
    main()
