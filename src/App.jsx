import React, { useState } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

function App() {
  // --- State for the entire application ---
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [] });
  const [schedule, setSchedule] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(31); // You can adjust the default
  const [generated, setGenerated] = useState(false);
  const [params, setParams] = useState({
    D: 2,
    E: 2,
    N: 2,
    minOff: 8,
    maxConsecutive: 5,
  });

  // --- Event Handlers ---
  const handleConfirm = () => {
    const names = (nurseNames || '').split(',').map(name => name.trim()).filter(Boolean);
    const initialSchedule = {};
    names.forEach(name => {
      initialSchedule[name] = Array(daysInMonth).fill('');
    });
    setSchedule(initialSchedule);
    setGenerated(true); // Show the schedule table and generate button
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

  // --- Render Logic ---
  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>

      {/* --- Parameter Inputs --- */}
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

      {/* --- Nurse and Shift Inputs --- */}
      <InputPanel
        nurseNames={nurseNames}
        setNurseNames={setNurseNames}
        availableShifts={availableShifts}
        setAvailableShifts={setAvailableShifts}
        onConfirm={handleConfirm}
      />

      {/* --- Schedule Table and Generate Button (only appears after confirmation) --- */}
      {generated && (
        <>
          <ScheduleTable
            schedule={schedule}
            setSchedule={setSchedule}
            daysInMonth={daysInMonth}
            availableShifts={availableShifts}
          />
          <button onClick={handleGenerate}>產生班表</button>
        </>
      )}
    </div>
  );
}

export default App;
