"""
Enable App Groups capability on the share-extension App ID and delete any
stale provisioning profiles that were created before the capability existed.

Codemagic exposes these env vars from the app_store_connect integration:
  APP_STORE_CONNECT_KEY_IDENTIFIER
  APP_STORE_CONNECT_ISSUER_ID
  APP_STORE_CONNECT_PRIVATE_KEY

BUNDLE_ID must also be set (e.g. com.shieldai.app).
"""
import json
import os
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://api.appstoreconnect.apple.com"


def jwt_token():
    try:
        import jwt
    except ImportError:
        import subprocess
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q", "PyJWT", "cryptography"],
            check=True,
        )
        import jwt

    kid = os.environ["APP_STORE_CONNECT_KEY_IDENTIFIER"]
    iss = os.environ["APP_STORE_CONNECT_ISSUER_ID"]
    key = os.environ["APP_STORE_CONNECT_PRIVATE_KEY"]
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
            "Authorization": f"Bearer {jwt_token()}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        print(
            f"HTTP {e.code} {method} {path}: {e.read().decode()[:400]}",
            file=sys.stderr,
        )
        return None


def main():
    bundle_str = f"{os.environ['BUNDLE_ID']}.share-extension"
    print(f"Configuring App ID: {bundle_str}")

    # Find or create the App ID
    res = api("GET", f"/v1/bundleIds?filter[identifier]={bundle_str}")
    if res and res.get("data"):
        bid_id = res["data"][0]["id"]
        print(f"  found: {bid_id}")
    else:
        res = api(
            "POST",
            "/v1/bundleIds",
            {
                "data": {
                    "type": "bundleIds",
                    "attributes": {
                        "identifier": bundle_str,
                        "name": "Shield AI Share Extension",
                        "platform": "IOS",
                    },
                }
            },
        )
        if not res:
            print("ERROR: could not find or create bundle ID", file=sys.stderr)
            sys.exit(1)
        bid_id = res["data"]["id"]
        print(f"  created: {bid_id}")

    # Enable App Groups capability if missing
    caps = api("GET", f"/v1/bundleIds/{bid_id}/bundleIdCapabilities") or {}
    has_app_groups = any(
        c["attributes"]["capabilityType"] == "APP_GROUPS"
        for c in caps.get("data", [])
    )
    if has_app_groups:
        print("  App Groups already enabled")
    else:
        print("  Enabling App Groups capability...")
        r = api(
            "POST",
            "/v1/bundleIdCapabilities",
            {
                "data": {
                    "type": "bundleIdCapabilities",
                    "attributes": {"capabilityType": "APP_GROUPS", "settings": []},
                    "relationships": {
                        "bundleId": {"data": {"type": "bundleIds", "id": bid_id}}
                    },
                }
            },
        )
        print(f"  {'enabled' if r else 'WARNING: enable failed'}")

    # Delete stale distribution profiles (created before App Groups was enabled)
    profs = (
        api(
            "GET",
            f"/v1/profiles?filter[bundleId]={bid_id}&filter[profileType]=IOS_APP_STORE",
        )
        or {}
    )
    for p in profs.get("data", []):
        pid, name = p["id"], p["attributes"]["name"]
        api("DELETE", f"/v1/profiles/{pid}")
        print(f"  deleted stale profile: {name} ({pid})")


if __name__ == "__main__":
    main()
