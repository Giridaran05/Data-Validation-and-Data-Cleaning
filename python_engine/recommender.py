"""
Intelligent Dynamic Recommender & Rules Generator.
Generates tailored cleaning and validation operations based on inferred domain,
column semantic types, null ratios, and identifier constraints.
"""

from typing import Any, Dict, List


class RecommendationEngine:
    """
    Evaluates dataset profile and outputs actionable, user-configurable
    cleaning operations and validation rules with before-and-after previews.
    """

    @classmethod
    def generate_recommendations(
        cls,
        profile: Dict[str, Any],
        sample_records: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        recommendations: List[Dict[str, Any]] = []
        domain_key = profile.get("domain_key", "GENERAL_CUSTOM")
        columns = profile.get("columns", [])
        primary_id = profile.get("primary_identifier")

        # 1. Exact Duplicate Row Suppress Recommendation
        dup_count = profile.get("duplicate_rows_count", 0)
        if dup_count > 0:
            recommendations.append({
                "id": "REC_DEDUP_EXACT",
                "category": "DEDUPLICATION",
                "name": "Deduplicate Exact Row Matches",
                "affected_column": "ALL_COLUMNS",
                "description": f"Detected {dup_count} identical duplicate row(s). Keep first occurrence and purge redundant copies.",
                "affected_records": dup_count,
                "severity": "WARNING",
                "enabled": True,
                "preview": {"before": f"{dup_count} duplicate rows", "after": "Unique records preserved"},
            })

        # 2. Primary Key Uniqueness Recommendation
        if primary_id:
            recommendations.append({
                "id": f"REC_PK_{primary_id}",
                "category": "IDENTIFIER_INTEGRITY",
                "name": f"Enforce Unique Identifier on [{primary_id}]",
                "affected_column": primary_id,
                "description": f"Treat [{primary_id}] as the canonical primary identifier. Flag duplicate IDs or missing values into the Exception Register.",
                "affected_records": profile.get("duplicate_rows_count", 0) or 1,
                "severity": "CRITICAL",
                "enabled": True,
                "preview": {"before": "Repeated or empty IDs", "after": "Unique verified entity key"},
            })

        # 3. Column Specific Recommendations
        for col_info in columns:
            col_name = col_info["column_name"]
            norm_name = col_info["normalized_name"]
            sem_type = col_info["semantic_type"]
            phys_type = col_info["physical_type"]
            missing_count = col_info["missing_count"]

            # Missing value handling
            if missing_count > 0:
                is_id = col_name == primary_id or col_info.get("is_potential_identifier")
                recommendations.append({
                    "id": f"REC_NULL_{col_name}",
                    "category": "MISSING_DATA",
                    "name": f"Missing Value Quarantine on [{col_name}]",
                    "affected_column": col_name,
                    "description": f"Found {missing_count} empty / null value(s) in [{col_name}]. " + (
                        "Mandatory identifier cannot be null — will be quarantined." if is_id else "Flag in Exception Register."
                    ),
                    "affected_records": missing_count,
                    "severity": "CRITICAL" if is_id else "WARNING",
                    "enabled": True,
                    "preview": {"before": "NULL / Empty / N/A", "after": "Isolated in Exception Register"},
                })

            # Email Normalization & Validation
            if sem_type == "email" or "email" in norm_name:
                # Find a sample value to demonstrate preview
                sample_val = col_info["sample_values"][0] if col_info["sample_values"] else "user@sample.com"
                recommendations.append({
                    "id": f"REC_EMAIL_{col_name}",
                    "category": "FORMAT_NORMALIZATION",
                    "name": f"Standardize & Validate Email Format on [{col_name}]",
                    "affected_column": col_name,
                    "description": "Strip whitespace, convert to canonical lowercase, and quarantine non-compliant RFC 5322 addresses.",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "INFO",
                    "enabled": True,
                    "preview": {
                        "before": f"  {sample_val.upper()}  ",
                        "after": sample_val.lower().strip()
                    },
                })

            # Date Standardization
            if sem_type == "date" or "date" in norm_name or "dob" in norm_name or "doj" in norm_name:
                sample_val = col_info["sample_values"][0] if col_info["sample_values"] else "03/15/2026"
                recommendations.append({
                    "id": f"REC_DATE_{col_name}",
                    "category": "STANDARDIZATION",
                    "name": f"Normalize Dates to ISO-8601 on [{col_name}]",
                    "affected_column": col_name,
                    "description": "Standardize heterogeneous date formats (MM/DD/YYYY, DD-MM-YYYY) into ISO YYYY-MM-DD.",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "INFO",
                    "enabled": True,
                    "preview": {
                        "before": "03/15/2026 or 15-03-2026",
                        "after": "2026-03-15"
                    },
                })

            # Currency & Financial Numbers
            if sem_type == "currency" or any(w in norm_name for w in ("price", "cost", "salary", "amount", "total", "balance", "fee")):
                recommendations.append({
                    "id": f"REC_CURRENCY_{col_name}",
                    "category": "NUMERIC_CLEANING",
                    "name": f"Sanitize Currency Symbols on [{col_name}]",
                    "affected_column": col_name,
                    "description": "Strip currency symbols ($ , € , £ , ¥ , ₹) and thousands separator commas to yield pure decimal floats.",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "INFO",
                    "enabled": True,
                    "preview": {
                        "before": "$1,499.50",
                        "after": "1499.50"
                    },
                })

            # Phone numbers
            if sem_type == "phone" or any(w in norm_name for w in ("phone", "mobile", "contact", "cell")):
                recommendations.append({
                    "id": f"REC_PHONE_{col_name}",
                    "category": "PHONE_VALIDATION",
                    "name": f"Normalize & Validate Phone Format on [{col_name}]",
                    "affected_column": col_name,
                    "description": "Validate 10-12 digit standard phone numbers, strip non-numeric punctuation (except optional leading +).",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "WARNING",
                    "enabled": True,
                    "preview": {
                        "before": "+1 (555) 019-2834",
                        "after": "+15550192834"
                    },
                })

            # Names (Student, Employee, Customer)
            if any(w in norm_name for w in ("name", "first_name", "last_name", "full_name", "student_name", "employee_name")):
                recommendations.append({
                    "id": f"REC_NAME_{col_name}",
                    "category": "TEXT_NORMALIZATION",
                    "name": f"Titlecase & Trim Name on [{col_name}]",
                    "affected_column": col_name,
                    "description": "Remove unnecessary leading/trailing whitespace and capitalize words neatly without altering identity.",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "INFO",
                    "enabled": True,
                    "preview": {
                        "before": "  SARAH  connor  ",
                        "after": "Sarah Connor"
                    },
                })

            # Preserve Leading Zeros on Register Numbers or Zero-Padded IDs
            if sem_type == "zero_padded_identifier" or any(w in norm_name for w in ("reg_no", "regno", "roll_no", "rollno", "emp_id", "postal", "zip")):
                recommendations.append({
                    "id": f"REC_ZEROS_{col_name}",
                    "category": "PRESERVATION",
                    "name": f"Preserve Leading Zeros on Identifier [{col_name}]",
                    "affected_column": col_name,
                    "description": "Ensure numeric identifiers with leading zeros (e.g. 00421) are preserved as exact text and not truncated by float casting.",
                    "affected_records": len(col_info["sample_values"]),
                    "severity": "INFO",
                    "enabled": True,
                    "preview": {
                        "before": "00421 (as text)",
                        "after": "00421 (preserved)"
                    },
                })

        # 4. Domain-specific additions
        if domain_key == "PRODUCT_INVENTORY":
            recommendations.append({
                "id": "REC_NON_NEGATIVE_STOCK",
                "category": "BUSINESS_RULE",
                "name": "Assert Non-Negative Stock & Price",
                "affected_column": "price, quantity",
                "description": "Detect and quarantine negative inventory quantities or negative price anomalies.",
                "affected_records": 1,
                "severity": "CRITICAL",
                "enabled": True,
                "preview": {"before": "price: -15.00", "after": "Quarantined in Exception Register"},
            })

        elif domain_key == "ECOMMERCE_ORDER":
            recommendations.append({
                "id": "REC_MATH_INTEGRITY",
                "category": "BUSINESS_RULE",
                "name": "Verify Cross-Field Invoiced Total Formula",
                "affected_column": "total_amount",
                "description": "Verify calculation: total_amount = qty * price * (1 - discount) + tax (tolerance ±$0.05).",
                "affected_records": 1,
                "severity": "CRITICAL",
                "enabled": True,
                "preview": {"before": "Mismatched total amount", "after": "Audit exception logged"},
            })

        return recommendations
