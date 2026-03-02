"""Remove unnecessary Python artifacts from the embedded Python distribution."""

import shutil
import sys
from pathlib import Path

REMOVE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.pdb",
    "*.lib",
    "*.a",
]

REMOVE_DIRS = [
    "test",
    "tests",
    "idle_test",
    "__phello__",
    "tkinter",
    "turtledemo",
    "ensurepip",
    "idlelib",
    "unittest",
]


def clean(root: Path) -> None:
    removed_size = 0

    for pattern in REMOVE_PATTERNS:
        for item in root.rglob(pattern):
            size = item.stat().st_size if item.is_file() else 0
            if item.is_dir():
                size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                shutil.rmtree(item)
            else:
                item.unlink()
            removed_size += size

    for name in REMOVE_DIRS:
        for item in root.rglob(name):
            if item.is_dir():
                size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                shutil.rmtree(item)
                removed_size += size

    # pip-generated launcher executables have hardcoded Python paths that
    # break after relocation; we invoke modules via `python -m` instead.
    scripts_dir = root / "Scripts"
    if scripts_dir.is_dir():
        size = sum(f.stat().st_size for f in scripts_dir.rglob("*") if f.is_file())
        shutil.rmtree(scripts_dir)
        removed_size += size

    print(f"Cleaned {removed_size / 1024 / 1024:.2f} MB from {root}")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "python"
    if not target.exists():
        print(f"Target directory not found: {target}")
        sys.exit(1)
    clean(target)
