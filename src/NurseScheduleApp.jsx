import React, { useState } from 'react';
import ScheduleTable from './ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import { countShortages } from './utils/helpers';

function NurseScheduleApp({ nurses, availability }) {
  const [schedule, setSchedule] = useState({});
  const [errors, setErrors] = useState([]);
  const daysInMonth = 31;
  const minOffDays = 8;
  const maxConsecutiveDays = 5;
  const dayShiftCount = 3, eveningShiftCount = 2, nightShiftCount = 2;

  const generate = () => {
    const newSchedule = autoGenerateSchedule(
      nurses, daysInMonth, {}, minOffDays, maxConsecutiveDays,
      dayShiftCount, eveningShiftCount, nightShiftCount, availability, schedule
    );
    setSchedule(newSchedule);
    const err = countShortages(newSchedule, daysInMonth, dayShiftCount, eveningShiftCount, nightShiftCount);
    setErrors(err);
  };

  return (
    <div>
      <button onClick={generate}>產生班表</button>
      <ScheduleTable schedule={schedule} setSchedule={setSchedule} />
      {errors.length > 0 && (
        <div className="error-report">
          <h4>⚠️ 缺人警示</h4>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default NurseScheduleApp;
