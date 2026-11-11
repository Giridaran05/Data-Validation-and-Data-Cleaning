"""
Universal CLI runner for profiling, dynamic recommendation, and cleaning of arbitrary CSV datasets.
"""

import argparse
import csv
import json
import os
import sys

# Ensure root workspace directory is in sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from python_engine.profiler import DatasetProfiler
from python_engine.recommender import RecommendationEngine
from python_engine.universal_engine import UniversalDataEngine


def parse_csv_file(file_path: str):
    records = []
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            return [], []
        headers = [h.strip() for h in headers]
        for row in reader:
            if not any(row):
                continue
            rec = {}
            for idx, h in enumerate(headers):
                rec[h] = row[idx].strip() if idx < len(row) else ""
            records.append(rec)
    return headers, records


def write_csv_file(file_path: str, headers, records):
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        if not records:
            writer = csv.writer(f)
            writer.writerow(headers)
            return
        fieldnames = headers if headers else list(records[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def main():
    parser = argparse.ArgumentParser(description="Universal CSV Profiler & Cleaning Engine")
    parser.add_argument("--input", required=True, help="Path to input CSV file")
    parser.add_argument("--action", default="process", choices=["profile", "process"], help="Action to perform")
    parser.add_argument("--rules", default=None, help="JSON file containing enabled cleaning rule IDs")
    parser.add_argument("--output-clean", default=None, help="Output path for cleaned CSV")
    parser.add_argument("--output-exceptions", default=None, help="Output path for exception register CSV")
    parser.add_argument("--summary-json", default=None, help="Output path for summary telemetry JSON")
    parser.add_argument("--profile-json", default=None, help="Output path for profile JSON")

    args = parser.parse_args()

    headers, records = parse_csv_file(args.input)
    if not headers:
        print(json.dumps({"error": "Empty or invalid CSV file"}))
        sys.exit(1)

    if args.action == "profile":
        profiler = DatasetProfiler(headers, records)
        profile = profiler.analyze()
        recs = RecommendationEngine.generate_recommendations(profile, records)
        output = {"profile": profile, "recommendations": recs}
        if args.profile_json:
            with open(args.profile_json, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2)
        print(json.dumps(output))
        return

    # Process Action
    enabled_rules = {}
    if args.rules and os.path.exists(args.rules):
        try:
            with open(args.rules, "r", encoding="utf-8") as f:
                enabled_rules = json.load(f)
        except Exception:
            pass

    engine = UniversalDataEngine()
    result = engine.process_dataset(headers, records, enabled_rules)

    if args.output_clean:
        write_csv_file(args.output_clean, headers, result["cleaned_records"])

    if args.output_exceptions:
        exc_headers = [
            "row_number", "record_id", "field_name", "rule_id",
            "violation_type", "severity", "raw_value", "expected",
            "error_message", "suggested_correction"
        ]
        write_csv_file(args.output_exceptions, exc_headers, result["exception_records"])

    if args.summary_json:
        with open(args.summary_json, "w", encoding="utf-8") as f:
            json.dump({
                "summary": result["summary"],
                "profile": result["profile"],
            }, f, indent=2)

    print(json.dumps({
        "summary": result["summary"],
        "profile": result["profile"],
        "cleaned_count": len(result["cleaned_records"]),
        "exception_count": len(result["exception_records"]),
    }))


if __name__ == "__main__":
    main()
