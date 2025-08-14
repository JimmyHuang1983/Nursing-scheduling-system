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
    // --- (此處上方的輔助函式 getShiftCounts, isShiftSequenceValid, checkConsecutive 皆保持不變) ---
    const { year, month } = scheduleData.__meta;
    const schedule = { ...scheduleData };
    delete schedule.__meta;

    const nurses = Object.keys(schedule);
    const { minOff, maxConsecutive } = params;

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
        for (let i = day; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(sch[nurse][i])) consecutive++;
            else break;
        }
        return consecutive <= maxConsecutive;
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
        if (newShift === 'E') {
            if (nextDayShift === 'N') return false;
        }
        return true;
    };


    // --- 演算法主體 ---
    let bestSchedule = {};
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 30; attempt++) {
        let currentSchedule = JSON.parse(JSON.stringify(schedule));
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // [步驟 1 到 5 維持不變]
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = '';
            }
        });
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                const required = params[shift];
                let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length;
                const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses
                    .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n))
                    .sort((a, b) => shiftCounts[a].work - shiftCounts[b].work);
                for (const candidate of candidates) {
                    if (assignedCount >= required) break;
                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                    tempSchedule[candidate][day] = shift;
                    if (checkConsecutive(tempSchedule, candidate, day) && isShiftSequenceValid(tempSchedule, candidate, day, shift)) {
                        currentSchedule[candidate][day] = shift;
                        assignedCount++;
                    }
                }
            }
        }
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
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n));
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
        nurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });


        // ✅ 步驟 6: 小夜與大夜人力互相支援 (根本性修正版)
        if (mutualSupport) {
            for (let iter = 0; iter < 50; iter++) {
                const currentCounts = getShiftCounts(currentSchedule, nurses);
                const eNurses = nurses.filter(n => availableShifts['E']?.includes(n));
                const nNurses = nurses.filter(n => availableShifts['N']?.includes(n));

                if (eNurses.length < 1 || nNurses.length < 1) break;

                const avgOffE = eNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / eNurses.length;
                const avgOffN = nNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / nNurses.length;
                
                let donorGroup, recipientGroup, supportShift;

                // 判斷支援方向
                if (avgOffE > avgOffN + 1) { // E 支援 N
                    donorGroup = eNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                    recipientGroup = nNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off);
                    supportShift = 'N';
                } else if (avgOffN > avgOffE + 1) { // N 支援 E
                    donorGroup = nNurses.sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                    recipientGroup = eNurses.sort((a, b) => currentCounts[a].off - currentCounts[b].off);
                    supportShift = 'E';
                } else {
                    break; // 休假已平衡，無需支援
                }

                let swapped = false;
                // 尋找可以交換的組合
                for (const donor of donorGroup) {
                    for (const recipient of recipientGroup) {
                        // 如果休假不夠不平衡，就跳過這個組合
                        if (currentCounts[donor].off <= currentCounts[recipient].off + 1) continue;

                        let bestDonorDay = -1;
                        let bestRecipientDay = -1;

                        // 遍歷所有日期，尋找最佳交換點
                        for (let day_d = 0; day_d < daysInMonth; day_d++) { // 尋找捐贈者的 OFF 日
                            if (currentSchedule[donor][day_d] !== 'OFF') continue;

                            for (let day_r = 0; day_r < daysInMonth; day_r++) { // 尋找接受者的上班日
                                if (currentSchedule[recipient][day_r] !== supportShift) continue;

                                // --- 核心檢查邏輯 ---
                                // 模擬將 donor 的 OFF 日拿去上 supportShift
                                const tempScheduleForDonor = JSON.parse(JSON.stringify(currentSchedule));
                                tempScheduleForDonor[donor][day_d] = supportShift;
                                // 模擬將 recipient 的上班日換成 OFF
                                const tempScheduleForRecipient = JSON.parse(JSON.stringify(currentSchedule));
                                tempScheduleForRecipient[recipient][day_r] = 'OFF';

                                // 檢查：
                                // 1. donor 去上 supportShift 後，班表是否合法
                                // 2. recipient 換成 OFF 後，班表是否合法
                                if (isShiftSequenceValid(tempScheduleForDonor, donor, day_d, supportShift) &&
                                    checkConsecutive(tempScheduleForDonor, donor, day_d) &&
                                    isShiftSequenceValid(tempScheduleForRecipient, recipient, day_r, 'OFF')
                                   )
                                {
                                    bestDonorDay = day_d;
                                    bestRecipientDay = day_r;
                                    break;
                                }
                            }
                            if (bestDonorDay !== -1) break;
                        }

                        // 如果找到了最佳交換點，則執行交換
                        if (bestDonorDay !== -1 && bestRecipientDay !== -1) {
                            currentSchedule[donor][bestDonorDay] = supportShift;
                            currentSchedule[recipient][bestRecipientDay] = 'OFF';
                            swapped = true;
                            break;
                        }
                    }
                    if (swapped) break;
                }

                if (!swapped) break;
            }
        }
        
        // [步驟 7 和 最終評分 維持不變]
        // ... ...

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

    bestSchedule.__meta = { year, month };
    return bestSchedule;
}

export default autoGenerateSchedule;
