function autoGenerateSchedule(
  nurses,
  daysInMonth,
  preferredOffDays,
  minOffDays,
  maxConsecutiveDays,
  dayShiftCount,
  eveningShiftCount,
  nightShiftCount,
  availability,
  existingSchedule
) {
  const shifts = ['D', 'E', 'N', 'OFF', '公', 'R'];
  const schedule = {};

  // Initialize
  nurses.forEach(name => {
    schedule[name] = Array.from({ length: daysInMonth }, (_, i) =>
      existingSchedule?.[name]?.[i] === 'R' ? 'R' : 'OFF'
    );
  });

  const dailyShiftAssignments = Array.from({ length: daysInMonth }, () => ({ D: [], E: [], N: [] }));

  for (let day = 0; day < daysInMonth; day++) {
    const shuffled = [...nurses].sort(() => 0.5 - Math.random());

    const assignForShift = (shiftKey, count) => {
      let assigned = 0;
      for (const nurse of shuffled) {
        const recent = schedule[nurse].slice(Math.max(0, day - maxConsecutiveDays), day);
        const tooMany = recent.filter(s => ['D', 'E', 'N'].includes(s)).length >= maxConsecutiveDays;
        if (schedule[nurse][day] === 'OFF' && !tooMany && availability[shiftKey]?.includes(nurse)) {
          schedule[nurse][day] = shiftKey;
          dailyShiftAssignments[day][shiftKey].push(nurse);
          assigned++;
          if (assigned >= count) break;
        }
      }
    };

    assignForShift('D', dayShiftCount);
    assignForShift('E', eveningShiftCount);
    assignForShift('N', nightShiftCount);
  }

  // Fill OFF for unmet minOff
  nurses.forEach(nurse => {
    const current = schedule[nurse].filter(s => s === 'OFF').length;
    const deficit = minOffDays - current;
    if (deficit > 0) {
      const replaceable = schedule[nurse].map((s, i) => (['D', 'E', 'N'].includes(s) ? i : -1)).filter(i => i >= 0);
      for (let i = 0; i < deficit && i < replaceable.length; i++) {
        schedule[nurse][replaceable[i]] = 'OFF';
      }
    }
  });

  return schedule;
}

export default autoGenerateSchedule;