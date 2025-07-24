function autoGenerateSchedule(scheduleData, availableShifts, daysInMonth, params, mutualSupport) {
    const { year, month } = scheduleData.__meta;
    const schedule = { ...scheduleData };
    delete schedule.__meta;

    const nurses = Object.keys(schedule);
    const { minOff, maxConsecutive } = params;

    const isWeekday = (day) => {
        const date = new Date(year, month, day + 1);
        const dayOfWeek = date.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    };

    const getShiftCounts = (sch, nurseList) => {
        const counts = {};
        nurseList.forEach(nurse => {
            counts[nurse] = { D: 0, E: 0, N: 0, Fn: 0, OFF: 0, R: 0, work: 0, off: 0 };
            if (sch[nurse]) {
                sch[nurse].forEach(shift => {
                    if (counts[nurse][shift] !== undefined) counts[nurse][shift]++;
                    if (['D', 'E', 'N', 'Fn'].includes(shift)) counts[nurse].work++;
                    else if (['OFF', 'R'].includes(shift)) counts[nurse].off++;
                });
            }
        });
        return counts;
    };

    const checkConsecutive = (sch, nurse, day) => {
        let consecutive = 0;
        for (let i = day - 1; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        return consecutive < maxConsecutive;
    };

    let bestSchedule = {};
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 20; attempt++) {
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });

        // 階段一：優先滿足每日人力需求
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                // ✅ 修改點：移除 Fn 班只能在週間排的硬性限制
                // if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n) && checkConsecutive(currentSchedule, n, day))
                    .sort((a, b) => shiftCounts[a].work - shiftCounts[b].work);

                for(const candidate of candidates) {
                    if (assignedCount >= required) break;
                    currentSchedule[candidate][day] = shift;
                    assignedCount++;
                }
            }
        }

        // 階段二：公平性補休
        shuffledNurses.forEach(nurse => {
            let shiftCounts = getShiftCounts(currentSchedule, nurses);
            let currentOffs = shiftCounts[nurse].off;
            if (currentOffs < minOff) {
                for (let day = 0; day < daysInMonth; day++) {
                    if (currentSchedule[nurse][day] === '' && currentOffs < minOff) {
                        currentSchedule[nurse][day] = 'OFF';
                        currentOffs++;
                    }
                }
            }
        });

        // 階段三：執行支援邏輯
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n) && checkConsecutive(currentSchedule, n, day));
                if (fnCandidates.length > 0) currentSchedule[fnCandidates[0]][day] = 'D';
            }
        }
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let nCount = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if (nCount < params.N) {
                    const eCandidates = shuffledNurses.filter(n =>
                        currentSchedule[n][day] === '' &&
                        availableShifts['E']?.includes(n) &&
                        !availableShifts['N']?.includes(n) &&
                        checkConsecutive(currentSchedule, n, day)
                    );
                    if (eCandidates.length > 0) currentSchedule[eCandidates[0]][day] = 'N';
                }
            }
        }

        // 階段四：將最後所有剩餘的空格填滿 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });
        
        // 階段五：最終公平性優化 (Swap)
        for(let i=0; i<50; i++) {
            const finalCounts = getShiftCounts(currentSchedule, nurses);
            const sortedByOff = Object.entries(finalCounts).sort(([, a], [, b]) => a.off - b.off);
            if (sortedByOff.length < 2) break;

            const leastRestedNurse = sortedByOff[0][0];
            const mostRestedNurse = sortedByOff[sortedByOff.length - 1][0];

            if (finalCounts[mostRestedNurse].off - finalCounts[leastRestedNurse].off > 1) {
                let swapped = false;
                for (let day = 0; day < daysInMonth; day++) {
                    const mostShift = currentSchedule[mostRestedNurse][day];
                    const leastShift = currentSchedule[leastRestedNurse][day];
                    
                    if (mostShift === 'OFF' && ['D', 'E', 'N', 'Fn'].includes(leastShift)) {
                        if (availableShifts[leastShift]?.includes(mostRestedNurse) && checkConsecutive(currentSchedule, mostRestedNurse, day)) {
                           currentSchedule[mostRestedNurse][day] = leastShift;
                           currentSchedule[leastRestedNurse][day] = 'OFF';
                           swapped = true;
                           break;
                        }
                    }
                }
                if (!swapped) break;
            } else {
                break;
            }
        }

        // --- 最終評分 ---
        let shortage = 0;
        for (let day = 0; day < daysInMonth; day++) {
            for (const shift of ['D', 'E', 'N', 'Fn']) {
                if (shift === 'Fn' && !isWeekday(day) && params.Fn > 0) { // 如果Fn有需求，週末的人力不足也應該被計算
                    // 週末Fn班的人力不足可以有較低的權重，這裡暫不計算以保持彈性
                } else if (shift !== 'Fn' || isWeekday(day)) {
                    const required = params[shift];
                    const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                    if (actual < required) shortage += (required - actual);
                }
            }
        }
        
        const finalShiftCounts = getShiftCounts(currentSchedule, nurses);
        const offDaysArray = Object.values(finalShiftCounts).map(counts => counts.off);
        const averageOffDays = offDaysArray.reduce((sum, val) => sum + val, 0) / (offDaysArray.length || 1);
        const variance = offDaysArray.reduce((sum, val) => sum + Math.pow(val - averageOffDays, 2), 0) / (offDaysArray.length || 1);
        
        const totalScore = shortage * 1000 + variance;
        
        if (totalScore < bestScore) {
            bestScore = totalScore;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    bestSchedule.__meta = { year, month };
    return bestSchedule;
}

export default autoGenerateSchedule;

