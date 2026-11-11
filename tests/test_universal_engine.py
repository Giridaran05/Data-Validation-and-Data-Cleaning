"""
Unit & Integration Tests for Universal Intelligent CSV Engine.
Tests automatic profiling, domain detection, college student cleaning,
product inventory constraints, employee salary parsing, and leading zeros preservation.
"""

import unittest
from python_engine.profiler import DatasetProfiler
from python_engine.recommender import RecommendationEngine
from python_engine.universal_engine import UniversalDataEngine


class TestUniversalEngine(unittest.TestCase):

    def test_student_domain_detection_and_cleaning(self):
        headers = ["reg_no", "student_name", "email", "department", "year", "phone_number"]
        records = [
            {"reg_no": "00101", "student_name": "  arun kumar  ", "email": "arun@university.edu", "department": "Computer Science", "year": "3", "phone_number": "+91-9876543210"},
            {"reg_no": "00102", "student_name": "priya r", "email": "priya@@bad", "department": "ECE", "year": "2", "phone_number": "9876543211"},
            {"reg_no": "00101", "student_name": "arun kumar", "email": "arun@university.edu", "department": "Computer Science", "year": "3", "phone_number": "9876543210"},
        ]

        engine = UniversalDataEngine()
        result = engine.process_dataset(headers, records)

        profile = result["profile"]
        self.assertEqual(profile["domain_key"], "COLLEGE_STUDENT")
        self.assertEqual(profile["primary_identifier"], "reg_no")

        cleaned = result["cleaned_records"]
        exceptions = result["exception_records"]

        # Row 1 must have titlecased name and preserved leading zero "00101"
        self.assertEqual(cleaned[0]["student_name"], "Arun Kumar")
        self.assertEqual(cleaned[0]["reg_no"], "00101")

        # Row 2 must be quarantined due to invalid email format
        bad_email_exc = [e for e in exceptions if e["field_name"] == "email"]
        self.assertTrue(len(bad_email_exc) > 0)

        # Row 3 must be quarantined due to duplicate reg_no
        dup_reg_exc = [e for e in exceptions if e["rule_id"] in ("PK_DUPLICATE", "DUPLICATE_EXACT_ROW")]
        self.assertTrue(len(dup_reg_exc) > 0)

    def test_product_domain_and_negative_price_detection(self):
        headers = ["product_id", "product_name", "category", "price", "stock_quantity"]
        records = [
            {"product_id": "PRD-01", "product_name": "USB Cable", "category": "Electronics", "price": "$12.50", "stock_quantity": "100"},
            {"product_id": "PRD-02", "product_name": "Headphones", "category": "Electronics", "price": "-45.00", "stock_quantity": "50"},
            {"product_id": "PRD-03", "product_name": "Keyboard", "category": "Electronics", "price": "$ 85.00", "stock_quantity": "-5"},
        ]

        engine = UniversalDataEngine()
        result = engine.process_dataset(headers, records)

        profile = result["profile"]
        self.assertEqual(profile["domain_key"], "PRODUCT_INVENTORY")

        cleaned = result["cleaned_records"]
        exceptions = result["exception_records"]

        # Valid row 1 should have currency symbol stripped ($12.50 -> 12.50)
        self.assertEqual(cleaned[0]["price"], "12.50")

        # Negative price in PRD-02 must be quarantined
        neg_price_exc = [e for e in exceptions if e["rule_id"] == "RANGE_POSITIVE"]
        self.assertTrue(len(neg_price_exc) > 0)

        # Negative stock in PRD-03 must be quarantined
        neg_stock_exc = [e for e in exceptions if e["rule_id"] == "RANGE_STOCK_POSITIVE"]
        self.assertTrue(len(neg_stock_exc) > 0)

    def test_recommendation_engine_generation(self):
        headers = ["emp_id", "employee_name", "email", "salary"]
        records = [
            {"emp_id": "EMP-01", "employee_name": "John Doe", "email": "john@corp.com", "salary": "$90,000"},
            {"emp_id": "EMP-02", "employee_name": "Jane Smith", "email": "jane@corp.com", "salary": ""},
        ]
        profiler = DatasetProfiler(headers, records)
        profile = profiler.analyze()
        recs = RecommendationEngine.generate_recommendations(profile, records)

        self.assertTrue(any("salary" in r["affected_column"] for r in recs))
        self.assertTrue(any(r["category"] == "MISSING_DATA" for r in recs))


if __name__ == "__main__":
    unittest.main()
