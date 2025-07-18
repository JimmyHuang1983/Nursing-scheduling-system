import React from 'react';

const shiftOptions = ['D', 'E', 'N', 'OFF', 'R', '公'];

function ScheduleTable({ schedule, daysInMonth, onScheduleChange, nurses }) {
  const shiftGroups = [
    { name: '日班', code: 'D' },
    { name: '小夜班', code: 'E' },
    { name: '大夜班', code: 'N' },
  ];

  const getTotalShiftsPerDay = (dayIndex, shiftCode) => {
    return nurses.reduce((count, nurse) => {
      const shift = schedule[nurse]?.[dayIndex];
      return shift === shiftCode ? count + 1 : count;
    }, 0);
  };

  const getOffDaysForNurse = (nurse) => {
    return schedule[nurse]?.filter(s => s === 'OFF').length || 0;
  };

  return (
    <table border="1">
      <thead>
        <tr>
          <th>姓名</th>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <th key={i}>{i + 1}</th>
          ))}
          <th>本月休假天數</th>
        </tr>
      </thead>
      <tbody>
        {shiftGroups.map((group, groupIdx) => (
          <React.Fragment key={group.code}>
            {/* 加總列 */}
            <tr style={{ backgroundColor: '#eee', fontWeight: 'bold' }}>
              <td>{group.name}總人數</td>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <td key={i}>{getTotalShiftsPerDay(i, group.code)}</td>
              ))}
              <td>-</td>
            </tr>
            {/* 空白列 */}
            <tr><td colSpan={daysInMonth + 2}>&nbsp;</td></tr>

            {/* 該班別人員列 */}
            {nurses.map((nurse, i) => (
              <tr key={`${group.code}-${i}`}>
                <td>{nurse}</td>
                {Array.from({ length: daysInMonth }, (_, dayIdx) => (
                  <td key={dayIdx}>
                    <select
                      value={schedule[nurse]?.[dayIdx] || ''}
                      onChange={(e) => onScheduleChange(nurse, dayIdx, e.target.value)}
                    >
                      <option value=""></option>
                      {shiftOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                ))}
                <td>{getOffDaysForNurse(nurse)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

export default ScheduleTable;

