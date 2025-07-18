import React from 'react';
import './styles.css';

const shifts = ['D', 'E', 'N', 'OFF', '公', 'R'];

function ScheduleTable({ schedule, setSchedule }) {
  const nurses = Object.keys(schedule);
  const days = [...Array(31).keys()];

  const handleChange = (nurse, day, value) => {
    const newSchedule = { ...schedule };
    newSchedule[nurse][day] = value;
    setSchedule(newSchedule);
  };

  const shiftCountPerDay = days.map(day =>
    nurses.reduce((acc, nurse) => {
      const val = schedule[nurse][day];
      if (['D', 'E', 'N'].includes(val)) acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <table className="schedule-table">
      <thead>
        <tr><th>姓名</th>{days.map(d => <th key={d}>{d + 1}</th>)}<th>休假數</th></tr>
      </thead>
      <tbody>
        {nurses.map(nurse => {
          const offCount = schedule[nurse].filter(s => s === 'OFF').length;
          return (
            <tr key={nurse}>
              <td>{nurse}</td>
              {schedule[nurse].map((val, day) => (
                <td key={day}>
                  <select value={val} onChange={e => handleChange(nurse, day, e.target.value)}>
                    {shifts.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              ))}
              <td className="summary-cell">{offCount}</td>
            </tr>
          );
        })}
        <tr className="summary-row">
          <td>加總</td>
          {days.map((_, day) => {
            const counts = shiftCountPerDay[day];
            return (
              <td key={day} className={Object.values(counts).some(c => c < 1) ? 'error-cell' : 'summary-cell'}>
                D:{counts.D || 0} E:{counts.E || 0} N:{counts.N || 0}
              </td>
            );
          })}
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

export default ScheduleTable;