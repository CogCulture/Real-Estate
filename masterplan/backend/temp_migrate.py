import sqlite3
import os
db_path = os.path.join("d:\\RE 2.0\\masterplan\\backend", "masterplan.db")
conn = sqlite3.connect(db_path)
try:
    conn.execute("ALTER TABLE projects ADD COLUMN features TEXT;")
    conn.commit()
    print("Column 'features' added successfully.")
except sqlite3.OperationalError as e:
    print("Column might already exist or error:", e)
conn.close()
