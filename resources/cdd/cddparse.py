import json
import sys
from pathlib import Path

# When launched as `python cddparse.py`, this file is not part of a package, so
# relative imports fail and sibling modules are not on sys.path. Ensure the
# directory containing the CDD Python sources is importable.
_cdd_dir = str(Path(__file__).resolve().parent)
if _cdd_dir not in sys.path:
    sys.path.insert(0, _cdd_dir)

from cdd_tester_parser import CddParse


def parseTesterInfo(file_path):
    parser = CddParse()
    return parser.parse_tester_info(file_path)


def main(argv=None):
    args = list(sys.argv if argv is None else argv)
    if len(args) < 4:
        print(
            json.dumps(
                {
                    "error": 1,
                    "message": "Usage: cddparse.py <command> <cddFilePath> <outputJsonPath>",
                }
            )
        )
        return 1

    command = args[1]
    cdd_path = args[2]
    output_path = args[3]

    if command == "parseTesterInfo":
        result = parseTesterInfo(cdd_path)
    else:
        result = {"error": 1, "message": f"Unknown command: {command}"}

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
