"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: models.py
Domain models, dataclasses, and enums representing schema rules, exception entries,
validation outcomes, and execution summaries.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
import datetime


class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ValidationAction(str, Enum):
    PASS = "PASS"
    CORRECTED = "CORRECTED"
    QUARANTINE = "QUARANTINE"


class FieldType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    EMAIL = "email"


class DeduplicationStrategy(str, Enum):
    KEEP_FIRST = "keep_first"
    KEEP_LAST = "keep_last"
    QUARANTINE_ALL = "quarantine_all"


@dataclass
class FieldRule:
    name: str
    field_type: FieldType
    required: bool = True
    nullable: bool = False
    regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    allowed_values: Optional[List[str]] = None
    strip_whitespace: bool = True
    date_format: str = "%Y-%m-%d"
    to_lowercase: bool = False
    to_uppercase: bool = False
    description: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FieldRule":
        return cls(
            name=data["name"],
            field_type=FieldType(data.get("field_type", "string")),
            required=data.get("required", True),
            nullable=data.get("nullable", False),
            regex=data.get("regex"),
            min_value=data.get("min_value"),
            max_value=data.get("max_value"),
            allowed_values=data.get("allowed_values"),
            strip_whitespace=data.get("strip_whitespace", True),
            date_format=data.get("date_format", "%Y-%m-%d"),
            to_lowercase=data.get("to_lowercase", False),
            to_uppercase=data.get("to_uppercase", False),
            description=data.get("description", ""),
        )


@dataclass
class BusinessRule:
    rule_id: str
    description: str
    rule_type: str  # "cross_field_math", "conditional_required", "custom_check"
    fields: List[str]
    expression: str
    error_message: str
    severity: Severity = Severity.ERROR

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BusinessRule":
        return cls(
            rule_id=data["rule_id"],
            description=data.get("description", ""),
            rule_type=data.get("rule_type", "cross_field_math"),
            fields=data.get("fields", []),
            expression=data.get("expression", ""),
            error_message=data.get("error_message", "Business rule violation"),
            severity=Severity(data.get("severity", "ERROR")),
        )


@dataclass
class DeduplicationConfig:
    key_fields: List[str]
    strategy: DeduplicationStrategy = DeduplicationStrategy.KEEP_FIRST

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DeduplicationConfig":
        return cls(
            key_fields=data.get("key_fields", []),
            strategy=DeduplicationStrategy(data.get("strategy", "keep_first")),
        )


@dataclass
class RuleConfig:
    dataset_name: str
    required_columns: List[str]
    field_rules: Dict[str, FieldRule]
    business_rules: List[BusinessRule] = field(default_factory=list)
    deduplication: Optional[DeduplicationConfig] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RuleConfig":
        field_rules = {
            f["name"]: FieldRule.from_dict(f)
            for f in data.get("fields", [])
        }
        business_rules = [
            BusinessRule.from_dict(b)
            for b in data.get("business_rules", [])
        ]
        dedup = None
        if "deduplication" in data:
            dedup = DeduplicationConfig.from_dict(data["deduplication"])

        return cls(
            dataset_name=data.get("dataset_name", "dataset"),
            required_columns=data.get("required_columns", list(field_rules.keys())),
            field_rules=field_rules,
            business_rules=business_rules,
            deduplication=dedup,
        )


@dataclass
class ExceptionRecord:
    row_number: int
    record_id: str
    field_name: str
    rule_id: str
    violation_type: str
    severity: Severity
    raw_value: Any
    expected: str
    error_message: str
    timestamp: str = field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_number": self.row_number,
            "record_id": self.record_id,
            "field_name": self.field_name,
            "rule_id": self.rule_id,
            "violation_type": self.violation_type,
            "severity": self.severity.value,
            "raw_value": str(self.raw_value) if self.raw_value is not None else "NULL",
            "expected": self.expected,
            "error_message": self.error_message,
            "timestamp": self.timestamp,
        }


@dataclass
class EngineSummary:
    total_records: int = 0
    valid_records: int = 0
    quarantined_records: int = 0
    corrected_records: int = 0
    duplicate_records: int = 0
    execution_time_ms: float = 0.0
    violation_counts_by_type: Dict[str, int] = field(default_factory=dict)
    violation_counts_by_field: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        pass_rate = round((self.valid_records / self.total_records * 100), 2) if self.total_records > 0 else 0.0
        quarantine_rate = round((self.quarantined_records / self.total_records * 100), 2) if self.total_records > 0 else 0.0
        return {
            "total_records": self.total_records,
            "valid_records": self.valid_records,
            "quarantined_records": self.quarantined_records,
            "corrected_records": self.corrected_records,
            "duplicate_records": self.duplicate_records,
            "pass_rate_pct": pass_rate,
            "quarantine_rate_pct": quarantine_rate,
            "execution_time_ms": round(self.execution_time_ms, 2),
            "violation_counts_by_type": self.violation_counts_by_type,
            "violation_counts_by_field": self.violation_counts_by_field,
        }
