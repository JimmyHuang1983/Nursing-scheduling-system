import React, { useState, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

function App() {
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [generated, setGenerated] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mutualSupport, setMutualSupport] = useState(false); // 新增：夜班支援狀態

  const [params, setParams] = useState({
    D: 6,
    E: 4,
    N: 4,
    Fn: 1,
    minOff: 8,
    maxConsecutive: 5,
  });

  // 當月份改變時，自動更新當月天數
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const newDaysInMonth = new Date(year, month + 1, 0).getDate();
    setDaysInMonth(newDaysInMonth);
  }, [currentDate]);

  const handleConfirm = () => {
    const names = (nurseNames || '').split(',').map(name => name.trim()).filter(Boolean);
    const initialSchedule = {};
    names.forEach(name => {
      initialSchedule[name] = Array(daysInMonth).fill('');
    });
    setSchedule(initialSchedule);
    setGenerated(true);
  };
  
  const handleDemo = () => {
    const demoNames = [
      '林小美', '陳大明', '黃小華', '張美麗', '王小英', '李小強', '周小芬', '吳小龍', '蔡小雅', // D班 (9人)
      '許小文', '鄭小靜', // Fn班 (2人)
      '廖小琪', '洪小玲', '徐小惠', '彭小君', '董小萍', '游小詩', // E班 (6人)
      '蕭小虎', '潘小豹', '鍾小獅', '任小象', '葉小狼' // N班 (5人)
    ];
    setNurseNames(demoNames.join(', '));
    setAvailableShifts({
        D: demoNames.slice(0, 9),
        Fn: demoNames.slice(9, 11),
        E: demoNames.slice(11, 17),
        N: demoNames.slice(17, 22),
    });
    setParams({ D: 6, E: 4, N: 4, Fn: 1, minOff: 8, maxConsecutive: 5 });
  };

  const handleGenerate = () => {
    const scheduleWithYearAndMonth = {
      ...schedule,
      __meta: {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
      }
    };
    const newSchedule = autoGenerateSchedule(
      scheduleWithYearAndMonth,
      availableShifts,
      daysInMonth,
      params,
      mutualSupport // 傳入夜班支援選項
    );
    delete newSchedule.__meta;
    setSchedule(newSchedule);
  };

  const handleExportToExcel = () => {
    if (typeof XLSX === 'undefined') {
      console.error('Excel 匯出函式庫 (xlsx) 尚未載入。');
      return;
    }
    const nurseList = Object.keys(schedule).filter(key => key !== '__meta');
    const data = [['護理師', ...Array.from({ length: daysInMonth }, (_, i) => i + 1), '休假']];
    nurseList.forEach(nurse => {
      const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
      data.push([nurse, ...schedule[nurse], offDays]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班表');
    XLSX.writeFile(wb, '護理班表.xlsx');
  };

  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>
      <div className="inputs">
        <label>
            排班月份：
            <input 
                type="month"
                value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`}
                onChange={e => setCurrentDate(new Date(e.target.value))}
            />
        </label>
        <br/>
        <label>
          各班每日人數需求：
          D <input type="number" value={params.D} onChange={e => setParams({ ...params, D: parseInt(e.target.value) || 0 })}/>
          E <input type="number" value={params.E} onChange={e => setParams({ ...params, E: parseInt(e.target.value) || 0 })}/>
          N <input type="number" value={params.N} onChange={e => setParams({ ...params, N: parseInt(e.target.value) || 0 })}/>
          Fn <input type="number" value={params.Fn} onChange={e => setParams({ ...params, Fn: parseInt(e.target.value) || 0 })}/>
        </label>
        <br />
        <label>
          每人本月應休天數：
          <input type="number" value={params.minOff} onChange={e => setParams({ ...params, minOff: parseInt(e.target.value) || 0 })}/>
        </label>
        <label>
          最多連上天數：
          <input type="number" value={params.maxConsecutive} onChange={e => setParams({ ...params, maxConsecutive: parseInt(e.target.value) || 0 })}/>
        </label>
        {/* 新增：夜班人力互相支援 Checkbox */}
        <label>
            <input
                type="checkbox"
                checked={mutualSupport}
                onChange={e => setMutualSupport(e.target.checked)}
            />
            夜班人力互相支援
        </label>
      </div>

      <InputPanel
        nurseNames={nurseNames}
        setNurseNames={setNurseNames}
        availableShifts={availableShifts}
        setAvailableShifts={setAvailableShifts}
        onConfirm={handleConfirm}
      />
      
      <div className="actions-panel">
         <button className="demo-button" onClick={handleDemo}>DEMO</button>
         {generated && (
            <>
              <button onClick={handleGenerate}>產生班表</button>
              <button onClick={handleExportToExcel}>匯出至Excel</button>
            </>
          )}
      </div>

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


