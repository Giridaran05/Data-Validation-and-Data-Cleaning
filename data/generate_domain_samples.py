import csv

# 1. College Student Dataset with typical real-world errors
STUDENTS_CSV = """reg_no,student_name,email,department,year,phone_number,cgpa
00101,  arun kumar  ,arun@university.edu,Computer Science,3,+91-9876543210,8.75
00102,priya r,priya.r@@university,Electronics,2,9876543211,9.10
00103,MOHAMMED FAIZAL,faizal@college.edu,Mechanical,4,9876543212,7.80
00104,SNEHA SHARMA,sneha@university.edu,Computer Science,1,9876543213,8.90
00101,arun kumar,arun@university.edu,Computer Science,3,9876543210,8.75
00105,Karthik M,karthik@college.edu,Civil,2,98765,6.50
,Deepa S,deepa@university.edu,Information Technology,3,9876543215,8.20
00107,Vikram Patel,vikram.p@college.edu,Electrical,4,9876543216,-1.50
"""

# 2. Product Inventory Dataset with negative prices and stocks
PRODUCTS_CSV = """product_id,product_name,category,price,stock_quantity,supplier
PRD-101,Wireless Ergonomic Mouse,Electronics,$29.99,150,LogiTech Supply
PRD-102,USB-C Fast Charging Cable,Electronics,12.50,500,Anker Direct
PRD-103,Organic Cotton T-Shirt,Apparel,$ 19.99,80,EcoWear Global
PRD-104,Stainless Steel Water Bottle,Home & Kitchen,$24.00,-15,HydroFlask Inc
PRD-105,Bluetooth Noise-Cancelling Headphones,Electronics,-89.99,45,Sony Sound
PRD-106,,Office Supplies,$4.50,200,Stationery Hub
PRD-102,USB-C Fast Charging Cable,Electronics,12.50,500,Anker Direct
PRD-107,Ceramic Coffee Mug,Home & Kitchen,$15.00,0,KitchenCraft
"""

# 3. Employee HR Dataset with salary symbols and unstandardized dates
EMPLOYEES_CSV = """emp_id,employee_name,email,department,salary,joining_date,phone
EMP-001,  ALICE JOHNSON  ,alice@company.com,Engineering,$115,000.00,2021-06-15,+1-555-0101
EMP-002,Robert Chen,robert.chen@@company.com,Finance,95000.00,03/22/2020,555-0102
EMP-003,Maria Garcia,maria@company.com,Human Resources,$82,500.00,15-08-2019,555-0103
EMP-004,David Kim,david.kim@company.com,Engineering,-60000.00,2022-01-10,555-0104
EMP-001,Alice Johnson,alice@company.com,Engineering,115000.00,2021-06-15,555-0101
EMP-005,Emily Davis,emily@company.com,Marketing,$78,000.00,invalid-date,555-0105
,James Wilson,james@company.com,Sales,88000.00,2023-04-01,555-0106
"""

# 4. Healthcare Patient Dataset
HEALTHCARE_CSV = """patient_id,patient_name,age,blood_group,admission_date,doctor_assigned,room_no
PAT-501,Johnathan Doe,45,O+,2026-02-10,Dr. Robert Smith,302-A
PAT-502,Emma Watson,28,A-,02/14/2026,Dr. Sarah Connor,105-B
PAT-503,Michael Brown,-5,B+,2026-02-12,Dr. Alan Grant,201-C
PAT-504,Sarah Jenkins,62,AB+,2026-02-15,Dr. Lisa Cuddy,401-A
PAT-501,Johnathan Doe,45,O+,2026-02-10,Dr. Robert Smith,302-A
,David Miller,51,O-,2026-02-16,Dr. Gregory House,502-B
"""

with open("data/sample_students.csv", "w", encoding="utf-8") as f:
    f.write(STUDENTS_CSV.strip())

with open("data/sample_products.csv", "w", encoding="utf-8") as f:
    f.write(PRODUCTS_CSV.strip())

with open("data/sample_employees.csv", "w", encoding="utf-8") as f:
    f.write(EMPLOYEES_CSV.strip())

with open("data/sample_healthcare.csv", "w", encoding="utf-8") as f:
    f.write(HEALTHCARE_CSV.strip())

print("Created 4 diverse multi-domain CSV datasets in data/")
