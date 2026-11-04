"""
Unit tests for python_engine.cleaner
"""

import unittest
from python_engine.cleaner import (
    clean_null_value,
    clean_numeric_string,
    normalize_case,
    parse_and_normalize_date,
    strip_whitespace,
)


class TestCleaner(unittest.TestCase):

    def test_clean_null_value(self):
        self.assertIsNone(clean_null_value(""))
        self.assertIsNone(clean_null_value("   "))
        self.assertIsNone(clean_null_value("null"))
        self.assertIsNone(clean_null_value("NULL"))
        self.assertIsNone(clean_null_value("N/A"))
        self.assertIsNone(clean_null_value("None"))
        self.assertIsNone(clean_null_value("NaN"))
        self.assertIsNone(clean_null_value("-"))
        # Valid values preserved
        self.assertEqual(clean_null_value(0), 0)
        self.assertEqual(clean_null_value(False), False)
        self.assertEqual(clean_null_value("Valid Text"), "Valid Text")

    def test_strip_whitespace(self):
        self.assertEqual(strip_whitespace("  hello world  "), "hello world")
        self.assertEqual(strip_whitespace("\tclean\n"), "clean")
        self.assertEqual(strip_whitespace(123), 123)

    def test_normalize_case(self):
        self.assertEqual(normalize_case("HELLO WORLD", "lower"), "hello world")
        self.assertEqual(normalize_case("hello world", "upper"), "HELLO WORLD")
        self.assertEqual(normalize_case("john doe", "title"), "John Doe")

    def test_clean_numeric_string(self):
        self.assertEqual(clean_numeric_string("$1,200.50"), "1200.50")
        self.assertEqual(clean_numeric_string("€500"), "500")
        self.assertAlmostEqual(clean_numeric_string("15%"), 0.15)
        self.assertAlmostEqual(clean_numeric_string("0%"), 0.0)

    def test_parse_and_normalize_date(self):
        # ISO format
        norm, err = parse_and_normalize_date("2026-10-15")
        self.assertEqual(norm, "2026-10-15")
        self.assertIsNone(err)

        # Slash format
        norm, err = parse_and_normalize_date("10/15/2026")
        self.assertEqual(norm, "2026-10-15")
        self.assertIsNone(err)

        # Invalid date
        norm, err = parse_and_normalize_date("invalid-date-string")
        self.assertIsNone(norm)
        self.assertIsNotNone(err)


if __name__ == "__main__":
    unittest.main()
