import argparse
import pandas as pd
import re
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

def format_date_string(date_str):
    """Converts ddmmyyyy to dd/mm/yyyy."""
    date_str = str(date_str).strip()
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:2]}/{date_str[2:4]}/{date_str[4:]}"
    return date_str

def parse_work_done(work_str):
    results = []
    if pd.isna(work_str) or str(work_str).strip() == "":
        return results
    
    pattern = r'(\d+)\.\{([^}]+)\}|(\d+)\.(\d+)'
    
    matches = re.finditer(pattern, str(work_str))
    
    for match in matches:
        # Check if it's the bracketed format: 4.{1,2,3}
        if match.group(1):
            assign_num = int(match.group(1))
            inner_content = match.group(2)
            
            sub_parts = inner_content.split(',')
            for sub in sub_parts:
                sub = sub.strip()
                if '-' in sub:
                    range_match = re.match(r'(\d+)-(\d+)', sub)
                    if range_match:
                        start, end = int(range_match.group(1)), int(range_match.group(2))
                        for p in range(start, end + 1):
                            results.append((assign_num, p))
                elif sub.isdigit():
                    results.append((assign_num, int(sub)))
        
        # Check if it's the individual format: 4.1
        elif match.group(3):
            assign_num = int(match.group(3))
            problem_num = int(match.group(4))
            results.append((assign_num, problem_num))
            
    return results

def main():
    parser = argparse.ArgumentParser(description="Expand complex assignment logs with filtering.")
    parser.add_argument("input", help="Input .xlsx file path")
    parser.add_argument("output", help="Output .xlsx file path")
    parser.add_argument("--show-all", action="store_true", 
                        help="Include all roll numbers found in input, even those with no work recorded.")
    args = parser.parse_args()

    # Data structures
    data = {} # assignment -> roll_no -> problem -> date
    active_roll_nos = set() # Roll numbers that actually have work
    total_roll_nos = set()  # Every roll number seen in the input

    # 1. Process Input
    xl = pd.ExcelFile(args.input)
    for sheet_name in xl.sheet_names:
        formatted_date = format_date_string(sheet_name)
        df = xl.parse(sheet_name)
        df.columns = [str(c).strip() for c in df.columns]
        
        for _, row in df.iterrows():
            roll_no = row['Roll No.']
            total_roll_nos.add(roll_no)
            
            expanded = parse_work_done(row.get('Work Done', ''))
            if expanded:
                active_roll_nos.add(roll_no)
                for a_id, p_id in expanded:
                    data.setdefault(a_id, {}).setdefault(roll_no, {})[p_id] = formatted_date

    # 2. Setup Workbook & Styles
    wb = Workbook()
    wb.remove(wb.active)

    jb_font = Font(name='JetBrains Mono', size=10)
    jb_font_bold = Font(name='JetBrains Mono', size=10, bold=True)
    center_align = Alignment(horizontal='center', vertical='center')
    red_fill = PatternFill(start_color='FADAD8', end_color='FADAD8', fill_type='solid') 
    green_fill = PatternFill(start_color='D9EAD3', end_color='D9EAD3', fill_type='solid') 

    # Filter roll numbers based on user flag
    final_roll_list = sorted(list(total_roll_nos if args.show_all else active_roll_nos))

    # 3. Create Assignment Sheets
    for a_id in sorted(data.keys()):
        ws = wb.create_sheet(title=f"Assignment {a_id}")
        
        probs = set()
        for r in data[a_id]:
            probs.update(data[a_id][r].keys())
        sorted_probs = sorted(list(probs))

        # Headers
        headers = ["Roll No."] + [f"{a_id}.{p}" for p in sorted_probs]
        for c_idx, val in enumerate(headers, 1):
            cell = ws.cell(row=1, column=c_idx, value=val)
            cell.font = jb_font_bold
            cell.alignment = center_align
        ws.row_dimensions[1].height = 22

        # Data Rows
        for r_idx, r_no in enumerate(final_roll_list, 2):
            # Roll No Cell
            c_rn = ws.cell(row=r_idx, column=1, value=r_no)
            c_rn.font = jb_font
            c_rn.alignment = center_align
            
            for c_idx, p_id in enumerate(sorted_probs, 2):
                date_val = data[a_id].get(r_no, {}).get(p_id, "-")
                cell = ws.cell(row=r_idx, column=c_idx, value=date_val)
                cell.font = jb_font
                cell.alignment = center_align
                cell.fill = red_fill if date_val == "-" else green_fill
            
            ws.row_dimensions[r_idx].height = 18

        # 4. Column Resizing
        for col in ws.columns:
            max_length = 0
            column_letter = get_column_letter(col[0].column)
            for cell in col:
                val_len = len(str(cell.value)) if cell.value else 0
                if val_len > max_length: max_length = val_len
            ws.column_dimensions[column_letter].width = max_length + 6

    wb.save(args.output)
    print(f"File generated: {args.output}")

if __name__ == "__main__":
    main()
