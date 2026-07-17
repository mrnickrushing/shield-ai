"""Disable fmt 11.0.2's broken consteval path under Xcode 26.4+.

React Native 0.76 downloads fmt during ``pod install``. Apple Clang in Xcode
26.4 rejects several FMT_STRING expressions when fmt enables consteval, so the
patch must run after CocoaPods has populated ``Pods/fmt``.
"""

from pathlib import Path
import re
import sys


CONSTEVAL_ENABLED = re.compile(
    r"(#elif defined\(__cpp_consteval\)\r?\n#\s*define FMT_USE_CONSTEVAL)\s+1\b"
)
CONSTEVAL_DISABLED = re.compile(
    r"#elif defined\(__cpp_consteval\)\r?\n#\s*define FMT_USE_CONSTEVAL\s+0\b"
)
WORKAROUND_COMMENT = "  // Xcode 26.4 Apple Clang workaround"


def patch_fmt_header(path: Path) -> bool:
    """Patch *path* and return True, or return False when already patched."""
    if not path.is_file():
        raise FileNotFoundError(f"fmt header not found: {path}")

    original = path.read_text(encoding="utf-8")
    if CONSTEVAL_DISABLED.search(original):
        print(f"[fmt patch] consteval already disabled in {path}")
        return False

    patched, replacements = CONSTEVAL_ENABLED.subn(
        lambda match: f"{match.group(1)} 0{WORKAROUND_COMMENT}",
        original,
    )
    if replacements != 1:
        raise RuntimeError(
            "fmt consteval definition was not found exactly once; "
            "the bundled fmt layout may have changed"
        )

    path.write_text(patched, encoding="utf-8")
    if not CONSTEVAL_DISABLED.search(path.read_text(encoding="utf-8")):
        raise RuntimeError("fmt consteval patch verification failed")

    print(f"[fmt patch] disabled consteval in {path}")
    return True


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {Path(sys.argv[0]).name} <fmt-base.h>")

    try:
        patch_fmt_header(Path(sys.argv[1]))
    except (FileNotFoundError, OSError, RuntimeError) as error:
        print(f"[fmt patch] ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
