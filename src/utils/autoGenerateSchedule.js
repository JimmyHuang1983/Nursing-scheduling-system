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
        shuffledNurses.forEach(nurse => { for (let day = 0; day < daysInMonth; day++) { if (currentSchedule[nurse][day] !== 'R') currentSchedule[nurse][day] = ''; } });
        for (let day = 0; day < daysInMonth; day++) {
            const shiftsInOrder = ['Fn', 'N', 'E', 'D'];
            for (const shift of shiftsInOrder) {
                const required = params[shift]; let assignedCount = nurses.filter(n => currentSchedule[n][day] === shift).length; const shiftCounts = getShiftCounts(currentSchedule, shuffledNurses);
                const candidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n)).sort((a, b) => shiftCounts[a].work - shiftCounts[b].work);
                for (const candidate of candidates) {
                    if (assignedCount >= required) break;
                    const tempSchedule = JSON.parse(JSON.stringify(currentSchedule)); tempSchedule[candidate][day] = shift;
                    if (checkConsecutive(tempSchedule, candidate, day) && isShiftSequenceValid(tempSchedule, candidate, day, shift)) { currentSchedule[candidate][day] = shift; assignedCount++; }
                }
            }
        }
        shuffledNurses.forEach(nurse => {
            let shiftCounts = getShiftCounts(currentSchedule, nurses); let currentOffs = shiftCounts[nurse].off;
            if (currentOffs < minOff) { for (let day = 0; day < daysInMonth; day++) { if (currentSchedule[nurse][day] === '' && currentOffs < minOff) { currentSchedule[nurse][day] = 'OFF'; currentOffs++; } } }
        });
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n));
                if (fnCandidates.length > 0) {
                     const candidate = fnCandidates[0]; const tempSchedule = JSON.parse(JSON.stringify(currentSchedule)); tempSchedule[candidate][day] = 'D';
                     if(checkConsecutive(tempSchedule, candidate, day) && isShiftSequenceValid(tempSchedule, candidate, day, 'D')) { currentSchedule[candidate][day] = 'D'; }
                }
            }
        }
        nurses.forEach(nurse => { for (let day = 0; day < daysInMonth; day++) { if (currentSchedule[nurse][day] === '') { currentSchedule[nurse][day] = 'OFF'; } } });


        // ✅ 步驟 6: 小夜與大夜人力互相支援 (三方連鎖反應邏輯)
        if (mutualSupport) {
            for (let iter = 0; iter < 50; iter++) {
                const currentCounts = getShiftCounts(currentSchedule, nurses);
                const eNurses = nurses.filter(n => availableShifts['E']?.includes(n));
                const nNurses = nurses.filter(n => availableShifts['N']?.includes(n));

                if (eNurses.length < 1 || nNurses.length < 1) break;

                const avgOffE = eNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / eNurses.length;
                const avgOffN = nNurses.reduce((sum, n) => sum + (currentCounts[n]?.off || 0), 0) / nNurses.length;
                
                let swapped = false;

                // 判斷支援方向
                if (avgOffE > avgOffN + 1) { // 情況一: E 班支援 N 班
                    for (let day = 0; day < daysInMonth; day++) {
                        // 1. 尋找 Donor (超休的E班人員，當天是OFF)
                        const donors = eNurses
                            .filter(n => currentSchedule[n][day] === 'OFF' && currentCounts[n].off > minOff)
                            .sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                        if (donors.length === 0) continue;
                        const donor = donors[0];

                        // 2. 尋找 Pivot (當天是E班，且隔天是OFF的人員)
                        const pivots = eNurses
                            .filter(n => currentSchedule[n][day] === 'E' && (day + 1 >= daysInMonth || currentSchedule[n][day+1] === 'OFF'));
                        if (pivots.length === 0) continue;
                        const pivot = pivots[0];

                        // 3. 尋找 Recipient (欠休的N班人員，當天是N)
                        const recipients = nNurses
                            .filter(n => currentSchedule[n][day] === 'N')
                            .sort((a, b) => currentCounts[a].off - currentCounts[b].off);
                        if (recipients.length === 0) continue;
                        const recipient = recipients[0];
                        
                        // 如果 Donor 的休假沒有明顯比 Recipient 多，則跳過
                        if(currentCounts[donor].off <= currentCounts[recipient].off + 1) continue;
                        
                        // 執行三方連鎖反應
                        currentSchedule[donor][day] = 'E';         // 步驟一：超休E從 OFF -> E
                        currentSchedule[pivot][day] = 'N';         // 步驟二：另一位E從 E -> N (支援)
                        currentSchedule[recipient][day] = 'OFF';   // 步驟三：欠休N從 N -> OFF
                        
                        swapped = true;
                        break; // 完成一次交換，跳出day迴圈，重新開始新一輪迭代
                    }
                } else if (avgOffN > avgOffE + 1) { // 情況二: N 班支援 E 班 (反向邏輯)
                    for (let day = 0; day < daysInMonth; day++) {
                        // 1. 尋找 Donor (超休的N班人員，當天是OFF)
                        const donors = nNurses
                            .filter(n => currentSchedule[n][day] === 'OFF' && currentCounts[n].off > minOff)
                            .sort((a, b) => currentCounts[b].off - currentCounts[a].off);
                        if (donors.length === 0) continue;
                        const donor = donors[0];
                        
                        // 2. 尋找 Pivot (當天是N班，且隔天是OFF的人員)
                        // 注意：因為N班支援E班沒有班次銜接問題，所以不需要檢查隔天是否為OFF
                        const pivots = nNurses
                            .filter(n => currentSchedule[n][day] === 'N');
                        if (pivots.length === 0) continue;
                        const pivot = pivots[0];

                        // 3. 尋找 Recipient (欠休的E班人員，當天是E)
                        const recipients = eNurses
                            .filter(n => currentSchedule[n][day] === 'E')
                            .sort((a, b) => currentCounts[a].off - currentCounts[b].off);
                        if (recipients.length === 0) continue;
                        const recipient = recipients[0];
                        
                        if(currentCounts[donor].off <= currentCounts[recipient].off + 1) continue;

                        // 檢查 Pivot 換成 E 班後是否合法
                        const tempSchedule = JSON.parse(JSON.stringify(currentSchedule));
                        tempSchedule[pivot][day] = 'E';
                        if (!isShiftSequenceValid(tempSchedule, pivot, day, 'E')) continue;

                        // 執行三方連鎖反應
                        currentSchedule[donor][day] = 'N';         // 步驟一：超休N從 OFF -> N
                        currentSchedule[pivot][day] = 'E';         // 步驟二：另一位N從 N -> E (支援)
                        currentSchedule[recipient][day] = 'OFF';   // 步驟三：欠休E從 E -> OFF
                        
                        swapped = true;
                        break;
                    }
                }

                if (!swapped) break; // 如果這一輪迭代沒有發生任何交換，說明已經平衡
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
