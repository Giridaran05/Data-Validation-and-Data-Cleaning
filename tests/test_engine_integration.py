"""
Integration tests for DataValidationEngine.
"""

import os
import unittest
from python_engine.dataset_generator import generate_synthetic_dataset
from python_engine.engine import DataValidationEngine
from python_engine.exceptions import MissingColumnError


class TestEngineIntegration(unittest.TestCase):

    def setUp(self):
        self.rules_file = "data/rules_config.json"
        self.raw_data_file = "data/test_orders_raw.csv"
        self.clean_data_file = "data/test_cleaned_orders.csv"
        self.exception_file = "data/test_exceptions.csv"

        # Generate fresh test dataset
        generate_synthetic_dataset(
            record_count=50,
            output_csv=self.raw_data_file,
            output_json="data/test_orders_raw.json",
        )

    def tearDown(self):
        for f in [self.raw_data_file, self.clean_data_file, self.exception_file, "data/test_orders_raw.json"]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass

    def test_end_to_end_pipeline(self):
        engine = DataValidationEngine.from_config_file(self.rules_file)
        cleaned, exceptions, summary = engine.run_file(
            input_file=self.raw_data_file,
            output_clean=self.clean_data_file,
            output_exceptions=self.exception_file,
        )

        self.assertEqual(summary.total_records, 50)
        self.assertGreater(summary.valid_records, 0)
        self.assertGreater(summary.quarantined_records, 0)
        self.assertEqual(summary.valid_records + summary.quarantined_records, 50)

        # Ensure output files were generated and non-empty
        self.assertTrue(os.path.exists(self.clean_data_file))
        self.assertTrue(os.path.exists(self.exception_file))
        self.assertGreater(os.path.getsize(self.clean_data_file), 100)
        self.assertGreater(os.path.getsize(self.exception_file), 100)

    def test_missing_column_raises_schema_error(self):
        engine = DataValidationEngine.from_config_file(self.rules_file)
        # Headers missing required columns
        is_ok, missing = engine.validate_schema(["order_id", "customer_id"])
        self.assertFalse(is_ok)
        self.assertIn("total_amount", missing)


if __name__ == "__main__":
    unittest.main()
