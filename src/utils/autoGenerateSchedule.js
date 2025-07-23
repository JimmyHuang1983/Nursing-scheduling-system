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
  // 隨機打亂護理師順序以產生不同班表
  const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);
  const newSchedule = JSON.parse(JSON.stringify(schedule));

  // 檢查某天是否為週間 (週一至週五)
  const isWeekday = (day) => {
    // day 是 0-indexed, date in new Date() is 1-indexed
    const date = new Date(year, month, day + 1);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  };

  // 1. 清空現有班表（但保留使用者預先設定的 'R' 假）
  shuffledNurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] !== 'R') {
        newSchedule[nurse][day] = '';
      }
    }
  });

  // 2. 優先處理 Fn 班
  // 先排週間 (Mon-Fri)
  for (let day = 0; day < daysInMonth; day++) {
    if (isWeekday(day)) {
      const dailyFnCount = shuffledNurses.filter(n => newSchedule[n][day] === 'Fn').length;
      if (dailyFnCount < fnShiftCount) {
        for (const nurse of shuffledNurses) {
          if (newSchedule[nurse][day] === '' && availableShifts['Fn']?.includes(nurse)) {
            newSchedule[nurse][day] = 'Fn';
            break; // 每天只排一個 Fn
          }
        }
      }
    }
  }
  // 若週間排不滿，再嘗試排週末
  for (let day = 0; day < daysInMonth; day++) {
    const dailyFnCount = shuffledNurses.filter(n => newSchedule[n][day] === 'Fn').length;
    if (dailyFnCount < fnShiftCount) {
      if (!isWeekday(day)) {
        for (const nurse of shuffledNurses) {
          if (newSchedule[nurse][day] === '' && availableShifts['Fn']?.includes(nurse)) {
            newSchedule[nurse][day] = 'Fn';
            break;
          }
        }
      }
    }
  }

  // 3. 處理 D, E, N 主力班別
  for (let day = 0; day < daysInMonth; day++) {
    const shiftsToFill = { D: dayShiftCount, E: eveningShiftCount, N: nightShiftCount };
    const shuffledShifts = Object.keys(shiftsToFill).sort(() => Math.random() - 0.5);

    shuffledShifts.forEach(shift => {
      let assignedCount = shuffledNurses.filter(n => newSchedule[n][day] === shift).length;

      // ✅ 根據班別定義候選人清單
      let candidates = [];
      if (shift === 'D') {
        // D班的候選人包含：所有D班資格的人 + 同時有D班和Fn班資格的人
        const dNurses = shuffledNurses.filter(n => availableShifts['D']?.includes(n));
        const fnSupportNurses = shuffledNurses.filter(n =>
          availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n)
        );
        // 使用 Set 避免重複，再轉回陣列
        candidates = Array.from(new Set([...dNurses, ...fnSupportNurses]));
      } else {
        // E 和 N 班的候選人維持不變
        candidates = shuffledNurses.filter(n => availableShifts[shift]?.includes(n));
      }

      for (const nurse of candidates) {
        if (assignedCount >= shiftsToFill[shift]) break;

        if (newSchedule[nurse][day] === '') {
          // 檢查連續上班天數
          let consecutive = 0;
          for (let i = day - 1; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(newSchedule[nurse][i])) {
              consecutive++;
            } else {
              break;
            }
          }

          if (consecutive < maxConsecutive) {
            newSchedule[nurse][day] = shift;
            assignedCount++;
          }
        }
      }
    });
  }

  // 4. 最後補上 'OFF'
  shuffledNurses.forEach(nurse => {
    let offDays = newSchedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
    for (let day = 0; day < daysInMonth && offDays < minOffDays; day++) {
      if (newSchedule[nurse][day] === '') {
        newSchedule[nurse][day] = 'OFF';
        offDays++;
      }
    }
  });

  return newSchedule;
}

export default autoGenerateSchedule;


