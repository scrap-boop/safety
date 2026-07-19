/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { InspectionItem, InspectionRecord, UserAccount } from '../types';
import { appendInspectionRecord } from '../lib/sheets';
import { motion } from 'motion/react';
import { ClipboardCheck, ShieldAlert, CheckCircle, XCircle, ArrowRight, Save, MessageSquare, ListFilter, AlertCircle } from 'lucide-react';

interface InspectorProps {
  currentUser: UserAccount;
  items: InspectionItem[];
  spreadsheetId: string;
  onRecordAdded: () => void;
}

export default function Inspector({ currentUser, items, spreadsheetId, onRecordAdded }: InspectorProps) {
  // Filter only Active items for inspection
  const activeItems = useMemo(() => {
    return items.filter((item) => item.status === 'Active');
  }, [items]);

  // Form states
  const [selectedDept, setSelectedDept] = useState<string>(currentUser.department || 'ฝ่ายผลิต');
  const [filterCategory, setFilterCategory] = useState<string>('ทั้งหมด');
  
  // Track status and notes for each item ID
  // values: { [itemId]: { status: 'ผ่าน' | 'ไม่ผ่าน' | null, notes: string } }
  const [checklistState, setChecklistState] = useState<{
    [key: string]: { status: 'ผ่าน' | 'ไม่ผ่าน' | null; notes: string };
  }>(() => {
    const initialState: typeof checklistState = {};
    activeItems.forEach((item) => {
      initialState[item.id] = { status: null, notes: '' };
    });
    return initialState;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extract unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    activeItems.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return ['ทั้งหมด', ...Array.from(cats)];
  }, [activeItems]);

  // Filter items in the view
  const visibleItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (filterCategory !== 'ทั้งหมด' && item.category !== filterCategory) return false;
      return true;
    });
  }, [activeItems, filterCategory]);

  // Progress metrics
  const progress = useMemo(() => {
    const activeIds = activeItems.map((item) => item.id);
    const filledCount = Object.keys(checklistState).filter(
      (id) => activeIds.includes(id) && checklistState[id].status !== null
    ).length;
    const totalCount = activeItems.length;
    const percent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
    return { filledCount, totalCount, percent };
  }, [checklistState, activeItems]);

  const handleStatusChange = (itemId: string, status: 'ผ่าน' | 'ไม่ผ่าน') => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const handleNoteChange = (itemId: string, notes: string) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  const handleQuickFillAll = (status: 'ผ่าน' | 'ไม่ผ่าน') => {
    setChecklistState((prev) => {
      const updated = { ...prev };
      visibleItems.forEach((item) => {
        updated[item.id] = { ...updated[item.id], status };
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);

    // Filter items with input results
    const recordsToSubmit = activeItems
      .filter((item) => checklistState[item.id]?.status !== null)
      .map((item) => {
        const state = checklistState[item.id];
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().substring(0, 5);
        const randomId = Math.floor(1000 + Math.random() * 9000);

        return {
          recordId: `REC${randomId}`,
          date: dateStr,
          time: timeStr,
          inspector: currentUser.fullName || currentUser.username,
          department: selectedDept,
          itemId: item.id,
          itemName: item.itemName,
          status: state.status as 'ผ่าน' | 'ไม่ผ่าน',
          notes: state.notes || 'ปกติ',
          resolved: (state.status === 'ไม่ผ่าน' ? 'ไม่' : 'ใช่') as 'ใช่' | 'ไม่' | 'ไม่ระบุ',
        } as InspectionRecord;
      });

    if (recordsToSubmit.length === 0) {
      setSubmitMessage({
        type: 'error',
        text: 'โปรดเลือกผลการตรวจ (ผ่าน/ไม่ผ่าน) อย่างน้อย 1 รายการก่อนบันทึก',
      });
      return;
    }

    const confirmed = window.confirm(`ยืนยันการบันทึกรายงานการตรวจเช็คความปลอดภัยจำนวน ${recordsToSubmit.length} รายการ?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      // Append each record to the Google Sheet
      for (const record of recordsToSubmit) {
        await appendInspectionRecord(record, spreadsheetId);
      }

      setSubmitMessage({
        type: 'success',
        text: 'บันทึกรายงานการตรวจเช็คลงใน Google Sheet เรียบร้อยแล้ว!',
      });

      // Clear checklist states
      setChecklistState(() => {
        const reset: typeof checklistState = {};
        activeItems.forEach((item) => {
          reset[item.id] = { status: null, notes: '' };
        });
        return reset;
      });

      onRecordAdded();
    } catch (err: any) {
      console.error('Submit inspection records error:', err);
      setSubmitMessage({
        type: 'error',
        text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || 'โปรดติดต่อผู้ดูแลระบบ'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">เริ่มการตรวจเช็คความปลอดภัย (New Audit)</h2>
              <p className="text-xs text-gray-400">
                ผู้ตรวจสอบ: <span className="font-semibold text-gray-600">{currentUser.fullName}</span> ({currentUser.role})
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">แผนก/พื้นที่ที่ตรวจ</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-emerald-500 w-full sm:w-48 font-medium text-gray-700"
            >
              <option value="ความปลอดภัย">แผนกความปลอดภัย (Safety)</option>
              <option value="ฝ่ายผลิต">ฝ่ายผลิต (Production)</option>
              <option value="ฝ่ายซ่อมบำรุง">ฝ่ายซ่อมบำรุง (Maintenance)</option>
              <option value="คลังสินค้า">คลังสินค้า (Warehouse)</option>
              <option value="สำนักงาน">สำนักงาน (Office)</option>
            </select>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1.5">
            <span>ความคืบหน้าการกรอกรายงาน ({progress.filledCount}/{progress.totalCount} รายการ)</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Control Actions & Category Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <ListFilter className="h-4 w-4 text-gray-400" />
          <span className="font-semibold text-gray-600">ประเภทรายการ:</span>
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-full transition-all ${
                  filterCategory === cat
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => handleQuickFillAll('ผ่าน')}
            className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium transition-colors"
          >
            เลือก "ผ่าน" ทั้งหมดในกลุ่มนี้
          </button>
          <button
            onClick={() => handleQuickFillAll('ไม่ผ่าน')}
            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-medium transition-colors"
          >
            เลือก "ไม่ผ่าน" ทั้งหมดในกลุ่มนี้
          </button>
        </div>
      </div>

      {/* Checklist Grid */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {visibleItems.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400">
            <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p>ไม่พบรายการตรวจสอบที่ตรงกับหมวดหมู่นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleItems.map((item) => {
              const itemState = checklistState[item.id] || { status: null, notes: '' };
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all duration-200 ${
                    itemState.status === 'ผ่าน'
                      ? 'border-emerald-500 bg-emerald-50/10'
                      : itemState.status === 'ไม่ผ่าน'
                      ? 'border-red-400 bg-red-50/10'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">
                          {item.id} · {item.category}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-800 leading-relaxed">
                          {item.itemName}
                        </h4>
                      </div>
                    </div>

                    {/* Check Status Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'ผ่าน')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border font-medium text-xs transition-all ${
                          itemState.status === 'ผ่าน'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <CheckCircle className={`h-4 w-4 ${itemState.status === 'ผ่าน' ? 'text-white' : 'text-emerald-500'}`} />
                        ผ่าน (Pass)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'ไม่ผ่าน')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border font-medium text-xs transition-all ${
                          itemState.status === 'ไม่ผ่าน'
                            ? 'bg-red-600 border-red-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <XCircle className={`h-4 w-4 ${itemState.status === 'ไม่ผ่าน' ? 'text-white' : 'text-red-500'}`} />
                        ไม่ผ่าน (Fail)
                      </button>
                    </div>

                    {/* Note Input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        value={itemState.notes}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        placeholder="หมายเหตุ / รายละเอียดความเสียหาย"
                        className="w-full text-xs bg-gray-50/50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white text-gray-700"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Section */}
        {submitMessage && (
          <div
            className={`p-4 rounded-xl text-xs border ${
              submitMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {submitMessage.text}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || activeItems.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-colors text-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>กำลังบันทึกข้อมูล...</>
            ) : (
              <>
                <Save className="h-4 w-4" /> บันทึกรายงานการตรวจ ({progress.filledCount} รายการ)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
