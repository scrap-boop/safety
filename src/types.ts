/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ทั่วไป' | 'staff' | 'admin';

export interface UserAccount {
  username: string;
  password?: string;
  role: UserRole;
  department: string;
  fullName: string;
}

export interface InspectionItem {
  id: string;
  itemName: string;
  category: string;
  department: string;
  status: 'Active' | 'Inactive';
}

export interface InspectionRecord {
  recordId: string;
  date: string;
  time: string;
  inspector: string;
  department: string;
  itemId: string;
  itemName: string;
  status: 'ผ่าน' | 'ไม่ผ่าน';
  notes: string;
  resolved: 'ใช่' | 'ไม่' | 'ไม่ระบุ';
}
