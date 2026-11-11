"""
Universal Dynamic Data Cleaning & Validation Engine.
Processes ANY tabular CSV dataset without hardcoded column requirements.
Applies domain-aware sanitization, preserves identifiers, tracks exceptions,
and generates structured audits and telemetry.
"""

import csv
import json
import logging
import math
import os
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from python_engine.cleaner import (
    clean_null_value,
    clean_numeric_string,
    normalize_case,
    parse_and_normalize_date,
    strip_whitespace,
)
from python_engine.logger import setup_logger
from python_engine.profiler import DatasetProfiler, normalize_col_name


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_REGEX = re.compile(r"^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}$")


class UniversalDataEngine:
    """
    Intelligent universal engine capable of ingesting any CSV dataset,
    applying configurable dynamic cleaning rules, validating invariants,
    and partitioning rows into Clean Records vs Exception Register.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or setup_logger("UniversalDataEngine")

    def process_dataset(
        self,
        headers: List[str],
        records: List[Dict[str, str]],
        enabled_rules: Optional[Dict[str, bool]] = None,
        custom_identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end intelligent profiling, cleaning, and validation.
        """
        start_time = time.perf_counter()
        rules = enabled_rules or {}

        # 1. Profile Dataset
        profiler = DatasetProfiler(headers, records)
        profile = profiler.analyze()

        primary_id = custom_identifier or profile.get("primary_identifier")
        columns_by_name = {c["column_name"]: c for c in profile.get("columns", [])}

        cleaned_records: List[Dict[str, Any]] = []
        exception_records: List[Dict[str, Any]] = []
        seen_identifiers: Set[str] = set()
        seen_exact_rows: Set[str] = set()

        # Flags for enabled rules
        enforce_dedup = rules.get("REC_DEDUP_EXACT", True)
        enforce_pk_unique = rules.get(f"REC_PK_{primary_id}", True) if primary_id else True

        for row_idx, raw_row in enumerate(records, start=1):
            row_is_quarantined = False
            row_exceptions: List[Dict[str, Any]] = []
            cleaned_row: Dict[str, Any] = {}

            # Exact duplicate check
            row_hash = "|".join(str(raw_row.get(h, "")).strip().lower() for h in headers)
            if enforce_dedup:
                if row_hash in seen_exact_rows:
                    exception_records.append({
                        "row_number": str(row_idx),
                        "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                        "field_name": "ROW_RECORD",
                        "rule_id": "DUPLICATE_EXACT_ROW",
                        "violation_type": "DUPLICATE_ROW",
                        "severity": "WARNING",
                        "raw_value": "IDENTICAL_TO_PREVIOUS",
                        "expected": "Unique row data",
                        "error_message": f"Row #{row_idx} is an exact duplicate of a previously ingested record.",
                        "suggested_correction": "Purge redundant copy or verify unique entity identifier.",
                    })
                    continue  # Purged / Quarantined
                else:
                    seen_exact_rows.add(row_hash)

            # Primary Key validation & deduplication
            if primary_id and primary_id in raw_row:
                raw_pk = raw_row.get(primary_id, "")
                cleaned_pk = clean_null_value(raw_pk)
                if cleaned_pk is None or str(cleaned_pk).strip() == "":
                    row_is_quarantined = True
                    row_exceptions.append({
                        "row_number": str(row_idx),
                        "record_id": f"ROW_{row_idx}",
                        "field_name": primary_id,
                        "rule_id": "PK_MISSING",
                        "violation_type": "MISSING_PRIMARY_KEY",
                        "severity": "CRITICAL",
                        "raw_value": "EMPTY_NULL",
                        "expected": "Unique Non-Empty Identifier",
                        "error_message": f"Primary identifier '{primary_id}' cannot be null or empty.",
                        "suggested_correction": "Provide a valid distinct entity ID.",
                    })
                elif enforce_pk_unique:
                    pk_str = str(cleaned_pk).strip()
                    if pk_str in seen_identifiers:
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": pk_str,
                            "field_name": primary_id,
                            "rule_id": "PK_DUPLICATE",
                            "violation_type": "DUPLICATE_IDENTIFIER",
                            "severity": "CRITICAL",
                            "raw_value": pk_str,
                            "expected": "Unique entity key across dataset",
                            "error_message": f"Identifier '{pk_str}' is already assigned to an earlier row.",
                            "suggested_correction": "Generate unique key or verify merged transactions.",
                        })
                    else:
                        seen_identifiers.add(pk_str)

            # Column-by-Column Processing
            for col in headers:
                val = raw_row.get(col, "")
                col_meta = columns_by_name.get(col, {})
                norm_name = col_meta.get("normalized_name", normalize_col_name(col))
                sem_type = col_meta.get("semantic_type", "text")
                phys_type = col_meta.get("physical_type", "string")

                # Step 1: Strip basic whitespace
                if isinstance(val, str):
                    val = val.strip()

                # Step 2: Handle Null Representation
                cleaned_val = clean_null_value(val)
                if cleaned_val is None:
                    # Check if column was flagged as required / identifier
                    if col == primary_id or col_meta.get("is_potential_identifier"):
                        # Already logged under PK check or log missing value
                        pass
                    cleaned_row[col] = ""
                    continue

                # Step 3: Domain / Semantic Aware Cleaning & Validation
                # A. Preserve Leading Zeros on Register Numbers or Zero-Padded IDs
                if sem_type == "zero_padded_identifier" or any(w in norm_name for w in ("reg_no", "regno", "roll_no", "rollno", "emp_id", "postal", "zip")):
                    cleaned_row[col] = str(cleaned_val)
                    continue

                # B. Email normalization & validation
                if sem_type == "email" or "email" in norm_name:
                    email_str = str(cleaned_val).strip().lower()
                    if EMAIL_REGEX.match(email_str):
                        cleaned_row[col] = email_str
                    else:
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                            "field_name": col,
                            "rule_id": "FORMAT_EMAIL",
                            "violation_type": "INVALID_EMAIL_FORMAT",
                            "severity": "ERROR",
                            "raw_value": str(cleaned_val),
                            "expected": "RFC 5322 compliant address (e.g. user@domain.com)",
                            "error_message": f"Value '{cleaned_val}' is not a valid email address.",
                            "suggested_correction": "Correct typo or supply legitimate domain name.",
                        })
                        cleaned_row[col] = email_str
                    continue

                # C. Date Normalization
                if sem_type == "date" or any(w in norm_name for w in ("date", "dob", "doj", "admission", "discharge")):
                    norm_date, err = parse_and_normalize_date(cleaned_val)
                    if norm_date:
                        cleaned_row[col] = norm_date
                    else:
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                            "field_name": col,
                            "rule_id": "FORMAT_DATE",
                            "violation_type": "INVALID_DATE_FORMAT",
                            "severity": "ERROR",
                            "raw_value": str(cleaned_val),
                            "expected": "Standard date (YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY)",
                            "error_message": f"Cannot parse '{cleaned_val}' as a valid calendar date.",
                            "suggested_correction": "Format as YYYY-MM-DD.",
                        })
                        cleaned_row[col] = str(cleaned_val)
                    continue

                # D. Currency & Price sanitization
                if sem_type == "currency" or any(w in norm_name for w in ("price", "cost", "salary", "amount", "total", "balance", "fee")):
                    cleaned_num = clean_numeric_string(cleaned_val)
                    try:
                        float_val = float(cleaned_num)
                        # Check for negative value where prohibited
                        if float_val < 0.0 and any(w in norm_name for w in ("price", "salary", "stock", "quantity", "fee")):
                            row_is_quarantined = True
                            row_exceptions.append({
                                "row_number": str(row_idx),
                                "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                                "field_name": col,
                                "rule_id": "RANGE_POSITIVE",
                                "violation_type": "NEGATIVE_VALUE_ERROR",
                                "severity": "CRITICAL",
                                "raw_value": str(cleaned_val),
                                "expected": "Positive numeric value >= 0.00",
                                "error_message": f"Negative value '{float_val}' is invalid for field '{col}'.",
                                "suggested_correction": "Provide non-negative monetary or quantity value.",
                            })
                        cleaned_row[col] = f"{float_val:.2f}"
                    except (ValueError, TypeError):
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                            "field_name": col,
                            "rule_id": "TYPE_FLOAT",
                            "violation_type": "TYPE_CAST_FAILURE",
                            "severity": "ERROR",
                            "raw_value": str(cleaned_val),
                            "expected": "Numeric float value",
                            "error_message": f"Cannot convert '{cleaned_val}' to decimal float.",
                            "suggested_correction": "Remove non-numeric characters.",
                        })
                        cleaned_row[col] = str(cleaned_val)
                    continue

                # E. Name normalization (Student Name, Employee Name, Customer Name)
                if any(w in norm_name for w in ("name", "first_name", "last_name", "full_name")):
                    name_str = " ".join(str(cleaned_val).split())
                    cleaned_row[col] = name_str.title()
                    continue

                # F. Phone Number Validation
                if sem_type == "phone" or any(w in norm_name for w in ("phone", "mobile", "contact", "cell")):
                    digits = re.sub(r"\D", "", str(cleaned_val))
                    if 10 <= len(digits) <= 13:
                        cleaned_row[col] = ("+" if str(cleaned_val).strip().startswith("+") else "") + digits
                    else:
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                            "field_name": col,
                            "rule_id": "FORMAT_PHONE",
                            "violation_type": "INVALID_PHONE_NUMBER",
                            "severity": "WARNING",
                            "raw_value": str(cleaned_val),
                            "expected": "10-12 digit valid phone number",
                            "error_message": f"Phone number '{cleaned_val}' has invalid length or pattern.",
                            "suggested_correction": "Supply standard mobile number.",
                        })
                        cleaned_row[col] = str(cleaned_val)
                    continue

                # G. Integer casting & Stock Quantity
                if phys_type == "integer" or any(w in norm_name for w in ("quantity", "qty", "stock", "units", "year", "semester")):
                    cleaned_int = clean_numeric_string(cleaned_val)
                    try:
                        int_val = int(float(cleaned_int))
                        if int_val < 0 and any(w in norm_name for w in ("quantity", "qty", "stock")):
                            row_is_quarantined = True
                            row_exceptions.append({
                                "row_number": str(row_idx),
                                "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                                "field_name": col,
                                "rule_id": "RANGE_STOCK_POSITIVE",
                                "violation_type": "NEGATIVE_STOCK",
                                "severity": "CRITICAL",
                                "raw_value": str(cleaned_val),
                                "expected": "Non-negative integer >= 0",
                                "error_message": f"Negative count '{int_val}' is not permitted for '{col}'.",
                                "suggested_correction": "Set stock/quantity >= 0.",
                            })
                        cleaned_row[col] = str(int_val)
                    except (ValueError, TypeError):
                        cleaned_row[col] = str(cleaned_val)
                    continue

                # Default fallback
                cleaned_row[col] = str(cleaned_val)

            # Cross-Field Business Math Verification (e.g. for Orders / Invoices)
            if all(k in cleaned_row for k in ("quantity", "unit_price", "total_amount")):
                try:
                    q = float(cleaned_row["quantity"])
                    p = float(cleaned_row["unit_price"])
                    t = float(cleaned_row["total_amount"])
                    d = float(cleaned_row.get("discount_pct", 0.0))
                    tax = float(cleaned_row.get("tax_amount", 0.0))
                    calc_total = round((q * p * (1.0 - d)) + tax, 2)
                    if abs(calc_total - t) > 0.05:
                        row_is_quarantined = True
                        row_exceptions.append({
                            "row_number": str(row_idx),
                            "record_id": str(raw_row.get(primary_id, f"ROW_{row_idx}")),
                            "field_name": "total_amount",
                            "rule_id": "BIZ_MATH_VERIFY",
                            "violation_type": "MATHEMATICAL_DISCREPANCY",
                            "severity": "CRITICAL",
                            "raw_value": str(t),
                            "expected": f"Expected formula total: ${calc_total:.2f} (qty*price*(1-disc)+tax)",
                            "error_message": f"Cross-field calculation mismatch. Invoiced ${t:.2f} != Calculated ${calc_total:.2f}",
                            "suggested_correction": f"Reconcile total to ${calc_total:.2f}.",
                        })
                except Exception:
                    pass

            # Partition Row
            if row_is_quarantined:
                exception_records.extend(row_exceptions)
            else:
                cleaned_records.append(cleaned_row)

        execution_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        total_input = len(records)
        valid_count = len(cleaned_records)
        quarantined_count = total_input - valid_count
        pass_rate = round((valid_count / total_input * 100.0), 1) if total_input > 0 else 0.0

        summary = {
            "total_records": total_input,
            "valid_records": valid_count,
            "quarantined_records": quarantined_count,
            "duplicate_records": profile.get("duplicate_rows_count", 0),
            "pass_rate_pct": pass_rate,
            "quarantine_rate_pct": round(100.0 - pass_rate, 1),
            "execution_time_ms": execution_ms,
            "domain_detected": profile.get("domain_title"),
            "data_quality_score": profile.get("data_quality_score"),
            "total_exceptions": len(exception_records),
        }

        return {
            "profile": profile,
            "summary": summary,
            "cleaned_records": cleaned_records,
            "exception_records": exception_records,
        }
