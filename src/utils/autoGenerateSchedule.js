function autoGenerateSchedule(scheduleData, availableShifts, daysInMonth, params, mutualSupport) {
    // 從傳入的資料中獲取年份和月份
    const { year, month } = scheduleData.__meta;
    const schedule = { ...scheduleData };
    delete schedule.__meta;

    const nurses = Object.keys(schedule);
    const { D: dayShiftCount, E: eveningShiftCount, N: nightShiftCount, Fn: fnShiftCount, minOff, maxConsecutive } = params;

    // --- 輔助函式 ---
    const isWeekday = (day) => {
        const date = new Date(year, month, day + 1);
        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
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

    // --- 演算法主體 ---
    let bestSchedule = {};
    let bestScore = { shortage: Infinity, variance: Infinity };

    // 演算法會嘗試多次，從隨機結果中找出最佳解
    for (let attempt = 0; attempt < 30; attempt++) { // 增加嘗試次數
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空班表 (保留 'R')
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });

        // 步驟 2: 依序智慧填滿各班別
        const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
        for (const shift of shiftsInOrder) {
            for (let day = 0; day < daysInMonth; day++) {
                if (shift === 'Fn' && !isWeekday(day)) continue;

                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;

                while (assignedCount < required) {
                    const shiftCounts = getShiftCounts(currentSchedule);

                    // 尋找最佳候選人
                    const candidates = shuffledNurses
                        .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n))
                        .map(n => {
                            // 計算成本分數
                            let cost = 0;
                            // 主要成本：離目標休假天數越遠，成本越低 (越該被排)
                            cost += (minOff - shiftCounts[n].off) * 10;
                            
                            // 檢查連續上班限制
                            let consecutive = 0;
                            for (let i = day - 1; i >= 0; i--) {
                                if (['D', 'E', 'N', 'Fn'].includes(currentSchedule[n][i])) consecutive++;
                                else break;
                            }
                            if (consecutive >= maxConsecutive) {
                                cost = Infinity; // 若違反，則成本無限大
                            }
                            return { nurse: n, cost: cost };
                        })
                        .filter(c => c.cost !== Infinity)
                        .sort((a, b) => a.cost - b.cost); // 成本越低越優先

                    if (candidates.length > 0) {
                        const bestCandidate = candidates[0].nurse;
                        currentSchedule[bestCandidate][day] = shift;
                        assignedCount++;
                    } else {
                        break; // 當前班別找不到人，換下一天
                    }
                }
            }
        }

        // 步驟 3: 執行支援邏輯
        // Fn 支援 D
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < dayShiftCount) {
                const fnCandidates = shuffledNurses.filter(n =>
                    currentSchedule[n][day] === '' &&
                    availableShifts['Fn']?.includes(n) &&
                    availableShifts['D']?.includes(n)
                );
                if(fnCandidates.length > 0) {
                    currentSchedule[fnCandidates[0]][day] = 'D';
                }
            }
        }
        
        // 夜班人力互相支援
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let n_count = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if (n_count < nightShiftCount) {
                     const shiftCounts = getShiftCounts(currentSchedule);
                     const e_candidates = shuffledNurses.filter(n =>
                        availableShifts['E']?.includes(n) &&
                        !nurses.some(other => currentSchedule[other][day] === 'E' && other === n) && // 確保自己當天不是E
                        (day + 1 >= daysInMonth || currentSchedule[n][day+1] !== 'E') 
                     );
                     
                     if (e_candidates.length > 0) {
                         const personToMove = e_candidates.find(e => shiftCounts[e].off > minOff);
                         if (personToMove && currentSchedule[personToMove][day] === 'OFF'){
                             currentSchedule[personToMove][day] = 'N';
                         }
                     }
                }
            }
        }

        // 步驟 4: 將剩餘的空格填滿 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });

        // --- 新的評分機制 ---
        // 1. 計算人力短缺 (最高權重)
        let shortage = 0;
        for (let day = 0; day < daysInMonth; day++) {
            for (const shift of ['D', 'E', 'N', 'Fn']) {
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                if (actual < required) {
                    shortage += (required - actual) * 10; // 加權
                }
            }
        }
        
        // 2. 計算休假天數的公平性 (變異數，次高權重)
        const finalShiftCounts = getShiftCounts(currentSchedule);
        const offDaysArray = Object.values(finalShiftCounts).map(counts => counts.off);
        const averageOffDays = offDaysArray.reduce((sum, val) => sum + val, 0) / (offDaysArray.length || 1);
        const variance = offDaysArray.reduce((sum, val) => sum + Math.pow(val - averageOffDays, 2), 0) / (offDaysArray.length || 1);

        const currentScore = { shortage, variance };
        
        // 如果當前班表更好，則更新為最佳解
        if (currentScore.shortage < bestScore.shortage || 
           (currentScore.shortage === bestScore.shortage && currentScore.variance < bestScore.variance)) 
        {
            bestScore = currentScore;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    return bestSchedule;
}

export default autoGenerateSchedule;
