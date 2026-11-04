"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: exceptions.py
Custom exception hierarchy providing domain-specific error handling
for schema mismatches, missing columns, type failures, and business violations.
"""

from typing import Any, Optional


class DataEngineError(Exception):
    """Base exception for all Data Cleaning and Validation Engine errors."""
    def __init__(self, message: str, context: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.context = context or {}

    def __str__(self) -> str:
        if self.context:
            ctx_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
            return f"{self.message} [{ctx_str}]"
        return self.message


class DataIngestionError(DataEngineError):
    """Raised when an input file cannot be found, read, or parsed (malformed CSV/JSON)."""
    pass


class SchemaValidationError(DataEngineError):
    """Raised when dataset headers or required columns do not match the expected specification."""
    pass


class MissingColumnError(SchemaValidationError):
    """Raised when one or more mandatory columns are missing from the input dataset."""
    pass


class FieldValidationError(DataEngineError):
    """Raised when a specific row field fails validation."""
    def __init__(self, field_name: str, raw_value: Any, expected: str, reason: str, row_idx: Optional[int] = None):
        msg = f"Validation failed for field '{field_name}' at row {row_idx}: {reason} (got: {raw_value!r}, expected: {expected})"
        context = {
            "field": field_name,
            "raw_value": raw_value,
            "expected": expected,
            "row": row_idx,
        }
        super().__init__(msg, context)
        self.field_name = field_name
        self.raw_value = raw_value
        self.expected = expected
        self.reason = reason
        self.row_idx = row_idx


class TypeValidationError(FieldValidationError):
    """Raised when a value cannot be safely cast to the declared target type."""
    pass


class FormatValidationError(FieldValidationError):
    """Raised when a value violates regex, date format, or structural pattern."""
    pass


class BusinessRuleViolation(DataEngineError):
    """Raised when a cross-field or logical business assertion fails."""
    def __init__(self, rule_id: str, message: str, row_idx: Optional[int] = None, fields: Optional[list] = None):
        super().__init__(f"Business rule '{rule_id}' failed: {message}", context={"rule_id": rule_id, "row": row_idx})
        self.rule_id = rule_id
        self.row_idx = row_idx
        self.fields = fields or []


class DuplicateRecordError(DataEngineError):
    """Raised when a duplicate record is detected according to configured key fields."""
    def __init__(self, key_fields: list, key_value: Any, row_idx: int):
        super().__init__(
            f"Duplicate primary key detected on fields {key_fields}: value {key_value!r} at row {row_idx}",
            context={"key_fields": key_fields, "key_value": key_value, "row": row_idx}
        )
        self.key_fields = key_fields
        self.key_value = key_value
        self.row_idx = row_idx
