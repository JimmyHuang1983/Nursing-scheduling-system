import React, { useState } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

function App() {
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

  const handleConfirm = () => {
    const names = nurseNames.split(',').map(name => name.trim()).filter(Boolean);
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

  return (
    <div className="app">
      <h1>AI 護理排班系統</h1>
      <div className="inputs">
        <label>
          三班每日人數需求：
          <input
            type="number"
            value={params.D}
            onChange={e => setParams({ ...params, D: parseInt(e.target.value) })}
            placeholder="日班人數"
          />
          <input
            type="number"
            value={params.E}
            onChange={e => setParams({ ...params, E: parseInt(e.target.value) })}
            placeholder="小夜人數"
          />
          <input
            type="number"
            value={params.N}
            onChange={e => setParams({ ...params, N: parseInt(e.target.value) })}
            placeholder="大夜人數"
          />
        </label>
        <br />
        <label>
          每人本月應休天數：
          <input
            type="number"
            value={params.minOff}
            onChange={e => setParams({ ...params, minOff: parseInt(e.target.value) })}
          />
        </label>
        <label>
          最多連上天數：
          <input
            type="number"
            value={params.maxConsecutive}
            onChange={e => setParams({ ...params, maxConsecutive: parseInt(e.target.value) })}
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
          />
          <button onClick={handleGenerate}>產生班表</button>
        </>
      )}
    </div>
  );
}

export default App;

