"""
Explicitly set PROVISIONING_PROFILE_SPECIFIER for the ShareExtension target in
the Xcode project file after xcode-project use-profiles has run.

usage: python3 patch_share_extension_profile.py <profile_name>

This is needed when expo-share-intent stores the extension bundle ID as a
variable reference ($(PRODUCT_BUNDLE_IDENTIFIER).share-extension) in the
pbxproj, which xcode-project use-profiles cannot resolve.
"""
import glob
import os
import plistlib
import subprocess
import sys

profiles_dir = os.path.expanduser("~/Library/MobileDevice/Provisioning Profiles")
cm_build_dir = os.environ.get("CM_BUILD_DIR", "")
bundle_id = os.environ.get("BUNDLE_ID", "")
share_bundle = f"{bundle_id}.share-extension"


def find_share_profile_name():
    """Return the Name of the installed share-extension provisioning profile."""
    for f in sorted(glob.glob(f"{profiles_dir}/*.mobileprovision")):
        result = subprocess.run(["security", "cms", "-D", "-i", f], capture_output=True)
        if result.returncode != 0:
            continue
        try:
            p = plistlib.loads(result.stdout)
        except Exception:
            continue
        app_id = p.get("Entitlements", {}).get("application-identifier", "")
        ag = p.get("Entitlements", {}).get("com.apple.security.application-groups", [])
        if "share-extension" in app_id.lower():
            name = p.get("Name", "")
            print(f"[patch] found profile: {name}")
            print(f"  application-identifier: {app_id}")
            print(f"  app-groups:             {ag}")
            if not ag:
                print("[patch] WARNING: profile has no app-groups entitlement")
            return name
    return None


def patch_pbxproj(pbxproj_path, profile_name):
    """
    Add PROVISIONING_PROFILE_SPECIFIER = "<profile_name>" to every
    XCBuildConfiguration block that belongs to the ShareExtension target
    (identified by BUNDLE_IDENTIFIER or PRODUCT_BUNDLE_IDENTIFIER matching
    the share extension bundle ID, or by the literal variable reference).
    """
    with open(pbxproj_path) as f:
        lines = f.readlines()

    # Detect which blocks are ShareExtension configurations.
    # A block in pbxproj looks like:
    #   UUID /* Debug|Release */ = {
    #       isa = XCBuildConfiguration;
    #       buildSettings = {
    #           ...
    #       };
    #       name = Debug|Release;
    #   };
    #
    # We identify ShareExtension blocks by BUNDLE_IDENTIFIER or
    # PRODUCT_BUNDLE_IDENTIFIER containing share-extension OR the
    # variable $(PRODUCT_BUNDLE_IDENTIFIER).share-extension.

    share_id_markers = [
        share_bundle.lower(),
        "share-extension",
        "shareextension",
    ]

    # First pass: collect line ranges of XCBuildConfiguration blocks that
    # mention share-extension.
    blocks_to_patch = []  # list of (start_line, end_line) 0-indexed
    in_block = False
    block_start = 0
    brace_depth = 0
    is_share_block = False

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Detect start of XCBuildConfiguration block
        if "isa = XCBuildConfiguration;" in stripped:
            in_block = True
            block_start = i
            is_share_block = False
            brace_depth = 0

        if in_block:
            brace_depth += stripped.count("{") - stripped.count("}")

            # Check if this line references the share extension
            lower = stripped.lower()
            if any(m in lower for m in share_id_markers):
                is_share_block = True

            # End of block
            if brace_depth <= -2 and stripped.endswith("};"):
                if is_share_block:
                    blocks_to_patch.append((block_start, i))
                in_block = False

        i += 1

    if not blocks_to_patch:
        print(f"[patch] no ShareExtension build configurations found in {pbxproj_path}")
        print("[patch] looking for any XCBuildConfiguration blocks...")
        # Debug: print first 5 XCBuildConfiguration blocks
        for j, l in enumerate(lines):
            if "isa = XCBuildConfiguration;" in l:
                context = "".join(lines[max(0,j-2):j+10])
                print(f"  block at line {j}:\n{context}\n---")
        return False

    print(f"[patch] found {len(blocks_to_patch)} ShareExtension block(s) to patch")

    # Second pass: insert PROVISIONING_PROFILE_SPECIFIER in each block
    # We insert it just before the closing "};" of the buildSettings section.
    offset = 0  # lines added so far
    for (start, end) in blocks_to_patch:
        s = start + offset
        e = end + offset

        # Find the buildSettings closing brace
        depth = 0
        in_build_settings = False
        insert_at = None
        for k in range(s, e + 1):
            l = lines[k].strip()
            if "buildSettings = {" in l:
                in_build_settings = True
                depth = 1
                continue
            if in_build_settings:
                depth += l.count("{") - l.count("}")
                if depth == 0:
                    insert_at = k
                    break

        if insert_at is None:
            print(f"[patch] could not find buildSettings closing brace in block {start}-{end}")
            continue

        # Check if PROVISIONING_PROFILE_SPECIFIER is already set
        block_lines = lines[s:e+1]
        already_set = any("PROVISIONING_PROFILE_SPECIFIER" in l for l in block_lines)
        if already_set:
            # Update existing value
            for k in range(s, e + 1):
                if "PROVISIONING_PROFILE_SPECIFIER" in lines[k]:
                    indent = len(lines[k]) - len(lines[k].lstrip())
                    lines[k] = " " * indent + f'PROVISIONING_PROFILE_SPECIFIER = "{profile_name}";\n'
                    print(f"[patch] updated PROVISIONING_PROFILE_SPECIFIER at line {k}")
                    break
        else:
            # Insert new line
            indent = "\t\t\t\t"
            new_line = f'{indent}PROVISIONING_PROFILE_SPECIFIER = "{profile_name}";\n'
            lines.insert(insert_at, new_line)
            offset += 1
            print(f"[patch] inserted PROVISIONING_PROFILE_SPECIFIER at line {insert_at}")

    with open(pbxproj_path, "w") as f:
        f.writelines(lines)

    print(f"[patch] wrote updated {pbxproj_path}")
    return True


def main():
    log = open("/tmp/shield_signing.log", "a")
    orig_stdout = sys.stdout
    sys.stdout = type(sys.stdout)(
        sys.stdout.buffer,  # type: ignore[attr-defined]
    ) if hasattr(sys.stdout, "buffer") else sys.stdout

    # Allow profile name from command line or auto-detect
    if len(sys.argv) > 1:
        profile_name = " ".join(sys.argv[1:])
    else:
        profile_name = find_share_profile_name()
        if not profile_name:
            print("[patch] ERROR: could not find share extension profile")
            sys.exit(1)

    pbxproj = os.path.join(cm_build_dir, "mobile/ios/ShieldAI.xcodeproj/project.pbxproj")
    if not os.path.exists(pbxproj):
        print(f"[patch] ERROR: project file not found: {pbxproj}")
        sys.exit(1)

    ok = patch_pbxproj(pbxproj, profile_name)
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
