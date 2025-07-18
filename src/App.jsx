import React, { useState } from 'react';
import NurseScheduleApp from './NurseScheduleApp';
import InputPanel from './components/InputPanel';
import './styles.css';

function App() {
  const [nurseList, setNurseList] = useState([]);
  const [shiftAvailability, setShiftAvailability] = useState({ D: [], E: [], N: [] });

  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>
      <InputPanel
        onConfirm={(names, availability) => {
          setNurseList(names);
          setShiftAvailability(availability);
        }}
      />
      <NurseScheduleApp nurses={nurseList} availability={shiftAvailability} />
    </div>
  );
}

export default App;
