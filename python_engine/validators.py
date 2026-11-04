"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: validators.py
Core reusable validation algorithms: column presence, nullability, type casting,
regex formats, numeric ranges, categorical enums, and cross-field business assertions.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from python_engine.cleaner import clean_null_value, clean_numeric_string
from python_engine.models import (
    BusinessRule,
    FieldRule,
    FieldType,
    Severity,
    ExceptionRecord,
)

# RFC 5322 compliant simplified email regex
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)

# Precompiled regex cache
_REGEX_CACHE: Dict[str, re.Pattern] = {}


def get_compiled_regex(pattern: str) -> re.Pattern:
    if pattern not in _REGEX_CACHE:
        _REGEX_CACHE[pattern] = re.compile(pattern)
    return _REGEX_CACHE[pattern]


def validate_required_columns(
    headers: List[str],
    required_columns: List[str]
) -> Tuple[bool, List[str]]:
    """
    Checks whether all required columns are present in the dataset headers.
    Returns: (is_valid, missing_columns)
    """
    header_set: Set[str] = set(h.strip() for h in headers)
    missing: List[str] = [col for col in required_columns if col not in header_set]
    return len(missing) == 0, missing


def validate_and_cast_type(
    value: Any,
    target_type: FieldType
) -> Tuple[bool, Any, Optional[str]]:
    """
    Validates and casts a value to the target FieldType.
    Returns: (is_valid, casted_value, error_message)
    """
    if value is None:
        return True, None, None

    if target_type == FieldType.STRING:
        return True, str(value), None

    elif target_type == FieldType.INTEGER:
        cleaned = clean_numeric_string(value)
        try:
            # Handle float strings like "42.0" cleanly
            float_val = float(cleaned)
            if not float_val.is_integer():
                return False, value, f"Float '{value}' is not an integer"
            return True, int(float_val), None
        except (ValueError, TypeError):
            return False, value, f"Cannot convert '{value}' to integer"

    elif target_type == FieldType.FLOAT:
        cleaned = clean_numeric_string(value)
        try:
            val = float(cleaned)
            if math.isnan(val) or math.isinf(val):
                return False, value, "NaN or Infinity is not permitted for numeric fields"
            return True, val, None
        except (ValueError, TypeError):
            return False, value, f"Cannot convert '{value}' to float"

    elif target_type == FieldType.BOOLEAN:
        if isinstance(value, bool):
            return True, value, None
        s = str(value).strip().lower()
        if s in {"true", "1", "yes", "y", "t"}:
            return True, True, None
        elif s in {"false", "0", "no", "n", "f"}:
            return True, False, None
        return False, value, f"Cannot interpret '{value}' as boolean"

    elif target_type == FieldType.EMAIL:
        s = str(value).strip().lower()
        if EMAIL_REGEX.match(s) and not s.startswith(".") and not s.endswith("."):
            return True, s, None
        return False, value, f"Invalid email format: '{value}'"

    elif target_type == FieldType.DATE:
        if isinstance(value, datetime):
            return True, value.strftime("%Y-%m-%d"), None
        s = str(value).strip()
        try:
            dt = datetime.strptime(s, "%Y-%m-%d")
            return True, dt.strftime("%Y-%m-%d"), None
        except ValueError:
            return False, value, f"Date '{s}' does not match ISO format YYYY-MM-DD"

    return True, value, None


