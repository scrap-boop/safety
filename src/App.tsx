/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inspector from './components/Inspector';
import HistoryList from './components/HistoryList';
import ItemManager from './components/ItemManager';
import UserManager from './components/UserManager';
import { UserAccount, InspectionItem, InspectionRecord } from './types';
import {
  fetchUsers,
  fetchInspectionItems,
  fetchInspectionRecords,
  DEFAULT_SPREADSHEET_ID,
  initializeSpreadsheet,
  extractSpreadsheetId
} from './lib/sheets';
import { logout } from './lib/firebase';
import {
  Shield,
  LayoutDashboard,
  ClipboardCheck,
  History,
  FileSpreadsheet,
  Users2,
  LogOut,
  RefreshCw,
  TrendingUp,
  Settings,
  Database,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    // Read from localStorage if saved previously
    return localStorage.getItem('safety_app_spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Loaded data state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);

  // App UI states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspector' | 'history' | 'items' | 'users'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync spreadsheetId changes to localStorage
  const handleSetSpreadsheetId = (id: string) => {
    const cleanId = extractSpreadsheetId(id);
    setSpreadsheetId(cleanId);
    localStorage.setItem('safety_app_spreadsheet_id', cleanId);
  };

  // Main data fetching method
  const loadSheetData = useCallback(async (sheetId: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fetch all required sheets in parallel
      const [fetchedUsers, fetchedItems, fetchedRecords] = await Promise.all([
        fetchUsers(sheetId),
        fetchInspectionItems(sheetId),
        fetchInspectionRecords(sheetId),
      ]);

      setUsers(fetchedUsers);
      setItems(fetchedItems);
      setRecords(fetchedRecords);

      // Refresh currentUser values from the sheet in case they updated their password or role
      if (currentUser) {
        const freshUser = fetchedUsers.find((u) => u.username === currentUser.username);
        if (freshUser) {
          setCurrentUser(freshUser);
        }
      }
    } catch (err: any) {
      console.error('Failed to load sheet data:', err);
      setLoadError('เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Google Sheet: ' + (err.message || 'โปรดเข้าสู่ระบบหรือตรวจสอบสิทธิ์ใหม่'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleLoginSuccess = async (user: UserAccount, sheetId: string) => {
    setCurrentUser(user);
    setIsGoogleConnected(true);
    await loadSheetData(sheetId);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('คุณต้องการออกจากระบบหรือไม่?');
    if (!confirmed) return;

    await logout();
    setCurrentUser(null);
    setIsGoogleConnected(false);
    setUsers([]);
    setItems([]);
    setRecords([]);
    setActiveTab('dashboard');
  };

  // Refresh data trigger
  const handleRefresh = async () => {
    if (currentUser) {
      await loadSheetData(spreadsheetId);
    }
  };

  // Automatically refresh records when a new report is added
  const handleRecordAdded = async () => {
    await loadSheetData(spreadsheetId);
    setActiveTab('history'); // Switch to history tab to view new report
  };

  // Back-office visible menu authorization checks
  const isStaffOrAdmin = currentUser && (currentUser.role === 'staff' || currentUser.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      {!currentUser ? (
        <Login
          onLoginSuccess={handleLoginSuccess}
          spreadsheetId={spreadsheetId}
          setSpreadsheetId={handleSetSpreadsheetId}
        />
      ) : (
        <>
          {/* Main Navigation Top Bar */}
          <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                
                {/* Brand Logo */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-gray-900 leading-none">ตรวจความปลอดภัยพื้นที่</h1>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-semibold uppercase">Standard Can Portal</p>
                  </div>
                </div>

                {/* Navigation Links (Desktop) */}
                <nav className="hidden md:flex space-x-1">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'dashboard'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" /> แดชบอร์ดสรุป
                  </button>

                  <button
                    onClick={() => setActiveTab('inspector')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'inspector'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                    }`}
                  >
                    <ClipboardCheck className="h-4 w-4" /> ตรวจสอบพื้นที่
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'history'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                    }`}
                  >
                    <History className="h-4 w-4" /> ประวัติการตรวจสอบ
                  </button>

                  {isStaffOrAdmin && (
                    <>
                      <button
                        onClick={() => setActiveTab('items')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'items'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" /> จัดการหัวข้อตรวจ
                      </button>

                      <button
                        onClick={() => setActiveTab('users')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'users'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                        }`}
                      >
                        <Users2 className="h-4 w-4" /> จัดการผู้ใช้
                      </button>
                    </>
                  )}
                </nav>

                {/* Profile Controls / Logout */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs font-bold text-gray-800 leading-none">{currentUser.fullName}</div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold">
                        {currentUser.department}
                      </span>
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="h-8 border-l border-gray-100"></div>

                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 transition-colors"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>

              </div>
            </div>
          </header>

          {/* Navigation Links for Mobile */}
          <div className="md:hidden bg-white border-b border-gray-100 py-2 px-4 flex gap-1 overflow-x-auto shadow-xs select-none">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
              }`}
            >
              แดชบอร์ด
            </button>
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'inspector' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
              }`}
            >
              ตรวจสอบพื้นที่
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'history' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
              }`}
            >
              ประวัติ
            </button>
            {isStaffOrAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    activeTab === 'items' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
                  }`}
                >
                  หัวข้อตรวจ
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    activeTab === 'users' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500'
                  }`}
                >
                  ผู้ใช้งาน
                </button>
              </>
            )}
          </div>

          {/* Workspace info & Link to Google Sheet */}
          <div className="bg-gray-100 border-b border-gray-200 py-2 text-xs text-gray-500 shadow-inner">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span className="flex items-center gap-1 font-medium text-[11px]">
                <Database className="h-3.5 w-3.5 text-gray-400" />
                เชื่อมโยงแผ่นงานสำเร็จ: <span className="font-mono text-[10px] text-gray-600 font-semibold">{spreadsheetId}</span>
              </span>
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-emerald-700 hover:underline text-[11px] font-bold text-emerald-600 transition-all"
              >
                เปิดดูใน Google Sheets <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Main App Workspace Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {loadError && (
              <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 leading-relaxed flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span>{loadError}</span>
                <button
                  onClick={handleRefresh}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-lg font-bold"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-gray-500 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-xs font-medium">กำลังโหลดข้อมูลล่าสุดจาก Google Sheets...</p>
              </div>
            )}

            {!isLoading && (
              <div className="transition-all duration-150">
                {activeTab === 'dashboard' && (
                  <Dashboard records={records} onRefresh={handleRefresh} isLoading={isLoading} />
                )}
                {activeTab === 'inspector' && (
                  <Inspector
                    currentUser={currentUser}
                    items={items}
                    spreadsheetId={spreadsheetId}
                    onRecordAdded={handleRecordAdded}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryList
                    currentUser={currentUser}
                    records={records}
                    spreadsheetId={spreadsheetId}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'items' && (
                  <ItemManager
                    currentUser={currentUser}
                    items={items}
                    spreadsheetId={spreadsheetId}
                    onRefresh={handleRefresh}
                  />
                )}
                {activeTab === 'users' && (
                  <UserManager
                    currentUser={currentUser}
                    users={users}
                    spreadsheetId={spreadsheetId}
                    onRefresh={handleRefresh}
                  />
                )}
              </div>
            )}
          </main>

          {/* Humble clean footer */}
          <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400 mt-12">
            <p>ระบบตรวจพื้นที่ความปลอดภัย © {new Date().getFullYear()} Standard Can. สงวนลิขสิทธิ์.</p>
          </footer>
        </>
      )}
    </div>
  );
}
