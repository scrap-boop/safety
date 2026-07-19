/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { InspectionRecord, UserAccount, UserRole } from '../types';
import { saveInspectionRecords } from '../lib/sheets';
import { motion } from 'motion/react';
import { Calendar, Search, Edit2, Check, X, CheckCircle, AlertTriangle, Filter, Clipboard, AlertCircle } from 'lucide-react';

interface HistoryListProps {
  currentUser: UserAccount;
  records: InspectionRecord[];
  spreadsheetId: string;
  onRefresh: () => void;
}

export default function HistoryList({ currentUser, records, spreadsheetId, onRefresh }: HistoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ทั้งหมด');
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  
  // Edit mode states
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'ผ่าน' | 'ไม่ผ่าน'>('ผ่าน');
  const [editNotes, setEditNotes] = useState('');
  const [editResolved, setEditResolved] = useState<'ใช่' | 'ไม่' | 'ไม่ระบุ'>('ไม่ระบุ');
  const [isSaving, setIsSaving] = useState(false);

  // Extract unique departments for filters
  const departments = useMemo(() => {
    const depts = new Set<string>();
    records.forEach((r) => {
      if (r.department) depts.add(r.department);
    });
    return ['ทั้งหมด', ...Array.from(depts)];
  }, [records]);

  // Filter records based on filters and search
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (filterDept !== 'ทั้งหมด' && r.department !== filterDept) return false;
        if (filterStatus !== 'ทั้งหมด' && r.status !== filterStatus) return false;

        const query = searchQuery.toLowerCase().trim();
        if (query) {
          const matchInspector = r.inspector?.toLowerCase().includes(query);
          const matchItemName = r.itemName?.toLowerCase().includes(query);
          const matchNotes = r.notes?.toLowerCase().includes(query);
          const matchId = r.recordId?.toLowerCase().includes(query);
          return matchInspector || matchItemName || matchNotes || matchId;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by date then time desc
        const dateA = `${a.date}T${a.time || '00:00'}`;
        const dateB = `${b.date}T${b.time || '00:00'}`;
        return dateB.localeCompare(dateA);
      });
  }, [records, filterDept, filterStatus, searchQuery]);

  const handleStartEdit = (record: InspectionRecord) => {
    setEditingRecordId(record.recordId);
    setEditStatus(record.status);
    setEditNotes(record.notes);
    setEditResolved(record.resolved);
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
  };

  const handleSaveEdit = async (recordId: string) => {
    // 1. Prompt user with mandatory confirmation dialog
    const confirmed = window.confirm(
      `คุณต้องการยืนยันการแก้ไขข้อมูลรายงานการตรวจสอบรหัส ${recordId} หรือไม่? การกระทำนี้จะบันทึกข้อมูลกลับไปยัง Google Sheet`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      // Find and update the record in memory
      const updatedRecords = records.map((r) => {
        if (r.recordId === recordId) {
          return {
            ...r,
            status: editStatus,
            notes: editNotes,
            resolved: editResolved,
          };
        }
        return r;
      });

      // Save back to Google Sheet
      await saveInspectionRecords(updatedRecords, spreadsheetId);
      
      setEditingRecordId(null);
      onRefresh(); // Reload data from sheet
      alert('บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error('Save edit error:', err);
      alert('ไม่สามารถบันทึกข้อมูลได้: ' + (err.message || 'โปรดตรวจสอบสิทธิ์เชื่อมต่อ'));
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'staff' || currentUser.role === 'ทั่วไป'; // All users can edit based on requirement: "ผู้ใช้งานทั้งหมด เข้าถึงข้อมูลเดียวกัน ทั้งบันทึก แก้ไข และ ดู"

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="ค้นหาด้วย ผู้ตรวจ, รายการตรวจ, หมายเหตุ, รหัส..."
            className="w-full text-xs rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500 bg-gray-50/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          {/* Department Filter */}
          <div className="min-w-[120px]">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg text-xs px-2.5 py-2 focus:outline-none focus:border-emerald-500 w-full font-medium text-gray-600"
            >
              <option value="ทั้งหมด">แผนก: ทั้งหมด</option>
              {departments.filter(d => d !== 'ทั้งหมด').map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[120px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg text-xs px-2.5 py-2 focus:outline-none focus:border-emerald-500 w-full font-medium text-gray-600"
            >
              <option value="ทั้งหมด">สถานะ: ทั้งหมด</option>
              <option value="ผ่าน">ผ่าน (Pass)</option>
              <option value="ไม่ผ่าน">ไม่ผ่าน (Fail)</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Records Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
            <thead className="bg-gray-50/70 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">วันที่/เวลา</th>
                <th className="px-6 py-4">ผู้ตรวจสอบ</th>
                <th className="px-6 py-4">แผนกที่ตรวจ</th>
                <th className="px-6 py-4">รายการตรวจสอบ</th>
                <th className="px-6 py-4 text-center">ผลการตรวจ</th>
                <th className="px-6 py-4">หมายเหตุ / ความเห็น</th>
                <th className="px-6 py-4 text-center">แก้ไขแล้ว?</th>
                <th className="px-6 py-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <Clipboard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    ไม่มีข้อมูลรายงานการตรวจสอบที่ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isEditing = editingRecordId === record.recordId;
                  return (
                    <tr
                      key={record.recordId}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        isEditing ? 'bg-amber-50/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-800">{record.date}</div>
                        <div className="text-[10px] text-gray-400">{record.time || '--:--'} น.</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{record.inspector}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[10px]">
                          {record.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="font-semibold text-gray-400 text-[10px] mb-0.5">{record.itemId}</div>
                        <p className="line-clamp-2 text-gray-800 leading-relaxed">{record.itemName}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as 'ผ่าน' | 'ไม่ผ่าน')}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                          >
                            <option value="ผ่าน">ผ่าน</option>
                            <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                          </select>
                        ) : record.status === 'ผ่าน' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                            <CheckCircle className="h-3 w-3" /> ผ่าน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold text-[10px]">
                            <AlertTriangle className="h-3 w-3" /> ไม่ผ่าน
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full"
                          />
                        ) : (
                          <span className="text-gray-500 italic">{record.notes || '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <select
                            value={editResolved}
                            onChange={(e) => setEditResolved(e.target.value as 'ใช่' | 'ไม่' | 'ไม่ระบุ')}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="ใช่">ใช่ (แก้ไขแล้ว)</option>
                            <option value="ไม่">ไม่ (ยังไม่แก้)</option>
                            <option value="ไม่ระบุ">ไม่ระบุ</option>
                          </select>
                        ) : record.status === 'ผ่าน' ? (
                          <span className="text-gray-400 font-medium">-</span>
                        ) : record.resolved === 'ใช่' ? (
                          <span className="inline-flex px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold text-[10px]">
                            แก้ไขแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px]">
                            ยังไม่แก้
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(record.recordId)}
                                  disabled={isSaving}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                  title="บันทึก"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                                  title="ยกเลิก"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(record)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
                                title="แก้ไขข้อมูล"
                              >
                                <Edit2 className="h-3 w-3" /> แก้ไข
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
