# Universal Intelligent CSV Data Cleaning & Validation Engine

A high-performance, domain-aware CSV data processing and quality assurance system. Automatically profiles arbitrary tabular datasets, infers semantic domains, generates tailored cleaning recommendations, preserves entity identifiers, and isolates anomalies into a structured Exception Register.

---

## 🌟 Key Capabilities

### 1. Intelligent Dataset Understanding & Domain Detection
- **Multi-Domain Recognition**: Detects whether the uploaded CSV represents:
  - **College / University Student Data** (Register numbers, student names, departments, CGPA)
  - **Employee / HR Management Data** (Employee IDs, salaries, designations, joining dates)
  - **Product & Inventory Data** (SKUs, product names, price bounds, stock quantities)
  - **E-Commerce & Orders Data** (Order IDs, cross-field invoice math equations, tax)
  - **Hospital & Healthcare Patient Data** (Patient IDs, blood groups, doctor assignments)
  - **Banking & Financial Transactions** (Account numbers, transaction IDs, balances)
  - **Custom / Unknown Tabular CSVs** (Automatic schema inferencing based on data distribution)

### 2. Semantic Data Sanitization
- **Identifier Preservation**: Automatically preserves leading zeros on student register numbers (`00101`), employee badges, and postal codes without truncation.
- **Name Normalization**: Capitalizes words to standard title case (`"  arun kumar  "` $\rightarrow$ `"Arun Kumar"`) while preserving original identity.
- **Currency Sanitization**: Strips currency signs (`$`, `€`, `£`, `¥`, `₹`) and thousand commas (`"$1,499.50"` $\rightarrow$ `1499.50`).
- **Date Standardization**: Heterogeneous dates (`MM/DD/YYYY`, `DD-MM-YYYY`) are converted to standard ISO `YYYY-MM-DD`.
- **Phone & Email Validation**: Enforces RFC 5322 email patterns and international phone number constraints.
- **Business Math Verification**: Evaluates cross-field formula integrity ($Total = Qty \times Price \times (1 - Disc) + Tax$) within $\pm\$0.05$ rounding tolerance.

### 3. Dual Partitioning & Auditability
- **Clean Validated Dataset**: High-integrity, type-safe dataset ready for data warehouse or SQL ingestion.
- **Exception Register**: Downloadable quarantine log capturing row number, offending field, violation type, severity, raw value, root-cause diagnosis, and actionable fix suggestions.

---

## 🏗️ Architecture & Modules

```
/
├── python_engine/
│   ├── profiler.py            # DatasetProfiler & Domain inference engine
│   ├── recommender.py         # RecommendationEngine for dynamic cleaning rules
│   ├── universal_engine.py    # UniversalDataEngine coordinating row-by-row sanitization
│   ├── cleaner.py             # Whitespace, date, null, and numeric sanitization functions
│   ├── validators.py          # Type casting, regex verification, and range checkers
│   ├── models.py              # Dataclasses and enums for rules, exceptions, and telemetry
│   ├── logger.py              # In-memory and standard logging handlers
│   └── universal_cli.py       # Universal CLI runner for batch profiling and execution
├── data/
│   ├── sample_students.csv    # Benchmark College Student dataset
│   ├── sample_products.csv    # Benchmark Product Inventory dataset
│   ├── sample_employees.csv   # Benchmark Employee HR dataset
│   ├── sample_healthcare.csv  # Benchmark Healthcare Patient dataset
│   └── orders_raw.csv         # Benchmark 100-row E-Commerce Orders dataset
├── tests/
│   ├── test_universal_engine.py # Unit tests for universal domain detection & cleaning
│   ├── test_validators.py       # Validator test suite
│   ├── test_cleaner.py          # Data cleaner unit tests
│   ├── test_deduplication.py    # Deduplication strategy tests
│   └── test_business_rules.py   # Cross-field mathematical verification tests
├── server.ts                  # Express backend proxy mounted with Vite middleware (Port 3000)
└── src/App.tsx                # 6-step modern developer console and data quality dashboard
```

---

## 🚀 Running the Automated Test Suite

Execute all 24 unit and integration tests across all domains:
```bash
python3 -m unittest discover tests/ -v
```
Output:
```
Ran 24 tests in 0.028s
OK
```

---

## 📊 6-Step Workflow

1. **Upload CSV**: Upload custom CSVs or select from 5 diverse domain benchmarks.
2. **Dataset Analysis**: Auto-detects domain, dimensions, column taxonomy, missing percentages, and primary identifiers.
3. **Cleaning Recommendations**: Toggle specific cleaning operations with before-and-after value previews.
4. **Processing Execution**: Sub-20ms deterministic Python 3.10 native pipeline execution.
5. **Validation Invariants**: Separates clean records from quarantined anomalies.
6. **Results & Exports**: Instant 1-click downloads for Clean CSV, Exception Register CSV, and JSON metadata.
