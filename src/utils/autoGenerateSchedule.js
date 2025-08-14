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
        // 檢查從今天往前算的連續工作天數
        for (let i = day; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        // 注意：這裡的判斷是 <= maxConsecutive，因為 max=6 表示最多可以連上6天
        return consecutive <= maxConsecutive;
    };

    const isShiftSequenceValid = (schedule, nurse, day, newShift) => {
        const prevDayShift = day > 0 ? schedule[nurse][day - 1] : null;
        const nextDayShift = day < daysInMonth - 1 ? schedule[nurse][day + 1] : null;

        // 規則1：上大夜(N)的「前一天」和「後一天」都不能是D/E/Fn班
        if (newShift === 'N') {
            if (['D', 'E', 'Fn'].includes(prevDayShift) || ['D', 'E', 'Fn'].includes(nextDayShift)) {
                return false;
            }
        }
        // 規則2：上D/E/Fn班的「前一天」不能是大夜(N)
        if (['D', 'E', 'Fn'].includes(newShift)) {
            if (prevDayShift === 'N') return false;
        }
        
        // 規則3: 上小夜(E)的「後一天」不能是大夜(N)
        if (newShift === 'E') {
             if (nextDayShift === 'N') return false;
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

        // 步驟 2: **人力優先**，填滿每日各班別基礎人力 (嚴格遵守原始資格)
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => 
                        currentSchedule[n][day] === '' && 
                        availableShifts[shift]?.includes(n) && // ✅ 此處嚴格遵守原始資格
                        checkConsecutive(currentSchedule, n, day) &&
                        isShiftSequenceValid(currentSchedule, n, day, shift)
                    )
                    .sort((a, b) => shiftCounts[a].work - shiftCounts[b].work);

                for(const candidate of candidates) {
                    if (assignedCount >= required) break;
                    // 模擬指派並檢查合法性
                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                    tempSchedule[candidate][day] = shift;
                    if(checkConsecutive(tempSchedule, candidate, day)) {
                        currentSchedule[candidate][day] = shift;
                        assignedCount++;
                    }
                }
            }
        }

        // 步驟 3 & 4: 補滿休假 & Fn支援D班
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
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                 const fnCandidates = shuffledNurses.filter(n => 
                    currentSchedule[n][day] === '' && 
                    availableShifts['Fn']?.includes(n) && 
                    availableShifts['D']?.includes(n) // Fn支援D，需要兩邊都有資格
                );
                if (fnCandidates.length > 0) {
                     const candidate = fnCandidates[0];
                     const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                     tempSchedule[candidate][day] = 'D';
                     if(checkConsecutive(tempSchedule, candidate, day) && isShiftSequenceValid(tempSchedule, candidate, day, 'D')) {
                        currentSchedule[candidate][day] = 'D';
                     }
                }
            }
        }
        
        // 步驟 5: 將所有剩餘的空格都先填上 'OFF'
        nurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });
        
        // ✅ 步驟 6: 小夜與大夜人力互相支援 (修正版)
        if (mutualSupport) {
            for (let iter = 0; iter < 50; iter++) { 
                const currentCounts = getShiftCounts(currentSchedule, nurses);
                const eNurses = nurses.filter(n => availableShifts['E']?.includes(n));
                const nNurses = nurses.filter(n => availableShifts['N']?.includes(n));

                if (eNurses.length === 0 || nNurses.length === 0) break;

                const avgOffE = eNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / eNurses.length;
                const avgOffN = nNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / nNurses.length;

                let swapped = false;
                
                // 判斷支援方向
                // 情況一：大夜班(N)比較累 -> 小夜(E)來支援
                if (avgOffE > avgOffN + 0.5) {
                    const donors = eNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                    const recipients = nNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off);
                    
                    for (const donor of donors) { // 捐贈者 (休假較多的E)
                        for (const recipient of recipients) { // 接受者 (休假較少的N)
                            if (currentCounts[donor].off <= currentCounts[recipient].off + 1) continue;

                            for (let day = 0; day < daysInMonth; day++) {
                                if (currentSchedule[donor][day] === 'OFF' && currentSchedule[recipient][day] === 'N') {
                                    // 關鍵：此處不再檢查 availableShifts['N'] 是否包含 donor
                                    // 因為啟動了支援，所以 E 班人員臨時獲得上 N 班的資格
                                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                                    tempSchedule[donor][day] = 'N';
                                    tempSchedule[recipient][day] = 'OFF';

                                    if (checkConsecutive(tempSchedule, donor, day) && isShiftSequenceValid(tempSchedule, donor, day, 'N')) {
                                        currentSchedule[donor][day] = 'N';
                                        currentSchedule[recipient][day] = 'OFF';
                                        swapped = true;
                                        break;
                                    }
                                }
                            }
                            if (swapped) break;
                        }
                        if (swapped) break;
                    }
                }
                // 情況二：小夜班(E)比較累 -> 大夜(N)來支援
                else if (avgOffN > avgOffE + 0.5) {
                    const donors = nNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                    const recipients = eNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off);

                    for (const donor of donors) { // 捐贈者 (休假較多的N)
                        for (const recipient of recipients) { // 接受者 (休假較少的E)
                           if (currentCounts[donor].off <= currentCounts[recipient].off + 1) continue;

                            for (let day = 0; day < daysInMonth; day++) {
                                if (currentSchedule[donor][day] === 'OFF' && currentSchedule[recipient][day] === 'E') {
                                    // 關鍵：此處不再檢查 availableShifts['E'] 是否包含 donor
                                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                                    tempSchedule[donor][day] = 'E';
                                    tempSchedule[recipient][day] = 'OFF';

                                    if (checkConsecutive(tempSchedule, donor, day) && isShiftSequenceValid(tempSchedule, donor, day, 'E')) {
                                        currentSchedule[donor][day] = 'E';
                                        currentSchedule[recipient][day] = 'OFF';
                                        swapped = true;
                                        break;
                                    }
                                }
                            }
                            if (swapped) break;
                        }
                        if (swapped) break;
                    }
                }
                
                if (!swapped) break;
            }
        }
        
        // 步驟 7: **最終公平性優化 (Swap)** - 此處恢復嚴格資格檢查
        for(let i=0; i < 50; i++) { 
            const finalCounts = getShiftCounts(currentSchedule, nurses);
            const sortedByOff = Object.entries(finalCounts).sort(([, a], [, b]) => a.off - b.off);
            if (sortedByOff.length < 2) break;

            const leastRestedNurse = sortedByOff[0][0];
            const mostRestedNurse = sortedByOff[sortedByOff.length - 1][0];

            if (finalCounts[mostRestedNurse].off > finalCounts[leastRestedNurse].off + 1) {
                let swapped = false;
                for (let day = 0; day < daysInMonth; day++) {
                    const mostShift = currentSchedule[mostRestedNurse][day];
                    const leastShift = currentSchedule[leastRestedNurse][day];
                    
                    if (mostShift === 'OFF' && ['D', 'E', 'N', 'Fn'].includes(leastShift)) {
                        // 在最終優化階段，換班必須基於原始資格
                        if (availableShifts[leastShift]?.includes(mostRestedNurse)) {
                           const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                           tempSchedule[mostRestedNurse][day] = leastShift;
                           tempSchedule[leastRestedNurse][day] = 'OFF';

                           if (
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
