"""
Unit tests for cross-field business rules.
"""

import unittest
from python_engine.models import BusinessRule, Severity
from python_engine.validators import evaluate_business_rule


class TestBusinessRules(unittest.TestCase):

    def test_calculation_integrity_success(self):
        # qty 2, price 50.00, discount 0.10, tax 7.42 -> (2 * 50 * 0.9) + 7.42 = 97.42
        rule = BusinessRule(
            rule_id="BR_MATH",
            description="Math check",
            rule_type="cross_field_math",
            fields=["quantity", "unit_price", "discount_pct", "tax_amount", "total_amount"],
            expression="",
            error_message="Math error",
            severity=Severity.ERROR,
        )
        record = {
            "order_id": "ORD-001",
            "quantity": 2,
            "unit_price": 50.00,
            "discount_pct": 0.10,
            "tax_amount": 7.42,
            "total_amount": 97.42,
        }
        exc = evaluate_business_rule(rule, record, row_num=1)
        self.assertIsNone(exc)

    def test_calculation_integrity_violation(self):
        rule = BusinessRule(
            rule_id="BR_MATH",
            description="Math check",
            rule_type="cross_field_math",
            fields=["quantity", "unit_price", "discount_pct", "tax_amount", "total_amount"],
            expression="",
            error_message="Math error",
            severity=Severity.ERROR,
        )
        record = {
            "order_id": "ORD-002",
            "quantity": 2,
            "unit_price": 50.00,
            "discount_pct": 0.10,
            "tax_amount": 7.42,
            "total_amount": 500.00,  # Forged total
        }
        exc = evaluate_business_rule(rule, record, row_num=2)
        self.assertIsNotNone(exc)
        self.assertEqual(exc.violation_type, "CROSS_FIELD_MATH_MISMATCH")

    def test_paid_status_positive_total_violation(self):
        rule = BusinessRule(
            rule_id="BR_PAID",
            description="Paid check",
            rule_type="payment_status_integrity",
            fields=["payment_status", "total_amount"],
            expression="",
            error_message="Paid total must be > 0",
        )
        record = {
            "order_id": "ORD-003",
            "payment_status": "PAID",
            "total_amount": 0.00,
        }
        exc = evaluate_business_rule(rule, record, row_num=3)
        self.assertIsNotNone(exc)
        self.assertEqual(exc.violation_type, "INVALID_PAID_STATUS")


if __name__ == "__main__":
    unittest.main()
