/**
 * 檢查護理師在指定日期是否違反了連續上班天數的規則
 * @param {string} nurse - 護理師姓名
 * @param {number} day - 要檢查的日期 (0-indexed)
 * @param {object} schedule - 當前的班表
 * @param {number} maxConsecutive - 最大連續上班天數
 * @returns {boolean} - 如果違反了規則則返回 true
 */
function checkConsecutive(nurse, day, schedule, maxConsecutive) {
  if (day < maxConsecutive) return false; // 如果天數不夠，不可能違反規則

  for (let i = 1; i <= maxConsecutive; i++) {
    // 往前檢查 maxConsecutive 天，只要有一天不是班(D/E/N)，就沒有連續
    const shift = schedule[nurse][day - i];
    if (!['D', 'E', 'N'].includes(shift)) {
      return false;
    }
  }
  // 如果往前檢查了 maxConsecutive 天全都是班，代表今天再上班就違反規則了
  return true;
}

/**
 * 智慧排班演算法
 * @returns {object} - 回傳一個新的班表物件
 */
function autoGenerateSchedule(
  currentSchedule,
  availableShifts,
  daysInMonth,
  dayShiftCount,
  eveningShiftCount,
  nightShiftCount,
  minOffDays,
  maxConsecutive
) {
  // 深度複製一份班表來進行修改，避免直接修改狀態
  const newSchedule = JSON.parse(JSON.stringify(currentSchedule));
  const nurses = Object.keys(newSchedule);
  const shiftRequirements = {
    D: dayShiftCount,
    E: eveningShiftCount,
    N: nightShiftCount,
  };

  // --- 第一步：遍歷每一天，滿足每日各班所需人數 ---
  for (let day = 0; day < daysInMonth; day++) {
    for (const shift of ['D', 'E', 'N']) {
      const requiredCount = shiftRequirements[shift];
      
      // 計算當天此班別已經有多少人被預排或手動排入
      const alreadyAssigned = nurses.filter(n => newSchedule[n][day] === shift).length;
      let needed = requiredCount - alreadyAssigned;

      if (needed <= 0) continue; // 人數已滿，換下一個班別

      // 找出所有符合資格的候選人
      let candidates = nurses.filter(nurse =>
        // 1. 該人員必須可以上這個班別
        availableShifts[shift]?.includes(nurse) &&
        // 2. 當天還沒有被排任何班 ('' 是空的)
        newSchedule[nurse][day] === '' &&
        // 3. 沒有違反連續上班規則
        !checkConsecutive(nurse, day, newSchedule, maxConsecutive)
      );
      
      // 將候選人名單隨機排序，避免每次結果都一樣
      candidates.sort(() => Math.random() - 0.5);

      // 從候選人中指派所需人數
      for (const candidate of candidates) {
        if (needed <= 0) break;
        newSchedule[candidate][day] = shift;
        needed--;
      }
    }
  }

  // --- 第二步：滿足每人最少休假天數 ---
  for (const nurse of nurses) {
    // 計算目前已排的班(D/E/N)和預設假(R/公)
    const workOrPreOffDays = newSchedule[nurse].filter(s => s !== '' && s !== 'OFF').length;
    // 計算應有的最少上班天數
    const mustWorkDays = daysInMonth - minOffDays;
    
    // 如果已排班日少於應上班日，則用 "OFF" 補足剩下的休假
    let assignedOffDays = newSchedule[nurse].filter(s => s === 'OFF').length;
    const requiredOffDays = minOffDays;

    for (let day = 0; day < daysInMonth && assignedOffDays < requiredOffDays; day++) {
      if (newSchedule[nurse][day] === '') {
        newSchedule[nurse][day] = 'OFF';
        assignedOffDays++;
      }
    }
  }

  // --- 第三步：將剩下所有空格填上休假 ---
  for (const nurse of nurses) {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] === '') {
        newSchedule[nurse][day] = 'OFF';
      }
    }
  }

  return newSchedule;
}

export default autoGenerateSchedule;

