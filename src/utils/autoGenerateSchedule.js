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
  const newSchedule = JSON.parse(JSON.stringify(schedule));

  for (let day = 0; day < daysInMonth; day++) {
    const assign = (shiftKey, count) => {
      const candidates = nurses.filter(
        name =>
          availableShifts[shiftKey].includes(name) &&
          newSchedule[name][day] !== 'R'
      );
      let assigned = 0;

      for (const name of candidates) {
        if (assigned >= count) break;
        const recent = newSchedule[name].slice(Math.max(0, day - maxConsecutive), day);
        const tooMany = recent.every(s => ['D', 'E', 'N'].includes(s));
        if (!tooMany && !['D', 'E', 'N'].includes(newSchedule[name][day])) {
          newSchedule[name][day] = shiftKey;
          assigned++;
        }
      }

      if (assigned < count) {
        newSchedule[`__warning__${shiftKey}_${day}`] = `⚠️ ${day + 1} 日 ${shiftKey} 班僅排到 ${assigned} 人`;
      }
    };

    assign('D', dayShiftCount);
    assign('E', eveningShiftCount);
    assign('N', nightShiftCount);
  }

  // 補休
  nurses.forEach(name => {
    const restDays = newSchedule[name].filter(s => s === 'OFF').length;
    for (let i = 0; i < daysInMonth && restDays < minOffDays; i++) {
      if (!['D', 'E', 'N', 'R'].includes(newSchedule[name][i])) {
        newSchedule[name][i] = 'OFF';
      }
    }
  });

  return newSchedule;
}

export default autoGenerateSchedule;

