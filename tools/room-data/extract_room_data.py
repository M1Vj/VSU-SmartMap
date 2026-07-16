#!/usr/bin/env python3
"""Extract and audit room data from the Cumulus PDF export.

The source PDF is a Google Sheets export. Pages 1-2 contain the wide room
registry table. Pages 5-11 contain an older room-utilization list with remarks;
those remarks are used only for reconciliation and are not exported as app data.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import fitz


COLLEGES = {"CAFS", "CAS", "CET", "CFES", "CME", "CON", "CTE", "CVM"}

COLUMN_BOUNDS = {
    "college": (45, 76),
    "department": (76, 105),
    "building_name": (105, 137),
    "room": (137, 196),
    "capacity": (196, 216),
    "actual_capacity": (216, 251),
    "lec_lab": (251, 285),
    "comments": (285, 340),
    "declared_to_registrar": (340, 390),
    "is_shareable": (390, 430),
    "room_status": (430, 465),
    "remarks": (465, 600),
}

UTILIZATION_SOURCE_CODES = {
    "Dept. of Agricultural and Bio-system Engineering": "DABE",
    "Dept. of Animal Science": "DAS",
    "Dept. of Biological Science": "DBS",
    "Dept. of Computer Science and Technology": "DCST",
    "Dept. of Development Communication": "DDC",
    "Dept. of Food Science and Technology": "DFST",
    "Dept. of Plant Breeding and Genetics": "DPBG",
    "Dept. of Liberal Arts and Behavioral Sciences": "DLABS",
    "Dept. of Agro-Forestry": "CFNR",
    "Dept. of Economics": "DOE",
    "Dept. of Horticulture": "DOH",
    "Dept. of Pure and Applied Chemistry": "DOPAC",
    "Dept. of Pest Management": "DPM",
    "Dept. of Teacher Education": "DTE",
    "Institute of Human Kinetics": "IHK",
    "Institute of Strategic Research and Devt. Studies": "ISRDS",
    "Office of National Service Training Program": "NSTP",
    "Office of the Dean of Students": "ODS",
    "Institute of Tropical Ecology & Environmental Management": "ITEEM",
    "Dept. of Mechanical Engineering": "DME",
    "Dept. of Nursing": "DON",
    "Dept. of Veterinary Medicine": "DVM",
    "Dept. of Forest Science": "DFS",
    "Dept. of Consumer, Hospitality and Management": "DTHM",
    "Dept. of Agricultural Education and Extension": "DAEEx",
    "Research and Extension Building": "ODREX",
    "Dept. of Biotechnology": "DBT",
    "Dept. of Statistics": "DStat",
    "Plant Science Building": "PSB",
    "Virtual Learning Class": "VIRTUAL",
    "Dept. of Physics": "DPhys",
    "Department of Meteorology": "DMet",
    "FOR RESIDENCY": "RESIDENCY",
    "Dept. of Business Management": "DBM",
    "Dept. of Soil Science": "DSS",
    "Dept. of Agronomy": "DA",
    "Dept. of Mathematics": "DMath",
    "Dept. of Civil Engineering": "DCE",
    "Dept. of Geodetic Engineering": "DGE",
    "Dept. of Philosophy and Social Sciences": "DPSS/DALL",
}


def clean_join(parts: list[str]) -> str:
    text = " ".join(parts)
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("DTHM-OFR /OFFICE ROOM", "DTHM-OFR / OFFICE ROOM")
    return text


def int_or_none(value: str) -> int | None:
    value = value.strip()
    return int(value) if re.fullmatch(r"\d+", value) else None


def floor_from_room(room: str) -> int | None:
    candidates = re.findall(r"(?<!\d)(\d{3})(?!\d)", room)
    for candidate in candidates:
        if candidate[0] in "123456":
            return int(candidate[0])
    return None


def words_for_row(words: list[tuple], y: float) -> list[tuple]:
    return [word for word in words if abs(word[1] - y) <= 0.85]


def field_from_words(row_words: list[tuple], field: str) -> str:
    left, right = COLUMN_BOUNDS[field]
    values = [
        word[4]
        for word in sorted(row_words, key=lambda item: item[0])
        if left <= word[0] < right
    ]
    return clean_join(values)


def extract_wide_table(pdf: Path) -> list[dict[str, Any]]:
    doc = fitz.open(pdf)
    rows: list[dict[str, Any]] = []

    for page_index in (0, 1):
        page = doc[page_index]
        words = page.get_text("words")
        starts = sorted(
            (word[1], word[4])
            for word in words
            if 45 <= word[0] < 76 and word[4] in COLLEGES
        )

        for y, _college in starts:
            row_words = words_for_row(words, y)
            row = {field: field_from_words(row_words, field) for field in COLUMN_BOUNDS}
            if not row["college"] or not row["department"]:
                continue
            row["source_page"] = page_index + 1
            row["capacity_value"] = int_or_none(row["capacity"])
            row["actual_capacity_value"] = int_or_none(row["actual_capacity"])
            row["floor"] = floor_from_room(row["room"])
            rows.append(row)

    return rows


def is_section_heading(line: str) -> bool:
    return line in UTILIZATION_SOURCE_CODES


def is_remark(line: str) -> bool:
    return line in {"OK", "DELETED", "-"}


def extract_utilization_list(pdf: Path) -> list[dict[str, Any]]:
    doc = fitz.open(pdf)
    rows: list[dict[str, Any]] = []
    current_heading = ""
    page_range = range(4, 11)

    for page_index in page_range:
        lines = [
            line.strip()
            for line in doc[page_index].get_text("text").splitlines()
            if line.strip()
        ]
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.startswith("Classroom Utilization") or line in {"Room", "Capacity", "Remarks"}:
                i += 1
                continue
            if is_section_heading(line):
                current_heading = line
                i += 1
                continue
            if not current_heading:
                i += 1
                continue

            room = line
            capacity: int | None = None
            remark = ""
            if i + 1 < len(lines) and re.fullmatch(r"\d+", lines[i + 1]):
                capacity = int(lines[i + 1])
                if i + 2 < len(lines) and is_remark(lines[i + 2]):
                    remark = lines[i + 2]
                    i += 3
                else:
                    i += 2
            elif i + 1 < len(lines) and is_remark(lines[i + 1]):
                remark = lines[i + 1]
                i += 2
            else:
                i += 1
                continue

            rows.append(
                {
                    "source_page": page_index + 1,
                    "source_heading": current_heading,
                    "source_code": UTILIZATION_SOURCE_CODES[current_heading],
                    "room": room,
                    "capacity_value": capacity,
                    "remarks": remark,
                }
            )

    return rows


def canonical_room(row: dict[str, Any]) -> dict[str, Any] | None:
    room = row["room"].strip()
    if not room:
        return None

    capacity = row["capacity_value"]
    description = f"Capacity: {capacity}" if capacity is not None else ""

    return {
        "college": row["college"],
        "department": row["department"],
        "building_name": row["building_name"],
        "room_code": room,
        "capacity": capacity,
        "actual_capacity": row["actual_capacity_value"],
        "lec_lab": row["lec_lab"],
        "floor": floor_from_room(room),
        "description": description,
        "source_page": row["source_page"],
    }


def build_audit(
    wide_rows: list[dict[str, Any]],
    canonical_rows: list[dict[str, Any]],
    utilization_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    blank_wide = [row for row in wide_rows if not row["room"].strip()]
    by_facility_room = Counter(
        (row["building_name"], row["room_code"]) for row in canonical_rows if row["room_code"]
    )
    duplicate_facility_rooms = [
        {"building_name": key[0], "room_code": key[1], "count": count}
        for key, count in sorted(by_facility_room.items())
        if count > 1
    ]
    room_only = Counter(row["room_code"] for row in canonical_rows if row["room_code"])
    duplicate_room_codes = [
        {"room_code": room, "count": count}
        for room, count in sorted(room_only.items())
        if count > 1
    ]

    source_counts = Counter(row["building_name"] for row in canonical_rows)
    pivot_expected = {
        "DA": 6,
        "DABE": 7,
        "DAEEX": 2,
        "DALL": 7,
        "DAS": 7,
        "DBM": 2,
        "DBS": 7,
        "DBT": 4,
        "DCE": 7,
        "DCST": 6,
        "DDC": 3,
        "DFS": 10,
        "DFST": 5,
        "DGE": 5,
        "DLABS": 1,
        "DMath": 7,
        "DME": 3,
        "DMet": 3,
        "DOE": 5,
        "DOH": 6,
        "DON": 3,
        "DOPAC": 8,
        "DPBG": 5,
        "DPhys": 6,
        "DPM": 7,
        "DPSS": 7,
        "DSS": 6,
        "DepStat": 6,
        "DTE": 8,
        "DTHM": 10,
        "DVM": 11,
        "IHK": 7,
        "ISRDS": 1,
        "ITEEM": 1,
    }
    count_mismatches = [
        {
            "building_name": code,
            "expected": expected,
            "actual": source_counts.get(code, 0),
        }
        for code, expected in pivot_expected.items()
        if source_counts.get(code, 0) != expected
    ]

    util_ok = {
        (row["source_code"], row["room"]): row
        for row in utilization_rows
        if row["remarks"] in {"OK", "-"}
    }
    canonical_keys = {(row["department"], row["room_code"]) for row in canonical_rows}
    supplemental_ok_not_in_wide = [
        row for key, row in sorted(util_ok.items()) if key not in canonical_keys
    ]

    return {
        "wide_row_count": len(wide_rows),
        "canonical_row_count": len(canonical_rows),
        "utilization_row_count": len(utilization_rows),
        "blank_wide_rooms_reconciliation_candidates": blank_wide,
        "duplicate_facility_rooms": duplicate_facility_rooms,
        "duplicate_room_codes_across_buildings_or_departments": duplicate_room_codes,
        "pivot_count_mismatches": count_mismatches,
        "supplemental_ok_not_in_wide": supplemental_ok_not_in_wide,
        "building_counts": dict(sorted(source_counts.items())),
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def write_audit_markdown(path: Path, audit: dict[str, Any]) -> None:
    lines = [
        "# Room Data Extraction Audit",
        "",
        f"- Wide-table rows extracted: {audit['wide_row_count']}",
        f"- Canonical rows after fixes: {audit['canonical_row_count']}",
        f"- Utilization-list rows extracted for reconciliation only: {audit['utilization_row_count']}",
        f"- Blank wide-table room rows needing reconciliation: {len(audit['blank_wide_rooms_reconciliation_candidates'])}",
        f"- Duplicate room codes within the same building: {len(audit['duplicate_facility_rooms'])}",
        f"- Pivot count mismatches: {len(audit['pivot_count_mismatches'])}",
        "",
        "## Building Counts",
    ]
    for code, count in audit["building_counts"].items():
        lines.append(f"- {code}: {count}")
    lines.extend(["", "## Blank Wide-Table Rows Needing Reconciliation"])
    if audit["blank_wide_rooms_reconciliation_candidates"]:
        for row in audit["blank_wide_rooms_reconciliation_candidates"]:
            lines.append(
                f"- Page {row['source_page']}: {row['college']} {row['department']} "
                f"{row['building_name']} blank room, capacity {row['capacity']}; "
                "page 5 utilization list has DAS-6 with capacity 35, but the wide-table "
                "room cell is blank and the pivot count excludes it"
            )
    else:
        lines.append("- None")
    lines.extend(["", "## Duplicate Room Codes Within Same Building"])
    if audit["duplicate_facility_rooms"]:
        for item in audit["duplicate_facility_rooms"]:
            lines.append(f"- {item['building_name']} / {item['room_code']}: {item['count']}")
    else:
        lines.append("- None")
    lines.extend(["", "## Pivot Count Mismatches"])
    if audit["pivot_count_mismatches"]:
        for item in audit["pivot_count_mismatches"]:
            lines.append(
                f"- {item['building_name']}: expected {item['expected']}, actual {item['actual']}"
            )
    else:
        lines.append("- None")
    lines.extend(["", "## Supplemental OK Rows Not In Wide Table"])
    for row in audit["supplemental_ok_not_in_wide"][:80]:
        lines.append(
            f"- {row['source_heading']} / {row['room']} / capacity {row['capacity_value']}"
        )
    if len(audit["supplemental_ok_not_in_wide"]) > 80:
        lines.append(f"- ... {len(audit['supplemental_ok_not_in_wide']) - 80} more")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, default=Path("output/room-data-audit"))
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    wide_rows = extract_wide_table(args.pdf)
    canonical_rows = [
        canonical
        for row in wide_rows
        if (canonical := canonical_room(row)) is not None
    ]
    utilization_rows = extract_utilization_list(args.pdf)
    audit = build_audit(wide_rows, canonical_rows, utilization_rows)

    (args.out / "wide-table-raw.json").write_text(
        json.dumps(wide_rows, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (args.out / "rooms-canonical.json").write_text(
        json.dumps(canonical_rows, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (args.out / "utilization-reconciliation.json").write_text(
        json.dumps(utilization_rows, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (args.out / "audit.json").write_text(
        json.dumps(audit, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_csv(args.out / "rooms-canonical.csv", canonical_rows)
    write_audit_markdown(args.out / "audit.md", audit)

    print(json.dumps(audit, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
