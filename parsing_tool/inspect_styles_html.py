import re
from pathlib import Path

FILE_PATH = Path("data/styles")

def inspect_styles():
    content = FILE_PATH.read_text(encoding="utf-8")
    
    # Simple regex to find headers
    # <th ...>Name</th>
    headers = re.findall(r'<th[^>]*>(.*?)</th>', content)
    print("Headers found:", headers[:15]) # Print first 15 headers
    
    # Find rows
    # <tr ...>...</tr>
    rows = re.findall(r'<tr.*?>(.*?)</tr>', content)
    print(f"Total rows: {len(rows)}")
    
    # Inspect ALL rows
    print("\n--- Row Identifiers ---")
    for i, row in enumerate(rows):
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row)
        if cells:
            raw_name = cells[0]
            clean_name = re.sub(r'<[^>]+>', '', raw_name).strip()
            if clean_name:
                print(f"Row {i}: {clean_name}")

if __name__ == "__main__":
    inspect_styles()
