"""
Unit tests for deduplication strategies.
"""

import unittest
from python_engine.engine import DataValidationEngine
from python_engine.models import DeduplicationConfig, DeduplicationStrategy, RuleConfig, FieldRule, FieldType


class TestDeduplication(unittest.TestCase):

    def setUp(self):
        self.field_rules = {
            "order_id": FieldRule(name="order_id", field_type=FieldType.STRING),
            "amount": FieldRule(name="amount", field_type=FieldType.FLOAT),
        }

    def test_keep_first_strategy(self):
        config = RuleConfig(
            dataset_name="test",
            required_columns=["order_id", "amount"],
            field_rules=self.field_rules,
            deduplication=DeduplicationConfig(
                key_fields=["order_id"],
                strategy=DeduplicationStrategy.KEEP_FIRST,
            ),
        )
        engine = DataValidationEngine(config)
        records = [
            {"order_id": "ORD-001", "amount": 100.0},
            {"order_id": "ORD-002", "amount": 200.0},
            {"order_id": "ORD-001", "amount": 150.0},  # duplicate of ORD-001
        ]
        cleaned, exceptions, summary = engine.run_pipeline(records)

        self.assertEqual(len(cleaned), 2)
        self.assertEqual(cleaned[0]["amount"], 100.0)  # first ORD-001 preserved
        self.assertEqual(cleaned[1]["amount"], 200.0)
        self.assertEqual(len(exceptions), 1)
        self.assertEqual(exceptions[0].violation_type, "DUPLICATE_PRIMARY_KEY")

    def test_keep_last_strategy(self):
        config = RuleConfig(
            dataset_name="test",
            required_columns=["order_id", "amount"],
            field_rules=self.field_rules,
            deduplication=DeduplicationConfig(
                key_fields=["order_id"],
                strategy=DeduplicationStrategy.KEEP_LAST,
            ),
        )
        engine = DataValidationEngine(config)
        records = [
            {"order_id": "ORD-001", "amount": 100.0},
            {"order_id": "ORD-001", "amount": 999.0},  # latest occurrence
        ]
        cleaned, exceptions, summary = engine.run_pipeline(records)

        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]["amount"], 999.0)  # last ORD-001 preserved
        self.assertEqual(len(exceptions), 1)

    def test_quarantine_all_strategy(self):
        config = RuleConfig(
            dataset_name="test",
            required_columns=["order_id", "amount"],
            field_rules=self.field_rules,
            deduplication=DeduplicationConfig(
                key_fields=["order_id"],
                strategy=DeduplicationStrategy.QUARANTINE_ALL,
            ),
        )
        engine = DataValidationEngine(config)
        records = [
            {"order_id": "ORD-001", "amount": 100.0},
            {"order_id": "ORD-002", "amount": 200.0},
            {"order_id": "ORD-001", "amount": 150.0},
        ]
        cleaned, exceptions, summary = engine.run_pipeline(records)

        # ORD-001 is quarantined completely, only ORD-002 survives
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]["order_id"], "ORD-002")
        self.assertEqual(len(exceptions), 2)  # both ORD-001 quarantined


if __name__ == "__main__":
    unittest.main()
