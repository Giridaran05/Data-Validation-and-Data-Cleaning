"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: dataset_generator.py
Generates a realistic synthetic e-commerce and retail transactions dataset
with controlled statistical distribution of valid records and real-world anomalies.
"""

import csv
import json
import os
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List


def generate_synthetic_dataset(
    record_count: int = 100,
    seed: int = 2026,
    output_csv: str = "data/orders_raw.csv",
    output_json: str = "data/orders_raw.json"
) -> List[Dict[str, Any]]:
    """
    Generates a realistic e-commerce order dataset containing both valid transactions
    and targeted data anomalies for validating the data engine.
    """
    random.seed(seed)

    first_names = ["Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Pat", "Riley", "Cameron", "Jamie", "Elena", "Marcus", "Priya", "Chen", "Aisha", "Liam"]
    last_names = ["Smith", "Patel", "Garcia", "Tanaka", "Wong", "Johnson", "Mueller", "Kim", "Santos", "O'Connor", "Dubois", "Schmidt"]
    domains = ["enterprise.com", "apexcloud.io", "globalsupply.org", "techcorp.net", "innovate.co"]
    categories = ["Electronics", "Apparel", "Home & Kitchen", "Health & Beauty", "Books", "Office Supplies"]
    countries = ["US", "CA", "UK", "DE", "FR", "SG", "AU"]

    records: List[Dict[str, Any]] = []
    base_date = datetime(2026, 10, 1)

    for i in range(1, record_count + 1):
        order_num = 10000 + i
        order_id = f"ORD-2026-{order_num}"
        cust_id = f"CUST-{random.randint(1000, 9999)}"
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        email = f"{fn.lower()}.{ln.lower()}@{random.choice(domains)}"
        order_date = (base_date + timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d")

        cat_prefix = {
            "Electronics": "ELC",
            "Apparel": "APP",
            "Home & Kitchen": "HMK",
            "Health & Beauty": "HLB",
            "Books": "BOK",
            "Office Supplies": "OFC",
        }
        category = random.choice(categories)
        sku = f"{cat_prefix[category]}-{random.randint(1000, 9999)}"
        qty = random.randint(1, 15)
        unit_price = round(random.uniform(12.50, 480.00), 2)
        discount_pct = round(random.choice([0.0, 0.05, 0.10, 0.15, 0.20, 0.25]), 2)
        subtotal = qty * unit_price * (1.0 - discount_pct)
        tax_amount = round(subtotal * 0.0825, 2)
        total_amount = round(subtotal + tax_amount, 2)
        status = random.choice(["PAID", "PAID", "PAID", "PENDING", "REFUNDED"])
        country = random.choice(countries)
        postal_code = f"{random.randint(10000, 99999)}"

        rec: Dict[str, Any] = {
            "order_id": order_id,
            "customer_id": cust_id,
            "customer_email": email,
            "order_date": order_date,
            "product_sku": sku,
            "category": category,
            "quantity": qty,
            "unit_price": unit_price,
            "discount_pct": discount_pct,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "payment_status": status,
            "shipping_country": country,
            "postal_code": postal_code,
        }
        records.append(rec)

    # -------------------------------------------------------------
    # Inject Controlled Real-World Anomalies safely
    # -------------------------------------------------------------
    def safe_set(idx: int, field_name: str, value: Any):
        if idx < len(records):
            records[idx][field_name] = value

    safe_set(4, "customer_id", "")
    safe_set(9, "order_date", "null")
    safe_set(14, "customer_email", "marcus.smith@@broken..net")
    safe_set(19, "quantity", "three")
    safe_set(24, "unit_price", -45.00)
    safe_set(29, "discount_pct", 0.95)
    safe_set(34, "product_sku", "INVALID_SKU_#99")
    safe_set(39, "category", "Cryptocurrency Token")
    safe_set(44, "total_amount", 9999.99)
    safe_set(49, "order_date", "2029-12-31")
    safe_set(54, "order_id", "ORD-2026-10002")
    if 59 < len(records):
        records[59]["payment_status"] = "PAID"
        records[59]["total_amount"] = 0.00
    safe_set(64, "customer_email", "   ALEX.JOHNSON@ENTERPRISE.COM   ")
    safe_set(64, "product_sku", "  ELC-4921  ")
    if 69 < len(records):
        records[69]["unit_price"] = "$120.00"
        records[69]["total_amount"] = round(float(records[69]["quantity"]) * 120.00 * (1 - float(records[69]["discount_pct"])) + float(records[69]["tax_amount"]), 2)
    safe_set(74, "order_id", "ORD-2026-10008")

    # Export CSV
    os.makedirs(os.path.dirname(os.path.abspath(output_csv)), exist_ok=True)
    with open(output_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    # Export JSON
    os.makedirs(os.path.dirname(os.path.abspath(output_json)), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    return records


if __name__ == "__main__":
    recs = generate_synthetic_dataset(100)
    print(f"Generated {len(recs)} synthetic order records at data/orders_raw.csv")
