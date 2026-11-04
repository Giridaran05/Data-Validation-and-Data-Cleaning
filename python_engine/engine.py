"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: engine.py
Core pipeline orchestrator coordinating schema validation, row sanitation,
type casting, constraint checking, business rules, and deduplication.
"""

import csv
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from python_engine.cleaner import (
    clean_null_value,
    clean_numeric_string,
    normalize_case,
    parse_and_normalize_date,
    strip_whitespace,
)
from python_engine.exceptions import (
    DataEngineError,
    DataIngestionError,
    MissingColumnError,
    SchemaValidationError,
)
from python_engine.logger import setup_logger
from python_engine.models import (
    DeduplicationStrategy,
    EngineSummary,
    ExceptionRecord,
    FieldRule,
    FieldType,
    RuleConfig,
    Severity,
)
from python_engine.validators import (
    evaluate_business_rule,
    validate_and_cast_type,
    validate_field_constraints,
    validate_required_columns,
)


class DataValidationEngine:
    """
    Production-ready Data Cleaning and Validation Engine.
    Executes declarative business rules against tabular datasets, isolates invalid
    records into an Exception Register, and emits a clean, type-safe dataset.
    """

    def __init__(self, rules_config: RuleConfig, logger: Optional[logging.Logger] = None):
        self.config = rules_config
        self.logger = logger or setup_logger("DataValidationEngine")

    @classmethod
    def from_config_file(cls, config_path: str, logger: Optional[logging.Logger] = None) -> "DataValidationEngine":
        """Factory method to load rule configuration from a JSON file."""
        if not os.path.exists(config_path):
            raise DataIngestionError(f"Configuration file not found: {config_path}")
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            config = RuleConfig.from_dict(data)
            return cls(config, logger)
        except Exception as e:
            raise SchemaValidationError(f"Failed to parse rule configuration: {str(e)}")

    def validate_schema(self, headers: List[str]) -> Tuple[bool, List[str]]:
        """Verifies dataset header presence against mandatory columns."""
        is_valid, missing = validate_required_columns(headers, self.config.required_columns)
        if not is_valid:
            self.logger.error(f"Schema violation: missing mandatory columns {missing}")
        return is_valid, missing

    def clean_and_validate_field(
        self,
        field_rule: FieldRule,
        raw_val: Any,
        row_num: int,
        record_id: str
    ) -> Tuple[bool, Any, Optional[ExceptionRecord]]:
        """
        Cleans and validates an individual field value against its FieldRule.
        Returns: (is_valid, cleaned_casted_value, exception_record_or_none)
        """
        val = raw_val

        # Step 1: Whitespace strip
        if field_rule.strip_whitespace and isinstance(val, str):
            val = strip_whitespace(val)

        # Step 2: Casing normalization
        if field_rule.to_lowercase and isinstance(val, str):
            val = normalize_case(val, "lower")
        elif field_rule.to_uppercase and isinstance(val, str):
            val = normalize_case(val, "upper")

        # Step 3: Null representation detection
        val = clean_null_value(val)

        # Step 4: Nullability / Required check
        if val is None:
            if field_rule.required and not field_rule.nullable:
                exc = ExceptionRecord(
                    row_number=row_num,
                    record_id=record_id,
                    field_name=field_rule.name,
                    rule_id=f"REQ_{field_rule.name.upper()}",
                    violation_type="MISSING_MANDATORY_VALUE",
                    severity=Severity.CRITICAL if field_rule.name in ("order_id", "customer_id") else Severity.ERROR,
                    raw_value="NULL",
                    expected="Non-null value required",
                    error_message=f"Mandatory field '{field_rule.name}' is empty or null.",
                )
                return False, None, exc
            return True, None, None

        # Step 5: Date parsing & normalization
        if field_rule.field_type == FieldType.DATE:
            normalized_date, date_err = parse_and_normalize_date(
                val,
                expected_output_fmt=field_rule.date_format
            )
            if date_err:
                exc = ExceptionRecord(
                    row_number=row_num,
                    record_id=record_id,
                    field_name=field_rule.name,
                    rule_id=f"FMT_{field_rule.name.upper()}",
                    violation_type="DATE_FORMAT_INVALID",
                    severity=Severity.ERROR,
                    raw_value=val,
                    expected=field_rule.date_format,
                    error_message=date_err,
                )
                return False, val, exc
            val = normalized_date

        # Step 6: Type casting
        is_type_valid, casted_val, type_err = validate_and_cast_type(val, field_rule.field_type)
        if not is_type_valid:
            exc = ExceptionRecord(
                row_number=row_num,
                record_id=record_id,
                field_name=field_rule.name,
                rule_id=f"TYPE_{field_rule.name.upper()}",
                violation_type="TYPE_CAST_FAILURE",
                severity=Severity.ERROR,
                raw_value=val,
                expected=f"Type {field_rule.field_type.value}",
                error_message=type_err or f"Value cannot be converted to {field_rule.field_type.value}",
            )
            return False, val, exc

        # Step 7: Constraint checks (ranges, enums, regex)
        is_constraint_valid, constraint_err = validate_field_constraints(field_rule, casted_val)
        if not is_constraint_valid:
            v_type = "CONSTRAINT_VIOLATION"
            if field_rule.regex:
                v_type = "REGEX_FORMAT_MISMATCH"
            elif field_rule.allowed_values is not None:
                v_type = "INVALID_ENUM_VALUE"
            elif field_rule.min_value is not None or field_rule.max_value is not None:
                v_type = "OUT_OF_BOUNDS_RANGE"

            exc = ExceptionRecord(
                row_number=row_num,
                record_id=record_id,
                field_name=field_rule.name,
                rule_id=f"CONST_{field_rule.name.upper()}",
                violation_type=v_type,
                severity=Severity.ERROR,
                raw_value=casted_val,
                expected=field_rule.regex or str(field_rule.allowed_values) or f"[{field_rule.min_value}..{field_rule.max_value}]",
                error_message=constraint_err or "Constraint violation",
            )
            return False, casted_val, exc

        return True, casted_val, None

    def handle_deduplication(
        self,
        indexed_records: List[Tuple[int, Dict[str, Any]]]
    ) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[ExceptionRecord]]:
        """
        Deduplicates records based on configured primary key fields.
        Returns: (deduplicated_indexed_records, duplicate_exception_records)
        """
        if not self.config.deduplication or not self.config.deduplication.key_fields:
            return indexed_records, []

        key_fields = self.config.deduplication.key_fields
        strategy = self.config.deduplication.strategy
        self.logger.info(f"Applying deduplication on keys {key_fields} using strategy '{strategy.value}'")

        seen_keys: Dict[Tuple, List[Tuple[int, Dict[str, Any]]]] = {}
        for row_num, record in indexed_records:
            composite_key = tuple(record.get(kf) for kf in key_fields)
            seen_keys.setdefault(composite_key, []).append((row_num, record))

        surviving_records: List[Tuple[int, Dict[str, Any]]] = []
        duplicate_exceptions: List[ExceptionRecord] = []

        for key_tuple, records in seen_keys.items():
            if len(records) == 1:
                surviving_records.append(records[0])
            else:
                # Duplicates detected
                key_display = ":".join(str(k) for k in key_tuple)
                if strategy == DeduplicationStrategy.KEEP_FIRST:
                    surviving_records.append(records[0])
                    for row_num, rec in records[1:]:
                        rec_id = str(rec.get("order_id", f"ROW_{row_num}"))
                        duplicate_exceptions.append(ExceptionRecord(
                            row_number=row_num,
                            record_id=rec_id,
                            field_name=",".join(key_fields),
                            rule_id="DEDUP_KEEP_FIRST",
                            violation_type="DUPLICATE_PRIMARY_KEY",
                            severity=Severity.WARNING,
                            raw_value=key_display,
                            expected="Unique primary key",
                            error_message=f"Duplicate primary key '{key_display}' - quarantined per KEEP_FIRST strategy (survived: row {records[0][0]})",
                        ))
                elif strategy == DeduplicationStrategy.KEEP_LAST:
                    surviving_records.append(records[-1])
                    for row_num, rec in records[:-1]:
                        rec_id = str(rec.get("order_id", f"ROW_{row_num}"))
                        duplicate_exceptions.append(ExceptionRecord(
                            row_number=row_num,
                            record_id=rec_id,
                            field_name=",".join(key_fields),
                            rule_id="DEDUP_KEEP_LAST",
                            violation_type="DUPLICATE_PRIMARY_KEY",
                            severity=Severity.WARNING,
                            raw_value=key_display,
                            expected="Unique primary key",
                            error_message=f"Duplicate primary key '{key_display}' - quarantined per KEEP_LAST strategy (survived: row {records[-1][0]})",
                        ))
                elif strategy == DeduplicationStrategy.QUARANTINE_ALL:
                    for row_num, rec in records:
                        rec_id = str(rec.get("order_id", f"ROW_{row_num}"))
                        duplicate_exceptions.append(ExceptionRecord(
                            row_number=row_num,
                            record_id=rec_id,
                            field_name=",".join(key_fields),
                            rule_id="DEDUP_QUARANTINE_ALL",
                            violation_type="DUPLICATE_PRIMARY_KEY",
                            severity=Severity.ERROR,
                            raw_value=key_display,
                            expected="Unique primary key",
                            error_message=f"Duplicate primary key '{key_display}' detected - all occurrences quarantined per QUARANTINE_ALL policy",
                        ))

        # Re-sort surviving records by original row number
        surviving_records.sort(key=lambda x: x[0])
        return surviving_records, duplicate_exceptions

    def run_pipeline(
        self,
        raw_records: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[ExceptionRecord], EngineSummary]:
        """
        Executes end-to-end cleaning and validation on a list of raw record dictionaries.
        Returns: (cleaned_records, exception_records, summary)
        """
        start_time = time.perf_counter()
        summary = EngineSummary(total_records=len(raw_records))
        exceptions: List[ExceptionRecord] = []
        pre_dedup_valid: List[Tuple[int, Dict[str, Any]]] = []

        self.logger.info(f"Starting Data Cleaning & Validation Engine on {len(raw_records)} records...")

        # Row-by-Row Processing
        for idx, raw_record in enumerate(raw_records, start=1):
            record_id = str(raw_record.get("order_id") or f"ROW_{idx}")
            row_has_error = False
            cleaned_row: Dict[str, Any] = {}

            # Field-level cleaning and validation
            for field_name, rule in self.config.field_rules.items():
                raw_val = raw_record.get(field_name)
                is_valid, cleaned_val, exc = self.clean_and_validate_field(
                    rule, raw_val, idx, record_id
                )
                if not is_valid and exc:
                    row_has_error = True
                    exceptions.append(exc)
                    summary.violation_counts_by_type[exc.violation_type] = (
                        summary.violation_counts_by_type.get(exc.violation_type, 0) + 1
                    )
                    summary.violation_counts_by_field[field_name] = (
                        summary.violation_counts_by_field.get(field_name, 0) + 1
                    )
                else:
                    cleaned_row[field_name] = cleaned_val

            # Preserve non-specified fields
            for extra_key, extra_val in raw_record.items():
                if extra_key not in self.config.field_rules:
                    cleaned_row[extra_key] = extra_val

            # Record-level Business Rules (only run if field validations passed)
            if not row_has_error:
                for biz_rule in self.config.business_rules:
                    biz_exc = evaluate_business_rule(biz_rule, cleaned_row, idx)
                    if biz_exc:
                        row_has_error = True
                        exceptions.append(biz_exc)
                        summary.violation_counts_by_type[biz_exc.violation_type] = (
                            summary.violation_counts_by_type.get(biz_exc.violation_type, 0) + 1
                        )
                        summary.violation_counts_by_field[biz_exc.field_name] = (
                            summary.violation_counts_by_field.get(biz_exc.field_name, 0) + 1
                        )

            if not row_has_error:
                pre_dedup_valid.append((idx, cleaned_row))

        # Deduplication step
        surviving_valid, dedup_exceptions = self.handle_deduplication(pre_dedup_valid)
        exceptions.extend(dedup_exceptions)
        for d_exc in dedup_exceptions:
            summary.violation_counts_by_type[d_exc.violation_type] = (
                summary.violation_counts_by_type.get(d_exc.violation_type, 0) + 1
            )
            summary.violation_counts_by_field[d_exc.field_name] = (
                summary.violation_counts_by_field.get(d_exc.field_name, 0) + 1
            )
        summary.duplicate_records = len(dedup_exceptions)

        # Extract final cleaned records
        cleaned_records = [rec for _, rec in surviving_valid]

        # Calculate final metrics
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        summary.execution_time_ms = elapsed_ms
        summary.valid_records = len(cleaned_records)
        summary.quarantined_records = summary.total_records - summary.valid_records

        self.logger.info(
            f"Validation Complete in {elapsed_ms:.2f}ms: "
            f"{summary.valid_records}/{summary.total_records} records PASSED "
            f"({(summary.valid_records / max(1, summary.total_records) * 100):.1f}%), "
            f"{summary.quarantined_records} quarantined, "
            f"{len(exceptions)} total exceptions recorded."
        )

        return cleaned_records, exceptions, summary

    def run_file(
        self,
        input_file: str,
        output_clean: Optional[str] = None,
        output_exceptions: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[ExceptionRecord], EngineSummary]:
        """Loads input CSV or JSON file, runs validation, and exports outputs."""
        if not os.path.exists(input_file):
            raise DataIngestionError(f"Input file not found: {input_file}")

        records: List[Dict[str, Any]] = []
        headers: List[str] = []

        if input_file.endswith(".csv"):
            with open(input_file, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []
                for row in reader:
                    records.append(dict(row))
        elif input_file.endswith(".json"):
            with open(input_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    records = data
                    headers = list(records[0].keys()) if records else []
                elif isinstance(data, dict) and "records" in data:
                    records = data["records"]
                    headers = list(records[0].keys()) if records else []
        else:
            raise DataIngestionError(f"Unsupported file format: {input_file}. Expected .csv or .json")

        # Validate schema headers
        is_schema_ok, missing_cols = self.validate_schema(headers)
        if not is_schema_ok:
            raise MissingColumnError(
                f"Dataset missing required schema columns: {missing_cols}",
                context={"missing_columns": missing_cols}
            )

        cleaned_records, exceptions, summary = self.run_pipeline(records)

        # Export Cleaned Output
        if output_clean and cleaned_records:
            os.makedirs(os.path.dirname(os.path.abspath(output_clean)), exist_ok=True)
            if output_clean.endswith(".csv"):
                with open(output_clean, "w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=list(cleaned_records[0].keys()))
                    writer.writeheader()
                    writer.writerows(cleaned_records)
            elif output_clean.endswith(".json"):
                with open(output_clean, "w", encoding="utf-8") as f:
                    json.dump(cleaned_records, f, indent=2, default=str)
            self.logger.info(f"Cleaned dataset exported to: {output_clean}")

        # Export Exception Register
        if output_exceptions and exceptions:
            os.makedirs(os.path.dirname(os.path.abspath(output_exceptions)), exist_ok=True)
            exc_dicts = [e.to_dict() for e in exceptions]
            if output_exceptions.endswith(".csv"):
                with open(output_exceptions, "w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=list(exc_dicts[0].keys()))
                    writer.writeheader()
                    writer.writerows(exc_dicts)
            elif output_exceptions.endswith(".json"):
                with open(output_exceptions, "w", encoding="utf-8") as f:
                    json.dump(exc_dicts, f, indent=2)
            self.logger.info(f"Exception register exported to: {output_exceptions}")

        return cleaned_records, exceptions, summary
