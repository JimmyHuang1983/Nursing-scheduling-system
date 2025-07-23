// 函式簽名更新以接收 Fn 班資訊、年份和月份
function autoGenerateSchedule(
  schedule,
  availableShifts,
  daysInMonth,
  dayShiftCount,
  eveningShiftCount,
  nightShiftCount,
  fnShiftCount,
  minOffDays,
  maxConsecutive,
  year,
  month // month is 0-11
) {
  const nurses = Object.keys(schedule);
  const newSchedule = JSON.parse(JSON.stringify(schedule));

  // --- 1. 初始化 ---
  // 清空班表，但保留使用者預排的 'R' (Rest)
  nurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] !== 'R') {
        newSchedule[nurse][day] = '';
      }
    }
  });

  const isWeekday = (day) => {
    const date = new Date(year, month, day + 1);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  };
  
  const targetWorkDays = daysInMonth - minOffDays;

  // --- 2. 核心排班迴圈 ---
  // 逐日填滿班表
  for (let day = 0; day < daysInMonth; day++) {
    // 班別需求，可以調整優先順序，例如 N 班限制較多，可優先排
    const shiftsToFill = {
      N: nightShiftCount,
      E: eveningShiftCount,
      D: dayShiftCount,
      Fn: isWeekday(day) ? fnShiftCount : 0, // Fn 班優先排週間
    };
    
    // 隨機化班別順序，增加多樣性
    const shiftOrder = Object.keys(shiftsToFill).sort(() => Math.random() - 0.5);

    for (const shift of shiftOrder) {
      let needed = shiftsToFill[shift];
      let assignedCount = nurses.filter(n => newSchedule[n][day] === shift).length;

      while (assignedCount < needed) {
        // 從所有護理師中，找出最適合的人選
        const candidates = nurses
          .map(nurse => {
            // -- 檢查資格 --
            // 1. 是否有此班別資格
            const isQualified = availableShifts[shift]?.includes(nurse);
            // 2. 當天是否為空班
            const isAvailable = newSchedule[nurse][day] === '';
            // 3. 檢查連續上班天數是否超標
            let consecutive = 0;
            for (let i = day - 1; i >= 0; i--) {
              if (['D', 'E', 'N', 'Fn'].includes(newSchedule[nurse][i])) {
                consecutive++;
              } else {
                break;
              }
            }
            const isNotOverworked = consecutive < maxConsecutive;
            
            if (!isQualified || !isAvailable || !isNotOverworked) {
              return null;
            }

            // -- 計算分數 --
            const workDays = newSchedule[nurse].filter(s => ['D', 'E', 'N', 'Fn'].includes(s)).length;
            // 分數越高代表越需要被排班 (離目標工時最遠)
            const needToWorkScore = targetWorkDays - workDays;
            
            return { name: nurse, score: needToWorkScore };
          })
          .filter(c => c !== null) // 移除不合格人選
          // 排序：分數高者優先，分數相同則隨機
          .sort((a, b) => b.score - a.score || Math.random() - 0.5);

        if (candidates.length === 0) {
          break; // 當天此班別已找不到適合人選
        }

        const bestCandidate = candidates[0].name;
        newSchedule[bestCandidate][day] = shift;
        assignedCount++;
      }
    }
  }

  // --- 3. Fn 班支援 D 班 & 填補週末 Fn 班 ---
  for (let day = 0; day < daysInMonth; day++) {
    // 檢查 D 班是否缺人
    const dAssigned = nurses.filter(n => newSchedule[n][day] === 'D').length;
    if (dAssigned < dayShiftCount) {
      const fnSupportCandidates = nurses.filter(nurse =>
        availableShifts['Fn']?.includes(nurse) &&
        availableShifts['D']?.includes(nurse) &&
        newSchedule[nurse][day] === ''
      );
      if (fnSupportCandidates.length > 0) {
        newSchedule[fnSupportCandidates[0]][day] = 'D';
      }
    }
    // 檢查週末 Fn 班是否缺人
    if (!isWeekday(day)) {
        const fnAssigned = nurses.filter(n => newSchedule[n][day] === 'Fn').length;
        if(fnAssigned < fnShiftCount) {
             const fnWeekendCandidates = nurses.filter(nurse => 
                availableShifts['Fn']?.includes(nurse) && newSchedule[nurse][day] === ''
             );
             if(fnWeekendCandidates.length > 0) {
                 newSchedule[fnWeekendCandidates[0]][day] = 'Fn';
             }
        }
    }
  }

  // --- 4. 最後將所有剩餘空位填滿 'OFF' ---
  nurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] === '') {
        newSchedule[nurse][day] = 'OFF';
      }
    }
  });

  return newSchedule;
}

export default autoGenerateSchedule;


