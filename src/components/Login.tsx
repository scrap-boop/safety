/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn, initAuth, logout } from '../lib/firebase';
import { fetchUsers, DEFAULT_SPREADSHEET_ID, initializeSpreadsheet, extractSpreadsheetId } from '../lib/sheets';
import { UserAccount } from '../types';
import { Shield, Key, Mail, CheckCircle2, RefreshCw, FileSpreadsheet, Lock, HelpCircle, ExternalLink, Copy } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: UserAccount, sheetId: string) => void;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => void;
}

export default function Login({ onLoginSuccess, spreadsheetId, setSpreadsheetId }: LoginProps) {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingSheet, setIsCheckingSheet] = useState(false);
  const [sheetReady, setSheetReady] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Custom User/Pass form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        verifySheet(token, spreadsheetId);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setSheetReady(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [spreadsheetId]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setSheetError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        const cleanId = extractSpreadsheetId(spreadsheetId);
        await verifySheet(result.accessToken, cleanId);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setSheetError('การลงชื่อเข้าใช้ Google ล้มเหลว: ' + (err.message || 'ข้อผิดพลาดเครือข่าย'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const verifySheet = async (token: string, sheetId: string) => {
    if (!token) return;
    const cleanId = extractSpreadsheetId(sheetId);
    if (cleanId !== sheetId) {
      setSpreadsheetId(cleanId);
    }
    setIsCheckingSheet(true);
    setSheetError(null);
    try {
      // Check sheet and initialize missing tabs (DATA, item, users)
      await initializeSpreadsheet(cleanId);
      setSheetReady(true);
      
      // Load user accounts from sheet to prepare for password verification
      const users = await fetchUsers(cleanId);
      setUserList(users);
    } catch (err: any) {
      console.error('Sheet verification failed:', err);
      setSheetReady(false);
      setSheetError(
        'ไม่สามารถเข้าถึงหรือสร้างข้อมูลใน Google Sheet ได้ ' +
        'โปรดตรวจสอบว่าบัญชี Google ของคุณมีสิทธิ์เปิดและแก้ไขชีตนี้ และใส่ ID/ลิงก์ชีตถูกต้อง ' +
        '(คำแนะนำ: หากไม่ได้รับอนุญาตสิทธิ์ ให้คลิกสำเนาไฟล์ต้นแบบเป็นของคุณเองด้านล่าง)'
      );
    } finally {
      setIsCheckingSheet(false);
    }
  };

  const handleUsernamePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetReady) {
      setLoginError('ระบบชีตยังไม่พร้อมใช้งาน');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    // Find user in user list
    const foundUser = userList.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!foundUser) {
      setLoginError('ไม่พบชื่อผู้ใช้นี้ในระบบ');
      setIsLoggingIn(false);
      return;
    }

    if (foundUser.password !== password) {
      setLoginError('รหัสผ่านไม่ถูกต้อง');
      setIsLoggingIn(false);
      return;
    }

    // Success!
    setIsLoggingIn(false);
    onLoginSuccess(foundUser, spreadsheetId);
  };

  const handleResetGoogle = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleToken(null);
    setSheetReady(false);
    setUserList([]);
  };

  return (
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-sans">
            ระบบเช็คพื้นที่ความปลอดภัย
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Safety Area Inspection Management Portal
          </p>
        </div>

        {/* STEP 1: Connect to Google Sheets */}
        {!googleUser ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-800 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
                <HelpCircle className="h-4 w-4 text-emerald-600" /> คำแนะนำเพื่อเริ่มใช้งาน Google Sheets:
              </p>
              <ol className="list-decimal pl-4 space-y-1.5 mt-2">
                <li>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/copy`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                  >
                    คลิกที่นี่เพื่อทำสำเนาเทมเพลตต้นแบบ <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-[11px] text-emerald-600 mt-0.5">ระบบจะคัดลอกแผ่นงานตรวจความปลอดภัยไปยัง Google Drive ของคุณ</p>
                </li>
                <li>
                  คัดลอก <strong>ลิงก์ URL หรือ Spreadsheet ID</strong> ของคุณมาวางลงในกล่องข้อความด้านล่าง
                </li>
                <li>
                  กดปุ่ม <strong>เชื่อมต่อ Google Sheets เพื่อเริ่มต้น</strong> ด้านล่างเพื่อลงชื่อเข้าใช้ด้วยบัญชี Google ของคุณ
                </li>
              </ol>
            </div>

            <div>
              <label htmlFor="spreadsheet-id-input" className="block text-xs font-semibold text-gray-700 mb-2">
                ลิงก์หรือ Spreadsheet ID ของคุณ (รองรับลิงก์เต็ม URL)
              </label>
              <div className="flex gap-2">
                <input
                  id="spreadsheet-id-input"
                  type="text"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="วางลิงก์ชีต หรือ ID แผ่นงานของคุณที่นี่..."
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                * คุณสามารถวางลิงก์ของบราวเซอร์ <code>https://docs.google.com/spreadsheets/d/...</code> ลงไปได้เลย ระบบจะแยก ID ให้อัตโนมัติ!
              </p>
            </div>

            <button
              id="btn-google-login"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 border border-gray-300 rounded-xl shadow-sm transition-all text-sm disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              )}
              เชื่อมต่อ Google Sheets เพื่อเริ่มต้น
            </button>

            {sheetError && (
              <div id="sheet-error-msg" className="rounded-xl bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="text-sm text-red-700 leading-relaxed">{sheetError}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: Authenticate with custom Username & Password */
          <div className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800">
                  เชื่อมต่อชีตสำเร็จแล้ว
                </span>
              </div>
              <button
                onClick={handleResetGoogle}
                className="text-[11px] text-gray-500 hover:text-red-600 underline font-medium"
              >
                เปลี่ยนบัญชี Google
              </button>
            </div>

            {isCheckingSheet ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">กำลังตรวจสอบระบบจัดเก็บข้อมูลใน Google Sheets...</p>
              </div>
            ) : sheetReady ? (
              <form onSubmit={handleUsernamePasswordLogin} className="space-y-4">
                <div className="rounded-md shadow-sm space-y-4">
                  <div>
                    <label htmlFor="username-input" className="block text-xs font-semibold text-gray-600 mb-1">
                      ชื่อผู้ใช้ (Username)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="username-input"
                        name="username"
                        type="text"
                        required
                        className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10"
                        placeholder="กรอกชื่อผู้ใช้ เช่น admin, staff, general"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="password-input" className="block text-xs font-semibold text-gray-600 mb-1">
                      รหัสผ่าน (Password)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        id="password-input"
                        name="password"
                        type="password"
                        required
                        className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10"
                        placeholder="รหัสผ่านเดิมเริ่มต้น admin: password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {loginError && (
                  <div id="login-error-msg" className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-600">
                    {loginError}
                  </div>
                )}

                <div className="text-xs text-gray-400 text-center py-1">
                  บัญชีตัวอย่าง: <strong>admin</strong> / <strong>password</strong> (สำหรับผู้ดูแลระบบ)
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isLoggingIn}
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? 'กำลังลงชื่อเข้าใช้...' : 'เข้าสู่ระบบตรวจความปลอดภัย'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-700 leading-relaxed text-left">
                  {sheetError}
                </div>
                <button
                  onClick={() => verifySheet(googleToken!, spreadsheetId)}
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-4 rounded-lg border border-gray-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> ลองตรวจสอบอีกครั้ง
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
