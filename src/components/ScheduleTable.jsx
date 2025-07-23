import React from 'react';

// 將 Fn 加入下拉選單選項
const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];

function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts, params }) {
  const handleChange = (nurse, day, value) => {
    const updated = { ...schedule };
    updated[nurse][day] = value;
    setSchedule(updated);
  };

  // 渲染一群護理師的班表行
  const renderNurseRows = (nursesToRender) => {
    if (!nursesToRender || nursesToRender.length === 0) return null;

    return nursesToRender.map((nurse) => {
      // 確保 schedule 物件中有該護理師的資料
      if (!schedule[nurse]) return null;

      const offDays = schedule[nurse].filter(
        (s) => s === 'OFF' || s === 'R'
      ).length;
      const isOffDayShortage = offDays < params.minOff;

      return (
        <tr key={nurse}>
          <td>{nurse}</td>
          {schedule[nurse].map((s, i) => (
            <td key={i}>
              <select
                value={s || ''}
                onChange={(e) => handleChange(nurse, i, e.target.value)}
              >
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </td>
          ))}
          <td className={isOffDayShortage ? 'shortage-cell' : ''}>
            {offDays}
          </td>
        </tr>
      );
    });
  };

  // 渲染一個班別的每日總計行
  const renderTotalRow = (shift) => {
    const dailyTotals = Array.from({ length: daysInMonth }, (_, day) => {
      return Object.keys(schedule).reduce((count, nurse) => {
        return schedule[nurse][day] === shift ? count + 1 : count;
      }, 0);
    });

    return (
      <tr className="sum-row">
        <td>{shift} 班總計</td>
        {dailyTotals.map((total, i) => {
          const required = params[shift] || 0;
          // 對於Fn班，週末不檢查人力不足
          const isWeekday =
            new Date(params.year, params.month, i + 1).getDay() % 6 !== 0;
          const isShortage =
            shift === 'Fn'
              ? isWeekday && total < required
              : total < required;

          return (
            <td
              key={`total-${shift}-${i}`}
              className={isShortage ? 'shortage-cell' : ''}
            >
              {total}
            </td>
          );
        })}
        <td></td>
      </tr>
    );
  };

  // 根據資格區分護理師群組
  const nurseList = Object.keys(schedule);
  const fnNurses = nurseList.filter((nurse) =>
    availableShifts['Fn']?.includes(nurse)
  );
  const dNurses = nurseList.filter(
    (nurse) =>
      availableShifts['D']?.includes(nurse) && !fnNurses.includes(nurse)
  );
  const eNurses = nurseList.filter((nurse) =>
    availableShifts['E']?.includes(nurse)
  );
  const nNurses = nurseList.filter((nurse) =>
    availableShifts['N']?.includes(nurse)
  );

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

      {/* 日班與 Fn 班區塊 */}
      <tbody>
        {renderNurseRows(dNurses)}
        {renderNurseRows(fnNurses)}
        {renderTotalRow('D')}
        {renderTotalRow('Fn')}
      </tbody>

      {/* 分隔線 */}
      <tbody>
        <tr className="spacer-row">
          <td colSpan={daysInMonth + 2}></td>
        </tr>
      </tbody>

      {/* 小夜班區塊 */}
      <tbody>
        {renderNurseRows(eNurses)}
        {renderTotalRow('E')}
      </tbody>

      {/* 分隔線 */}
      <tbody>
        <tr className="spacer-row">
          <td colSpan={daysInMonth + 2}></td>
        </tr>
      </tbody>

      {/* 大夜班區塊 */}
      <tbody>
        {renderNurseRows(nNurses)}
        {renderTotalRow('N')}
      </tbody>
    </table>
  );
}

export default ScheduleTable;


