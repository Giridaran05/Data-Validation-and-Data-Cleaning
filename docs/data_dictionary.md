# Data Dictionary: E-Commerce Orders Dataset
**Project**: DIT Internship 2026 - TASK 07 Data Cleaning & Validation Engine  
**Dataset Identifier**: `ecommerce_orders`  
**Classification**: Internal Financial & Operational Data  
**Schema Version**: 1.0.0  

---

## 1. Schema Overview

| Field Name | Physical Type | Logical Type | Nullable? | Primary Key? | Validation Format / Pattern | Business Constraint |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `order_id` | String (Varchar) | Unique Order Identifier | **No** | **Yes** | `^ORD-\d{4}-\d{5}$` (e.g. `ORD-2026-10001`) | Must be unique across all batches; deduplication key. |
| `customer_id` | String (Varchar) | Customer Master ID | **No** | No | `^CUST-\d{4,6}$` (e.g. `CUST-4912`) | Must correspond to registered customer profile. |
| `customer_email` | String (Varchar) | Customer Contact Email | **No** | No | RFC 5322 Standard Email Regex | Normalized to lowercase; stripped of leading/trailing spaces. |
| `order_date` | String / Date | Transaction Timestamp | **No** | No | ISO 8601 (`YYYY-MM-DD`) | Cannot be in future; cannot precede year 2020. |
| `product_sku` | String (Varchar) | Stock Keeping Unit | **No** | No | `^[A-Z]{3}-\d{4}$` (e.g. `ELC-1042`) | Category prefix must match product catalog. |
| `category` | String (Enum) | Merchandise Category | **No** | No | Allowed Enum Values | `['Electronics', 'Apparel', 'Home & Kitchen', 'Health & Beauty', 'Books', 'Office Supplies']` |
| `quantity` | Integer | Quantity Purchased | **No** | No | Positive Integer | `1 <= quantity <= 500` |
| `unit_price` | Float (Decimal) | Unit Price (USD) | **No** | No | Non-negative Decimal | `$0.01 <= unit_price <= $10,000.00` |
| `discount_pct` | Float (Decimal) | Promotional Discount | **No** | No | Float between 0.0 and 1.0 | `0.00 <= discount_pct <= 0.70` (Max 70% discount) |
| `tax_amount` | Float (Decimal) | State & Local Sales Tax | **No** | No | Non-negative Decimal | `>= 0.00` |
| `total_amount` | Float (Decimal) | Final Invoiced Total | **No** | No | Non-negative Decimal | Cross-field formula: `round(qty * price * (1-disc), 2) + tax` (tolerance $\pm$ $0.05). |
| `payment_status` | String (Enum) | Payment State | **No** | No | Allowed Enum Values | `['PAID', 'PENDING', 'REFUNDED', 'FAILED']`. If `PAID`, `total_amount` must be `> $0.00`. |
| `shipping_country` | String (Varchar) | Destination Country | **No** | No | ISO-3166-1 alpha-2 (`^[A-Z]{2}$`) | 2-letter uppercase country code (e.g. `US`, `DE`, `SG`). |
| `postal_code` | String (Varchar) | Shipping Postal Code | **No** | No | Non-empty String | Alphanumeric or numeric standard zip/postal code. |

---

## 2. Field Specifications & Anomaly Signatures

### 2.1 `order_id`
- **Purpose**: System-wide unique transaction primary key.
- **Valid Example**: `ORD-2026-10042`
- **Anomaly Signatures**:
  - Null or whitespace: `""`, `null`
  - Bad pattern: `ORDER_10042`, `10042`
  - Duplicate: Same `order_id` appearing in multiple rows.

### 2.2 `customer_email`
- **Purpose**: Customer receipt delivery and account linking.
- **Valid Example**: `jordan.patel@enterprise.com`
- **Auto-Correction**: Strip spaces, lowercase conversion (`  ALEX@DOMAIN.COM  ` $\rightarrow$ `alex@domain.com`).
- **Anomaly Signatures**:
  - Syntax failure: `john@@example..com`, `no_at_symbol.com`, `user@domain` (missing TLD).

### 2.3 `order_date`
- **Purpose**: Financial accounting period allocation.
- **Valid Example**: `2026-10-18`
- **Auto-Correction**: Parse and convert alternative date representations (`10/18/2026` $\rightarrow$ `2026-10-18`).
- **Anomaly Signatures**:
  - Temporal violation: Future dates (e.g. `2029-12-31`).
  - Unparseable date strings: `2026-99-99`, `yesterday`.

### 2.4 `unit_price`, `quantity`, `discount_pct`, `total_amount`
- **Purpose**: Billing and general ledger calculations.
- **Auto-Correction**: Currency symbols and formatted numbers (`$1,250.00` $\rightarrow$ `1250.00`; `15%` $\rightarrow$ `0.15`).
- **Anomaly Signatures**:
  - Negative values (`unit_price = -45.00`).
  - Out of bounds discount (`discount_pct = 0.95` when company max cap is 0.70).
  - Cross-field discrepancy: If invoice reports `total_amount = $9,999.99` but calculation results in `$128.45`, row is quarantined to prevent accounting fraud or system drift.

---

## 3. Exception Register Format

When a record fails one or more validation checks, it is rejected from the clean dataset and routed to the Exception Register with the following schema:

| Column | Description |
| :--- | :--- |
| `row_number` | 1-based original line number in the source file |
| `record_id` | Identifier (`order_id`) or `ROW_X` fallback |
| `field_name` | Name of the offending column or rule |
| `rule_id` | Identifier of the rule violated (e.g. `REQ_CUSTOMER_ID`, `BR_01_CALCULATION_INTEGRITY`) |
| `violation_type` | Categorical failure code (`TYPE_CAST_FAILURE`, `REGEX_FORMAT_MISMATCH`, `DUPLICATE_PRIMARY_KEY`) |
| `severity` | Severity tier: `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `raw_value` | Exact value found in input before rejection |
| `expected` | Description or pattern of what was expected |
| `error_message` | Human-readable explanation of why the check failed |
| `timestamp` | UTC ISO-8601 audit timestamp of validation execution |
