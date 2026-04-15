import json
import sys

try:
    from .cdd_tester_parser import CddParse
except ImportError:
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
