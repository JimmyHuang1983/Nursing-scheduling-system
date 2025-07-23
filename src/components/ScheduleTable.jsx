import React from 'react';

// 將 Fn 加入下拉選單選項
const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];

// Helper: 找出連續上班超時的區間
const getOverlappingRanges = (shifts, maxConsecutive) => {
    if (!shifts || maxConsecutive <= 0) return [];
    
    const ranges = [];
    let currentRangeStart = -1;

    for (let i = 0; i <= shifts.length; i++) {
        const isWorkDay = ['D', 'E', 'N', 'Fn'].includes(shifts[i]);

        if (isWorkDay && currentRangeStart === -1) {
            // 開始一個新的連續區間
            currentRangeStart = i;
        } else if (!isWorkDay && currentRangeStart !== -1) {
            // 連續區間結束
            const rangeLength = i - currentRangeStart;
            if (rangeLength > maxConsecutive) {
                ranges.push({ start: currentRangeStart, end: i - 1 });
            }
            currentRangeStart = -1;
        }
    }
    return ranges;
};


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
      
      // 找出該員連續上班超時的區間
      const overLimitRanges = getOverlappingRanges(schedule[nurse], params.maxConsecutive);

      return (
        <tr key={nurse}>
          <td>{nurse}</td>
          {schedule[nurse].map((s, i) => {
            // 檢查本日是否在超時區間內
            const isOverConsecutive = overLimitRanges.some(range => i >= range.start && i <= range.end);
            const cellClass = isOverConsecutive ? 'over-consecutive-cell' : '';

            return (
              <td key={i} className={cellClass}>
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
            )
          })}
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
        // D班總計要包含上Fn班的人
        if (shift === 'D' && schedule[nurse][day] === 'Fn') {
            return count + 1;
        }
        return schedule[nurse][day] === shift ? count + 1 : count;
      }, 0);
    });

    return (
      <tr className="sum-row">
        <td>{shift} 班總計</td>
        {dailyTotals.map((total, i) => {
          const required = params[shift] || 0;
          const isWeekday = new Date(params.year, params.month, i + 1).getDay() % 6 !== 0;
          const isShortage = shift === 'Fn' ? (isWeekday && total < required) : (total < required);
          
          return (
            <td key={`total-${shift}-${i}`} className={isShortage ? 'shortage-cell' : ''}>
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
  const fnNurses = nurseList.filter((nurse) => availableShifts['Fn']?.includes(nurse));
  const dNurses = nurseList.filter(
    (nurse) => availableShifts['D']?.includes(nurse) && !fnNurses.includes(nurse)
  );
  const eNurses = nurseList.filter((nurse) => availableShifts['E']?.includes(nurse));
  const nNurses = nurseList.filter((nurse) => availableShifts['N']?.includes(nurse));


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
      
      <tbody>
        {renderNurseRows(dNurses)}
        {renderNurseRows(fnNurses)}
        {renderTotalRow('D')}
        {renderTotalRow('Fn')}
      </tbody>

      <tbody>
         <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
      </tbody>

      <tbody>
        {renderNurseRows(eNurses)}
        {renderTotalRow('E')}
      </tbody>
      
      <tbody>
         <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
      </tbody>

      <tbody>
        {renderNurseRows(nNurses)}
        {renderTotalRow('N')}
      </tbody>

    </table>
  );
}

export default ScheduleTable;


