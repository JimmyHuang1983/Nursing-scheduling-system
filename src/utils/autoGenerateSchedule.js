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
        for (let i = day - 1; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        return consecutive < maxConsecutive;
    };
    
    const isShiftSequenceValid = (schedule, nurse, day, newShift) => {
        const prevDayShift = day > 0 ? schedule[nurse][day - 1] : null;
        const nextDayShift = day < daysInMonth - 1 ? schedule[nurse][day + 1] : null;

        if (newShift === 'N') {
            if (['D', 'E', 'Fn'].includes(prevDayShift) || ['D', 'E', 'Fn'].includes(nextDayShift)) return false;
        }
        if (['D', 'E', 'Fn'].includes(newShift)) {
            if (prevDayShift === 'N') return false;
        }
        return true;
    };

    // --- 演算法主體 ---
    let bestSchedule = {};
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 30; attempt++) {
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空班表 (保留 'R')
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });

        // 步驟 2: **人力優先**，填滿每日各班別基礎人力 (使用原始資格)
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => 
                        currentSchedule[n][day] === '' && 
                        availableShifts[shift]?.includes(n) && // ✅ 使用原始資格
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
        
        // ✅ 步驟 6: **夜班人力互相支援 (邏輯重寫)**
        if (mutualSupport) {
            // 進行多輪迭代，以持續優化和平衡
            for (let iter = 0; iter < 50; iter++) { 
                const currentCounts = getShiftCounts(currentSchedule, nurses);
                const eNurses = nurses.filter(n => availableShifts['E']?.includes(n));
                const nNurses = nurses.filter(n => availableShifts['N']?.includes(n));

                if (eNurses.length === 0 || nNurses.length === 0) break;

                let swapped = false;

                // 全面搜索所有 E 班和 N 班的組合
                for (const donor of eNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off)) { // 從休最多的E開始
                    for (const recipient of nNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off)) { // 從休最少的N開始
                        
                        // **只要休假天數差異大於 1，就嘗試交換**
                        if (currentCounts[donor].off > currentCounts[recipient].off + 1) {
                            for (let day = 0; day < daysInMonth; day++) {
                                // 尋找一個可以交換的機會點: E班人員OFF, N班人員上N班
                                if (
                                    currentSchedule[donor][day] === 'OFF' && 
                                    currentSchedule[recipient][day] === 'N'
                                ) {
                                    // 模擬交換後的班表，以進行合法性檢查
                                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                                    tempSchedule[donor][day] = 'N';
                                    tempSchedule[recipient][day] = 'OFF';
                                    
                                    // 檢查捐贈者(E班)交換後是否合法
                                    if (
                                        checkConsecutive(tempSchedule, donor, day) &&
                                        isShiftSequenceValid(tempSchedule, donor, day, 'N') &&
                                        isShiftSequenceValid(tempSchedule, recipient, day, 'OFF')
                                    ) {
                                        // 執行交換
                                        currentSchedule[donor][day] = 'N';
                                        currentSchedule[recipient][day] = 'OFF';
                                        swapped = true;
                                        break; // 完成一次交換，跳出 day 迴圈
                                    }
                                }
                            }
                        }
                        if (swapped) break; // 跳出 recipient 迴圈
                    }
                    if (swapped) break; // 跳出 donor 迴圈
                }

                if (!swapped) break; // 如果這一整輪都沒有發生任何交換，提前結束
            }
        }
        
        // 步驟 7: **最終公平性優化 (Swap)**
        for(let i=0; i < 50; i++) { 
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
                        const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                        tempSchedule[mostRestedNurse][day] = leastShift;
                        tempSchedule[leastRestedNurse][day] = 'OFF';

                        if (
                            availableShifts[leastShift]?.includes(mostRestedNurse) &&
                            checkConsecutive(tempSchedule, mostRestedNurse, day) &&
                            isShiftSequenceValid(tempSchedule, mostRestedNurse, day, leastShift) &&
                            isShiftSequenceValid(tempSchedule, leastRestedNurse, day, 'OFF')
                        ) {
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

