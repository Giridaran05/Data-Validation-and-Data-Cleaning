"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: cli.py
Command-line interface with argument parsing for batch pipeline execution,
synthetic dataset generation, and summary reporting.
"""

import argparse
import json
import logging
import os
import sys

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from python_engine.dataset_generator import generate_synthetic_dataset
from python_engine.engine import DataValidationEngine
from python_engine.logger import setup_logger


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine CLI"
    )
    parser.add_argument(
        "--generate",
        action="store_true",
        help="Generate synthetic raw dataset with realistic anomalies before running validation",
    )
    parser.add_argument(
        "--records",
        type=int,
        default=100,
        help="Number of synthetic records to generate (default: 100)",
    )
    parser.add_argument(
        "-i", "--input",
        type=str,
        default="data/orders_raw.csv",
        help="Path to input raw dataset (.csv or .json)",
    )
    parser.add_argument(
        "-r", "--rules",
        type=str,
        default="data/rules_config.json",
        help="Path to declarative business rules JSON file",
    )
    parser.add_argument(
        "-o", "--output-clean",
        type=str,
        default="data/cleaned_orders.csv",
        help="Destination path for validated & cleaned records",
    )
    parser.add_argument(
        "-e", "--output-exceptions",
        type=str,
        default="data/exception_register.csv",
        help="Destination path for the exception quarantine register",
    )
    parser.add_argument(
        "-s", "--summary-json",
        type=str,
        default="data/engine_summary.json",
        help="Destination path for execution metrics summary JSON",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable detailed DEBUG level logging output",
    )
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logger = setup_logger("CLI", level=log_level)

    logger.info("==================================================================")
    logger.info("  DIT Internship 2026 - TASK 07: Data Cleaning & Validation Engine")
    logger.info("==================================================================")

    if args.generate:
        logger.info(f"Generating {args.records} synthetic test records...")
        generate_synthetic_dataset(record_count=args.records, output_csv=args.input)
        logger.info(f"Synthetic dataset saved to: {args.input}")

    try:
        engine = DataValidationEngine.from_config_file(args.rules, logger=logger)
        cleaned_records, exceptions, summary = engine.run_file(
            input_file=args.input,
            output_clean=args.output_clean,
            output_exceptions=args.output_exceptions,
        )

        # Export summary JSON
        with open(args.summary_json, "w", encoding="utf-8") as f:
            json.dump(summary.to_dict(), f, indent=2)

        print("\n" + "=" * 60)
        print("                 EXECUTION METRICS SUMMARY               ")
        print("=" * 60)
        print(f"Total Input Records:      {summary.total_records}")
        print(f"Valid / Cleaned Records:  {summary.valid_records} ({summary.to_dict()['pass_rate_pct']}%)")
        print(f"Quarantined Records:      {summary.quarantined_records} ({summary.to_dict()['quarantine_rate_pct']}%)")
        print(f"Duplicate Primary Keys:   {summary.duplicate_records}")
        print(f"Total Exceptions Logged:  {len(exceptions)}")
        print(f"Pipeline Runtime:         {summary.execution_time_ms:.2f} ms")
        print("=" * 60)
        print(f"Cleaned Dataset:          {args.output_clean}")
        print(f"Exception Register:       {args.output_exceptions}")
        print(f"Summary JSON:             {args.summary_json}")
        print("=" * 60 + "\n")

    except Exception as e:
        logger.error(f"Fatal Engine Failure: {str(e)}", exc_info=args.verbose)
        sys.exit(1)


if __name__ == "__main__":
    main()
