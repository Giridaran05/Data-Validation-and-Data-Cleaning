"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: test_mandatory_suite.py
Official 10 Mandatory Evaluation Test Cases (TC-01 through TC-10)
Directly matching academic evaluation rubric in '13. Test Cases and Results'.
"""

import os
import unittest
from python_engine.engine import DataValidationEngine
from python_engine.models import RuleConfig, FieldRule, FieldType, Severity, DeduplicationConfig, DeduplicationStrategy
from python_engine.exceptions import SchemaValidationError, DataIngestionError
from python_engine.cleaner import clean_null_value, parse_and_normalize_date, strip_whitespace
from python_engine.validators import validate_and_cast_type, validate_required_columns, validate_field_constraints
from python_engine.universal_engine import UniversalDataEngine


class TestMandatoryTenSuite(unittest.TestCase):
    """
    Official 10 Mandatory Evaluation Test Suite (TC-01 to TC-10)
    """

    def setUp(self):
        """Prepare sample schema rules for test runs."""
        self.rules_config = RuleConfig(
            dataset_name="Orders Test",
            required_columns=["order_id", "email", "amount", "order_date"],
            field_rules={
                "order_id": FieldRule(name="order_id", field_type=FieldType.STRING, required=True, strip_whitespace=True),
                "email": FieldRule(name="email", field_type=FieldType.EMAIL, required=True, nullable=False, strip_whitespace=True),
                "amount": FieldRule(name="amount", field_type=FieldType.FLOAT, required=True, min_value=0.01),
                "order_date": FieldRule(name="order_date", field_type=FieldType.DATE, required=True),
            },
            deduplication=DeduplicationConfig(key_fields=["order_id"], strategy=DeduplicationStrategy.KEEP_FIRST),
        )
        self.engine = DataValidationEngine(self.rules_config)
        self.univ_engine = UniversalDataEngine()

    def test_tc01_valid_csv_input(self):
        """TC-01: Valid CSV input -> File loads and processing completes successfully."""
        headers = ["order_id", "email", "amount", "order_date"]
        rows = [
            {"order_id": "ORD-101", "email": "alice@example.com", "amount": "99.50", "order_date": "2026-03-01"},
            {"order_id": "ORD-102", "email": "bob@example.com", "amount": "149.00", "order_date": "2026-03-02"},
        ]
        result = self.univ_engine.process_dataset(headers, rows)
        self.assertEqual(len(result["cleaned_records"]), 2)
        self.assertEqual(len(result["exception_records"]), 0)
        self.assertEqual(result["summary"]["pass_rate_pct"], 100.0)

    def test_tc02_missing_required_column(self):
        """TC-02: Missing required column -> Schema issue is detected and reported."""
        headers = ["order_id", "amount"]  # Missing 'email' and 'order_date'
        is_valid, missing = validate_required_columns(headers, self.rules_config.required_columns)
        self.assertFalse(is_valid)
        self.assertIn("email", missing)
        self.assertIn("order_date", missing)

    def test_tc03_blank_mandatory_value(self):
        """TC-03: Blank mandatory value -> Missing-value issue is identified and quarantined."""
        field_rule = self.rules_config.field_rules["email"]
        # Blank string on mandatory required field
        is_valid, val, exc = self.engine.clean_and_validate_field(field_rule, "", 1, "ORD-201")
        self.assertFalse(is_valid)
        self.assertIsNotNone(exc)
        self.assertEqual(exc.violation_type, "MISSING_MANDATORY_VALUE")

    def test_tc04_incorrect_data_type(self):
        """TC-04: Incorrect data type -> Type mismatch is identified and flagged."""
        is_valid, val, err = validate_and_cast_type("INVALID_NOT_A_NUMBER", FieldType.FLOAT)
        self.assertFalse(is_valid)
        self.assertIn("Cannot convert", err)

    def test_tc05_duplicate_record_key(self):
        """TC-05: Duplicate record/key -> Duplicate primary key is detected as configured."""
        headers = ["order_id", "customer_name", "amount"]
        rows = [
            {"order_id": "ORD-999", "customer_name": "User A", "amount": "100"},
            {"order_id": "ORD-999", "customer_name": "User B (Duplicate)", "amount": "100"},
        ]
        result = self.univ_engine.process_dataset(headers, rows, custom_identifier="order_id")
        self.assertEqual(len(result["cleaned_records"]), 1)
        self.assertEqual(len(result["exception_records"]), 1)
        self.assertEqual(result["exception_records"][0]["violation_type"], "DUPLICATE_IDENTIFIER")

    def test_tc06_invalid_date_format(self):
        """TC-06: Invalid date/format -> Malformed date format issue is recorded."""
        norm_date, err = parse_and_normalize_date("03/15/2026")
        self.assertEqual(norm_date, "2026-03-15")
        self.assertIsNone(err)

        invalid_date, err = parse_and_normalize_date("NOT_A_REAL_DATE_32/13/99")
        self.assertIsNone(invalid_date)
        self.assertIsNotNone(err)

    def test_tc07_empty_csv(self):
        """TC-07: Empty CSV -> Readable validation error is handled gracefully."""
        headers = []
        rows = []
        result = self.univ_engine.process_dataset(headers, rows)
        self.assertEqual(result["summary"]["total_records"], 0)
        self.assertEqual(result["summary"]["valid_records"], 0)

    def test_tc08_malformed_unreadable_file(self):
        """TC-08: Malformed/unreadable file -> Processing stops safely with descriptive message."""
        with self.assertRaises(DataIngestionError):
            DataValidationEngine.from_config_file("non_existent_directory/invalid_file.json")

    def test_tc09_valid_business_rule_boundary(self):
        """TC-09: Valid business-rule boundary -> Boundary values handled correctly."""
        rule = FieldRule(name="discount", field_type=FieldType.FLOAT, min_value=0.0, max_value=1.0)
        # Test boundary min_value=0.0
        is_valid_min, err_min = validate_field_constraints(rule, 0.0)
        self.assertTrue(is_valid_min)
        self.assertIsNone(err_min)

        # Test boundary max_value=1.0
        is_valid_max, err_max = validate_field_constraints(rule, 1.0)
        self.assertTrue(is_valid_max)
        self.assertIsNone(err_max)

        # Test out-of-boundary value 1.5
        is_valid_over, err_over = validate_field_constraints(rule, 1.5)
        self.assertFalse(is_valid_over)
        self.assertIsNotNone(err_over)

    def test_tc10_output_generation(self):
        """TC-10: Output generation -> Clean dataset and exception report are created."""
        headers = ["id", "val"]
        rows = [
            {"id": "001", "val": "100"},
            {"id": "002", "val": "200"},
        ]
        result = self.univ_engine.process_dataset(headers, rows)
        self.assertIn("cleaned_records", result)
        self.assertIn("exception_records", result)
        self.assertIn("summary", result)
        self.assertEqual(len(result["cleaned_records"]), 2)


if __name__ == "__main__":
    unittest.main()
