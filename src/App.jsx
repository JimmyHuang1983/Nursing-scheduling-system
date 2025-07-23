import React, { useState } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';
// 引入 SheetJS/xlsx 函式庫
import 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';


function App() {
  const [nurseNames, setNurseNames] = useState('');
  // ✅ 將 Fn 加入可上班別
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31); 
  const [generated, setGenerated] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // ✅ 更新預設班別人數需求
  const [params, setParams] = useState({
    D: 6,
    E: 4,
    N: 4,
    Fn: 1, // 新增 Fn 班需求
    minOff: 8,
    maxConsecutive: 5,
  });

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
      params.Fn, // 傳入 Fn 班需求
      params.minOff,
      params.maxConsecutive,
      currentDate.getFullYear(),
      currentDate.getMonth()
    );
    setSchedule(newSchedule);
  };

  const handleExportToExcel = () => {
    // 確保xlsx函式庫已載入
    if (typeof XLSX === 'undefined') {
      alert('Excel 匯出函式庫載入中，請稍後再試。');
      return;
    }

    const nurseList = Object.keys(schedule);
    const data = [];

    // 建立表頭
    const header = ['護理師'];
    for (let i = 1; i <= daysInMonth; i++) {
      header.push(String(i));
    }
    header.push('休假');
    data.push(header);

    // 建立護理師班表資料
    nurseList.forEach(nurse => {
      const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
      const row = [nurse, ...schedule[nurse], offDays];
      data.push(row);
    });

    // 建立工作表
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 建立活頁簿
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班表');

    // 觸發下載
    XLSX.writeFile(wb, '護理班表.xlsx');
  };

  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>

      <div className="inputs">
        <label>
          三班每日人數需求：
          <input
            type="number"
            value={params.D}
            onChange={e => setParams({ ...params, D: parseInt(e.target.value) || 0 })}
            placeholder="日班人數"
          />
          <input
            type="number"
            value={params.E}
            onChange={e => setParams({ ...params, E: parseInt(e.target.value) || 0 })}
            placeholder="小夜人數"
          />
          <input
            type="number"
            value={params.N}
            onChange={e => setParams({ ...params, N: parseInt(e.target.value) || 0 })}
            placeholder="大夜人數"
          />
        </label>
        <br />
        <label>
          每人本月應休天數：
          <input
            type="number"
            value={params.minOff}
            onChange={e => setParams({ ...params, minOff: parseInt(e.target.value) || 0 })}
          />
        </label>
        <label>
          最多連上天數：
          <input
            type="number"
            value={params.maxConsecutive}
            onChange={e => setParams({ ...params, maxConsecutive: parseInt(e.target.value) || 0 })}
          />
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
            params={params}
          />
          <button onClick={handleGenerate}>產生班表</button>
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </>
      )}
    </div>
  );
}

export default App;


