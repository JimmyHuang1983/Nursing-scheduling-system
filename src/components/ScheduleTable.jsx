import React from 'react';

// 常數：定義所有可能的班別選項
const SHIFT_OPTIONS = ['D', 'E', 'N', 'OFF', '公', 'R', ''];

// 新的排版，按班別分組顯示
function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts }) {
  const nurses = Object.keys(schedule);

  // 處理班表變更的函式
  const handleChange = (nurse, day, value) => {
    const updatedSchedule = { ...schedule };
    updatedSchedule[nurse][day] = value;
    setSchedule(updatedSchedule);
  };

  // 渲染單個班別區塊的函式 (D, E, N)
  const renderShiftSection = (shift) => {
    // 找出可以在此班別上班的護理師
    const shiftNurses = nurses.filter(nurse => availableShifts[shift]?.includes(nurse));
    
    // 如果這個班別沒有護理師，則不顯示
    if (shiftNurses.length === 0) {
      return null;
    }

    // 計算此班別每日的上班人數
    const dailyShiftSum = Array.from({ length: daysInMonth }, (_, day) => {
      let count = 0;
      shiftNurses.forEach(nurse => {
        if (schedule[nurse][day] === shift) {
          count++;
        }
      });
      return count;
    });

    return (
      <tbody key={shift}>
        {/* 渲染此班別下每一位護理師的班表行 */}
        {shiftNurses.map(nurse => {
          const offDays = schedule[nurse].filter(s => s === 'OFF').length;
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
              <td>{offDays}</td>
            </tr>
          );
        })}
        {/* 渲染此班別的人數加總行 */}
        <tr className="sum-row">
          <td>{shift} 班本日總計</td>
          {dailyShiftSum.map((sum, i) => (
            <td key={`sum-${shift}-${i}`}>{sum}</td>
          ))}
          <td></td>
        </tr>
        {/* 渲染用來區隔的空白行 */}
        <tr className="spacer-row">
          <td colSpan={daysInMonth + 2}></td>
        </tr>
      </tbody>
    );
  };

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
      {/* 依次渲染 D, E, N 三個班別的區塊 */}
      {['D', 'E', 'N'].map(shift => renderShiftSection(shift))}
    </table>
  );
}

export default ScheduleTable;

