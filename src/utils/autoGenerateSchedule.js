function autoGenerateSchedule(scheduleData, availableShifts, daysInMonth, params, mutualSupport) {
    // 從傳入的資料中獲取年份和月份
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
    
    // 輔助函式：檢查是否違反連續上班規定
    const checkConsecutive = (sch, nurse, day) => {
        let consecutive = 0;
        for (let i = day - 1; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        return consecutive < maxConsecutive;
    };

    // --- 全新演算法主體 ---
    let bestSchedule = {};
    let bestScore = Infinity;

    // 演算法會嘗試多次，從隨機結果中找出最佳解
    for (let attempt = 0; attempt < 50; attempt++) { 
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空班表 (保留 'R')
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });

        // 步驟 2: **迭代填滿空格**，每次都選擇最優的選擇
        // 這個迴圈會重複執行，直到所有空格都被填滿
        let changedInLoop = true;
        while(changedInLoop) {
            changedInLoop = false;
            let bestCell = { nurse: null, day: -1, shift: null, score: -Infinity };

            // 遍歷所有護理師和天數，找出最佳填補位置
            for (const nurse of shuffledNurses) {
                for (let day = 0; day < daysInMonth; day++) {
                    if (currentSchedule[nurse][day] === '') {
                        // 評估在此處填入各班別的「分數」
                        for (const shift of ['D', 'E', 'N', 'Fn', 'OFF']) {
                            if (!availableShifts[shift]?.includes(nurse) && shift !== 'OFF') continue;
                            if (shift === 'Fn' && !isWeekday(day)) continue;
                            if (!checkConsecutive(currentSchedule, nurse, day)) continue;

                            let currentScore = 0;
                            const dailyAssigned = nurses.filter(n => currentSchedule[n][day] === shift).length;
                            const required = params[shift] || 0;

                            // 核心計分邏輯：
                            // 1. 如果該班別人力不足，則優先填補 (高分)
                            if (shift !== 'OFF' && dailyAssigned < required) {
                                currentScore += 1000;
                            }

                            // 2. 如果該員休假不足，則優先給假 (次高分)
                            const shiftCounts = getShiftCounts(currentSchedule);
                            if (shift === 'OFF' && shiftCounts[nurse].off < minOff) {
                                currentScore += 500;
                            }

                            // 3. 避免讓人休太多假
                            if (shift === 'OFF' && shiftCounts[nurse].off >= minOff) {
                                currentScore -= 200; // 不鼓勵休超過的假
                            }
                            
                            // 4. 隨機性，以產生多樣化結果
                            currentScore += Math.random() * 50;

                            if (currentScore > bestCell.score) {
                                bestCell = { nurse, day, shift, score: currentScore };
                            }
                        }
                    }
                }
            }
            
            // 如果找到了最佳填補位置，就填入並重新開始下一輪迭代
            if (bestCell.nurse) {
                currentSchedule[bestCell.nurse][bestCell.day] = bestCell.shift;
                changedInLoop = true;
            }
        }
        
        // 步驟 3: 最終檢查與評分
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
        
        // 總分結合了「人力短缺」和「休假不公」
        const totalScore = shortage * 1000 + variance;
        
        if (totalScore < bestScore) {
            bestScore = totalScore;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    return bestSchedule;
}

export default autoGenerateSchedule;
