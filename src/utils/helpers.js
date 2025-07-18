export function countShortages(schedule, days, Dtarget, Etarget, Ntarget) {
  const result = [];
  for (let d = 0; d < days; d++) {
    let D = 0, E = 0, N = 0;
    for (const nurse in schedule) {
      const s = schedule[nurse][d];
      if (s === 'D') D++;
      if (s === 'E') E++;
      if (s === 'N') N++;
    }
    if (D < Dtarget) result.push(`${d+1} 日班缺 ${Dtarget - D} 人`);
    if (E < Etarget) result.push(`${d+1} 小夜班缺 ${Etarget - E} 人`);
    if (N < Ntarget) result.push(`${d+1} 大夜班缺 ${Ntarget - N} 人`);
  }
  return result;
}