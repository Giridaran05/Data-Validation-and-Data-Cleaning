"""
Unit tests for python_engine.validators
"""

import unittest
from python_engine.models import FieldRule, FieldType
from python_engine.validators import (
    validate_and_cast_type,
    validate_field_constraints,
    validate_required_columns,
)


class TestValidators(unittest.TestCase):

    def test_required_columns_success(self):
        headers = ["order_id", "customer_id", "order_date", "quantity"]
        required = ["order_id", "quantity"]
        ok, missing = validate_required_columns(headers, required)
        self.assertTrue(ok)
        self.assertEqual(missing, [])

    def test_required_columns_missing(self):
        headers = ["order_id", "order_date"]
        required = ["order_id", "customer_id", "total_amount"]
        ok, missing = validate_required_columns(headers, required)
        self.assertFalse(ok)
        self.assertEqual(missing, ["customer_id", "total_amount"])

    def test_integer_type_casting(self):
        # Valid integer string
        ok, val, err = validate_and_cast_type("42", FieldType.INTEGER)
        self.assertTrue(ok)
        self.assertEqual(val, 42)
        self.assertIsNone(err)

        # Invalid string
        ok, val, err = validate_and_cast_type("not-a-number", FieldType.INTEGER)
        self.assertFalse(ok)
        self.assertIn("Cannot convert", err)

        # Non-integer float
        ok, val, err = validate_and_cast_type("42.5", FieldType.INTEGER)
        self.assertFalse(ok)

    def test_float_type_casting(self):
        ok, val, err = validate_and_cast_type("129.95", FieldType.FLOAT)
        self.assertTrue(ok)
        self.assertAlmostEqual(val, 129.95)

        # Currency string with dollar sign and commas
        ok, val, err = validate_and_cast_type("$1,250.75", FieldType.FLOAT)
        self.assertTrue(ok)
        self.assertAlmostEqual(val, 1250.75)

    def test_email_validation(self):
        # Valid email
        ok, val, err = validate_and_cast_type("Alex.Smith@Enterprise.com", FieldType.EMAIL)
        self.assertTrue(ok)
        self.assertEqual(val, "alex.smith@enterprise.com")

        # Invalid emails
        for bad_email in ["notanemail", "user@@broken.com", "user@.com", "@missinguser.com"]:
            ok, val, err = validate_and_cast_type(bad_email, FieldType.EMAIL)
            self.assertFalse(ok, f"Expected {bad_email} to fail")

    def test_range_constraints(self):
        rule = FieldRule(
            name="quantity",
            field_type=FieldType.INTEGER,
            min_value=1,
            max_value=100
        )
        # Inside range
        ok, err = validate_field_constraints(rule, 50)
        self.assertTrue(ok)

        # Below minimum
        ok, err = validate_field_constraints(rule, 0)
        self.assertFalse(ok)
        self.assertIn("less than minimum", err)

        # Above maximum
        ok, err = validate_field_constraints(rule, 150)
        self.assertFalse(ok)
        self.assertIn("exceeds maximum", err)

    def test_enum_allowed_values(self):
        rule = FieldRule(
            name="payment_status",
            field_type=FieldType.STRING,
            allowed_values=["PAID", "PENDING", "REFUNDED", "FAILED"]
        )
        ok, err = validate_field_constraints(rule, "PAID")
        self.assertTrue(ok)

        ok, err = validate_field_constraints(rule, "BITCOIN")
        self.assertFalse(ok)
        self.assertIn("not in allowed list", err)

    def test_regex_pattern(self):
        rule = FieldRule(
            name="sku",
            field_type=FieldType.STRING,
            regex=r"^[A-Z]{3}-\d{4}$"
        )
        ok, err = validate_field_constraints(rule, "ELC-1042")
        self.assertTrue(ok)

        ok, err = validate_field_constraints(rule, "INVALID_SKU")
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
