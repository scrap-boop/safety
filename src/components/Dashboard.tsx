/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { InspectionRecord } from '../types';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { AlertTriangle, CheckCircle, ClipboardList, TrendingUp, Calendar, RefreshCw } from 'lucide-react';

interface DashboardProps {
  records: InspectionRecord[];
  onRefresh: () => void;
  isLoading: boolean;
}

const THAI_MONTHS = [
  'ทั้งหมด',
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export default function Dashboard({ records, onRefresh, isLoading }: DashboardProps) {
  const [selectedDept, setSelectedDept] = useState<string>('ทั้งหมด');
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = ทั้งหมด
  const [selectedYear, setSelectedYear] = useState<string>('ทั้งหมด');

  // 1. Extract Unique Departments & Years from Records for filter dropdowns
  const departments = useMemo(() => {
    const depts = new Set<string>();
    records.forEach((r) => {
      if (r.department) depts.add(r.department);
    });
    return ['ทั้งหมด', ...Array.from(depts)];
  }, [records]);

  const years = useMemo(() => {
    const yrs = new Set<string>();
    records.forEach((r) => {
      if (r.date) {
        const yr = r.date.split('-')[0];
        if (yr && yr.length === 4) yrs.add(yr);
      }
    });
    return ['ทั้งหมด', ...Array.from(yrs)].sort().reverse();
  }, [records]);

  // 2. Filter records based on selected dropdown options
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedDept !== 'ทั้งหมด' && r.department !== selectedDept) return false;

      if (r.date) {
        const parts = r.date.split('-');
        if (parts.length === 3) {
          const yr = parts[0];
          const mth = parseInt(parts[1], 10);

          if (selectedYear !== 'ทั้งหมด' && yr !== selectedYear) return false;
          if (selectedMonth !== 0 && mth !== selectedMonth) return false;
        }
      }
      return true;
    });
  }, [records, selectedDept, selectedMonth, selectedYear]);

  // 3. Stats calculations
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const passed = filteredRecords.filter((r) => r.status === 'ผ่าน').length;
    const failed = filteredRecords.filter((r) => r.status === 'ไม่ผ่าน').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;
    
    // Unresolved failed items (requires action)
    const pendingIssues = filteredRecords.filter((r) => r.status === 'ไม่ผ่าน' && r.resolved !== 'ใช่').length;

    return { total, passed, failed, passRate, failRate, pendingIssues };
  }, [filteredRecords]);

  // 4. Chart Data: Pass / Fail by Department
  const deptChartData = useMemo(() => {
    const deptMap: { [key: string]: { dept: string; passed: number; failed: number } } = {};

    filteredRecords.forEach((r) => {
      const dept = r.department || 'ไม่ระบุ';
      if (!deptMap[dept]) {
        deptMap[dept] = { dept, passed: 0, failed: 0 };
      }
      if (r.status === 'ผ่าน') {
        deptMap[dept].passed += 1;
      } else {
        deptMap[dept].failed += 1;
      }
    });

    return Object.values(deptMap);
  }, [filteredRecords]);

  // 5. Chart Data: Monthly Inspection Trends
  const monthlyTrendData = useMemo(() => {
    const monthsMap: { [key: number]: { monthName: string; count: number; passed: number; failed: number } } = {};
    
    // Initialize 12 months
    for (let m = 1; m <= 12; m++) {
      monthsMap[m] = { monthName: THAI_MONTHS[m].substring(0, 3), count: 0, passed: 0, failed: 0 };
    }

    filteredRecords.forEach((r) => {
      if (r.date) {
        const parts = r.date.split('-');
        if (parts.length === 3) {
          const mth = parseInt(parts[1], 10);
          if (monthsMap[mth]) {
            monthsMap[mth].count += 1;
            if (r.status === 'ผ่าน') {
              monthsMap[mth].passed += 1;
            } else {
              monthsMap[mth].failed += 1;
            }
          }
        }
      }
    });

    return Object.keys(monthsMap)
      .map((k) => ({
        monthNum: parseInt(k, 10),
        ...monthsMap[parseInt(k, 10)],
      }))
      // Filter months with actual activity if the year is specified, or show all 12
      .filter((m) => selectedYear !== 'ทั้งหมด' || m.count > 0);
  }, [filteredRecords, selectedYear]);

  // 6. Pie Chart Data
  const pieData = useMemo(() => {
    return [
      { name: 'ผ่าน (Pass)', value: stats.passed, color: '#10b981' },
      { name: 'ไม่ผ่าน (Fail)', value: stats.failed, color: '#ef4444' },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Filters section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" /> แดชบอร์ดสรุปผลความปลอดภัย
          </h2>
          <p className="text-xs text-gray-400">สรุปความคืบหน้า รายงาน และสถิติจำนวนการตรวจสอบพื้นที่</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex-1 md:flex-initial min-w-[120px]">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">แผนก</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex-1 md:flex-initial min-w-[120px]">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">เดือน</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {THAI_MONTHS.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex-1 md:flex-initial min-w-[100px]">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ปี</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y === 'ทั้งหมด' ? y : `${parseInt(y, 10) + 543} (ค.ศ. ${y})`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="self-end p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="โหลดข้อมูลใหม่"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inspections */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium">จำนวนการตรวจทั้งหมด</span>
            <h3 className="text-2xl font-bold text-gray-800">{stats.total} ครั้ง</h3>
            <p className="text-[11px] text-gray-400">รายการตรวจคัดกรองความเสี่ยง</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">
            <ClipboardList className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Card 2: Pass Rate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium">อัตราการผ่านเกณฑ์</span>
            <h3 className="text-2xl font-bold text-emerald-600">{stats.passRate}%</h3>
            <p className="text-[11px] text-gray-400">ผ่าน {stats.passed} รายการ</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Card 3: Failed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium">จำนวนที่ไม่ผ่านเกณฑ์</span>
            <h3 className="text-2xl font-bold text-red-500">{stats.failed} รายการ</h3>
            <p className="text-[11px] text-gray-400">คิดเป็น {stats.failRate}% ของการตรวจ</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Card 4: Unresolved Issues */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium">ปัญหาที่ยังไม่ได้รับการแก้ไข</span>
            <h3 className="text-2xl font-bold text-amber-500">{stats.pendingIssues} รายการ</h3>
            <p className="text-[11px] text-gray-400">ต้องการการดำเนินการแก้ไขด่วน</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Calendar className="h-5 w-5" />
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Bar chart showing Pass/Fail by Department */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">สถิติการตรวจสอบแยกตามแผนก (Department Comparison)</h3>
          <div className="h-80 w-full text-xs">
            {deptChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="dept" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="passed" name="ผ่าน (Pass)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="ไม่ผ่าน (Fail)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                ไม่มีข้อมูลตรวจพบในแผนกตามเงื่อนไขตัวกรอง
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Pie chart of overall pass/fail status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">สัดส่วนผลลัพธ์ทั้งหมด</h3>
            <p className="text-xs text-gray-400">เปรียบเทียบสัดส่วน ผ่าน / ไม่ผ่านเกณฑ์</p>
          </div>
          <div className="h-56 w-full relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                ไม่มีข้อมูลตรวจพบ
              </div>
            )}
            {pieData.length > 0 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-xs text-gray-400">ผ่านเฉลี่ย</span>
                <p className="text-xl font-bold text-gray-800">{stats.passRate}%</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>ผ่าน ({stats.passed})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
              <span>ไม่ผ่าน ({stats.failed})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3: Inspection Trend Over Time */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">แนวโน้มจำนวนการตรวจสอบความปลอดภัยรายเดือน</h3>
        <div className="h-64 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="monthName" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" allowDecimals={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="count"
                name="จำนวนการตรวจรวม"
                stroke="#6366f1"
                strokeWidth={2.5}
                activeDot={{ r: 6 }}
              />
              <Line type="monotone" dataKey="passed" name="ผ่าน" stroke="#10b981" strokeWidth={1.5} />
              <Line type="monotone" dataKey="failed" name="ไม่ผ่าน" stroke="#ef4444" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
