import React from 'react';

const SHIFTS = ['D', 'E', 'N', 'OFF', '公', 'R'];

function ScheduleTable({ schedule, setSchedule, daysInMonth }) {
  const handleChange = (nurse, day, value) => {
    const updated = { ...schedule };
    updated[nurse][day] = value;
    setSchedule(updated);
  };

  const dailySums = Array.from({ length: daysInMonth }, (_, day) => {
    const counts = { D: 0, E: 0, N: 0 };
    Object.values(schedule).forEach(row => {
      if (['D', 'E', 'N'].includes(row[day])) counts[row[day]]++;
    });
    return counts;
  });

  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>姓名</th>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <th key={i + 1}>{i + 1}</th>
          ))}
          <th>本月休假</th>
        </tr>
      </thead>
      <tbody>
        {/* 上方加總 */}
        <tr className="sum-row">
          <td>日班人數</td>
          {dailySums.map((d, i) => (
            <td key={`D-${i}`}>{d.D}</td>
          ))}
          <td></td>
        </tr>
        <tr className="sum-row">
          <td>小夜人數</td>
          {dailySums.map((d, i) => (
            <td key={`E-${i}`}>{d.E}</td>
          ))}
          <td></td>
        </tr>
        <tr className="sum-row">
          <td>大夜人數</td>
          {dailySums.map((d, i) => (
            <td key={`N-${i}`}>{d.N}</td>
          ))}
          <td></td>
        </tr>
        {/* 真正班表 */}
        {Object.entries(schedule).map(([nurse, shifts]) => {
          const offDays = shifts.filter(s => s === 'OFF').length;
          return (
            <tr key={nurse}>
              <td>{nurse}</td>
              {shifts.map((s, i) => (
                <td key={i}>
                  <select value={s} onChange={e => handleChange(nurse, i, e.target.value)}>
                    {SHIFTS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              ))}
              <td>{offDays}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default ScheduleTable;

