import React from 'react';

// 將 Fn 加入下拉選單選項
const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];

function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts, params }) {

  const handleChange = (nurse, day, value) => {
    const updated = { ...schedule };
    updated[nurse][day] = value;
    setSchedule(updated);
  };

  // 渲染一個班別區塊 (D, E, N, Fn)
  const renderShiftBlock = (shift) => {
    const nurseList = Object.keys(schedule);
    const shiftNurses = nurseList.filter(nurse => availableShifts[shift]?.includes(nurse));

    // 如果這個班別沒有任何可上人員，則不渲染此區塊
    if (shiftNurses.length === 0) return null;

    // 計算此班別的每日總計人數
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
              <td className={isOffDayShortage ? 'shortage-cell' : ''}>{offDays}</td>
            </tr>
          );
        })}
        {/* 渲染此班別的每日總計行 */}
        <tr className="sum-row">
          <td>{shift} 班總計</td>
          {dailyTotals.map((total, i) => {
            const required = params[shift] || 0;
            const isShortage = total < required;
            return (
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
      {/* 按照 D, Fn, E, N 的順序渲染班別區塊，並在中間加入間隔 */}
      <React.Fragment>
        {renderShiftBlock('D')}
        <tbody key="spacer-d-fn">
          <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
        </tbody>
        {renderShiftBlock('Fn')}
        <tbody key="spacer-fn-e">
          <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
        </tbody>
        {renderShiftBlock('E')}
        <tbody key="spacer-e-n">
          <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
        </tbody>
        {renderShiftBlock('N')}
      </React.Fragment>
    </table>
  );
}

export default ScheduleTable;


