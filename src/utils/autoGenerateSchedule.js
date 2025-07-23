// 函式簽名更新，以接收 params 物件和 mutualSupport 布林值
function autoGenerateSchedule(scheduleData, availableShifts, daysInMonth, params, mutualSupport) {
    // 從傳入的資料中獲取年份和月份
    const { year, month } = scheduleData.__meta;
    const schedule = { ...scheduleData };
    delete schedule.__meta; // 刪除元數據，避免干擾排班

    const nurses = Object.keys(schedule);
    const { D: dayShiftCount, E: eveningShiftCount, N: nightShiftCount, Fn: fnShiftCount, minOff, maxConsecutive } = params;

    // 輔助函式：檢查某天是否為週間 (週一至週五)
    const isWeekday = (day) => {
        const date = new Date(year, month, day + 1);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    };

    // 輔助函式：計算每個人的各班別與休假總數
    const getShiftCounts = (sch) => {
        const counts = {};
        nurses.forEach(nurse => {
            counts[nurse] = { work: 0, off: 0 };
            if (sch[nurse]) {
                sch[nurse].forEach(shift => {
                    if (['D', 'E', 'N', 'Fn'].includes(shift)) {
                        counts[nurse].work++;
                    } else if (['OFF', 'R'].includes(shift)) {
                        counts[nurse].off++;
                    }
                });
            }
        });
        return counts;
    };

    let bestSchedule = JSON.parse(JSON.stringify(schedule));
    let bestScore = Infinity; // 改為綜合分數

    // 演算法會嘗試多次，以從隨機結果中找出最佳解
    for (let attempt = 0; attempt < 20; attempt++) { // 增加嘗試次數以獲得更好結果
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空現有班表 (但保留 'R' 假)
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') {
                    currentSchedule[nurse][day] = '';
                }
            }
        });

        // 步驟 2: 依序填滿各班別
        const shiftsToFill = ['Fn', 'N', 'E', 'D'];
        shiftsToFill.forEach(shift => {
            for (let day = 0; day < daysInMonth; day++) {
                if (shift === 'Fn' && !isWeekday(day)) continue;

                const requiredCount = params[shift];
                let currentCount = nurses.filter(n => currentSchedule[n][day] === shift).length;

                while (currentCount < requiredCount) {
                    const shiftCounts = getShiftCounts(currentSchedule);
                    const candidates = shuffledNurses
                        .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n))
                        .sort((a, b) => shiftCounts[a].off - shiftCounts[b].off);

                    let assigned = false;
                    for (const candidate of candidates) {
                        let consecutive = 0;
                        for (let i = day - 1; i >= 0; i--) {
                            if (['D', 'E', 'N', 'Fn'].includes(currentSchedule[candidate][i])) {
                                consecutive++;
                            } else {
                                break;
                            }
                        }
                        if (consecutive < maxConsecutive) {
                            currentSchedule[candidate][day] = shift;
                            currentCount++;
                            assigned = true;
                            break;
                        }
                    }
                    if (!assigned) break;
                }
            }
        });
        
        // 步驟 3: Fn 班支援 D 班
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < dayShiftCount) {
                const shiftCounts = getShiftCounts(currentSchedule);
                const fnCandidates = shuffledNurses
                    .filter(n =>
                        currentSchedule[n][day] === '' &&
                        availableShifts['Fn']?.includes(n) &&
                        availableShifts['D']?.includes(n)
                    )
                    .sort((a, b) => shiftCounts[a].off - shiftCounts[b].off);

                for (const candidate of fnCandidates) {
                    if (dCount >= dayShiftCount) break;
                    let consecutive = 0;
                    for (let i = day - 1; i >= 0; i--) {
                        if (['D', 'E', 'N', 'Fn'].includes(currentSchedule[candidate][i])) consecutive++;
                        else break;
                    }
                    if (consecutive < maxConsecutive) {
                         currentSchedule[candidate][day] = 'D';
                         dCount++;
                    }
                }
            }
        }
        
        // 步驟 4: 夜班人力互相支援
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let n_count = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if (n_count < nightShiftCount) {
                     const shiftCounts = getShiftCounts(currentSchedule);
                     const e_candidates = shuffledNurses.filter(n =>
                        availableShifts['E']?.includes(n) &&
                        currentSchedule[n][day] === 'OFF' && 
                        shiftCounts[n].off > minOff && 
                        (day + 1 >= daysInMonth || currentSchedule[n][day+1] !== 'E') 
                     );
                     if (e_candidates.length > 0) {
                         currentSchedule[e_candidates[0]][day] = 'N';
                     }
                }
            }
        }

        // 步驟 5: 將剩餘的空格填滿 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });

        // ✅ 新的評分機制
        // 1. 計算人力短缺總數 (最高權重)
        let shortage = 0;
        for (let day = 0; day < daysInMonth; day++) {
            for (const shift of ['D', 'E', 'N', 'Fn']) {
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                if (actual < required) {
                    shortage += (required - actual);
                }
            }
        }

        // 2. 計算休假天數的公平性 (變異數)
        const finalShiftCounts = getShiftCounts(currentSchedule);
        const offDaysArray = Object.values(finalShiftCounts).map(counts => counts.off);
        const averageOffDays = offDaysArray.reduce((sum, val) => sum + val, 0) / (offDaysArray.length || 1);
        const variance = offDaysArray.reduce((sum, val) => sum + Math.pow(val - averageOffDays, 2), 0) / (offDaysArray.length || 1);

        // 3. 結合短缺與不公平性，計算總分
        const currentScore = shortage * 1000 + variance;

        // 如果當前分數更低，則更新為最佳解
        if (currentScore < bestScore) {
            bestScore = currentScore;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    return bestSchedule;
}

export default autoGenerateSchedule;
