"""
Universal Dataset Profiler & Domain Detector.
Pure Python standard library implementation.
Analyzes column patterns, data distributions, null ratios, uniqueness,
and identifies domain semantics with high-confidence scoring.
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Pre-compiled high-performance regex patterns
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_PATTERN = re.compile(r"^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}$")
DATE_ISO_PATTERN = re.compile(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$")
DATE_SLASH_PATTERN = re.compile(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$")
INTEGER_PATTERN = re.compile(r"^-?\d+$")
FLOAT_PATTERN = re.compile(r"^-?\d+(\.\d+)?$")
CURRENCY_PATTERN = re.compile(r"^[\$€£¥₹]\s*-?\d+(,\d{3})*(\.\d+)?$")

# Domain Semantic Dictionaries
DOMAIN_SIGNATURES: Dict[str, Dict[str, Any]] = {
    "COLLEGE_STUDENT": {
        "title": "College / University Student Data",
        "keywords": [
            "student", "reg", "register", "reg_no", "regno", "roll", "roll_no", "rollno",
            "department", "dept", "year", "semester", "sem", "cgpa", "gpa", "degree",
            "college", "university", "faculty", "course", "major", "campus", "academic",
            "marks", "grade", "hostel", "branch", "batch"
        ],
        "id_keywords": ["reg_no", "regno", "register_no", "register_number", "roll_no", "rollno", "student_id"],
        "default_rules": {
            "name_titlecase": True,
            "strip_spaces": True,
            "validate_email": True,
            "validate_phone": True,
            "preserve_leading_zeros": True,
            "standardize_dept": True,
            "standardize_year": True,
        }
    },
    "EMPLOYEE_HR": {
        "title": "Employee / HR Management Data",
        "keywords": [
            "employee", "emp", "emp_id", "empid", "staff", "staff_id", "salary",
            "designation", "role", "joining_date", "hire_date", "doj", "experience",
            "manager", "hr", "payroll", "allowance", "bonus", "department", "leaves",
            "performance", "job_title", "employment_type"
        ],
        "id_keywords": ["emp_id", "empid", "employee_id", "staff_id"],
        "default_rules": {
            "name_titlecase": True,
            "strip_spaces": True,
            "validate_email": True,
            "validate_salary": True,
            "validate_date": True,
            "preserve_leading_zeros": True,
        }
    },
    "PRODUCT_INVENTORY": {
        "title": "Product & Inventory Data",
        "keywords": [
            "product", "prod", "sku", "product_id", "item", "item_code", "stock",
            "quantity", "qty", "inventory", "price", "unit_price", "cost", "mrp",
            "brand", "supplier", "warehouse", "reorder_level", "category"
        ],
        "id_keywords": ["sku", "product_id", "prod_id", "item_code", "barcode"],
        "default_rules": {
            "clean_currency": True,
            "non_negative_price": True,
            "non_negative_stock": True,
            "standardize_category": True,
            "unique_sku": True,
        }
    },
    "ECOMMERCE_ORDER": {
        "title": "E-Commerce / Order Data",
        "keywords": [
            "order", "order_id", "order_date", "customer", "customer_id", "shipping",
            "discount", "tax", "total_amount", "subtotal", "payment", "payment_status",
            "tracking", "billing", "invoice", "courier"
        ],
        "id_keywords": ["order_id", "invoice_no", "order_number"],
        "default_rules": {
            "clean_currency": True,
            "normalize_dates": True,
            "verify_math_equation": True,
            "unique_order_id": True,
        }
    },
    "HEALTHCARE_PATIENT": {
        "title": "Hospital / Healthcare Patient Data",
        "keywords": [
            "patient", "patient_id", "doctor", "physician", "diagnosis", "disease",
            "hospital", "clinic", "admission_date", "discharge_date", "ward", "bed",
            "blood_group", "prescription", "symptoms", "dosage", "medical"
        ],
        "id_keywords": ["patient_id", "mrn", "uhid", "admission_no"],
        "default_rules": {
            "name_titlecase": True,
            "validate_blood_group": True,
            "normalize_dates": True,
            "preserve_leading_zeros": True,
        }
    },
    "BANKING_FINANCE": {
        "title": "Banking / Financial Transactions",
        "keywords": [
            "account", "account_no", "acc_no", "transaction", "trans_id", "txn_id",
            "balance", "debit", "credit", "amount", "bank", "branch", "ifsc", "swift",
            "cheque", "ledger", "deposit", "withdrawal"
        ],
        "id_keywords": ["txn_id", "trans_id", "transaction_id", "account_no"],
        "default_rules": {
            "clean_currency": True,
            "preserve_leading_zeros": True,
            "normalize_dates": True,
        }
    },
    "ATTENDANCE_LOGISTICS": {
        "title": "Attendance & Delivery Tracking",
        "keywords": [
            "attendance", "in_time", "out_time", "checkin", "checkout", "shift",
            "delivery", "shipment", "waybill", "consignee", "origin", "destination",
            "delivery_status", "status"
        ],
        "id_keywords": ["waybill_no", "tracking_no", "consignment_no", "punch_id"],
        "default_rules": {
            "normalize_dates": True,
            "strip_spaces": True,
        }
    }
}


def normalize_col_name(name: str) -> str:
    """Normalizes column names for semantic matching: 'Student_Reg_No' -> 'student_reg_no'"""
    return re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")


def infer_data_type(sample_values: List[str]) -> Tuple[str, str, Dict[str, Any]]:
    """
    Infers physical and semantic data type from non-empty string samples.
    Returns: (physical_type, semantic_type, details)
    """
    clean_vals = [v.strip() for v in sample_values if v is not None and v.strip() not in ("", "null", "none", "nan", "n/a", "-")]
    if not clean_vals:
        return "string", "empty", {}

    total = len(clean_vals)
    email_matches = sum(1 for v in clean_vals if EMAIL_PATTERN.match(v))
    if email_matches / total >= 0.7:
        return "string", "email", {"format": "RFC5322"}

    phone_matches = sum(1 for v in clean_vals if PHONE_PATTERN.match(v) and len(re.sub(r"\D", "", v)) in (10, 11, 12))
    if phone_matches / total >= 0.7:
        return "string", "phone", {"format": "E.164/National"}

    date_matches = sum(1 for v in clean_vals if DATE_ISO_PATTERN.match(v) or DATE_SLASH_PATTERN.match(v))
    if date_matches / total >= 0.7:
        return "date", "date", {"standard": "ISO-8601"}

    currency_matches = sum(1 for v in clean_vals if CURRENCY_PATTERN.match(v) or ("$" in v or "€" in v or "£" in v or "₹" in v))
    if currency_matches / total >= 0.6:
        return "float", "currency", {"strip_symbol": True}

    int_matches = sum(1 for v in clean_vals if INTEGER_PATTERN.match(v.replace(",", "")))
    if int_matches / total >= 0.8:
        # Check if leading zero exists (e.g. "00421" or "0123") -> should be preserved as identifier string!
        has_leading_zero = any(len(v) > 1 and v.startswith("0") for v in clean_vals)
        if has_leading_zero:
            return "string", "zero_padded_identifier", {"preserve_zeros": True}
        return "integer", "integer", {}

    float_matches = sum(1 for v in clean_vals if FLOAT_PATTERN.match(v.replace(",", "")))
    if float_matches / total >= 0.8:
        return "float", "decimal", {}

    # Check for categorical / enum
    unique_vals = set(clean_vals)
    if len(unique_vals) <= min(15, total // 2 + 1) and total >= 6:
        return "string", "category", {"distinct_values": sorted(list(unique_vals))[:10]}

    return "string", "text", {}


class DatasetProfiler:
    """
    Intelligent profiler that reads any tabular CSV, analyzes columns,
    infers domain, flags potential primary identifiers, and calculates data quality scores.
    """

    def __init__(self, headers: List[str], records: List[Dict[str, str]]):
        self.headers = headers
        self.records = records
        self.total_rows = len(records)
        self.total_cols = len(headers)

    def analyze(self) -> Dict[str, Any]:
        """Performs full statistical, structural, and semantic profile."""
        columns_profile: List[Dict[str, Any]] = []
        domain_scores: Dict[str, float] = {k: 0.0 for k in DOMAIN_SIGNATURES}
        potential_identifiers: List[str] = []
        total_missing = 0
        total_cells = self.total_rows * self.total_cols if self.total_rows > 0 else 1

        for col in self.headers:
            col_norm = normalize_col_name(col)
            values = [r.get(col, "") for r in self.records]

            # Missing detection
            missing_count = sum(1 for v in values if v is None or str(v).strip().lower() in ("", "null", "none", "nan", "n/a", "na", "-"))
            total_missing += missing_count
            missing_pct = round((missing_count / self.total_rows * 100), 2) if self.total_rows > 0 else 0.0

            # Uniqueness
            clean_values = [str(v).strip() for v in values if v is not None and str(v).strip() != ""]
            unique_count = len(set(clean_values))
            unique_pct = round((unique_count / len(clean_values) * 100), 2) if clean_values else 0.0

            # Type Inference
            sample = clean_values[:100]
            physical_type, semantic_type, details = infer_data_type(sample)

            # Check if potential ID
            is_potential_id = False
            if (unique_pct >= 90.0 and len(clean_values) >= max(3, self.total_rows * 0.7)) or any(
                id_word in col_norm for dom in DOMAIN_SIGNATURES.values() for id_word in dom["id_keywords"]
            ):
                is_potential_id = True
                potential_identifiers.append(col)

            # Domain scoring contribution
            for dom_key, dom_info in DOMAIN_SIGNATURES.items():
                for kw in dom_info["keywords"]:
                    if kw in col_norm:
                        domain_scores[dom_key] += 2.0
                for id_kw in dom_info["id_keywords"]:
                    if id_kw in col_norm:
                        domain_scores[dom_key] += 4.0

            # Add to column profiles
            columns_profile.append({
                "column_name": col,
                "normalized_name": col_norm,
                "physical_type": physical_type,
                "semantic_type": semantic_type,
                "is_potential_identifier": is_potential_id,
                "missing_count": missing_count,
                "missing_percentage": missing_pct,
                "unique_count": unique_count,
                "unique_percentage": unique_pct,
                "sample_values": clean_values[:3],
                "details": details,
            })

        # Determine Winning Domain
        sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
        top_domain_key, top_score = sorted_domains[0] if sorted_domains else ("GENERAL_TABULAR", 0.0)

        if top_score < 3.0:
            domain_key = "GENERAL_CUSTOM"
            domain_title = "Custom / General Tabular Dataset"
            domain_confidence = 65.0
        else:
            domain_key = top_domain_key
            domain_title = DOMAIN_SIGNATURES[top_domain_key]["title"]
            domain_confidence = min(98.0, 70.0 + (top_score * 3.5))

        # Duplicate Rows Detection (exact row duplicates)
        seen_rows: Set[str] = set()
        duplicate_rows_count = 0
        for r in self.records:
            row_hash = "|".join(str(r.get(h, "")).strip().lower() for h in self.headers)
            if row_hash in seen_rows:
                duplicate_rows_count += 1
            else:
                seen_rows.add(row_hash)

        # Primary Identifier selection
        primary_identifier = potential_identifiers[0] if potential_identifiers else (self.headers[0] if self.headers else None)

        # Overall Dataset Quality Score (0 to 100)
        missing_penalty = min(40.0, (total_missing / total_cells) * 100.0 * 1.5)
        duplicate_penalty = min(30.0, (duplicate_rows_count / max(1, self.total_rows)) * 100.0 * 1.2)
        base_score = max(10.0, round(100.0 - missing_penalty - duplicate_penalty, 1))

        return {
            "total_rows": self.total_rows,
            "total_columns": self.total_cols,
            "headers": self.headers,
            "domain_key": domain_key,
            "domain_title": domain_title,
            "domain_confidence_pct": round(domain_confidence, 1),
            "primary_identifier": primary_identifier,
            "potential_identifiers": potential_identifiers,
            "total_missing_cells": total_missing,
            "missing_cells_percentage": round((total_missing / total_cells) * 100.0, 2),
            "duplicate_rows_count": duplicate_rows_count,
            "data_quality_score": base_score,
            "columns": columns_profile,
        }
