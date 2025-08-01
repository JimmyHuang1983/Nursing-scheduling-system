function autoGenerateSchedule(scheduleData, availableShifts, daysInMonth, params, mutualSupport) {
    // 從傳入的資料中獲取元數據
    const { year, month } = scheduleData.__meta;
    const schedule = { ...scheduleData };
    delete schedule.__meta;

    const nurses = Object.keys(schedule);
    const { minOff, maxConsecutive } = params;

    // --- 輔助函式 ---
    const isWeekday = (day) => {
        const date = new Date(year, month, day + 1);
        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
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

    // --- 演算法主體 ---
    let bestSchedule = {};
    let bestScore = Infinity;

    // 演算法會嘗試多次，從隨機結果中找出最佳解
    for (let attempt = 0; attempt < 20; attempt++) {
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空班表 (保留 'R')
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });

        // 步驟 2: **人力優先**，填滿每日各班別基礎人力
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n) && checkConsecutive(currentSchedule, n, day))
                    .sort((a, b) => shiftCounts[a].work - shiftCounts[b].work); // 優先選擇上班最少的人

                for(const candidate of candidates) {
                    if (assignedCount >= required) break;
                    currentSchedule[candidate][day] = shift;
                    assignedCount++;
                }
            }
        }

        // 步驟 3: **公平性調整**，優先把休假補滿
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

        // 步驟 4: 執行 Fn 支援 D 班的邏輯
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n) && checkConsecutive(currentSchedule, n, day));
                if (fnCandidates.length > 0) currentSchedule[fnCandidates[0]][day] = 'D';
            }
        }
        
        // 步驟 5: 將所有剩餘的空格都先填上 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });
        
        // ✅ 步驟 6: **夜班人力互相支援 (邏輯增強)**
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let currentNCount = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                
                // 當大夜班人數不足時，尋求支援
                while (currentNCount < params.N) {
                    const finalCounts = getShiftCounts(currentSchedule, nurses);
                    
                    const candidates = shuffledNurses
                        .filter(nurse => 
                            availableShifts['E']?.includes(nurse) && // 1. 是 E 班資格者
                            currentSchedule[nurse][day] === 'OFF' &&  // 2. 當天排休 (OFF)
                            finalCounts[nurse].off > minOff &&        // 3. **總休假天數 > 最低應休天數**
                            (day + 1 >= daysInMonth || currentSchedule[nurse][day + 1] !== 'E') && // 4. 隔天不能接 E 班
                            (day > 0 || currentSchedule[nurse][day-1] !== 'E') // 5. 前一天不能是E班
                        )
                        .sort((a, b) => finalCounts[b].off - finalCounts[a].off); // 6. 優先選擇休假最多的人來支援

                    if (candidates.length > 0) {
                        const supportNurse = candidates[0];
                        currentSchedule[supportNurse][day] = 'N'; // 將 OFF 改為 N
                        currentNCount++;
                    } else {
                        break; // 找不到人支援，換下一天
                    }
                }
            }
        }
        
        // 步驟 7: **最終公平性優化 (Swap)**
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
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                if (actual < required) shortage += (required - actual);
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

    // 將元數據加回去
    bestSchedule.__meta = { year, month };
    return bestSchedule;
}

export default autoGenerateSchedule;

