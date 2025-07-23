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

    const getShiftCounts = (sch) => {
        const counts = {};
        nurses.forEach(nurse => {
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
    let bestScore = { shortage: Infinity, variance: Infinity };

    for (let attempt = 0; attempt < 10; attempt++) {
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
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;

                while (assignedCount < required) {
                    const shiftCounts = getShiftCounts(currentSchedule);
                    const candidates = shuffledNurses
                        .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n) && checkConsecutive(currentSchedule, n, day))
                        .sort((a, b) => shiftCounts[a].off - shiftCounts[b].off);

                    if (candidates.length > 0) {
                        currentSchedule[candidates[0]][day] = shift;
                        assignedCount++;
                    } else {
                        break;
                    }
                }
            }
        }

        // 階段二：公平性補休
        shuffledNurses.forEach(nurse => {
            let shiftCounts = getShiftCounts(currentSchedule);
            while (shiftCounts[nurse].off < minOff) {
                const emptyDay = currentSchedule[nurse].findIndex(s => s === '');
                if (emptyDay !== -1) {
                    currentSchedule[nurse][emptyDay] = 'OFF';
                    shiftCounts = getShiftCounts(currentSchedule);
                } else {
                    break; 
                }
            }
        });

        // 階段三：執行支援邏輯
        // Fn 支援 D
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n) && checkConsecutive(currentSchedule, n, day));
                if (fnCandidates.length > 0) {
                    currentSchedule[fnCandidates[0]][day] = 'D';
                }
            }
        }
        
        // 夜班人力互相支援
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let n_count = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if (n_count < params.N) {
                     const shiftCounts = getShiftCounts(currentSchedule);
                     const e_candidates = shuffledNurses.filter(n =>
                        availableShifts['E']?.includes(n) &&
                        currentSchedule[n][day] === 'OFF' &&
                        shiftCounts[n].off > minOff &&
                        (day + 1 >= daysInMonth || currentSchedule[n][day+1] !== 'E') &&
                        checkConsecutive(currentSchedule, n, day)
                     );
                     
                     if (e_candidates.length > 0) {
                         currentSchedule[e_candidates[0]][day] = 'N';
                     }
                }
            }
        }
        
        // 階段四：將所有剩餘的空格填滿 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });


        // 最終評分
        let shortage = 0;
        for (let day = 0; day < daysInMonth; day++) {
            for (const shift of ['D', 'E', 'N', 'Fn']) {
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                if (actual < required) shortage += (required - actual);
            }
        }
        
        const finalShiftCounts = getShiftCounts(currentSchedule);
        const offDaysArray = Object.values(finalShiftCounts).map(counts => counts.off);
        const averageOffDays = offDaysArray.reduce((sum, val) => sum + val, 0) / (offDaysArray.length || 1);
        const variance = offDaysArray.reduce((sum, val) => sum + Math.pow(val - averageOffDays, 2), 0) / (offDaysArray.length || 1);
        
        const totalScore = shortage * 1000 + variance;
        
        if (totalScore < bestScore) {
            bestScore = totalScore;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    return bestSchedule;
}

export default autoGenerateSchedule;

