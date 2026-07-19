/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAccessToken } from './firebase';
import { UserAccount, InspectionItem, InspectionRecord, UserRole } from '../types';

export const DEFAULT_SPREADSHEET_ID = '14oVgSCGjkSYZ5xkL8U4bBh-1uos8UQXuz08PWJpCZx4';

// Helper to extract clean spreadsheet ID from full Google Sheets URL if needed
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

// Helper to make API requests to Google Sheets
async function sheetsApiCall(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: any,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google ก่อน');
  }

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}${endpoint}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Sheets API error (${url}):`, errText);
    throw new Error(`Google Sheets API Error: ${response.statusText} (${response.status})`);
  }

  return response.json();
}

// 1. Get spreadsheet metadata and verify/create required sheets (tabs)
export async function initializeSpreadsheet(spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<void> {
  const meta = await sheetsApiCall('', 'GET', undefined, spreadsheetId);
  const existingSheetTitles = meta.sheets?.map((s: any) => s.properties?.title) || [];

  const requiredSheets = ['users', 'item', 'DATA'];
  const missingSheets = requiredSheets.filter((title) => !existingSheetTitles.includes(title));

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((title) => ({
      addSheet: {
        properties: {
          title,
        },
      },
    }));

    // Create missing sheets
    await sheetsApiCall(':batchUpdate', 'POST', { requests }, spreadsheetId);

    // Seed headers for newly created sheets
    for (const title of missingSheets) {
      if (title === 'users') {
        await sheetsApiCall(
          `/values/users!A1:E2?valueInputOption=USER_ENTERED`,
          'PUT',
          {
            values: [
              ['Username', 'Password', 'Role', 'Department', 'FullName'],
              ['admin', 'password', 'admin', 'ความปลอดภัย', 'ผู้จัดการระบบ'],
              ['staff', 'staff123', 'staff', 'ความปลอดภัย', 'เจ้าหน้าที่ปฏิบัติการ'],
              ['general', 'user123', 'ทั่วไป', 'ฝ่ายผลิต', 'พนักงานทั่วไป'],
            ],
          },
          spreadsheetId
        );
      } else if (title === 'item') {
        await sheetsApiCall(
          `/values/item!A1:E7?valueInputOption=USER_ENTERED`,
          'PUT',
          {
            values: [
              ['ID', 'Item Name', 'Category', 'Department', 'Status'],
              ['ITEM001', 'ตรวจสอบถังดับเพลิงอยู่ในสภาพพร้อมใช้งาน แรงดันอยู่ในเกณฑ์ปกติ', 'อุปกรณ์ดับเพลิง', 'ความปลอดภัย', 'Active'],
              ['ITEM002', 'ตรวจสอบทางหนีไฟไม่มีสิ่งกีดขวางและประตูปิด-เปิดได้สะดวก', 'ทางหนีไฟ', 'ความปลอดภัย', 'Active'],
              ['ITEM003', 'ตรวจสอบสายไฟ ปลั๊กไฟ และตู้ควบคุมไฟฟ้าอยู่ในสภาพสมบูรณ์', 'ระบบไฟฟ้า', 'ความปลอดภัย', 'Active'],
              ['ITEM004', 'ตรวจสอบกล่องปฐมพยาบาลมีอุปกรณ์และยาครบถ้วน', 'ปฐมพยาบาล', 'ความปลอดภัย', 'Active'],
              ['ITEM005', 'ตรวจสอบระบบระบายอากาศและพัดลมดูดอากาศทำงานปกติ', 'สภาพแวดล้อม', 'ฝ่ายผลิต', 'Active'],
              ['ITEM006', 'ตรวจสอบความสะอาดของพื้นที่ทำงานและไม่มีคราบน้ำมัน', 'ความสะอาด', 'ฝ่ายผลิต', 'Active'],
            ],
          },
          spreadsheetId
        );
      } else if (title === 'DATA') {
        await sheetsApiCall(
          `/values/DATA!A1:J2?valueInputOption=USER_ENTERED`,
          'PUT',
          {
            values: [
              ['Record ID', 'Date', 'Time', 'Inspector', 'Department', 'Item ID', 'Item Name', 'Status', 'Notes', 'Resolved'],
              ['REC1001', '2026-07-15', '09:30', 'เจ้าหน้าที่ปฏิบัติการ', 'ฝ่ายผลิต', 'ITEM001', 'ตรวจสอบถังดับเพลิงอยู่ในสภาพพร้อมใช้งาน แรงดันอยู่ในเกณฑ์ปกติ', 'ผ่าน', 'ปกติ', 'ใช่'],
            ],
          },
          spreadsheetId
        );
      }
    }
  }
}

// 2. Users CRUD
export async function fetchUsers(spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<UserAccount[]> {
  try {
    const data = await sheetsApiCall('/values/users!A1:E100', 'GET', undefined, spreadsheetId);
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    const users: UserAccount[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0]) {
        users.push({
          username: row[0] || '',
          password: row[1] || '',
          role: (row[2] as UserRole) || 'ทั่วไป',
          department: row[3] || '',
          fullName: row[4] || '',
        });
      }
    }
    return users;
  } catch (err) {
    console.error('Fetch users error:', err);
    return [];
  }
}

export async function saveUsers(users: UserAccount[], spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<void> {
  const values = [['Username', 'Password', 'Role', 'Department', 'FullName']];
  users.forEach((u) => {
    values.push([u.username, u.password || '', u.role, u.department, u.fullName]);
  });

  // Overwrite users range
  await sheetsApiCall(
    `/values/users!A1:E100?valueInputOption=USER_ENTERED`,
    'PUT',
    { values },
    spreadsheetId
  );
}

// 3. Inspection Items CRUD
export async function fetchInspectionItems(spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<InspectionItem[]> {
  try {
    const data = await sheetsApiCall('/values/item!A1:E200', 'GET', undefined, spreadsheetId);
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    const items: InspectionItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0]) {
        items.push({
          id: row[0],
          itemName: row[1] || '',
          category: row[2] || '',
          department: row[3] || '',
          status: (row[4] as 'Active' | 'Inactive') || 'Active',
        });
      }
    }
    return items;
  } catch (err) {
    console.error('Fetch items error:', err);
    return [];
  }
}

export async function saveInspectionItems(items: InspectionItem[], spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<void> {
  const values = [['ID', 'Item Name', 'Category', 'Department', 'Status']];
  items.forEach((item) => {
    values.push([item.id, item.itemName, item.category, item.department, item.status]);
  });

  await sheetsApiCall(
    `/values/item!A1:E200?valueInputOption=USER_ENTERED`,
    'PUT',
    { values },
    spreadsheetId
  );
}

// 4. Inspection Records CRUD
export async function fetchInspectionRecords(spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<InspectionRecord[]> {
  try {
    const data = await sheetsApiCall('/values/DATA!A1:J1000', 'GET', undefined, spreadsheetId);
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    const records: InspectionRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0]) {
        records.push({
          recordId: row[0],
          date: row[1] || '',
          time: row[2] || '',
          inspector: row[3] || '',
          department: row[4] || '',
          itemId: row[5] || '',
          itemName: row[6] || '',
          status: (row[7] as 'ผ่าน' | 'ไม่ผ่าน') || 'ผ่าน',
          notes: row[8] || '',
          resolved: (row[9] as 'ใช่' | 'ไม่' | 'ไม่ระบุ') || 'ไม่ระบุ',
        });
      }
    }
    return records;
  } catch (err) {
    console.error('Fetch records error:', err);
    return [];
  }
}

export async function appendInspectionRecord(record: InspectionRecord, spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<void> {
  const values = [
    [
      record.recordId,
      record.date,
      record.time,
      record.inspector,
      record.department,
      record.itemId,
      record.itemName,
      record.status,
      record.notes,
      record.resolved,
    ],
  ];

  await sheetsApiCall(
    `/values/DATA!A1:J1:append?valueInputOption=USER_ENTERED`,
    'POST',
    { values },
    spreadsheetId
  );
}

export async function saveInspectionRecords(records: InspectionRecord[], spreadsheetId: string = DEFAULT_SPREADSHEET_ID): Promise<void> {
  const values = [['Record ID', 'Date', 'Time', 'Inspector', 'Department', 'Item ID', 'Item Name', 'Status', 'Notes', 'Resolved']];
  records.forEach((r) => {
    values.push([
      r.recordId,
      r.date,
      r.time,
      r.inspector,
      r.department,
      r.itemId,
      r.itemName,
      r.status,
      r.notes,
      r.resolved,
    ]);
  });

  await sheetsApiCall(
    `/values/DATA!A1:J1000?valueInputOption=USER_ENTERED`,
    'PUT',
    { values },
    spreadsheetId
  );
}
