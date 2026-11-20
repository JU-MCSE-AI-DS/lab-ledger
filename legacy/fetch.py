import os
import sys
import pandas as pd
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# --- CONFIGURATION ---
load_dotenv()
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
HEADERS = ["Roll No.", "Work Done"]

def get_credentials():
    """Handles OAuth2 token extraction and refreshing."""
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return creds

def get_service(creds):
    """Builds the Google Sheets API service."""
    return build('sheets', 'v4', credentials=creds)

def fetch_main_title(service):
    """Fetches the main title of the sheet"""
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    return spreadsheet['properties']['title']

def fetch_all_as_dfs(service):
    """Fetches all sheets and returns a dict of DataFrames."""
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    sheet_names = [s['properties']['title'] for s in spreadsheet.get('sheets', [])]
    
    df_dict = {}
    for name in sheet_names:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=name
        ).execute()
        values = result.get('values', [])
        
        if not values:
            df_dict[name] = pd.DataFrame()
        else:
            # First row is header
            df_dict[name] = pd.DataFrame(values[1:], columns=values[0])
    return df_dict

def apply_formatting(service, sheet_id):
    """
    Enforces JetBrains Mono 10, Centering, and Bold Headers.
    Applied to the entire sheet to ensure consistency after updates.
    """
    requests = [
        # 1. Global Style: Center alignment + JetBrains Mono Size 10
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id},
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "textFormat": {
                            "fontFamily": "JetBrains Mono",
                            "fontSize": 10
                        }
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)"
            }
        },
        # 2. Header Style: Bold (Row 0)
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True}
                    }
                },
                "fields": "userEnteredFormat.textFormat.bold"
            }
        }
    ]
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID, 
        body={'requests': requests}
    ).execute()

def get_sheet_id_by_name(service, name):
    """Helper to find a sheet's numerical ID by its string name."""
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    for s in spreadsheet.get('sheets', []):
        if s['properties']['title'] == name:
            return s['properties']['sheetId']
    return None

def ensure_sheet_and_append(service, target_sheet_name, row_data):
    """Checks for sheet existence, creates if missing, appends data, then formats."""
    sheet_id = get_sheet_id_by_name(service, target_sheet_name)
    
    if sheet_id is None:
        # Create sheet and add headers
        add_body = {'requests': [{'addSheet': {'properties': {'title': target_sheet_name}}}]}
        res = service.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=add_body).execute()
        sheet_id = res['replies'][0]['addSheet']['properties']['sheetId']
        
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{target_sheet_name}!A1",
            valueInputOption="RAW",
            body={"values": [HEADERS]}
        ).execute()
    
    # Append the data
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{target_sheet_name}!A1",
        valueInputOption="RAW",
        body={"values": [row_data]}
    ).execute()

    # Re-apply formatting to ensure the new row matches the style
    apply_formatting(service, sheet_id)

def main():
    if not SPREADSHEET_ID:
        print("Error: SPREADSHEET_ID not found in .env file.")
        return

    creds = get_credentials()
    service = get_service(creds)
    
    # Fetch current state to show user what we have
    main_title = fetch_main_title(service)
    data_map = fetch_all_as_dfs(service)
    print(f"Connected to {main_title}.\nExisting sheets: {list(data_map.keys())}")

    print("\nInput format: SheetName, RollNo, WorkDone")
    line = sys.stdin.readline().strip()
    
    if not line:
        return

    parts = [p.strip() for p in line.split(',')]
    if len(parts) < 3:
        print("Invalid input. Need SheetName, RollNo, and WorkDone.")
        return

    target_sheet = parts[0]
    row_values = parts[1:] # Takes Roll No and Work Done

    ensure_sheet_and_append(service, target_sheet, row_values)
    print(f"Done! '{target_sheet}' updated and formatted.")

if __name__ == "__main__":
    main()
