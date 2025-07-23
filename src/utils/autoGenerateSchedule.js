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

  // 1. 初始化
  const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);
  // 清空班表，但保留使用者預排的 'R' (Rest)
  shuffledNurses.forEach(nurse => {
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

  // 2. 優先處理 Fn 班 (硬性需求)
  // 先排週間
  for (let day = 0; day < daysInMonth; day++) {
    if (isWeekday(day)) {
      const dailyFnCount = shuffledNurses.filter(n => newSchedule[n][day] === 'Fn').length;
      if (dailyFnCount < fnShiftCount) {
        for (const nurse of shuffledNurses) {
          if (newSchedule[nurse][day] === '' && availableShifts['Fn']?.includes(nurse)) {
            newSchedule[nurse][day] = 'Fn';
            break;
          }
        }
      }
    }
  }
  // 再排週末
  for (let day = 0; day < daysInMonth; day++) {
    if (!isWeekday(day)) {
      const dailyFnCount = shuffledNurses.filter(n => newSchedule[n][day] === 'Fn').length;
      if (dailyFnCount < fnShiftCount) {
        for (const nurse of shuffledNurses) {
          if (newSchedule[nurse][day] === '' && availableShifts['Fn']?.includes(nurse)) {
            newSchedule[nurse][day] = 'Fn';
            break;
          }
        }
      }
    }
  }

  // 3. 主要排班邏輯：迭代分配 D, E, N 班，優先滿足最缺休假的人
  for (let day = 0; day < daysInMonth; day++) {
    const shiftsToFill = { D: dayShiftCount, E: eveningShiftCount, N: nightShiftCount };

    for (const shift of ['D', 'E', 'N']) {
      let assignedCount = shuffledNurses.filter(n => newSchedule[n][day] === shift).length;
      let needed = shiftsToFill[shift];

      while (assignedCount < needed) {
        // 從所有護理師中，找出符合資格且休假最少的人
        const candidates = shuffledNurses
          .filter(nurse => {
            const isQualified = availableShifts[shift]?.includes(nurse);
            const isAvailable = newSchedule[nurse][day] === '';
            
            // 檢查連續上班天數
            let consecutive = 0;
            for (let i = day - 1; i >= 0; i--) {
              if (['D', 'E', 'N', 'Fn'].includes(newSchedule[nurse][i])) {
                consecutive++;
              } else {
                break;
              }
            }
            const isNotOverworked = consecutive < maxConsecutive;

            return isQualified && isAvailable && isNotOverworked;
          })
          // 轉換成包含休假天數的物件，以便排序
          .map(name => ({
            name,
            offCount: newSchedule[name].filter(s => s === 'OFF' || s === 'R').length
          }))
          // 排序：休假最少的人優先
          .sort((a, b) => a.offCount - b.offCount);

        if (candidates.length === 0) {
          break; // 沒有適合的人可以排了
        }

        const bestCandidate = candidates[0].name;
        newSchedule[bestCandidate][day] = shift;
        assignedCount++;
      }
    }
  }

  // 4. Fn 班支援 D 班
  for (let day = 0; day < daysInMonth; day++) {
    const dAssigned = nurses.filter(n => newSchedule[n][day] === 'D').length;
    if (dAssigned < dayShiftCount) {
        const fnSupportCandidates = shuffledNurses.filter(nurse =>
            availableShifts['Fn']?.includes(nurse) &&
            availableShifts['D']?.includes(nurse) &&
            newSchedule[nurse][day] === ''
        )
        .map(name => ({
            name: name,
            offCount: newSchedule[name].filter(s => s === 'OFF' || s === 'R').length
        }))
        .sort((a, b) => a.offCount - b.offCount);

        if (fnSupportCandidates.length > 0) {
            const supportNurse = fnSupportCandidates[0].name;
            let consecutive = 0;
            for (let i = day - 1; i >= 0; i--) {
                if (['D', 'E', 'N', 'Fn'].includes(newSchedule[supportNurse][i])) {
                    consecutive++;
                } else {
                    break;
                }
            }
            if (consecutive < maxConsecutive) {
                newSchedule[supportNurse][day] = 'D';
            }
        }
    }
  }

  // 5. 最後將所有剩餘空位填滿 'OFF'
  shuffledNurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (newSchedule[nurse][day] === '') {
        newSchedule[nurse][day] = 'OFF';
      }
    }
  });

  return newSchedule;
}

export default autoGenerateSchedule;


