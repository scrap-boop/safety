/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { saveUsers } from '../lib/sheets';
import { UserPlus, ShieldAlert, Key, Edit, Check, X, ShieldCheck, Users, Info } from 'lucide-react';

interface UserManagerProps {
  currentUser: UserAccount;
  users: UserAccount[];
  spreadsheetId: string;
  onRefresh: () => void;
}

export default function UserManager({ currentUser, users, spreadsheetId, onRefresh }: UserManagerProps) {
  const isAuthorized = currentUser.role === 'admin' || currentUser.role === 'staff';

  // State for creating a new user account
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('ทั่วไป');
  const [newDept, setNewDept] = useState('ฝ่ายผลิต');
  const [newFullName, setNewFullName] = useState('');

  // State for editing user password / details
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('ทั่วไป');
  const [editDept, setEditDept] = useState('');
  const [editFullName, setEditFullName] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenAddForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('ทั่วไป');
    setNewDept('ฝ่ายผลิต');
    setNewFullName('');
    setShowAddForm(true);
    setErrorMsg(null);
  };

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const usernameTrimmed = newUsername.trim().toLowerCase();
    if (!usernameTrimmed || !newPassword.trim() || !newFullName.trim()) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    // Check if username already exists
    if (users.some((u) => u.username.toLowerCase() === usernameTrimmed)) {
      setErrorMsg(`ชื่อผู้ใช้ "${usernameTrimmed}" นี้มีอยู่แล้วในระบบ`);
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันการเพิ่มผู้ใช้งานใหม่:\n- ชื่อบัญชี: ${usernameTrimmed}\n- กลุ่มผู้ใช้: ${newRole}`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedUsers: UserAccount[] = [
        ...users,
        {
          username: usernameTrimmed,
          password: newPassword.trim(),
          role: newRole,
          department: newDept,
          fullName: newFullName.trim(),
        },
      ];

      await saveUsers(updatedUsers, spreadsheetId);
      setShowAddForm(false);
      onRefresh();
      alert('เพิ่มผู้ใช้ใหม่สำเร็จ!');
    } catch (err: any) {
      console.error('Add user error:', err);
      setErrorMsg('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้: ' + (err.message || 'ข้อผิดพลาดทางด้านสิทธิ์'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (user: UserAccount) => {
    setEditingUsername(user.username);
    setEditPassword(user.password || '');
    setEditRole(user.role);
    setEditDept(user.department);
    setEditFullName(user.fullName);
  };

  const handleSaveEdit = async (username: string) => {
    if (!editPassword.trim() || !editFullName.trim()) {
      alert('รหัสผ่านและชื่อเต็มห้ามเว้นว่าง');
      return;
    }

    const confirmed = window.confirm(`คุณต้องการยืนยันการบันทึกการแก้ไขข้อมูลของบัญชี "${username}" หรือไม่?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedUsers = users.map((u) => {
        if (u.username.toLowerCase() === username.toLowerCase()) {
          return {
            ...u,
            password: editPassword.trim(),
            role: editRole,
            department: editDept,
            fullName: editFullName.trim(),
          };
        }
        return u;
      });

      await saveUsers(updatedUsers, spreadsheetId);
      setEditingUsername(null);
      onRefresh();
      alert(`อัปเดตข้อมูลของบัญชี "${username}" สำเร็จ!`);
    } catch (err: any) {
      console.error('Save user edit error:', err);
      alert('ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้: ' + (err.message || 'ข้อผิดพลาดทางด้านสิทธิ์'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username.toLowerCase() === 'admin') {
      alert('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin) ได้');
      return;
    }

    if (username.toLowerCase() === currentUser.username.toLowerCase()) {
      alert('คุณไม่สามารถลบบัญชีผู้ใช้ของตนเองขณะที่เข้าใช้งานอยู่ได้');
      return;
    }

    const confirmed = window.confirm(`คำเตือน: คุณต้องการลบบัญชีผู้ใช้ "${username}" ออกจากระบบหรือไม่?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const updatedUsers = users.filter((u) => u.username.toLowerCase() !== username.toLowerCase());
      await saveUsers(updatedUsers, spreadsheetId);
      onRefresh();
      alert(`ลบบัญชีผู้ใช้ "${username}" สำเร็จ!`);
    } catch (err: any) {
      console.error('Delete user error:', err);
      alert('ไม่สามารถลบข้อมูลผู้ใช้ได้: ' + (err.message || 'สิทธิ์ชีตไม่เพียงพอ'));
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
          <p className="text-xs">เมนูจัดการผู้ใช้งานเปิดให้ใช้งานเฉพาะกลุ่มผู้ปฏิบัติการ (Staff) และผู้ดูแลระบบ (Admin) เท่านั้น</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" /> ระบบจัดการบัญชีผู้ใช้งาน (User Management)
          </h2>
          <p className="text-xs text-gray-400">เพิ่ม ลบ บัญชีผู้ใช้ กำหนดบทบาท และเปลี่ยนรหัสผ่านให้กับสมาชิกในระบบทั้งหมด</p>
        </div>

        {!showAddForm && (
          <button
            onClick={handleOpenAddForm}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-all"
          >
            <UserPlus className="h-4 w-4" /> เพิ่มผู้ใช้งานใหม่
          </button>
        )}
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <form onSubmit={handleAddNewUser} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-3">
            <UserPlus className="h-4 w-4 text-emerald-600" /> ข้อมูลสมาชิกใหม่
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ชื่อผู้ใช้สำหรับล็อกอิน (Username)</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-semibold text-gray-700"
                placeholder="ภาษาอังกฤษเท่านั้น เช่น inspector01"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">รหัสผ่าน (Password)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 text-gray-700"
                placeholder="กำหนดรหัสผ่านเบื้องต้น..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ชื่อ-นามสกุลจริง (Full Name)</label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 text-gray-700"
                placeholder="เช่น นายมานะ ยินดี"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ระดับบทบาท (Role)</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="ทั่วไป">ทั่วไป (General auditor)</option>
                <option value="staff">ผู้ปฏิบัติงาน / เจ้าหน้าที่ (Staff)</option>
                <option value="admin">ผู้ดูแลระบบสูงสุด (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">แผนกงานที่สังกัด</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="ความปลอดภัย">ความปลอดภัย</option>
                <option value="ฝ่ายผลิต">ฝ่ายผลิต</option>
                <option value="ฝ่ายซ่อมบำรุง">ฝ่ายซ่อมบำรุง</option>
                <option value="คลังสินค้า">คลังสินค้า</option>
                <option value="สำนักงาน">สำนักงาน</option>
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
              {isSaving ? 'กำลังบันทึก...' : 'สร้างบัญชีผู้ใช้'}
            </button>
          </div>
        </form>
      )}

      {/* Users List Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
            <thead className="bg-gray-50/70 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">ชื่อเข้าใช้ (Username)</th>
                <th className="px-6 py-4">ชื่อผู้ตรวจจริง (Full Name)</th>
                <th className="px-6 py-4">รหัสผ่าน (Password)</th>
                <th className="px-6 py-4">บทบาท (Role)</th>
                <th className="px-6 py-4">แผนกงาน</th>
                <th className="px-6 py-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
              {users.map((user) => {
                const isEditing = editingUsername === user.username;
                const isAdminAccount = user.username.toLowerCase() === 'admin';
                return (
                  <tr key={user.username} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? 'bg-amber-50/10' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900 font-mono">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 max-w-xs font-semibold text-gray-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full"
                        />
                      ) : (
                        user.fullName || '-'
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium">
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                          {user.password || '******'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="ทั่วไป">ทั่วไป</option>
                          <option value="staff">staff</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold text-[10px]">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      ) : user.role === 'staff' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px]">
                          <Key className="h-3 w-3 text-amber-600" /> Staff
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium text-[10px]">
                          ทั่วไป
                        </span>
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
                        <span className="inline-flex px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                          {user.department}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(user.username)}
                              disabled={isSaving}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="บันทึก"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingUsername(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                              title="ยกเลิก"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
                              title="เปลี่ยนรหัสผ่าน / แก้ไขสิทธิ์"
                            >
                              <Edit className="h-3 w-3" /> แก้ไข/รหัสผ่าน
                            </button>
                            {!isAdminAccount && (
                              <button
                                onClick={() => handleDeleteUser(user.username)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="ลบผู้ใช้งาน"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
