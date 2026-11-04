# Project Mentor Guide: Business Problem & Architecture
**DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine**

---

## 1. Business Problem & Executive Context

### The Challenge: "Garbage In, Disaster Out"
In modern enterprise architectures (financial transaction pipelines, cloud data warehouses, ERP synchronization, ML training datasets), data is ingested continuously from heterogeneous sources: third-party payment gateways, CRM integrations, partner batch CSV feeds, and mobile clients.

When upstream systems emit corrupted, partial, or malformed data:
1. **Financial Discrepancy & Revenue Leakage**: Calculation mismatches between line items and reported totals lead to incorrect customer billing, tax miscalculations, and audit penalties.
2. **Downstream Pipeline Crashes**: A single string value (e.g. `"three"`) injected into an integer database column (`quantity`) or a future date crashes analytical ETL batch jobs running in BigQuery, Snowflake, or PostgreSQL.
3. **Data Pollution & Duplicate Billing**: Duplicate primary keys create duplicate charges, inaccurate inventory counts, and distorted executive KPIs.
4. **Compliance Violations**: Failure to enforce format standards violates data privacy (GDPR / CCPA) and financial regulations (BCBS 239).

### Internship Project Objectives (TASK 07)
The DIT Internship team was tasked with engineering an automated, resilient **Data Cleaning and Validation Engine** with zero hardcoded constraints, providing:
- Reusable, parameter-driven schema verification.
- Auto-sanitization (whitespace, casing, null representations, symbol cleaning).
- Strict type casting and format enforcement.
- Cross-field logical and mathematical business rules.
- Deduplication handling with configurable policies (`keep_first`, `keep_last`, `quarantine_all`).
- Separation of outputs: Clean Dataset vs Exception Quarantine Register.
- Full auditability, structured logging, and test suite.

---

## 2. System Architecture

The engine is engineered around a **6-Stage Defensive Pipeline**:

```
[Raw Input: CSV / JSON]
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 1: Schema Ingestion & Header Verification         │
│  - Verify presence of all mandatory columns               │
│  - Abort or quarantine entire batch if schema breached   │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 2: Data Cleansing & Sanitization                  │
│  - Trim leading/trailing whitespace                      │
│  - Standardize null markers ("", "null", "N/A", "None")  │
│  - Normalize casing (lowercase emails, uppercase SKUs)   │
│  - Clean currency symbols ($) and percentages (%)        │
│  - Reformat dates into standard ISO YYYY-MM-DD           │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 3: Field-Level Validation & Casting               │
│  - Check nullability / required presence                 │
│  - Type casting (Integer, Float, Date, Email, Boolean)   │
│  - Regex pattern matching (SKU, Order ID, Country Code)  │
│  - Value range verification (Min/Max thresholds)         │
│  - Categorical Enum membership validation                │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 4: Cross-Field Business Rules Evaluation          │
│  - Math integrity check (qty * unit_price - disc + tax)  │
│  - Temporal validation (order_date <= today)             │
│  - Status logic (PAID orders must have total > $0.00)    │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 5: Deduplication & Collision Management           │
│  - Composite primary key extraction (e.g. order_id)      │
│  - Apply strategy (KEEP_FIRST, KEEP_LAST, QUARANTINE_ALL)│
│  - Route duplicate collisions to Exception Register      │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  STAGE 6: Output Partitioning & Audit Telemetry          │
│  ├── CLEANED DATASET (data/cleaned_orders.csv)           │
│  ├── EXCEPTION REGISTER (data/exception_register.csv)     │
│  └── EXECUTION METRICS (data/engine_summary.json)        │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Why Exception Quarantining Over Silent Discarding?
In junior software development, bad data is often silently discarded with `try...except pass`. In enterprise automation:
- **Every rejected record represents revenue or customer intent**: Silent dropping creates unaccounted financial discrepancies.
- **Root Cause Analysis (RCA)**: By recording the exact line number, column, rule ID, raw value, and error reason in the Exception Register, data engineers can feed anomalies back to upstream service teams for bug fixes.
- **Audit Trails**: Regulators require proof of which records were rejected and under which specific policy.

---

## 4. Verification and Testing Methodology
The validation engine was tested using test-driven principles:
1. **Unit Tests (`tests/test_validators.py`, `tests/test_cleaner.py`)**: Isolated testing of regex patterns, boundary values, null handling, and type casting.
2. **Deduplication Tests (`tests/test_deduplication.py`)**: Validates that collisions are handled predictably under `keep_first`, `keep_last`, and `quarantine_all`.
3. **Business Rule Tests (`tests/test_business_rules.py`)**: Tests math discrepancy tolerance and condition evaluations.
4. **Integration Tests (`tests/test_engine_integration.py`)**: End-to-end batch execution on synthetic file inputs.
