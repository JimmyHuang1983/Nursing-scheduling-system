import React from 'react';

// 將 Fn 加入下拉選單選項
const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];

// 輔助函式：找出連續上班超時的區間
const getOverlappingRanges = (shifts, maxConsecutive) => {
    const ranges = [];
    let currentRangeStart = -1;
    let consecutiveCount = 0;

    shifts.forEach((shift, index) => {
        if (['D', 'E', 'N', 'Fn'].includes(shift)) {
            if (currentRangeStart === -1) {
                currentRangeStart = index;
            }
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
        ranges.push({ start: currentRangeStart, end: shifts.length - 1 });
    }
    return ranges;
};


function ScheduleTable({ schedule, setSchedule, daysInMonth, availableShifts, params }) {

  const handleChange = (nurse, day, value) => {
    const updatedSchedule = { ...schedule, [nurse]: [...schedule[nurse]] };
    updatedSchedule[nurse][day] = value;
    setSchedule(updatedSchedule);
  };
  
  // 根據資格區分護理師群組
  const nurseList = Object.keys(schedule).filter(key => key !== '__meta');
  const fnNurses = nurseList.filter(nurse => availableShifts['Fn']?.includes(nurse));
  const dNurses = nurseList.filter(nurse => availableShifts['D']?.includes(nurse) && !fnNurses.includes(nurse));
  const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
  const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));

  // 渲染一群護理師的班表行
  const renderNurseRows = (nursesToRender) => {
    if (!nursesToRender || nursesToRender.length === 0) return null;
    
    return nursesToRender.map(nurse => {
      if (!schedule[nurse]) return null;

      const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
      const isOffDayShortage = offDays < params.minOff;
      const consecutiveRanges = getOverlappingRanges(schedule[nurse], params.maxConsecutive);
      
      return (
        <tr key={nurse}>
          <td>{nurse}</td>
          {schedule[nurse].map((s, i) => {
            const isOver = consecutiveRanges.some(range => i >= range.start && i <= range.end);
            return (
              <td key={i} className={isOver ? 'over-consecutive-cell' : ''}>
                <select value={s || ''} onChange={e => handleChange(nurse, i, e.target.value)}>
                  {SHIFT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
            );
          })}
          <td className={isOffDayShortage ? 'shortage-cell' : ''}>{offDays}</td>
        </tr>
      );
    });
  };

  // 渲染一個班別的每日總計行
  const renderTotalRow = (shift) => {
    // ✅ 簡化並修正後的統一計算邏輯
    const dailyTotals = Array.from({ length: daysInMonth }, (_, day) => {
      return nurseList.reduce((count, nurse) => {
        // 如果該護理師當天的班別與我們要計算的班別相符，則計數+1
        return schedule[nurse] && schedule[nurse][day] === shift ? count + 1 : count;
      }, 0);
    });

    const required = params[shift] || 0;
    
    return (
      <tr className="sum-row">
        <td>{shift} 班總計</td>
        {dailyTotals.map((total, i) => {
          // 確保能從 params 拿到 year 和 month
          const year = params.year || new Date().getFullYear();
          const month = params.month !== undefined ? params.month : new Date().getMonth();
          const date = new Date(year, month, i + 1);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          
          let isShortage = total < required;
          // Fn班週末不檢查人力不足
          if (shift === 'Fn' && isWeekend) {
            isShortage = false; 
          }
          
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

  return (
    <div style={{ overflowX: 'auto' }}>
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
            <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
        </tbody>

        {/* 小夜班區塊 */}
        <tbody>
            {renderNurseRows(eNurses)}
            {renderTotalRow('E')}
        </tbody>
        
        {/* 分隔線 */}
        <tbody>
            <tr className="spacer-row"><td colSpan={daysInMonth + 2}></td></tr>
        </tbody>

        {/* 大夜班區塊 */}
        <tbody>
            {renderNurseRows(nNurses)}
            {renderTotalRow('N')}
        </tbody>

        </table>
    </div>
  );
}

export default ScheduleTable;
```


