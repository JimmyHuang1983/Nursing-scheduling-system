import React, { useState } from 'react';
import './App.css';
import ScheduleTable from './ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';


function App() {
  const [nurses, setNurses] = useState(['Alice', 'Bob', 'Charlie']);
  const [preferredOffDays, setPreferredOffDays] = useState({});
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [minOffDays, setMinOffDays] = useState(8);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(5);
  const [dayShiftCount, setDayShiftCount] = useState(2);
  const [eveningShiftCount, setEveningShiftCount] = useState(2);
  const [nightShiftCount, setNightShiftCount] = useState(1);

  const handleGenerate = () => {
    const newSchedule = autoGenerateSchedule(
      nurses,
      daysInMonth,
      preferredOffDays,
      minOffDays,
      maxConsecutiveDays,
      dayShiftCount,
      eveningShiftCount,
      nightShiftCount
    );
    setSchedule(newSchedule);
  };

  const handleNameChange = (index, value) => {
    const updated = [...nurses];
    updated[index] = value;
    setNurses(updated);
  };

  const handleAddNurse = () => {
    setNurses([...nurses, '']);
  };

  const handlePreferredChange = (name, value) => {
    const days = value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    setPreferredOffDays({ ...preferredOffDays, [name]: days });
  };

  const handleScheduleChange = (name, dayIndex, newShift) => {
    const updated = { ...schedule };
    updated[name][dayIndex] = newShift;
    setSchedule(updated);
  };

  return (
    <div className="App">
      <h1>護理人員自動排班系統</h1>

      <h2>1. 班別設定（每日需求人數）</h2>
      <div>
        <label>日班：<input type="number" value={dayShiftCount} onChange={e => setDayShiftCount(+e.target.value)} /></label>
        <label> 小夜班：<input type="number" value={eveningShiftCount} onChange={e => setEveningShiftCount(+e.target.value)} /></label>
        <label> 大夜班：<input type="number" value={nightShiftCount} onChange={e => setNightShiftCount(+e.target.value)} /></label>
      </div>

      <h2>2. 人員名單</h2>
      {nurses.map((nurse, i) => (
        <div key={i}>
          <input
            type="text"
            value={nurse}
            placeholder={`人員 ${i + 1}`}
            onChange={e => handleNameChange(i, e.target.value)}
          />
        </div>
      ))}
      <button onClick={handleAddNurse}>新增人員</button>

      <h2>3. 預休日期設定</h2>
      {nurses.map((nurse, i) => (
        <div key={i}>
          <label>{nurse || `人員 ${i + 1}`} 預休：
            <input
              type="text"
              placeholder="例如：7,15,21"
              onChange={e => handlePreferredChange(nurse, e.target.value)}
            />
          </label>
        </div>
      ))}

      <h2>4. 參數設定</h2>
      <label>月份天數：<input type="number" value={daysInMonth} onChange={e => setDaysInMonth(+e.target.value)} /></label>
      <label> 最少休假天數：<input type="number" value={minOffDays} onChange={e => setMinOffDays(+e.target.value)} /></label>
      <label> 最多連續上班天數：<input type="number" value={maxConsecutiveDays} onChange={e => setMaxConsecutiveDays(+e.target.value)} /></label>

      <div>
        <button onClick={handleGenerate}>產生排班表</button>
      </div>

      <ScheduleTable 
        schedule={schedule} 
        daysInMonth={daysInMonth} 
        onScheduleChange={handleScheduleChange} 
        nurses={nurses}
      />
    </div>
  );
}

export default App;

