import React from 'react';

const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'OFF', '公', 'R'];

// ✅ 接收 params 屬性
function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts, params }) {

  const handleChange = (nurse, day, value) => {
    const updated = { ...schedule };
    updated[nurse][day] = value;
    setSchedule(updated);
  };

  const renderShiftBlock = (shift) => {
    const nurseList = Object.keys(schedule);
    const shiftNurses = nurseList.filter(nurse => availableShifts[shift]?.includes(nurse));

    if (shiftNurses.length === 0) return null;

    const dailyTotals = Array.from({ length: daysInMonth }, (_, day) => {
      return shiftNurses.reduce((count, nurse) => {
        return schedule[nurse][day] === shift ? count + 1 : count;
      }, 0);
    });

    return (
      <tbody key={shift}>
        {/* 渲染此班別下每一位護理師的班表行 */}
        {shiftNurses.map(nurse => {
          const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
          // ✅ 檢查休假是否不足
          const isOffDayShortage = offDays < params.minOff;
          return (
            <tr key={nurse}>
              <td>{nurse}</td>
              {schedule[nurse].map((s, i) => (
                <td key={i}>
                  <select value={s} onChange={e => handleChange(nurse, i, e.target.value)}>
                    {SHIFT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              ))}
              {/* ✅ 若休假不足，則套用不足樣式 */}
              <td className={isOffDayShortage ? 'shortage-cell' : ''}>{offDays}</td>
            </tr>
          );
        })}
        {/* 渲染此班別的每日總計行 */}
        <tr className="sum-row">
          <td>{shift} 班總計</td>
          {dailyTotals.map((total, i) => {
            // ✅ 檢查每日排班人數是否不足
            const required = params[shift];
            const isShortage = total < required;
            return (
               // ✅ 若人數不足，則套用不足樣式
              <td key={`total-${shift}-${i}`} className={isShortage ? 'shortage-cell' : ''}>
                {total}
              </td>
            );
          })}
          <td></td>
        </tr>
      </tbody>
    );
  };

  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th style={{ minWidth: '100px' }}>護理師</th>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <th key={i + 1}>{i + 1}</th>
          ))}
          <th style={{ minWidth: '60px' }}>休假</th>
        </tr>
      </thead>
      {['D', 'E', 'N'].map((shift, index) => (
        <React.Fragment key={shift}>
          {renderShiftBlock(shift)}
          {index < 2 && (
            <tbody>
              <tr className="spacer-row">
                <td colSpan={daysInMonth + 2}></td>
              </tr>
            </tbody>
          )}
        </React.Fragment>
      ))}
    </table>
  );
}

export default ScheduleTable;


