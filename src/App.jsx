import React, { useState, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

// 輔助函式：找出連續上班超時的區間 (從 ScheduleTable.jsx 移至此處共享)
const getOverlappingRanges = (shifts, maxConsecutive) => {
    const ranges = [];
    let currentRangeStart = -1;
    let consecutiveCount = 0;
    (shifts || []).forEach((shift, index) => {
        if (['D', 'E', 'N', 'Fn'].includes(shift)) {
            if (currentRangeStart === -1) currentRangeStart = index;
            consecutiveCount++;
        } else {
            if (consecutiveCount > maxConsecutive) {
                ranges.push({ start: currentRangeStart, end: index - 1 });
            }
            currentRangeStart = -1;
            consecutiveCount = 0;
        }
    });
    if (consecutiveCount > maxConsecutive) {
        ranges.push({ start: currentRangeStart, end: (shifts || []).length - 1 });
    }
    return ranges;
};


// Welcome Modal Component
const WelcomeModal = ({ onClose }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <button onClick={onClose} className="modal-close-button">&times;</button>
            <h2>歡迎使用 AI 護理排班系統</h2>
            <p>本系統旨在協助護理長快速、公平且有效率地完成複雜的排班工作。請依照以下步驟操作：</p>
            <ul>
                <li><strong>步驟一：設定條件</strong> - 在畫面頂端輸入每日各班別的人力需求、每人應休天數上限與最多連續上班天數。</li>
                <li><strong>步驟二：輸入人員名單</strong> - 在「輸入人員名單」區塊，填入所有參與排班的護理師姓名，請用英文逗號 <code>,</code> 隔開。</li>
                <li><strong>步驟三：勾選班別資格</strong> - 系統會自動產生勾選清單，請為每位護理師勾選他/她具備的班別資格。</li>
                <li><strong>步驟四：確認與預班</strong> - 按下「確認人員與班別」按鈕，系統會產生一個空白的班表。您可以在此手動為特定人員預排休假（R）或其他班別。</li>
                <li><strong>步驟五：AI 產生班表</strong> - 按下「產生班表」按鈕，AI 將根據您設定的所有條件，自動計算並產生一份公平的班表。您可以多次點擊此按鈕，以獲得不同的排班組合。</li>
                <li><strong>步驟六：夜班人力優化</strong> - (可選) 如果您勾選了「夜班人力互相支援」，可以在產生班表後，多次點擊「夜班人力支援優化」按鈕，系統會嘗試找出休假最多的小夜班與休假最少的大夜班人員，進行一次智慧的班別交換，以平衡休假天數。</li>
                <li><strong>步驟七：匯出Excel</strong> - 對班表滿意後，可點擊「匯出至Excel」將結果下載保存。</li>
            </ul>
            <p><strong>提示：</strong>班表中若有儲存格出現 highlight，代表該處不符合排班規則，請手動調整。</p>
        </div>
    </div>
);


function App() {
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({ __meta: { year: new Date().getFullYear(), month: new Date().getMonth() } });
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [generated, setGenerated] = useState(false);
  const [mutualSupport, setMutualSupport] = useState(false);
  const [showModal, setShowModal] = useState(true); // 控制 Modal 顯示

  const [params, setParams] = useState({
    D: 6, E: 4, N: 4, Fn: 1,
    minOff: 8, maxConsecutive: 5,
  });
  
  // 根據 schedule 中的 meta data 更新月份天數
  useEffect(() => {
    if (schedule.__meta) {
      const { year, month } = schedule.__meta;
      const newDays = new Date(year, month + 1, 0).getDate();
      setDaysInMonth(newDays);
    }
  }, [schedule]);


  const handleConfirm = () => {
    const names = (nurseNames || '').split(',').map(name => name.trim()).filter(Boolean);
    const initialSchedule = { __meta: schedule.__meta };
    names.forEach(name => {
      initialSchedule[name] = Array(daysInMonth).fill('');
    });
    setSchedule(initialSchedule);
    setGenerated(true);
  };

  const handleGenerate = () => {
    const newSchedule = autoGenerateSchedule(
      schedule, availableShifts, daysInMonth, params, mutualSupport
    );
    setSchedule(newSchedule);
  };

  const handleDemo = () => {
    const demoNames = "艾美麗,陳心怡,林佳蓉,黃詩涵,吳靜宜,許雅婷,王文君,蔡佩玲,曾惠敏,李宗翰,張建宏,劉俊傑,高明志,方文山,周杰倫,王力宏,林俊傑,陳奕迅,張學友,劉德華,郭富城,黎明";
    setNurseNames(demoNames);
    setAvailableShifts({
        D: ["艾美麗", "陳心怡", "林佳蓉", "黃詩涵", "吳靜宜", "許雅婷", "王文君", "蔡佩玲", "曾惠敏"],
        Fn: ["李宗翰", "張建宏"],
        E: ["劉俊傑", "高明志", "方文山", "周杰倫", "王力宏", "林俊傑"],
        N: ["陳奕迅", "張學友", "劉德華", "郭富城", "黎明"]
    });
     setParams({ D: 6, E: 4, N: 4, Fn: 1, minOff: 8, maxConsecutive: 5 });
  };
  
  const handleExportToExcel = () => {
     if (typeof XLSX === 'undefined') {
      alert('Excel 匯出函式庫載入中，請稍後再試。');
      return;
    }
    // ... (此處省略現有的 Excel 匯出邏輯，維持不變)
  };
  
  // ✅ 新增：夜班人力支援優化函式
  const handleNightSupportOptimization = () => {
    const currentCounts = getShiftCounts(schedule, Object.keys(schedule).filter(k => k !== '__meta'));
    const eNurses = Object.keys(availableShifts).filter(nurse => availableShifts[nurse].includes('E'));
    const nNurses = Object.keys(availableShifts).filter(nurse => availableShifts[nurse].includes('N'));

    if (eNurses.length === 0 || nNurses.length === 0) {
        console.log("沒有足夠的 E/N 班人員進行優化。");
        return;
    }

    const sortedEByOff = eNurses.sort((a, b) => (currentCounts[b]?.off || 0) - (currentCounts[a]?.off || 0));
    const sortedNByOff = nNurses.sort((a, b) => (currentCounts[a]?.off || 0) - (currentCounts[b]?.off || 0));

    for (const donor of sortedEByOff) {
        for (const recipient of sortedNByOff) {
            if ((currentCounts[donor]?.off || 0) > (currentCounts[recipient]?.off || 0) + 1) {
                for (let day = 0; day < daysInMonth; day++) {
                    if (schedule[donor]?.[day] === 'OFF' && schedule[recipient]?.[day] === 'N') {
                        const tempSchedule = JSON.parse(JSON.stringify(schedule));
                        tempSchedule[donor][day] = 'N';
                        tempSchedule[recipient][day] = 'OFF';

                        if (isShiftSequenceValid(tempSchedule, donor, day, 'N') && isShiftSequenceValid(tempSchedule, recipient, day, 'OFF')) {
                            setSchedule(tempSchedule);
                            console.log(`成功將 ${donor} 的休假與 ${recipient} 的 N 班交換。`);
                            return; // 每次只執行一次交換
                        }
                    }
                }
            }
        }
    }
    
    console.log("找不到可優化的班別交換。");
  };

  // 輔助函式，需要移到 App.jsx 中共享
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


  return (
    <div className="App">
      {showModal && <WelcomeModal onClose={() => setShowModal(false)} />}
      
      <h1>AI 護理排班系統</h1>
      <div className="controls">
          <button onClick={handleDemo} className="demo-button">DEMO</button>
      </div>
      <div className="inputs">
        <label>
          各班每日人數需求：
          D:<input type="number" value={params.D} onChange={e => setParams({ ...params, D: parseInt(e.target.value) || 0 })}/>
          E:<input type="number" value={params.E} onChange={e => setParams({ ...params, E: parseInt(e.target.value) || 0 })}/>
          N:<input type="number" value={params.N} onChange={e => setParams({ ...params, N: parseInt(e.target.value) || 0 })}/>
          Fn:<input type="number" value={params.Fn} onChange={e => setParams({ ...params, Fn: parseInt(e.target.value) || 0 })}/>
        </label>
        <br />
        <label>
          每人本月應休天數：
          <input type="number" value={params.minOff} onChange={e => setParams({ ...params, minOff: parseInt(e.target.value) || 0 })}/>
        </label>
        <label>
          最多連上天數：
          <input type="number" value={params.maxConsecutive} onChange={e => setParams({ ...params, maxConsecutive: parseInt(e.target.value) || 0 })} />
        </label>
         <label>
          <input type="checkbox" checked={mutualSupport} onChange={e => setMutualSupport(e.target.checked)} />
          夜班人力互相支援
        </label>
      </div>

      <InputPanel
        nurseNames={nurseNames} setNurseNames={setNurseNames}
        availableShifts={availableShifts} setAvailableShifts={setAvailableShifts}
        onConfirm={handleConfirm}
      />

      {generated && (
        <>
          <ScheduleTable
            schedule={schedule} setSchedule={setSchedule}
            daysInMonth={daysInMonth} availableShifts={availableShifts}
            params={params}
          />
          <button onClick={handleGenerate}>產生班表</button>
          {/* ✅ 新增按鈕，並在勾選支援時才顯示 */}
          {mutualSupport && <button onClick={handleNightSupportOptimization} className="optimize-button">夜班人力支援優化</button>}
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </>
      )}
    </div>
  );
}

export default App;

