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

    // --- 演算法主體 ---
    let bestSchedule = {};
    let bestScore = { shortage: Infinity, variance: Infinity };

    // 演算法會嘗試多次，從隨機結果中找出最佳解
    for (let attempt = 0; attempt < 50; attempt++) { // 增加嘗試次數以獲得更優解
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

                while (assignedCount < required) {
                    const shiftCounts = getShiftCounts(currentSchedule);

                    // 尋找最佳候選人：尚未排班、有資格、且最需要上班(休假天數最少)
                    const candidates = shuffledNurses
                        .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n) && checkConsecutive(currentSchedule, n, day))
                        .sort((a, b) => shiftCounts[a].off - shiftCounts[b].off);

                    if (candidates.length > 0) {
                        currentSchedule[candidates[0]][day] = shift;
                        assignedCount++;
                    } else {
                        break; // 當前班別找不到人，換下一個班別
                    }
                }
            }
        }
        
        // 步驟 3: **公平性調整**，優先把休假補滿
        for (let i = 0; i < nurses.length; i++) {
            const shiftCounts = getShiftCounts(currentSchedule);
            // 找出最需要休假的人 (目前休假最少)
            const nurseToRest = nurses.sort((a, b) => shiftCounts[a].off - shiftCounts[b].off)[0];
            
            let currentOffs = shiftCounts[nurseToRest].off;
            if(currentOffs < minOff) {
                for(let day = 0; day < daysInMonth; day++){
                    if(currentSchedule[nurseToRest][day] === '' && currentOffs < minOff) {
                        currentSchedule[nurseToRest][day] = 'OFF';
                        currentOffs++;
                    }
                }
            }
        }

        // 步驟 4: 執行支援邏輯，並填補剩餘空缺
        for (let day = 0; day < daysInMonth; day++) {
             // Fn 支援 D
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < params.D) {
                const fnCandidates = shuffledNurses.filter(n => currentSchedule[n][day] === '' && availableShifts['Fn']?.includes(n) && availableShifts['D']?.includes(n) && checkConsecutive(currentSchedule, n, day));
                if(fnCandidates.length > 0) currentSchedule[fnCandidates[0]][day] = 'D';
            }
            // 夜班支援
            if (mutualSupport) {
                let nCount = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if(nCount < params.N) {
                    const shiftCounts = getShiftCounts(currentSchedule);
                    const eCandidates = shuffledNurses.filter(n => availableShifts['E']?.includes(n) && currentSchedule[n][day] === '' && shiftCounts[n].off > minOff && checkConsecutive(currentSchedule, n, day));
                     if(eCandidates.length > 0) currentSchedule[eCandidates[0]][day] = 'N';
                }
            }
        }

        // 步驟 5: 將最後所有剩餘的空格填滿 'OFF'
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] === '') {
                    currentSchedule[nurse][day] = 'OFF';
                }
            }
        });

        // --- 新的評分機制 ---
        let shortage = 0;
        for (let day = 0; day < daysInMonth; day++) {
            for (const shift of ['D', 'E', 'N', 'Fn']) {
                if (shift === 'Fn' && !isWeekday(day)) continue;
                const required = params[shift];
                const actual = nurses.filter(n => currentSchedule[n][day] === shift).length;
                if (actual < required) shortage += (required - actual) * 10;
            }
        }
        
        const finalShiftCounts = getShiftCounts(currentSchedule);
        const offDaysArray = Object.values(finalShiftCounts).map(counts => counts.off);
        const averageOffDays = offDaysArray.reduce((sum, val) => sum + val, 0) / (offDaysArray.length || 1);
        const variance = offDaysArray.reduce((sum, val) => sum + Math.pow(val - averageOffDays, 2), 0) / (offDaysArray.length || 1);

        const currentScore = { shortage, variance };
        
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
