import React, { useState } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

function App() {
  // --- 所有應用程式的狀態 (State) ---
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [] });
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [generated, setGenerated] = useState(false);
  const [params, setParams] = useState({
    D: 2,
    E: 2,
    N: 2,
    minOff: 8,
    maxConsecutive: 5,
  });

  // --- 事件處理函式 ---
  const handleConfirm = () => {
    const names = (nurseNames || '').split(',').map(name => name.trim()).filter(Boolean);
    const initialSchedule = {};
    names.forEach(name => {
      initialSchedule[name] = Array(daysInMonth).fill('');
    });
    setSchedule(initialSchedule);
    setGenerated(true);
  };

  const handleGenerate = () => {
    const newSchedule = autoGenerateSchedule(
      schedule,
      availableShifts,
      daysInMonth,
      params.D,
      params.E,
      params.N,
      params.minOff,
      params.maxConsecutive
    );
    setSchedule(newSchedule);
  };

  // ✅ 新增: 匯出至 Excel 的處理函式
  const handleExportToExcel = () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel匯出功能正在載入，請稍後再試。');
      return;
    }

    const dataForExcel = [];
    const shifts = ['D', 'E', 'N'];
    const nurseList = Object.keys(schedule);

    // 建立表頭
    const header = ['護理師'];
    for (let i = 1; i <= daysInMonth; i++) {
      header.push(i.toString());
    }
    header.push('休假');
    dataForExcel.push(header);

    // 依班別分組，建立資料
    shifts.forEach(shift => {
      const shiftNurses = nurseList.filter(nurse => availableShifts[shift]?.includes(nurse));

      // 該班別的護理師班表
      shiftNurses.forEach(nurse => {
        const rowData = [nurse];
        const nurseShifts = schedule[nurse];
        rowData.push(...nurseShifts);
        const offDays = nurseShifts.filter(s => s === 'OFF' || s === 'R').length;
        rowData.push(offDays);
        dataForExcel.push(rowData);
      });

      // 該班別的每日總計
      const totalRow = [`${shift} 班總計`];
      for (let day = 0; day < daysInMonth; day++) {
        let dailyTotal = 0;
        shiftNurses.forEach(nurse => {
          if (schedule[nurse][day] === shift) {
            dailyTotal++;
          }
        });
        totalRow.push(dailyTotal);
      }
      totalRow.push(''); // "休假"欄為空
      dataForExcel.push(totalRow);

      // 新增空白間隔行
      if (shifts.indexOf(shift) < shifts.length - 1) {
        dataForExcel.push(Array(daysInMonth + 2).fill(''));
      }
    });

    // 建立工作表並觸發下載
    const ws = XLSX.utils.aoa_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "班表");
    XLSX.writeFile(wb, "護理班表.xlsx");
  };

  // --- 渲染邏輯 ---
  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>

      <div className="inputs">
        <label>
          三班每日人數需求：
          <input type="number" value={params.D} onChange={e => setParams({ ...params, D: parseInt(e.target.value) || 0 })} placeholder="日班人數" />
          <input type="number" value={params.E} onChange={e => setParams({ ...params, E: parseInt(e.target.value) || 0 })} placeholder="小夜人數" />
          <input type="number" value={params.N} onChange={e => setParams({ ...params, N: parseInt(e.target.value) || 0 })} placeholder="大夜人數" />
        </label>
        <br />
        <label>
          每人本月應休天數：
          <input type="number" value={params.minOff} onChange={e => setParams({ ...params, minOff: parseInt(e.target.value) || 0 })} />
        </label>
        <label>
          最多連上天數：
          <input type="number" value={params.maxConsecutive} onChange={e => setParams({ ...params, maxConsecutive: parseInt(e.target.value) || 0 })} />
        </label>
      </div>

      <InputPanel
        nurseNames={nurseNames}
        setNurseNames={setNurseNames}
        availableShifts={availableShifts}
        setAvailableShifts={setAvailableShifts}
        onConfirm={handleConfirm}
      />

      {generated && (
        <>
          <ScheduleTable
            schedule={schedule}
            setSchedule={setSchedule}
            daysInMonth={daysInMonth}
            availableShifts={availableShifts}
          />
          <button onClick={handleGenerate}>產生班表</button>
          {/* ✅ 新增: 匯出Excel按鈕 */}
          <button onClick={handleExportToExcel} style={{ marginLeft: '10px' }}>匯出至Excel</button>
        </>
      )}
    </div>
  );
}

export default App;

