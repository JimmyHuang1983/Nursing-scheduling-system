function autoGenerateSchedule(
  schedule,
  availableShifts,
  daysInMonth,
  dayShiftCount,
  eveningShiftCount,
  nightShiftCount,
  minOffDays,
  maxConsecutive
) {
  const nurses = Object.keys(schedule);
  // ✅ 新增: 隨機化護理師處理順序，以產生不同的排班結果
  const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

  const newSchedule = JSON.parse(JSON.stringify(schedule));

  // 清空現有班表（保留使用者預排的 'R'）
  shuffledNurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] !== 'R') {
        newSchedule[nurse][day] = '';
      }
    }
  });

  // 遍歷每一天，為各班別安排人力
  for (let day = 0; day < daysInMonth; day++) {
    const shiftsToFill = {
      D: dayShiftCount,
      E: eveningShiftCount,
      N: nightShiftCount,
    };

    // 隨機打亂班別順序，避免固定模式
    const shuffledShifts = Object.keys(shiftsToFill).sort(() => Math.random() - 0.5);

    shuffledShifts.forEach(shift => {
      const requiredCount = shiftsToFill[shift];
      let assignedCount = 0;

      // 計算本日已排此班的人數
      shuffledNurses.forEach(nurse => {
        if (newSchedule[nurse][day] === shift) {
          assignedCount++;
        }
      });
      
      // 尋找可以上班的護理師
      for (const nurse of shuffledNurses) {
        if (assignedCount >= requiredCount) break;

        // 檢查條件：
        // 1. 本日尚未排班
        // 2. 護理師可上此班別
        // 3. 沒有連續上班超過天數上限
        const canWork =
          newSchedule[nurse][day] === '' &&
          availableShifts[shift]?.includes(nurse);

        if (canWork) {
          const consecutiveWorkDays = newSchedule[nurse]
            .slice(Math.max(0, day - maxConsecutive), day)
            .filter(s => ['D', 'E', 'N'].includes(s)).length;

          if (consecutiveWorkDays < maxConsecutive) {
            newSchedule[nurse][day] = shift;
            assignedCount++;
          }
        }
      }
    });
  }

  // 根據最少休假天數，補上 'OFF'
  shuffledNurses.forEach(nurse => {
    const offDays = newSchedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
    if (offDays < minOffDays) {
      for (let day = 0; day < daysInMonth; day++) {
        // 從月底開始補休假，通常較不影響排班
        const reversedDay = daysInMonth - 1 - day;
        const currentOffDays = newSchedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
        if (currentOffDays >= minOffDays) break;

        if (newSchedule[nurse][reversedDay] === '') {
          newSchedule[nurse][reversedDay] = 'OFF';
        }
      }
    }
  });

  return newSchedule;
}

export default autoGenerateSchedule;


