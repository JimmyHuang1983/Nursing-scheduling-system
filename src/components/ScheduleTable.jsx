import React from 'react';

// 維持現有的下拉選單選項
const SHIFT_OPTIONS = ['', 'D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];

// *** 新增的輔助函式 ***
// 功能：找出並回傳所有連續上班天數超過上限的區間
const getOverlappingRanges = (shifts, maxConsecutive) => {
    // 如果沒有班表資料或天數限制無效，則回傳空陣列
    if (!shifts || maxConsecutive <= 0) return [];
    
    const ranges = [];
    let currentRangeStart = -1;

    // 遍歷所有天數以找出連續區間
    for (let i = 0; i <= shifts.length; i++) {
        // 定義哪些班別算是「上班日」
        const isWorkDay = ['D', 'E', 'N', 'Fn'].includes(shifts[i]);

        if (isWorkDay && currentRangeStart === -1) {
            // 偵測到一個新連續區間的開始
            currentRangeStart = i;
        } else if (!isWorkDay && currentRangeStart !== -1) {
            // 偵測到一個連續區間的結束
            const rangeLength = i - currentRangeStart;
            // 如果區間長度超過上限，就記錄下來
            if (rangeLength > maxConsecutive) {
                ranges.push({ start: currentRangeStart, end: i - 1 });
            }
            // 重設起始點，準備偵測下一個區間
            currentRangeStart = -1;
        }
    }
    return ranges;
};
// *** 輔助函式結束 ***


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
      // 確保 schedule 物件中有該護理師的資料，避免錯誤
      if (!schedule[nurse]) return null;

      const offDays = schedule[nurse].filter(
        (s) => s === 'OFF' || s === 'R'
      ).length;
      const isOffDayShortage = offDays < params.minOff;
      
      // *** 修改開始：為每位護理師找出超時區間 ***
      const overLimitRanges = getOverlappingRanges(schedule[nurse], params.maxConsecutive);
      // *** 修改結束 ***

      return (
        <tr key={nurse}>
          <td>{nurse}</td>
          {schedule[nurse].map((s, i) => {
            // *** 修改開始：檢查本日是否在超時區間內 ***
            const isOverConsecutive = overLimitRanges.some(range => i >= range.start && i <= range.end);
            // 如果是，就賦予特殊的 CSS class
            const cellClass = isOverConsecutive ? 'over-consecutive-cell' : '';
            // *** 修改結束 ***

            return (
              // 將 class 名稱套用到儲存格上
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

  // --- 以下的程式碼維持不變 ---

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