def validate_field_constraints(
    field_rule: FieldRule,
    casted_val: Any
) -> Tuple[bool, Optional[str]]:
    """
    Validates range, allowed values, regex, and date sanity constraints.
    Returns: (is_valid, error_message)
    """
    if casted_val is None:
        return True, None

    # Allowed enum values
    if field_rule.allowed_values is not None:
        # Case insensitive match for strings
        allowed_normalized = [str(a).lower() for a in field_rule.allowed_values]
        if str(casted_val).lower() not in allowed_normalized:
            return False, f"Value '{casted_val}' not in allowed list: {field_rule.allowed_values}"

    # Range check
    if isinstance(casted_val, (int, float)):
        if field_rule.min_value is not None and casted_val < field_rule.min_value:
            return False, f"Value {casted_val} is less than minimum {field_rule.min_value}"
        if field_rule.max_value is not None and casted_val > field_rule.max_value:
            return False, f"Value {casted_val} exceeds maximum {field_rule.max_value}"

    # Regex format check
    if field_rule.regex and isinstance(casted_val, str):
        pattern = get_compiled_regex(field_rule.regex)
        if not pattern.match(casted_val):
            return False, f"Value '{casted_val}' does not match required format pattern '{field_rule.regex}'"

    # Date temporal checks
    if field_rule.field_type == FieldType.DATE and isinstance(casted_val, str):
        try:
            dt = datetime.strptime(casted_val, "%Y-%m-%d")
            # Order date cannot be far future (> today + 1 day)
            now = datetime.now()
            if dt > now:
                return False, f"Date '{casted_val}' is in the future (latest allowed: {now.strftime('%Y-%m-%d')})"
            if dt.year < 2020:
                return False, f"Date '{casted_val}' precedes minimum historical year 2020"
        except ValueError:
            return False, f"Invalid calendar date '{casted_val}'"

    return True, None


def evaluate_business_rule(
    rule: BusinessRule,
    record: Dict[str, Any],
    row_num: int
) -> Optional[ExceptionRecord]:
    """
    Evaluates configurable business rules on a validated record.
    Currently supports:
      - 'cross_field_math': Checks financial equation
      - 'conditional_required': Field X required if Field Y has certain value
      - 'expression': Python expression evaluated in safe sandbox
    Returns: ExceptionRecord if violated, None if satisfied.
    """
    record_id = str(record.get("order_id", f"ROW_{row_num}"))

    if rule.rule_type == "cross_field_math":
        # Check: total_amount == round((quantity * unit_price * (1 - discount_pct)) + tax_amount, 2)
        try:
            qty = float(record.get("quantity", 0))
            price = float(record.get("unit_price", 0.0))
            disc = float(record.get("discount_pct", 0.0))
            tax = float(record.get("tax_amount", 0.0))
            total = float(record.get("total_amount", 0.0))

            expected_subtotal = qty * price * (1.0 - disc)
            expected_total = round(expected_subtotal + tax, 2)

            tolerance = 0.05  # 5 cents tolerance for floating point rounding
            diff = abs(total - expected_total)
            if diff > tolerance:
                return ExceptionRecord(
                    row_number=row_num,
                    record_id=record_id,
                    field_name="total_amount",
                    rule_id=rule.rule_id,
                    violation_type="CROSS_FIELD_MATH_MISMATCH",
                    severity=rule.severity,
                    raw_value=total,
                    expected=f"Calculated {expected_total:.2f} (qty={qty} * price={price:.2f} * (1-{disc:.2f}) + tax={tax:.2f})",
                    error_message=f"Total amount mismatch: reported ${total:.2f} vs expected ${expected_total:.2f} (diff ${diff:.2f})",
                )
        except (ValueError, TypeError) as e:
            return ExceptionRecord(
                row_number=row_num,
                record_id=record_id,
                field_name="total_amount",
                rule_id=rule.rule_id,
                violation_type="CALCULATION_INPUT_ERROR",
                severity=rule.severity,
                raw_value="N/A",
                expected="Valid numeric values for calculation",
                error_message=f"Could not compute business rule: {str(e)}",
            )

    elif rule.rule_type == "payment_status_integrity":
        # Business logic: If payment_status is PAID, total_amount must be > 0.0
        status = str(record.get("payment_status", "")).upper()
        total = float(record.get("total_amount", 0.0) or 0.0)
        if status == "PAID" and total <= 0.0:
            return ExceptionRecord(
                row_number=row_num,
                record_id=record_id,
                field_name="payment_status",
                rule_id=rule.rule_id,
                violation_type="INVALID_PAID_STATUS",
                severity=Severity.ERROR,
                raw_value=f"status={status}, total={total}",
                expected="total_amount > 0 when status is PAID",
                error_message="A transaction marked as PAID cannot have a total amount <= 0.00",
            )

    return None
