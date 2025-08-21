import React from 'react';

// 修正點：調整下拉選單的順序
const SHIFT_OPTIONS = ['', 'R', '公', 'D', 'E', 'N', 'Fn', 'OFF'];

// 輔助函式：找出連續上班超時的區間
const getOverlappingRanges = (shifts, maxConsecutive) => {
    const ranges = [];
    let currentRangeStart = -1;
    let consecutiveCount = 0;
    (shifts || []).forEach((shift, index) => {
        if (['D', 'E', 'N', 'Fn'].includes(shift)) {
            if (currentRangeStart === -1) currentRangeStart = index;
            consecutiveCount++;
        } else {
            if (consecutiveCount > maxConsecutive) {
                ranges.push({ start: currentRangeStart, end: index - 1 });
            }
            currentRangeStart = -1;
            consecutiveCount = 0;
        }
    });
    if (consecutiveCount > maxConsecutive) {
        ranges.push({ start: currentRangeStart, end: (shifts || []).length - 1 });
    }
    return ranges;
};


function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts, params, userPrefills }) {

  const handleChange = (nurse, day, value) => {
    const updatedSchedule = { ...schedule, [nurse]: [...schedule[nurse]] };
    updatedSchedule[nurse][day] = value;
    setSchedule(updatedSchedule);
  };
  
  const nurseList = Object.keys(schedule).filter(key => key !== '__meta');
  const fnNurses = nurseList.filter(nurse => availableShifts['Fn']?.includes(nurse));
  const dNurses = nurseList.filter(nurse => availableShifts['D']?.includes(nurse) && !fnNurses.includes(nurse));
  const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
  const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));

  const renderNurseRows = (nursesToRender) => {
    if (!nursesToRender || nursesToRender.length === 0) return null;
    
    return nursesToRender.map(nurse => {
      if (!schedule[nurse]) return null;

      const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R' || s === '公').length;
      const isOffDayShortage = offDays < params.minOff;
      const consecutiveRanges = getOverlappingRanges(schedule[nurse], params.maxConsecutive);
      
      return (
        <tr key={nurse}>
          <td className="nurse-name-cell">{nurse}</td>
          {schedule[nurse].map((s, i) => {
            const isOver = consecutiveRanges.some(range => i >= range.start && i <= range.end);
            
            // 修正點：加入 Fn -> D 的檢查
            const prevShift = i > 0 ? schedule[nurse][i - 1] : null;
            const isInvalidSequence = 
                (prevShift === 'N' && (s === 'D' || s === 'E' || s === 'Fn')) ||
                (prevShift === 'E' && s === 'D') ||
                (prevShift === 'Fn' && s === 'D');

            const isPrefilled = userPrefills[nurse]?.[i] && userPrefills[nurse]?.[i] !== '';

            let cellClassName = '';
            if (isOver) cellClassName += ' over-consecutive-cell';
            if (isInvalidSequence) cellClassName += ' invalid-sequence-cell';
            if (isPrefilled) cellClassName += ' prefilled-cell';

            return (
              <td key={i} className={cellClassName.trim()}>
                <select value={s || ''} onChange={e => handleChange(nurse, i, e.target.value)}>
                  {SHIFT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
            );
          })}
          <td className={isOffDayShortage ? 'shortage-cell' : 'off-day-cell'}>{offDays}</td>
        </tr>
      );
    });
  };

  const renderTotalRow = (shift) => {
    const dailyTotals = Array.from({ length: daysInMonth }, (_, day) => {
      return nurseList.reduce((count, nurse) => {
        return schedule[nurse] && schedule[nurse][day] === shift ? count + 1 : count;
      }, 0);
    });
    
    return (
      <tr className="sum-row">
        <td>{shift} 班總計</td>
        {dailyTotals.map((total, i) => {
          const required = params[shift] || 0;
          let cellClass = '';
          // 修正點：移除對 Fn 班週末的特殊判斷
          if (total < required) {
            cellClass = 'shortage-cell';
          } else if (total > required) {
            cellClass = 'surplus-cell';
          }
          
          return (
            <td key={`total-${shift}-${i}`} className={cellClass}>
              {total}
            </td>
          );
        })}
        <td></td>
      </tr>
    );
  };
  
  // 新增：用來顯示星期幾的 JSX
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDayRow = Array.from({ length: daysInMonth }, (_, i) => {
      const year = schedule.__meta?.year || new Date().getFullYear();
      const month = schedule.__meta?.month !== undefined ? schedule.__meta.month : new Date().getMonth();
      const date = new Date(year, month, i + 1);
      return weekDays[date.getDay()];
  });


  return (
    <table className="schedule-table">
    <thead>
        <tr>
            <th className="nurse-name-header">護理師</th>
            {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i + 1}>{i + 1}</th>
            ))}
            <th className="off-day-header">休假</th>
        </tr>
        {/* 新增：星期幾的顯示列 */}
        <tr className="weekday-row">
            <th>星期</th>
            {weekDayRow.map((day, index) => (
                <th key={index}>{day}</th>
            ))}
            <th></th>
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

