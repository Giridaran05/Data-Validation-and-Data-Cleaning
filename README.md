# Universal Intelligent CSV Data Cleaning & Validation Engine

**DIT Internship 2026 — TASK 07 (Data Quality Track)**

An enterprise-grade, domain-aware CSV data cleaning, profiling, and validation platform built with a **pure Python 3 standard-library engine** (zero external `pip` dependencies) and a responsive **React + Express** web dashboard styled around the official **iData Engine** brand identity.

The system automatically analyzes arbitrary CSV datasets from any domain without requiring predefined column names or fixed schemas, preserves sensitive identifiers (such as leading zeros on register numbers and postal codes), isolates invalid records into a structured Exception Register, and exports clean, warehouse-ready CSV outputs.

---

## Core Capabilities

### 1. Intelligent Dataset Profiling & Domain Detection
* **Automatic Schema Inference**: Detects headers, row/column dimensions, physical data types (`INTEGER`, `FLOAT`, `STRING`, `DATE`, `BOOLEAN`), and semantic roles (`IDENTIFIER`, `EMAIL`, `PHONE_NUMBER`, `CURRENCY`, `PERCENTAGE`, `POSTAL_CODE`, `NAME`).
* **Multi-Domain Recognition**: Automatically classifies uploaded datasets across:
  * **College / University Student Data** (`sample_students.csv`)
  * **Employee / HR Management Data** (`sample_employees.csv`)
  * **Product & Inventory Data** (`sample_products.csv`)
  * **E-Commerce & Orders Data** (`orders_raw.csv`)
  * **Hospital & Healthcare Patient Data** (`sample_healthcare.csv`)
  * **Banking / Financial & Custom CSVs** (automatic distribution-based profiling)
* **Data Quality Scoring**: Calculates a 0–100 quality score, missing cell counts/percentages, primary identifier keys, and duplicate row metrics.

### 2. Dynamic Domain-Based Cleaning & Validation
* **Identifier & Leading-Zero Preservation**: Preserves leading zeros on student register numbers (e.g., `00101`), employee IDs, and postal codes without integer truncation.
* **Name & Text Normalization**: Strips leading/trailing whitespace and normalizes casing without altering record identity.
* **Currency & Numeric Sanitization**: Strips currency symbols (`$`, `€`, `£`, `¥`, `₹`) and thousand commas (`"$1,499.50"` → `1499.50`).
* **Date Standardization**: Normalizes heterogeneous date formats (`MM/DD/YYYY`, `DD-MM-YYYY`, etc.) to canonical ISO `YYYY-MM-DD`.
* **Contact & Format Validation**: Enforces RFC 5322 email syntax and international phone format validation (`+91`, `+1`, etc.).
* **Cross-Field Business Math & Boundary Checks**: Validates formula integrity (`total = quantity * unit_price * (1 - discount_pct) + tax_amount`), non-negative prices/stock, and configurable ranges.
* **Configurable Recommendations**: Generates toggleable cleaning operations with live **Before → After** previews before execution.

### 3. Dual Partitioning & Official Deliverables (Task 07)
1. **Validation Engine**: Modular Python 3 package (`python_engine/`).
2. **Cleaned Dataset**: Sanitized, type-safe warehouse-ready CSV (`cleaned_dataset.csv`).
3. **Exception Register**: Audit quarantine log (`exception_register.csv`) recording row number, record ID, offending field, violation code, severity, raw value, diagnosis, and suggested fix.
4. **Data Dictionary**: Dynamic physical/logical schema taxonomy modal and `docs/data_dictionary.md`.
5. **Automated Test Suite**: 10 mandatory `unittest` evaluation cases (`TC-01` through `TC-10`) runnable via CLI or directly from the dashboard.

---

## Technology Stack

* **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React (`Plus Jakarta Sans` & `JetBrains Mono`)
* **Backend API Bridge**: Node.js + Express.js (`tsx server.ts` on port `3000`)
* **Validation Engine**: Python 3.10+ Native Standard Library (`csv`, `json`, `re`, `datetime`, `math`, `argparse`, `logging`) — zero `pip` dependencies
* **Testing Framework**: Python `unittest` (`tests/test_mandatory_suite.py`)

---

## Project Architecture

