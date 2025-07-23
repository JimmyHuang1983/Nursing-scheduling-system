import React, { useState, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

// 引入 SheetJS/xlsx
const XLSX = window.XLSX;

function App() {
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [generated, setGenerated] = useState(false);
  
  // 更新預設班別需求
  const [params, setParams] = useState({
    D: 6,
    E: 4,
    N: 4,
    Fn: 1,
    minOff: 8,
    maxConsecutive: 5,
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  useEffect(() => {
    const date = new Date(params.year, params.month + 1, 0);
    setDaysInMonth(date.getDate());
  }, [params.year, params.month]);

  const handleConfirm = () => {
    const names = (nurseNames || '').split(',').map((name) => name.trim()).filter(Boolean);
    const initialSchedule = {};
    names.forEach((name) => {
      initialSchedule[name] = Array(daysInMonth).fill('');
    });
    setSchedule(initialSchedule);
    setGenerated(true);
  };

  const handleGenerate = () => {
    if (!nurseNames) {
      alert("請先輸入護理師名單！");
      return;
    }
    const newSchedule = autoGenerateSchedule(
      schedule,
      availableShifts,
      daysInMonth,
      params.D,
      params.E,
      params.N,
      params.Fn,
      params.minOff,
      params.maxConsecutive,
      params.year,
      params.month
    );
    setSchedule(newSchedule);
  };

  const handleExportToExcel = () => {
    if (Object.keys(schedule).length === 0) {
        alert("請先產生班表後再匯出！");
        return;
    }
    const worksheetData = [];
    // Header
    const header = ['護理師', ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    worksheetData.push(header);

    // Body
    Object.entries(schedule).forEach(([nurse, shifts]) => {
        worksheetData.push([nurse, ...shifts]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '班表');
    XLSX.writeFile(workbook, `護理班表_${params.year}-${params.month + 1}.xlsx`);
  };

  // DEMO 功能處理函式
  const handleDemo = () => {
    // 虛擬人名與班別資格
    const dNurses = ['王醫師', '陳護理師', '林護理師', '黃護理師', '張護理師', '李護理師', '吳護理師', '劉護理師', '蔡護理師']; // 9人
    const fnNurses = ['方技師', '周技師']; // 2人
    const eNurses = ['鄭護理師', '謝護理師', '洪護理師', '葉護理師', '蘇護理師', '賴護理師']; // 6人
    const nNurses = ['郭護理師', '曾護理師', '邱護理師', '廖護理師', '鄧護理師']; // 5人
    
    const allDemoNurses = [...dNurses, ...fnNurses, ...eNurses, ...nNurses];
    
    // 設定護理師名單
    setNurseNames(allDemoNurses.join(', '));

    // 設定可上人員
    setAvailableShifts({
        D: [...dNurses, ...fnNurses], // D班資格包含D和Fn
        E: eNurses,
        N: nNurses,
        Fn: fnNurses,
    });
    
    // 設定班別需求
    setParams(prev => ({
        ...prev,
        D: 6,
        E: 4,
        N: 4,
        Fn: 1,
    }));
  };


  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>
      <div className="inputs">
        <label>
          選擇月份：
          <input
            type="month"
            value={`${params.year}-${String(params.month + 1).padStart(2, '0')}`}
            onChange={e => {
                const [year, month] = e.target.value.split('-');
                setParams({...params, year: parseInt(year), month: parseInt(month) - 1});
            }}
          />
        </label>
        <br />
        <label>
          三班每日人數需求：
          <input type="number" value={params.D} onChange={e => setParams({ ...params, D: parseInt(e.target.value) || 0 })} placeholder="日班人數" />
          <input type="number" value={params.E} onChange={e => setParams({ ...params, E: parseInt(e.target.value) || 0 })} placeholder="小夜人數" />
          <input type="number" value={params.N} onChange={e => setParams({ ...params, N: parseInt(e.target.value) || 0 })} placeholder="大夜人數" />
          <input type="number" value={params.Fn} onChange={e => setParams({ ...params, Fn: parseInt(e.target.value) || 0 })} placeholder="Func班人數" />
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
        <div className="actions-panel">
          <button onClick={handleDemo} className="demo-button">DEMO</button>
          <button onClick={handleGenerate}>產生班表</button>
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </div>
      )}
      {generated && (
          <ScheduleTable
            schedule={schedule}
            setSchedule={setSchedule}
            daysInMonth={daysInMonth}
            availableShifts={availableShifts}
            params={params}
          />
      )}
    </div>
  );
}

export default App;


