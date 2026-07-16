#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Iterable, Optional

from docling.document_converter import DocumentConverter


WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

TIME_RE = re.compile(
    r"(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ampm>AM|PM)\b", re.IGNORECASE
)

DATE_RE = re.compile(r"^(?:(?P<w>[A-Za-z]+)\s+)?(?P<mon>[A-Za-z]+)\s+(?P<d>\d{1,2})$")


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


def looks_like_header(row: list[str]) -> bool:
    joined = " ".join(row).lower()
    return "date" in joined and "time" in joined and "event" in joined and "venue" in joined


def extract_table_rows(doc_dict: dict) -> Iterable[list[str]]:
    for table in doc_dict.get("tables", []):
        grid = table.get("data", {}).get("grid", [])
        if not grid:
            continue

        for ri, raw_row in enumerate(grid):
            row = [clean((cell or {}).get("text", "")) for cell in raw_row]
            if ri == 0 and looks_like_header(row):
                continue
            yield row


def parse_time(value: str) -> tuple[Optional[time], Optional[str]]:
    v = clean(value)
    if not v:
        return None, None

    match = TIME_RE.search(v)
    if not match:
        return None, v

    hour = int(match.group("h"))
    minute = int(match.group("m") or 0)
    ampm = match.group("ampm").upper()

    if hour == 12:
        hour = 0
    if ampm == "PM":
        hour += 12

    note = clean(v[match.end() :])
    return time(hour=hour, minute=minute), (note or None)


def infer_year(weekday: Optional[str], month: int, day: int, preferred: int) -> int:
    if not weekday:
        return preferred

    target = WEEKDAYS.get(weekday.lower())
    if target is None:
        return preferred

    candidates = [preferred, preferred - 1, preferred + 1, preferred - 2, preferred + 2]
    for year in candidates:
        try:
            if datetime(year, month, day).weekday() == target:
                return year
        except ValueError:
            continue

    return preferred


def parse_date_text(
    value: str, pending_weekday: Optional[str]
) -> tuple[Optional[tuple[str, int, int]], Optional[str]]:
    v = clean(value)
    if not v:
        return None, pending_weekday

    lower = v.lower()
    if lower in WEEKDAYS:
        return None, v

    match = DATE_RE.match(v)
    if not match:
        return None, None

    weekday = match.group("w")
    month_name = match.group("mon").lower()
    day = int(match.group("d"))
    month = MONTHS.get(month_name)
    if month is None:
        return None, None

    if not weekday and pending_weekday and pending_weekday.lower() in WEEKDAYS:
        weekday = pending_weekday
        pending_weekday = None

    return (weekday or "", month, day), pending_weekday


@dataclass(frozen=True)
class RawEntry:
    date_iso: str
    start_time: time
    time_note: Optional[str]
    event: str
    venue: str