```text
/
├── main.py                          # CLI entry point for rule-configured pipeline
├── server.ts                        # Express REST API + Vite middleware (Port 3000)
├── index.html                       # Web entry point with official favicon & fonts
├── package.json                     # Node.js dependencies & scripts
├── python_engine/
│   ├── __init__.py
│   ├── universal_cli.py             # Universal CLI runner (profile & process modes)
│   ├── universal_engine.py          # UniversalDataEngine for arbitrary CSVs
│   ├── profiler.py                  # DatasetProfiler & semantic domain inference
│   ├── recommender.py               # Dynamic cleaning rule recommendation engine
│   ├── engine.py                    # DataValidationEngine (declarative JSON rules)
│   ├── cleaner.py                   # Whitespace, date, null, & numeric sanitizers
│   ├── validators.py                # Column, type, regex, range, & math validators
│   ├── models.py                    # Dataclasses & enums (FieldRule, ExceptionRecord, etc.)
│   ├── exceptions.py                # Structured validation & ingestion exceptions
│   ├── logger.py                    # Formatted logging & stdout stream buffer
│   ├── dataset_generator.py         # Synthetic test dataset generator with anomalies
│   └── cli.py                       # CLI parser for batch automation
├── data/
│   ├── orders_raw.csv               # Benchmark 100-row E-Commerce Orders dataset
│   ├── sample_students.csv          # Benchmark College Student dataset
│   ├── sample_products.csv          # Benchmark Product Inventory dataset
│   ├── sample_employees.csv         # Benchmark Employee HR dataset
│   ├── sample_healthcare.csv        # Benchmark Healthcare Patient dataset
│   ├── rules_config.json            # Declarative validation rules configuration
│   ├── cleaned_orders.csv           # Sample cleaned output
│   ├── exception_register.csv       # Sample exception quarantine output
│   └── engine_summary.json          # Sample execution telemetry summary
├── docs/
│   ├── business_problem_and_architecture.md
│   └── data_dictionary.md
├── tests/
│   ├── test_mandatory_suite.py      # Official 10 mandatory test cases (TC-01 to TC-10)
│   ├── test_validators.py
│   ├── test_cleaner.py
│   ├── test_deduplication.py
│   ├── test_business_rules.py
│   ├── test_universal_engine.py
│   └── test_engine_integration.py
├── public/assets/aistudio/
│   └── logofi_0606f38f.png          # Official brand logo & favicon
└── src/
    ├── App.tsx                      # Responsive SaaS dashboard (Deep Navy & Royal Blue theme)
    ├── index.css                    # Tailwind CSS v4 & custom scrollbar styling
    └── main.tsx                     # React mount entry
```

---

## Installation and Execution

### Prerequisites
* **Python 3** (3.10 or higher recommended)
* **Git** installed
* **Node.js (v18+) & npm** *(for running the interactive web dashboard)*

### 1. Clone the Repository
```bash
git clone <repository-url>
cd <project-folder-name>
python3 --version
```

### 2. Run the Python Engine (CLI Mode)

**Universal Multi-Domain CSV Engine (works with any CSV):**
```bash
# Profile a CSV dataset (infers domain, primary key, types, and recommendations)
python3 python_engine/universal_cli.py --input data/sample_students.csv --action profile

# Clean and validate a CSV dataset
python3 python_engine/universal_cli.py \
  --input data/sample_students.csv \
  --action process \
  --output-clean data/cleaned_output.csv \
  --output-exceptions data/exception_register.csv \
  --summary-json data/summary.json
```

**Rule-Configured Pipeline (`main.py`):**
```bash
# Validate default dataset using data/rules_config.json
python3 main.py -v

# Generate synthetic records with anomalies and run validation
python3 main.py --generate --records 100 -v
```

### 3. Run the Automated Test Suite
Execute the 10 mandatory evaluation tests (`TC-01` through `TC-10`):
```bash
python3 -m unittest tests/test_mandatory_suite.py -v
```
Expected output:
```text
Ran 10 tests in 0.011s

OK
```

### 4. Launch the Interactive Web Dashboard
```bash
npm install
npm run dev
```
Open your browser and visit `http://localhost:3000`.
No login is required—you have immediate access to upload any CSV file, switch between benchmark domains, inspect the inferred schema taxonomy, toggle cleaning recommendations, execute validation, view the live Python terminal, run the 10 mandatory tests, and download the cleaned CSV and exception register.

---

## Mandatory Test Cases (`TC-01` to `TC-10`)

| Test ID | Scenario | Test Method (`tests/test_mandatory_suite.py`) | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-01** | Valid CSV input | `test_tc01_valid_csv_input` | File loads and processing completes successfully |
| **TC-02** | Missing required column | `test_tc02_missing_required_column` | Schema issue is detected and reported |
| **TC-03** | Blank mandatory value | `test_tc03_blank_mandatory_value` | Missing-value issue is identified and quarantined |
| **TC-04** | Incorrect data type | `test_tc04_incorrect_data_type` | Type mismatch is identified and flagged |
| **TC-05** | Duplicate record/key | `test_tc05_duplicate_record_key` | Duplicate primary key is detected as configured |
| **TC-06** | Invalid date/format | `test_tc06_invalid_date_format` | Malformed date format issue is recorded |
| **TC-07** | Empty CSV | `test_tc07_empty_csv` | Readable validation error is handled gracefully |
| **TC-08** | Malformed/unreadable file | `test_tc08_malformed_unreadable_file` | Processing stops safely with descriptive message |
| **TC-09** | Valid business-rule boundary | `test_tc09_valid_business_rule_boundary` | Boundary values handled correctly |
| **TC-10** | Output generation | `test_tc10_output_generation` | Clean dataset and exception report are created |
