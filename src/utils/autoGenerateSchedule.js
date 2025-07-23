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
            sch[nurse].forEach(shift => {
                if (['D', 'E', 'N', 'Fn'].includes(shift)) {
                    counts[nurse].work++;
                } else if (['OFF', 'R'].includes(shift)) {
                    counts[nurse].off++;
                }
            });
        });
        return counts;
    };

    let bestSchedule = JSON.parse(JSON.stringify(schedule));
    let minShortage = Infinity;

    // 演算法會嘗試多次，以從隨機結果中找出人力短缺最少的最佳解
    for (let attempt = 0; attempt < 10; attempt++) {
        const currentSchedule = JSON.parse(JSON.stringify(schedule));
        // 每次都隨機打亂護理師順序，以產生多樣化的班表
        const shuffledNurses = [...nurses].sort(() => Math.random() - 0.5);

        // 步驟 1: 清空現有班表 (但保留使用者預先設定的 'R' 假)
        shuffledNurses.forEach(nurse => {
            for (let day = 0; day < daysInMonth; day++) {
                if (currentSchedule[nurse][day] !== 'R') {
                    currentSchedule[nurse][day] = '';
                }
            }
        });

        // 步驟 2: 依序填滿各班別，優先處理需求較死的班別 (Fn, N, E, D)
        const shiftsToFill = ['Fn', 'N', 'E', 'D'];
        shiftsToFill.forEach(shift => {
            for (let day = 0; day < daysInMonth; day++) {
                // Fn 班只在週間排
                if (shift === 'Fn' && !isWeekday(day)) continue;

                const requiredCount = params[shift];
                let currentCount = nurses.filter(n => currentSchedule[n][day] === shift).length;

                while (currentCount < requiredCount) {
                    const shiftCounts = getShiftCounts(currentSchedule);
                    // 找出候選人：尚未排班、有該班資格
                    const candidates = shuffledNurses
                        .filter(n => currentSchedule[n][day] === '' && availableShifts[shift]?.includes(n))
                        // 排序：優先選擇「最需要上班(休假最少)」的人
                        .sort((a, b) => shiftCounts[a].off - shiftCounts[b].off);

                    let assigned = false;
                    for (const candidate of candidates) {
                        // 檢查連續上班天數
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
                            break; // 找到人就換下一輪
                        }
                    }
                    if (!assigned) break; // 若無任何合適人選，則放棄這一天這個班的剩餘空缺
                }
            }
        });
        
        // 步驟 3: Fn 班在滿足自身需求後，支援 D 班
        for (let day = 0; day < daysInMonth; day++) {
            let dCount = nurses.filter(n => currentSchedule[n][day] === 'D').length;
            if (dCount < dayShiftCount) {
                const shiftCounts = getShiftCounts(currentSchedule);
                // 找出候選人：有Fn和D雙重資格、尚未排班
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
                            if (['D', 'E', 'N', 'Fn'].includes(currentSchedule[candidate][i])) {
                                consecutive++;
                            } else {
                                break;
                            }
                        }
                    if (consecutive < maxConsecutive) {
                         currentSchedule[candidate][day] = 'D'; // 將Fn班人員排為D班
                         dCount++;
                    }
                }
            }
        }
        
        // 步驟 4: 夜班人力互相支援 (若有勾選)
        if (mutualSupport) {
            for (let day = 0; day < daysInMonth; day++) {
                let n_count = nurses.filter(n => currentSchedule[n][day] === 'N').length;
                if (n_count < nightShiftCount) {
                     const shiftCounts = getShiftCounts(currentSchedule);
                     // 找出候選人：有E班資格、當天是休假、總休假數>最低要求、隔天不是E班
                     const e_candidates = shuffledNurses.filter(n =>
                        availableShifts['E']?.includes(n) &&
                        currentSchedule[n][day] === 'OFF' && 
                        shiftCounts[n].off > minOff && 
                        (day + 1 >= daysInMonth || currentSchedule[n][day+1] !== 'E') 
                     );
                     
                     if (e_candidates.length > 0) {
                         const candidate = e_candidates[0]; // 選第一位符合資格者
                         currentSchedule[candidate][day] = 'N'; // 將 'OFF' 改為 'N'
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

        // 評分機制：計算當前班表的人力短缺總數
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

        // 如果當前班表的短缺數更少，則更新為最佳解
        if (shortage < minShortage) {
            minShortage = shortage;
            bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
        }
    }

    return bestSchedule;
}

export default autoGenerateSchedule;
```

