#!/usr/bin/env python3
"""Generate the audited room-data cleanup migration."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


CANONICAL_CODE_BY_SOURCE = {
    "DA": "DA",
    "DAEEX": "DAEEX",
    "DAS": "DAS",
    "DDC": "DDC",
    "DFST": "DFST",
    "DOH": "DOH",
    "DPBG": "DPBG",
    "DPM": "DPM",
    "DSS": "DSS",
    "DALL": "DALL",
    "DBS": "DBS",
    "DBT": "DBT",
    "DLABS": "DLABS",
    "DMath": "DMATH",
    "DOPAC": "DOPAC",
    "DPhys": "DPHYS",
    "DPSS": "DPSS",
    "DepStat": "DSTAT",
    "DABE": "DABE",
    "DCE": "DCE",
    "DCST": "DCST",
    "DGE": "DGE",
    "DME": "DME",
    "DMet": "DMET",
    "DFS": "DFS",
    "ITEEM": "ITEEM",
    "DBM": "DBM",
    "DOE": "DOE",
    "DTHM": "DTHM",
    "ISRDS": "ISRDS",
    "DON": "DON",
    "DTE": "DTE",
    "IHK": "IHK",
    "DVM": "DVM",
}

FACILITIES = {
    "DA": {
        "name": "Department of Agronomy",
        "slug": "department-of-agronomy",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DA", "Dept. of Agronomy"],
        "coords": (10.7461, 124.7933),
    },
    "DAEEX": {
        "name": "Department of Agricultural Education and Extension",
        "slug": "department-of-agricultural-education-and-extension",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DAEEx", "DAEEX"],
        "coords": (10.7461, 124.7933),
    },
    "DAS": {
        "name": "Department of Animal Science",
        "slug": "department-of-animal-science",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DAS"],
        "coords": (10.7475, 124.7932),
    },
    "DDC": {
        "name": "Department of Development Communication",
        "slug": "department-of-development-communication",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DDC", "DevCom"],
        "coords": (10.7447, 124.7949),
    },
    "DFST": {
        "name": "Department of Food Science and Technology",
        "slug": "department-of-food-science-and-technology",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DFST", "FT", "FoodTech"],
        "coords": (10.7476, 124.7928),
    },
    "DOH": {
        "name": "Department of Horticulture",
        "slug": "department-of-horticulture",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DOH"],
        "coords": (10.7461, 124.7933),
    },
    "DPBG": {
        "name": "Department of Plant Breeding and Genetics",
        "slug": "department-of-plant-breeding-and-genetics",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DPBG"],
        "coords": (10.7461, 124.7933),
    },
    "DPM": {
        "name": "Department of Pest Management",
        "slug": "department-of-pest-management",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DPM"],
        "coords": (10.7461, 124.7933),
    },
    "DSS": {
        "name": "Department of Soil Science",
        "slug": "department-of-soil-science",
        "parent": "Faculty of Agriculture and Food Science (FAFS)",
        "former_parent": "College of Agriculture and Food Science (CAFS)",
        "aliases": ["DSS"],
        "coords": (10.7461, 124.7933),
    },
    "DALL": {
        "name": "Department of Arts, Languages, and Literature",
        "slug": "department-of-arts-languages-and-literature",
        "parent": "Faculty of Humanities and Social Sciences (FHSS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DALL", "Department of Arts, Languages and Literature"],
        "coords": (10.7431, 124.7942),
    },
    "DBS": {
        "name": "Department of Biological Sciences",
        "slug": "department-of-biological-sciences",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DBS"],
        "coords": (10.7431, 124.7942),
    },
    "DBT": {
        "name": "Department of Biotechnology",
        "slug": "department-of-biotechnology",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DBT", "DBt", "BIOTECH"],
        "coords": (10.7431, 124.7942),
    },
    "DLABS": {
        "name": "Former DLABS Building",
        "slug": "former-dlabs-building",
        "parent": "Faculty of Humanities and Social Sciences (FHSS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": [
            "DLABS",
            "Department of Liberal Arts and Behavioral Sciences",
            "Department of Arts, Languages, and Literature",
            "Department of Philosophy and Social Sciences",
        ],
        "coords": (10.7431, 124.7942),
    },
    "DMATH": {
        "name": "Department of Mathematics",
        "slug": "department-of-mathematics",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DMath", "DMATH"],
        "coords": (10.7431, 124.7942),
    },
    "DOPAC": {
        "name": "Department of Pure and Applied Chemistry",
        "slug": "department-of-pure-and-applied-chemistry",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DoPAC", "DOPAC", "CHEM"],
        "coords": (10.7431, 124.7942),
    },
    "DPHYS": {
        "name": "Department of Physics",
        "slug": "department-of-physics",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DPhys", "DPHYS", "PHYS"],
        "coords": (10.7431, 124.7942),
    },
    "DPSS": {
        "name": "Department of Philosophy and Social Sciences",
        "slug": "department-of-philosophy-and-social-sciences",
        "parent": "Faculty of Humanities and Social Sciences (FHSS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DPSS"],
        "coords": (10.7431, 124.7942),
    },
    "DSTAT": {
        "name": "Department of Statistics",
        "slug": "department-of-statistics",
        "parent": "Faculty of Natural and Mathematical Sciences (FNMS)",
        "former_parent": "College of Arts and Sciences (CAS)",
        "aliases": ["DStat", "DepStat", "DSTAT", "STAT"],
        "coords": (10.7431, 124.7942),
    },
    "DABE": {
        "name": "Department of Agricultural and Biosystems Engineering",
        "slug": "department-of-agricultural-and-biosystems-engineering",
        "parent": "Faculty of Engineering (FE)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DABE", "ABE"],
        "coords": (10.7455, 124.7935),
    },
    "DCE": {
        "name": "Department of Civil Engineering",
        "slug": "department-of-civil-engineering",
        "parent": "Faculty of Engineering (FE)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DCE"],
        "coords": (10.7455, 124.7935),
    },
    "DCST": {
        "name": "Department of Computer Science and Technology",
        "slug": "department-of-computer-science-and-technology",
        "parent": "Faculty of Computing (FOC)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DCST", "CSAT"],
        "coords": (10.7455, 124.7935),
    },
    "DGE": {
        "name": "Department of Geodetic Engineering",
        "slug": "department-of-geodetic-engineering",
        "parent": "Faculty of Engineering (FE)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DGE", "GE"],
        "coords": (10.7455, 124.7935),
    },
    "DME": {
        "name": "Department of Mechanical Engineering",
        "slug": "department-of-mechanical-engineering",
        "parent": "Faculty of Engineering (FE)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DME", "ME", "MECH"],
        "coords": (10.7455, 124.7935),
    },
    "DMET": {
        "name": "Department of Meteorology",
        "slug": "department-of-meteorology",
        "parent": "Faculty of Engineering (FE)",
        "former_parent": "College of Engineering and Technology (CET)",
        "aliases": ["DMet", "DMET"],
        "coords": (10.7455, 124.7935),
    },
    "DFS": {
        "name": "Department of Forest Science",
        "slug": "department-of-forest-science",
        "parent": "Faculty of Forestry and Environmental Science (FFES)",
        "former_parent": "College of Forestry and Environmental Science (CFES)",
        "aliases": ["DFS", "CFNR", "CFES"],
        "coords": (10.7485, 124.7925),
    },
    "ITEEM": {
        "name": "Institute of Tropical Ecology and Environmental Management",
        "slug": "institute-of-tropical-ecology-and-environmental-management",
        "parent": "Faculty of Forestry and Environmental Science (FFES)",
        "former_parent": "College of Forestry and Environmental Science (CFES)",
        "aliases": ["ITEEM"],
        "coords": (10.7485, 124.7925),
    },
    "DBM": {
        "name": "Department of Business and Management",
        "slug": "department-of-business-and-management",
        "parent": "Faculty of Management and Economics (FME)",
        "former_parent": "College of Management and Economics (CME)",
        "aliases": ["DBM", "Department of Business Management"],
        "coords": (10.7445, 124.7952),
    },
    "DOE": {
        "name": "Department of Economics",
        "slug": "department-of-economics",
        "parent": "Faculty of Management and Economics (FME)",
        "former_parent": "College of Management and Economics (CME)",
        "aliases": ["DoE", "DOE", "ECON"],
        "coords": (10.7445, 124.7952),
    },
    "DTHM": {
        "name": "Department of Tourism and Hospitality Management",
        "slug": "department-of-tourism-and-hospitality-management",
        "parent": "Faculty of Management and Economics (FME)",
        "former_parent": "College of Management and Economics (CME)",
        "aliases": [
            "DTHM",
            "DCHM",
            "Department of Consumer and Hospitality Management",
            "Department of Hospitality Management",
            "Department of Tourism Management",
            "DTM",
            "DHM",
        ],
        "coords": (10.7451, 124.795),
    },
    "ISRDS": {
        "name": "Institute for Strategic Research and Development Studies",
        "slug": "institute-for-strategic-research-and-development-studies",
        "parent": "Faculty of Humanities and Social Sciences (FHSS)",
        "former_parent": "College of Management and Economics (CME)",
        "aliases": ["ISRDS", "Institute of Strategic Research and Development Studies"],
        "coords": (10.7445, 124.7952),
    },
    "DON": {
        "name": "Faculty of Nursing",
        "slug": "faculty-of-nursing",
        "parent": "Faculty of Nursing (FON)",
        "former_parent": "College of Nursing (CON)",
        "aliases": ["DON", "CON", "FON", "Department of Nursing"],
        "coords": (10.744, 124.7955),
    },
    "DTE": {
        "name": "Department of Teacher Education",
        "slug": "department-of-teacher-education",
        "parent": "Faculty of Teacher Education (FTE)",
        "former_parent": "College of Education (CTE)",
        "aliases": ["DTE", "DTED", "Department of Teacher Education"],
        "coords": (10.7435, 124.796),
    },
    "IHK": {
        "name": "Institute of Human Kinetics",
        "slug": "institute-of-human-kinetics",
        "parent": "Faculty of Teacher Education (FTE)",
        "former_parent": "College of Education (CTE)",
        "aliases": ["IHK"],
        "coords": (10.742, 124.797),
    },
    "DVM": {
        "name": "Faculty of Veterinary Medicine",
        "slug": "faculty-of-veterinary-medicine",
        "parent": "Faculty of Veterinary Medicine (FVM)",
        "former_parent": "College of Veterinary Medicine (CVM)",
        "aliases": ["DVM", "CVM", "FVM", "Department of Veterinary Medicine"],
        "coords": (10.75, 124.79),
    },
}

LEGACY_CODE_RENAMES = {
    "FT": "DFST",
    "ABE": "DABE",
    "GE": "DGE",
    "ME": "DME",
    "MECH": "DME",
    "ECON": "DOE",
    "DECON": "DOE",
    "BIOTECH": "DBT",
    "DTED": "DTE",
    "DTM": "DTHM",
    "CVM": "DVM",
    "CSAT": "DCST",
    "MATH": "DMATH",
    "PHYS": "DPHYS",
    "STAT": "DSTAT",
    "CHEM": "DOPAC",
}

ROOM_IMPORT_CODES = sorted(
    set(CANONICAL_CODE_BY_SOURCE.values())
    | set(LEGACY_CODE_RENAMES)
    | set(LEGACY_CODE_RENAMES.values())
    | {
        "ADMIN",
        "CAF",
        "CAS",
        "CET",
        "CFNR",
        "CHEM",
        "COMART",
        "DHM",
        "FON",
        "HIGHSC",
        "HOMESCI",
        "MATH",
        "MATHNS",
        "MECH",
        "NURS",
        "PHYS",
        "STAT",
        "VACADMIN",
    }
)


def sql(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def facility_description(code: str, source_codes: list[str]) -> str:
    meta = FACILITIES[code]
    aliases = sorted(set(meta["aliases"] + source_codes))
    return (
        f"{meta['parent']}; formerly under {meta['former_parent']}. "
        f"Search aliases: {', '.join(aliases)}."
    )


def facility_slug(code: str) -> str:
    meta = FACILITIES[code]
    return meta.get("slug") or slugify(meta["name"])


def floor_from_room(room: str) -> int | None:
    candidates = re.findall(r"(?<!\d)(\d{3})(?!\d)", room)
    for candidate in candidates:
        if candidate[0] in "123456":
            return int(candidate[0])
    return None


def generate(rows: list[dict[str, Any]]) -> str:
    by_facility_source: dict[str, set[str]] = {code: set() for code in FACILITIES}
    canonical_rows: list[dict[str, Any]] = []
    for row in rows:
        code = CANONICAL_CODE_BY_SOURCE[row["building_name"]]
        row = {**row, "facility_code": code}
        row["floor"] = floor_from_room(row["room_code"])
        canonical_rows.append(row)
        by_facility_source[code].add(row["building_name"])
        by_facility_source[code].add(row["department"])

    lines: list[str] = [
        "-- Audited room-data reset.",
        "-- Generated by tools/room-data/generate_room_migration.py.",
        "-- Remarks/status columns from the 2023-2024 utilization pages are intentionally not imported.",
        "",
        "BEGIN;",
        "",
    ]

    for old_code, new_code in LEGACY_CODE_RENAMES.items():
        lines.extend(
            [
                "DO $$",
                "BEGIN",
                f"  IF EXISTS (SELECT 1 FROM facilities WHERE code = {sql(old_code)})",
                f"     AND NOT EXISTS (SELECT 1 FROM facilities WHERE code = {sql(new_code)}) THEN",
                f"    UPDATE facilities SET code = {sql(new_code)} WHERE code = {sql(old_code)};",
                "  END IF;",
                "END $$;",
                "",
            ]
        )

    for code in sorted(FACILITIES):
        lines.extend(
            [
                "DO $$",
                "BEGIN",
                f"  IF NOT EXISTS (SELECT 1 FROM facilities WHERE code = {sql(code)})",
                f"     AND EXISTS (SELECT 1 FROM facilities WHERE slug = {sql(facility_slug(code))}) THEN",
                "    UPDATE facilities",
                f"    SET code = {sql(code)}",
                f"    WHERE slug = {sql(facility_slug(code))};",
                "  END IF;",
                "END $$;",
                "",
            ]
        )

    lines.extend(
        [
            "-- Remove rooms from earlier generated imports before inserting the audited 189-room set.",
            "DELETE FROM rooms",
            "WHERE facility_id IN (",
            "  SELECT id FROM facilities",
            "  WHERE code = ANY (ARRAY[",
            "    " + ", ".join(sql(code) for code in ROOM_IMPORT_CODES),
            "  ]::text[])",
            ");",
            "",
        ]
    )

    for code in sorted(FACILITIES):
        meta = FACILITIES[code]
        lat, lng = meta["coords"]
        source_codes = sorted(by_facility_source.get(code, set()))
        description = facility_description(code, source_codes)
        lines.extend(
            [
                "INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)",
                "VALUES (",
                f"  {sql(meta['name'])},",
                f"  {sql(facility_slug(code))},",
                f"  {sql(description)},",
                "  'academic',",
                "  true,",
                f"  {lat},",
                f"  {lng},",
                f"  {sql(code)}",
                ")",
                "ON CONFLICT (code) DO UPDATE SET",
                "  name = EXCLUDED.name,",
                "  description = EXCLUDED.description,",
                "  category = EXCLUDED.category,",
                "  has_rooms = true;",
                "",
            ]
        )

    lines.append("-- Canonical rooms from the wide table: 189 nonblank room cells.")
    for row in canonical_rows:
        lines.extend(
            [
                "INSERT INTO rooms (facility_id, room_code, name, floor, description)",
                "SELECT id,",
                f"  {sql(row['room_code'])},",
                "  NULL,",
                f"  {sql(row['floor'])},",
                f"  {sql(row['description'])}",
                "FROM facilities",
                f"WHERE code = {sql(row['facility_code'])}",
                "ON CONFLICT (facility_id, room_code) DO UPDATE SET",
                "  name = EXCLUDED.name,",
                "  floor = EXCLUDED.floor,",
                "  description = EXCLUDED.description;",
                "",
            ]
        )

    lines.extend(
        [
            "COMMIT;",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    source = Path("output/room-data-audit/rooms-canonical.json")
    target = Path("supabase/migrations/20260707120000_audited_room_data_reset.sql")
    rows = json.loads(source.read_text(encoding="utf-8"))
    target.write_text(generate(rows), encoding="utf-8")
    print(f"Wrote {target} with {len(rows)} rooms")


if __name__ == "__main__":
    main()
