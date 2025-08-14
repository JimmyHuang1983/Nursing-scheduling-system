/**
 * 自動排班演算法
 * @param {object} scheduleData - 包含護理師目前班表的物件，以及 __meta:{year, month}
 * @param {object} availableShifts - 描述每種班別有哪些護理師可上的物件
 * @param {number} daysInMonth - 當月天數
 * @param {object} params - 排班參數 { minOff, maxConsecutive, D, E, N, Fn }
 * @param {boolean} mutualSupport - 是否啟用小夜與大夜的互相支援邏輯
 * @returns {object} - 回傳計算後最佳的班表物件
 */
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
        // 檢查包含今天在內的過去連續工作天數
        for (let i = day; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        return consecutive <= maxConsecutive;
    };
    
    // 檢查班別銜接是否合法
    const isShiftSequenceValid = (schedule, nurse, day, newShift) => {
        const prevDayShift = day > 0 ? schedule[nurse][day - 1] : null;
        const nextDayShift = day < daysInMonth - 1 ? schedule[nurse][day + 1] : null;

        // 主要規則：N班前後不能接D/E/Fn班
        if (newShift === 'N') {
            if (['D', 'E', 'Fn'].includes(prevDayShift) || ['D', 'E', 'Fn'].includes(nextDayShift)) {
                return false;
            }
        }
        // D/E/Fn班的前一天不能是N班
        if (['D', 'E', 'Fn'].includes(newShift)) {
            if (prevDayShift === 'N') return false;
        }
        // E班的後一天不能是N班
        if (newShift === 'E') {
            if (nextDayShift === 'N') return false;
        }
        
        return true;
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
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => 
                        currentSchedule[n][day] === '' && 
                        availableShifts[shift]?.includes(n) && 
                        checkConsecutive(currentSchedule, n, day) &&
                        isShiftSequenceValid(currentSchedule, n, day, shift)
                    )
                    .sort((a, b) => shiftCounts[a].work - shiftCounts[b].work);

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
                const fnCandidates = shuffledNurses.filter(n => 
                    currentSchedule[n][day] === '' && 
                    availableShifts['Fn']?.includes(n) && 
                    availableShifts['D']?.includes(n) && 
                    checkConsecutive(currentSchedule, n, day) &&
                    isShiftSequenceValid(currentSchedule, n, day, 'D')
                );
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
        
        // ✅ 步驟 6: 小夜與大夜人力互相支援 (邏輯重構)
        if (mutualSupport) {
            // 進行多輪迭代，以持續優化和平衡
            for (let iter = 0; iter < 50; iter++) { 
                const currentCounts = getShiftCounts(currentSchedule, nurses);
                const eNurses = nurses.filter(n => availableShifts['E']?.includes(n));
                const nNurses = nurses.filter(n => availableShifts['N']?.includes(n));

                if (eNurses.length === 0 || nNurses.length === 0) break;

                const avgOffE = eNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / eNurses.length;
                const avgOffN = nNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / nNurses.length;

                let swapped = false;

                // 情況一：大夜班(N)比較累 (平均休假少)，讓小夜班(E)去支援
                if (avgOffE > avgOffN + 0.5) {
                    const donors = eNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off); // 休假最多的E
                    const recipients = nNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off); // 休假最少的N
                    
                    for (const donor of donors) {
                        for (const recipient of recipients) {
                            if (currentCounts[donor].off > currentCounts[recipient].off + 1) {
                                for (let day = 0; day < daysInMonth; day++) {
                                    if (currentSchedule[donor][day] === 'OFF' && currentSchedule[recipient][day] === 'N') {
                                        // 檢查換班後是否合法
                                        if (checkConsecutive(currentSchedule, donor, day) && isShiftSequenceValid(currentSchedule, donor, day, 'N')) {
                                            currentSchedule[donor][day] = 'N'; // E的人去上N班
                                            currentSchedule[recipient][day] = 'OFF';
                                            swapped = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (swapped) break;
                        }
                        if (swapped) break;
                    }
                }
                // 情況二：小夜班(E)比較累 (平均休假少)，讓大夜班(N)去支援
                else if (avgOffN > avgOffE + 0.5) {
                    const donors = nNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off); // 休假最多的N
                    const recipients = eNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off); // 休假最少的E
                    
                    for (const donor of donors) {
                        for (const recipient of recipients) {
                            if (currentCounts[donor].off > currentCounts[recipient].off + 1) {
                                for (let day = 0; day < daysInMonth; day++) {
                                    if (currentSchedule[donor][day] === 'OFF' && currentSchedule[recipient][day] === 'E') {
                                        if (checkConsecutive(currentSchedule, donor, day) && isShiftSequenceValid(currentSchedule, donor, day, 'E')) {
                                            currentSchedule[donor][day] = 'E'; // N的人去上E班
                                            currentSchedule[recipient][day] = 'OFF';
                                            swapped = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (swapped) break;
                        }
                        if (swapped) break;
                    }
                }
                
                if (!swapped) break; // 如果這一輪沒有發生交換，提前結束
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
                        // 檢查換班者是否有該班別資格 & 換班後是否合法
                        if (
                            availableShifts[leastShift]?.includes(mostRestedNurse) && 
                            checkConsecutive(currentSchedule, mostRestedNurse, day) &&
                            isShiftSequenceValid(currentSchedule, mostRestedNurse, day, leastShift)
                        ) {
                           // 模擬交換，並檢查另一方的合法性
                           const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                           tempSchedule[mostRestedNurse][day] = leastShift;
                           tempSchedule[leastRestedNurse][day] = 'OFF';
                           
                           if(isShiftSequenceValid(tempSchedule, leastRestedNurse, day, 'OFF')) {
                               currentSchedule[mostRestedNurse][day] = leastShift;
                               currentSchedule[leastRestedNurse][day] = 'OFF';
                               swapped = true;
                               break;
                           }
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

