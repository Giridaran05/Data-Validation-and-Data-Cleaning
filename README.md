# DIT Internship 2026 - TASK 07: Data Cleaning & Validation Engine

An enterprise-grade, zero-external-dependency Python Data Cleaning and Validation Engine designed to sanitize, validate, and partition raw tabular datasets into clean warehouse-ready tables and an actionable Exception Quarantine Register.

---

## 📋 Deliverables Summary

| Deliverable | Location | Description |
| :--- | :--- | :--- |
| **1. Validation Engine** | `python_engine/` | Modular Python package (`models`, `exceptions`, `logger`, `validators`, `cleaner`, `engine`, `cli`) |
| **2. Cleaned Sample Dataset** | `data/cleaned_orders.csv` | Sanitized, type-safe, validated records passing 100% of checks |
| **3. Exception Register** | `data/exception_register.csv` | Quarantined records with line numbers, field name, rule ID, raw value, severity, and error message |
| **4. Data Dictionary** | `docs/data_dictionary.md` | Complete field taxonomy, logical types, constraints, and anomaly signatures |
| **5. Test Suite** | `tests/` | 21 passing automated unit and integration tests (`python3 -m unittest`) |
| **6. Interactive Web Workbench**| `src/` & `server.ts` | Full-stack interactive visual dashboard for pipeline execution, rule editing, and testing |

---

## 🏗️ Architecture & Modules

```
├── python_engine/
│   ├── __init__.py          # Package initialization
│   ├── models.py            # Dataclasses & Enums (Severity, FieldRule, BusinessRule, ExceptionRecord)
│   ├── exceptions.py        # Custom exception hierarchy (DataEngineError, MissingColumnError, etc.)
│   ├── logger.py            # Structured logging with memory buffer for API/UI telemetry
│   ├── cleaner.py           # Sanitization (whitespace, case normalization, date/number cleaning)
│   ├── validators.py        # Core validation functions (types, regex, ranges, enums, cross-field rules)
│   ├── engine.py            # Main pipeline coordinator (schema checks, deduplication, row-by-row validation)
│   ├── dataset_generator.py # Synthetic dataset generator with controlled anomalies
│   └── cli.py               # CLI runner with argparse
├── data/
│   ├── rules_config.json    # Declarative schema and business rules specification
│   ├── orders_raw.csv       # 100 synthetic transaction records with realistic errors
│   ├── cleaned_orders.csv   # Validated output records (Deliverable 2)
│   ├── exception_register.csv # Quarantined anomaly records (Deliverable 3)
│   └── engine_summary.json  # Metric summary (pass rate, quarantine rate, runtime)
├── docs/
│   ├── data_dictionary.md   # Data Dictionary (Deliverable 4)
│   └── business_problem_and_architecture.md # Comprehensive problem analysis & architecture
├── tests/
│   ├── test_validators.py   # Type, regex, range, and enum tests
│   ├── test_cleaner.py      # Sanitization and date normalization tests
│   ├── test_deduplication.py# Keep-first, keep-last, quarantine-all deduplication tests
│   ├── test_business_rules.py # Cross-field calculation & status integrity tests
│   └── test_engine_integration.py # End-to-end file pipeline tests
└── main.py                  # Direct executable entrypoint
```

---

## 🚀 Quickstart & Execution

### 1. Run the Pipeline on the Sample Dataset
```bash
python3 main.py
```

### 2. Generate a New Synthetic Dataset and Run Validation
```bash
python3 main.py --generate --records 150 -v
```

### 3. Run the Automated Test Suite
```bash
python3 -m unittest discover tests/ -v
```

### 4. Custom File & Rule Configuration
```bash
python3 python_engine/cli.py \
  --input path/to/my_data.csv \
  --rules data/rules_config.json \
  --output-clean data/cleaned_orders.csv \
  --output-exceptions data/exception_register.csv \
  --summary-json data/engine_summary.json
```

---

## ⚙️ Declarative Business Rules Configuration

Rules are defined in `data/rules_config.json`:
- **Required Columns**: Verified before row processing.
- **Deduplication Strategy**: `keep_first`, `keep_last`, or `quarantine_all` on composite primary keys.
- **Field Specifications**:
  - `field_type`: `string`, `integer`, `float`, `boolean`, `date`, `email`
  - `regex`: Custom regex pattern (e.g. `^ORD-\d{4}-\d{5}$`)
  - `min_value` / `max_value`: Numeric boundaries
  - `allowed_values`: Enum whitelist
  - `strip_whitespace`, `to_lowercase`, `to_uppercase`: Auto-sanitization
- **Business Rules**: Cross-field mathematical integrity (e.g. Total = Qty * Price * (1 - Disc) + Tax) and payment state checks.

---

## 🧪 Test Results
```text
Ran 21 tests in 0.026s
OK
```
All tests verify zero external dependencies, robust exception isolation, and complete edge case handling.