def extract_entries(pdf_path: Path, preferred_year: int) -> list[RawEntry]:
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    doc_dict = result.document.export_to_dict()

    entries: list[RawEntry] = []

    for table in doc_dict.get("tables", []):
        grid = table.get("data", {}).get("grid", [])
        if not grid:
            continue

        rows: list[dict] = []
        for ri, raw_row in enumerate(grid):
            row = [clean((cell or {}).get("text", "")) for cell in raw_row]
            rows.append(
                {
                    "idx": ri,
                    "date": (row + [""] * 7)[0],
                    "time": (row + [""] * 7)[1],
                    "event": (row + [""] * 7)[2],
                    "venue": (row + [""] * 7)[3],
                }
            )

        data_start_idx = 1 if rows and looks_like_header([rows[0]["date"], rows[0]["time"], rows[0]["event"], rows[0]["venue"]]) else 0

        pending_weekday: Optional[str] = None
        pending_weekday_idx: Optional[int] = None
        markers: list[dict] = []

        for row in rows[data_start_idx:]:
            date_text = clean(row["date"])
            if not date_text:
                continue

            lower = date_text.lower()
            if lower in WEEKDAYS:
                pending_weekday = date_text
                pending_weekday_idx = row["idx"]
                continue

            match = DATE_RE.match(date_text)
            if not match:
                pending_weekday = None
                pending_weekday_idx = None
                continue

            weekday_in_text = match.group("w")
            month_name = match.group("mon").lower()
            day = int(match.group("d"))
            month = MONTHS.get(month_name)
            if month is None:
                pending_weekday = None
                pending_weekday_idx = None
                continue

            weekday = weekday_in_text
            marker_idx = row["idx"]
            if not weekday and pending_weekday and pending_weekday_idx is not None:
                weekday = pending_weekday
                marker_idx = pending_weekday_idx
            pending_weekday = None
            pending_weekday_idx = None

            markers.append(
                {
                    "idx": marker_idx,
                    "weekday": weekday,
                    "month": month,
                    "day": day,
                }
            )

        if not markers:
            continue

        markers.sort(key=lambda m: m["idx"])
        used: set[tuple[int, int, int, str]] = set()
        unique_markers: list[dict] = []
        for m in markers:
            key = (m["idx"], m["month"], m["day"], (m["weekday"] or "").lower())
            if key in used:
                continue
            used.add(key)
            unique_markers.append(m)

        segments: list[dict] = []
        for m in unique_markers:
            marker_row = rows[m["idx"]]
            is_label_row = not clean(marker_row["time"]) and not clean(marker_row["event"])
            start_idx = m["idx"]
            if is_label_row:
                prev = m["idx"] - 1
                while prev >= data_start_idx:
                    if clean(rows[prev]["date"]):
                        break
                    prev -= 1
                start_idx = prev + 1

            year = infer_year(m.get("weekday") or None, m["month"], m["day"], preferred_year)
            date_iso = f"{year:04d}-{m['month']:02d}-{m['day']:02d}"
            segments.append({"start": start_idx, "marker": m["idx"], "date_iso": date_iso})

        segments.sort(key=lambda s: s["start"])
        dedup_segments: list[dict] = []
        last_start = None
        for seg in segments:
            if last_start is not None and seg["start"] == last_start:
                dedup_segments[-1] = seg
            else:
                dedup_segments.append(seg)
                last_start = seg["start"]

        for si, seg in enumerate(dedup_segments):
            start = seg["start"]
            end = dedup_segments[si + 1]["start"] if si + 1 < len(dedup_segments) else len(rows)
            date_iso = seg["date_iso"]

            current_time: Optional[time] = None
            current_time_note: Optional[str] = None
            last_missing_venue_idx: Optional[int] = None

            for row in rows[start:end]:
                parsed_time, note = parse_time(row["time"])
                if parsed_time is not None:
                    current_time = parsed_time
                    current_time_note = note
                elif clean(row["time"]):
                    current_time_note = note

                event = clean(row["event"])
                venue = clean(row["venue"])

                if not event and not venue:
                    continue
                if not current_time:
                    continue

                if not event and venue and last_missing_venue_idx is not None:
                    prev_entry = entries[last_missing_venue_idx]
                    if (
                        prev_entry.date_iso == date_iso
                        and prev_entry.start_time == current_time
                        and not prev_entry.venue
                    ):
                        entries[last_missing_venue_idx] = RawEntry(
                            date_iso=prev_entry.date_iso,
                            start_time=prev_entry.start_time,
                            time_note=prev_entry.time_note,
                            event=prev_entry.event,
                            venue=venue,
                        )
                        continue

                if not event:
                    continue

                if event and not venue:
                    last_missing_venue_idx = len(entries)
                else:
                    last_missing_venue_idx = None

                entries.append(
                    RawEntry(
                        date_iso=date_iso,
                        start_time=current_time,
                        time_note=current_time_note,
                        event=event,
                        venue=venue,
                    )
                )

    return entries


def to_events(entries: list[RawEntry], tz_offset: str) -> list[dict]:
    by_date: dict[str, list[RawEntry]] = {}
    for entry in entries:
        by_date.setdefault(entry.date_iso, []).append(entry)

    output: list[dict] = []

    for date_iso, items in sorted(by_date.items(), key=lambda kv: kv[0]):
        distinct_starts = sorted({item.start_time for item in items})
        next_start: dict[time, Optional[time]] = {}
        for idx, start in enumerate(distinct_starts):
            next_start[start] = distinct_starts[idx + 1] if idx + 1 < len(distinct_starts) else None

        year, month, day = (int(part) for part in date_iso.split("-"))
        day_end = time(16, 0)

        for item in items:
            start = item.start_time
            end = next_start.get(start)
            if end is None:
                if start < day_end:
                    end = day_end
                else:
                    dt = datetime(year, month, day, start.hour, start.minute) + timedelta(hours=2)
                    end = time(dt.hour, dt.minute)

            start_dt = datetime(year, month, day, start.hour, start.minute)
            end_dt = datetime(year, month, day, end.hour, end.minute)
            if end_dt <= start_dt:
                end_dt = start_dt + timedelta(hours=1)

            title = item.event
            if item.time_note:
                title = f"{item.time_note}: {title}"

            output.append(
                {
                    "title": title,
                    "category": "sports",
                    "locationText": item.venue or None,
                    "startTime": start_dt.isoformat() + tz_offset,
                    "endTime": end_dt.isoformat() + tz_offset,
                }
            )

    output.sort(key=lambda e: (e["startTime"], e["title"]))
    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract SALINGKUSOG schedule from PDF using Docling"
    )
    parser.add_argument("--pdf", required=True, type=Path, help="Path to SALINGKUSOG PDF")
    parser.add_argument("--out", required=True, type=Path, help="Output JSON path")
    parser.add_argument("--year", type=int, default=datetime.now().year, help="Preferred year for date inference")
    parser.add_argument("--tz", type=str, default="+08:00", help="Timezone offset to append to ISO times")
    args = parser.parse_args()

    pdf_path: Path = args.pdf
    if not pdf_path.exists():
        raise FileNotFoundError(str(pdf_path))

    entries = extract_entries(pdf_path, preferred_year=args.year)
    events = to_events(entries, tz_offset=args.tz)

    payload = {
        "source": str(pdf_path),
        "generatedAt": datetime.now().isoformat(),
        "timezoneOffset": args.tz,
        "events": events,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    print(f"Wrote {len(events)} events to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
