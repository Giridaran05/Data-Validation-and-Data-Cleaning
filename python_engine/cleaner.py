"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: cleaner.py
Data sanitization, string normalization, whitespace stripping,
numeric symbol cleansing, and date formatting utilities.
"""

import re
from datetime import datetime
from typing import Any, List, Optional, Tuple


NULL_REPRESENTATIONS = {
    "",
    "null",
    "none",
    "n/a",
    "na",
    "nan",
    "nil",
    "#n/a",
    "undefined",
    "-",
}


def clean_null_value(value: Any) -> Optional[Any]:
    """
    Translates common string representations of null/empty into Python None.
    Preserves valid zero (0) and boolean False.
    """
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.lower() in NULL_REPRESENTATIONS:
            return None
        return stripped
    return value


def strip_whitespace(value: Any) -> Any:
    """Removes leading and trailing whitespace from strings."""
    if isinstance(value, str):
        return value.strip()
    return value


def normalize_case(value: Any, mode: str = "lower") -> Any:
    """Normalizes string casing: 'lower', 'upper', or 'title'."""
    if not isinstance(value, str):
        return value
    if mode == "lower":
        return value.lower()
    elif mode == "upper":
        return value.upper()
    elif mode == "title":
        return value.title()
    return value


def clean_numeric_string(value: Any) -> Any:
    """
    Cleans formatted numeric strings like '$1,250.50' or '15%' by removing
    currency signs, commas, and trailing percentage symbols.
    """
    if not isinstance(value, str):
        return value
    cleaned = value.strip()
    # Remove leading dollar, pound, euro
    cleaned = re.sub(r"^[\$\€\£\¥]", "", cleaned).strip()
    # Remove commas in numbers (e.g. 1,000.00 -> 1000.00)
    if re.match(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$", cleaned):
        cleaned = cleaned.replace(",", "")
    # Check if percentage
    if cleaned.endswith("%"):
        try:
            pct_val = float(cleaned[:-1].strip()) / 100.0
            return pct_val
        except ValueError:
            return value
    return cleaned


def parse_and_normalize_date(
    value: Any,
    expected_output_fmt: str = "%Y-%m-%d",
    accepted_input_formats: Optional[List[str]] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Attempts to parse a date string against common formats and convert to ISO YYYY-MM-DD.
    Returns: (normalized_date_str, error_message)
    """
    if value is None:
        return None, None

    if isinstance(value, datetime):
        return value.strftime(expected_output_fmt), None

    if not isinstance(value, str):
        return None, f"Expected date string, got {type(value).__name__}"

    str_val = value.strip()
    if not str_val:
        return None, None

    formats = accepted_input_formats or [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(str_val, fmt)
            return dt.strftime(expected_output_fmt), None
        except ValueError:
            continue

    return None, f"Date '{str_val}' does not match any recognized format (expected {expected_output_fmt})"
