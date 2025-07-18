function autoGenerateSchedule(
  nurses,
  daysInMonth,
  preferredOffDays,
  minOffDays,
  maxConsecutiveDays,
  dayShiftCount,
  eveningShiftCount,
  nightShiftCount
) {
  const shifts = ['D', 'E', 'N', 'OFF', '公', 'R'];
  const schedule = {};

  // Initialize schedule with OFFs
  nurses.forEach(name => {
    schedule[name] = Array(daysInMonth).fill('OFF');
  });

  // Track daily assignments by shift
  const dailyShiftAssignments = Array.from({ length: daysInMonth }, () => ({ D: [], E: [], N: [] }));

  // Simple assignment loop with constraints
  for (let day = 0; day < daysInMonth; day++) {
    // Shuffle nurse order to randomize assignment
    const shuffled = [...nurses].sort(() => 0.5 - Math.random());

    // Helper to assign shift to a nurse
    const assignShift = (name, shift) => {
      if (schedule[name][day] === 'OFF') {
        schedule[name][day] = shift;
        if (['D', 'E', 'N'].includes(shift)) {
          dailyShiftAssignments[day][shift].push(name);
        }
        return true;
      }
      return false;
    };

    const assignForShift = (shiftKey, count) => {
      let assigned = 0;
      for (const nurse of shuffled) {
        const recent = schedule[nurse].slice(Math.max(0, day - maxConsecutiveDays + 1), day);
        const consecutiveWork = recent.length >= maxConsecutiveDays && recent.every(s => s !== 'OFF');
        const prefOff = preferredOffDays[nurse] || [];
        const isPrefOff = prefOff.includes(day + 1);

        if (!consecutiveWork && !isPrefOff && schedule[nurse][day] === 'OFF') {
          if (assignShift(nurse, shiftKey)) {
            assigned++;
            if (assigned >= count) break;
          }
        }
      }
    };

    assignForShift('D', dayShiftCount);
    assignForShift('E', eveningShiftCount);
    assignForShift('N', nightShiftCount);
  }

  // Ensure minimum off days per nurse
  nurses.forEach(nurse => {
    const currentOffCount = schedule[nurse].filter(s => s === 'OFF').length;
    const deficit = minOffDays - currentOffCount;
    if (deficit > 0) {
      const replaceableDays = schedule[nurse]
        .map((s, i) => (['D', 'E', 'N'].includes(s) ? i : -1))
        .filter(i => i >= 0);
      for (let i = 0; i < deficit && i < replaceableDays.length; i++) {
        schedule[nurse][replaceableDays[i]] = 'OFF';
      }
    }
  });

  // Fill any remaining OFF days with R (預班) or 公 (公假) optionally as placeholders
  nurses.forEach(nurse => {
    for (let day = 0; day < daysInMonth; day++) {
      if (!['D', 'E', 'N', 'OFF'].includes(schedule[nurse][day])) {
        schedule[nurse][day] = 'R'; // default to R for unassigned
      }
    }
  });

  return schedule;
}

export default autoGenerateSchedule;

