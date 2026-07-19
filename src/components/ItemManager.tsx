/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { InspectionItem, UserAccount } from '../types';
import { saveInspectionItems } from '../lib/sheets';
import { Plus, Edit3, Trash2, Check, X, FileEdit, ClipboardList, Info } from 'lucide-react';

interface ItemManagerProps {
  currentUser: UserAccount;
  items: InspectionItem[];
  spreadsheetId: string;
  onRefresh: () => void;
}

export default function ItemManager({ currentUser, items, spreadsheetId, onRefresh }: ItemManagerProps) {
  // Check permission: Only staff and admin can access
  const isAuthorized = currentUser.role === 'admin' || currentUser.role === 'staff';

  // Form states for creating new item
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] = useState('ความปลอดภัยทั่วไป');
  const [newDept, setNewDept] = useState('ความปลอดภัย');
  const [newStatus, setNewStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Edit mode states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suggest a new ITEM ID automatically (e.g. ITEM007 based on length/values)
  const suggestedId = useMemo(() => {
    const numIds = items
      .map((item) => {
        const num = parseInt(item.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? 0 : num;
      })
      .sort((a, b) => a - b);
    
    const nextNum = numIds.length > 0 ? numIds[numIds.length - 1] + 1 : 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    return `ITEM${formattedNum}`;
  }, [items]);

  // Open add form and pre-fill suggestion
  const handleOpenAddForm = () => {
    setNewId(suggestedId);
    setNewItemName('');
    setShowAddForm(true);
    setErrorMsg(null);
  };

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newItemName.trim()) {
      setErrorMsg('กรุณากรอกชื่อรายการตรวจ');
      return;
    }

    if (items.some((item) => item.id.toUpperCase() === newId.trim().toUpperCase())) {
      setErrorMsg(`รหัสรายการตรวจ ${newId} ซ้ำกับที่มีอยู่แล้ว`);
      return;
    }

    const confirmed = window.confirm(`ยืนยันการเพิ่มรายการตรวจสอบความปลอดภัย ${newId}?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedItems: InspectionItem[] = [
        ...items,
        {
          id: newId.trim().toUpperCase(),
          itemName: newItemName.trim(),
          category: newCategory,
          department: newDept,
          status: newStatus,
        },
      ];

      await saveInspectionItems(updatedItems, spreadsheetId);
      setShowAddForm(false);
      onRefresh();
      alert('เพิ่มรายการตรวจสำเร็จ!');
    } catch (err: any) {
      console.error('Add item error:', err);
      setErrorMsg('ไม่สามารถบันทึกข้อมูลได้: ' + (err.message || 'ข้อผิดพลาดเกี่ยวกับสิทธิ์'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (item: InspectionItem) => {
    setEditingId(item.id);
    setEditItemName(item.itemName);
    setEditCategory(item.category);
    setEditDept(item.department);
    setEditStatus(item.status);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editItemName.trim()) {
      alert('กรุณากรอกชื่อรายการตรวจ');
      return;
    }

    const confirmed = window.confirm(`คุณต้องการยืนยันการแก้ไขข้อมูลรายการตรวจ ${id} หรือไม่?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedItems = items.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            itemName: editItemName.trim(),
            category: editCategory,
            department: editDept,
            status: editStatus,
          };
        }
        return item;
      });

      await saveInspectionItems(updatedItems, spreadsheetId);
      setEditingId(null);
      onRefresh();
      alert('แก้ไขรายการตรวจสำเร็จ!');
    } catch (err: any) {
      console.error('Edit item error:', err);
      alert('ไม่สามารถแก้ไขข้อมูลได้: ' + (err.message || 'สิทธิ์ชีตไม่เพียงพอ'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const confirmed = window.confirm(
      `คำเตือน: คุณแน่ใจหรือไม่ว่าต้องการลบรายการตรวจ ${id}? การกระทำนี้ไม่สามารถย้อนกลับได้`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedItems = items.filter((item) => item.id !== id);
      await saveInspectionItems(updatedItems, spreadsheetId);
      onRefresh();
      alert('ลบรายการตรวจสำเร็จ!');
    } catch (err: any) {
      console.error('Delete item error:', err);
      alert('ไม่สามารถลบข้อมูลได้: ' + (err.message || 'สิทธิ์ชีตไม่เพียงพอ'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-6 text-sm flex items-center gap-3">
        <Info className="h-5 w-5" />
        <div>
          <p className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <p className="text-xs">เมนูนี้เปิดให้ใช้งานเฉพาะกลุ่มผู้ปฏิบัติการ (Staff) และผู้ดูแลระบบ (Admin) เท่านั้น</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" /> จัดการรายการตรวจสอบความปลอดภัย (Inspection Items)
          </h2>
          <p className="text-xs text-gray-400">แก้ไข เพิ่มเติม และสลับสถานะความสมบูรณ์ของหัวข้อตรวจสอบหลัก</p>
        </div>

        {!showAddForm && (
          <button
            onClick={handleOpenAddForm}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> เพิ่มหัวข้อตรวจใหม่
          </button>
        )}
      </div>

      {/* Add New Item Form */}
      {showAddForm && (
        <form onSubmit={handleAddNewItem} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-3">
            <Plus className="h-4 w-4 text-emerald-600" /> สร้างหัวข้อตรวจสอบใหม่
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">รหัสรายการ (ID)</label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-mono font-semibold text-gray-700"
                placeholder="เช่น ITEM001"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ชื่อรายการตรวจ (Item Name)</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 text-gray-700"
                placeholder="ชื่อรายการตรวจเช็คความปลอดภัยที่ชัดเจน..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">สถานะใช้งาน</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="Active">เปิดใช้งาน (Active)</option>
                <option value="Inactive">ปิดใช้งาน (Inactive)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">หมวดหมู่ตรวจคัดกรอง</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="อุปกรณ์ดับเพลิง">อุปกรณ์ดับเพลิง</option>
                <option value="ทางหนีไฟ">ทางหนีไฟ</option>
                <option value="ระบบไฟฟ้า">ระบบไฟฟ้า</option>
                <option value="ปฐมพยาบาล">ปฐมพยาบาล</option>
                <option value="สภาพแวดล้อม">สภาพแวดล้อม</option>
                <option value="ความสะอาด">ความสะอาด</option>
                <option value="ความปลอดภัยทั่วไป">ความปลอดภัยทั่วไป</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">แผนกที่รับผิดชอบ</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="ความปลอดภัย">แผนกความปลอดภัย (Safety)</option>
                <option value="ฝ่ายผลิต">ฝ่ายผลิต (Production)</option>
                <option value="ฝ่ายซ่อมบำรุง">ฝ่ายซ่อมบำรุง (Maintenance)</option>
                <option value="คลังสินค้า">คลังสินค้า (Warehouse)</option>
                <option value="สำนักงาน">สำนักงาน (Office)</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-600">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 text-xs pt-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-600"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกรายการตรวจ'}
            </button>
          </div>
        </form>
      )}

      {/* Items List Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
            <thead className="bg-gray-50/70 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">รหัส (ID)</th>
                <th className="px-6 py-4">ประเภท/หมวดหมู่</th>
                <th className="px-6 py-4">หัวข้อตรวจสอบ</th>
                <th className="px-6 py-4">แผนกที่ตรวจ</th>
                <th className="px-6 py-4 text-center">สถานะใช้งาน</th>
                <th className="px-6 py-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    ไม่พบข้อมูลรายการตรวจเช็ค กรุณาเพิ่มรายการตรวจใหม่
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? 'bg-amber-50/10' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-gray-900">
                        {item.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="อุปกรณ์ดับเพลิง">อุปกรณ์ดับเพลิง</option>
                            <option value="ทางหนีไฟ">ทางหนีไฟ</option>
                            <option value="ระบบไฟฟ้า">ระบบไฟฟ้า</option>
                            <option value="ปฐมพยาบาล">ปฐมพยาบาล</option>
                            <option value="สภาพแวดล้อม">สภาพแวดล้อม</option>
                            <option value="ความสะอาด">ความสะอาด</option>
                            <option value="ความปลอดภัยทั่วไป">ความปลอดภัยทั่วไป</option>
                          </select>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold text-[10px]">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full"
                          />
                        ) : (
                          <p className="font-medium text-gray-800 leading-relaxed">{item.itemName}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="ความปลอดภัย">ความปลอดภัย</option>
                            <option value="ฝ่ายผลิต">ฝ่ายผลิต</option>
                            <option value="ฝ่ายซ่อมบำรุง">ฝ่ายซ่อมบำรุง</option>
                            <option value="คลังสินค้า">คลังสินค้า</option>
                            <option value="สำนักงาน">สำนักงาน</option>
                          </select>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[10px]">
                            {item.department}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as 'Active' | 'Inactive')}
                            className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        ) : item.status === 'Active' ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold text-[10px]">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold text-[10px]">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={isSaving}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title="บันทึก"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                                title="ยกเลิก"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
                                title="แก้ไขรายการ"
                              >
                                <FileEdit className="h-3 w-3" /> แก้ไข
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="ลบรายการ"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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
