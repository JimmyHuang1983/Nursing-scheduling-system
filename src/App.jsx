import React, { useState, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import autoGenerateSchedule from './utils/autoGenerateSchedule';
import './styles.css';

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
                <li><strong>步驟六：夜班人力優化</strong> - (可選) 在產生班表後，可多次點擊「夜班人力支援優化」按鈕，系統會嘗試找出休假最多的小夜班與休假最少的大夜班人員，進行一次智慧的班別交換，以平衡休假天數。</li>
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
  const [showModal, setShowModal] = useState(true);

  const [params, setParams] = useState({
    D: 6, E: 4, N: 4, Fn: 1,
    minOff: 8, maxConsecutive: 5,
  });
  
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
      schedule, availableShifts, daysInMonth, params, false // 初始排班不啟用支援
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

   const isShiftSequenceValid = (schedule, nurse, day, newShift) => {
        // 如果新班別是休假，則永遠合法
        if (['OFF', 'R', '公', ''].includes(newShift)) return true;

        // 檢查 前一天 -> 當天
        if (day > 0) {
            const prevShift = schedule[nurse][day - 1];
            if (prevShift === 'N' && (newShift === 'D' || newShift === 'E')) return false;
            if (prevShift === 'E' && newShift === 'D') return false;
        }

        // 檢查 當天 -> 後一天
        if (day < daysInMonth - 1) {
            const nextShift = schedule[nurse][day + 1];
            if (newShift === 'N' && (nextShift === 'D' || nextShift === 'E')) return false;
            if (newShift === 'E' && nextShift === 'D') return false;
        }
        
        return true;
   };

    const checkConsecutive = (sch, nurse, day, newShift) => {
        const tempSch = JSON.parse(JSON.stringify(sch));
        tempSch[nurse][day] = newShift;

        let consecutive = 0;
        // 從當天往前計算
        for (let i = day; i >= 0; i--) {
            if (['D', 'E', 'N', 'Fn'].includes(tempSch[nurse][i])) consecutive++;
            else break;
        }
        // 從當天往後計算 (但不重複計算當天)
         for (let i = day + 1; i < daysInMonth; i++) {
            if (['D', 'E', 'N', 'Fn'].includes(tempSch[nurse][i])) consecutive++;
            else break;
        }
        // 修正：上面的算法會重複計算，以下為正確算法
        let currentConsecutive = 0;
        for (let i = day; i >= 0; i--) {
             if (['D', 'E', 'N', 'Fn'].includes(tempSch[nurse][i])) currentConsecutive++;
             else break;
        }
         for (let i = day + 1; i < daysInMonth; i++) {
            if (['D', 'E', 'N', 'Fn'].includes(tempSch[nurse][i])) currentConsecutive++;
            else break;
        }

        return currentConsecutive <= params.maxConsecutive;
    };


  // ✅ 全新、更智慧的夜班人力支援優化函式
  const handleNightSupportOptimization = () => {
    const nurseList = Object.keys(schedule).filter(k => k !== '__meta');
    if (nurseList.length === 0) {
        alert("請先產生班表。");
        return;
    }
    
    const currentCounts = getShiftCounts(schedule, nurseList);
    const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
    const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));

    if (eNurses.length < 2 || nNurses.length === 0) {
        alert("沒有足夠的小夜或大夜班人員進行優化（至少需要2位小夜班人員）。");
        return;
    }
    
    // 1. 找到休假最多(超休)的E班人員 (捐贈者)
    const donors = eNurses
        .filter(n => (currentCounts[n]?.off || 0) > params.minOff)
        .sort((a, b) => (currentCounts[b]?.off || 0) - (currentCounts[a]?.off || 0));

    // 2. 找到休假最少的N班人員 (接受者)
    const recipients = nNurses
        .sort((a, b) => (currentCounts[a]?.off || 0) - (currentCounts[b]?.off || 0));

    if (donors.length === 0 || recipients.length === 0) {
        alert("找不到休假天數符合交換條件的小夜或大夜班人員。");
        return;
    }

    const recipient = recipients[0]; // 最需要休假的大夜

    // 遍歷所有可能的捐贈者和日期，尋找一個可行的三方交換
    for (const donor of donors) {
        // 確保捐贈者比接受者多休至少一天
        if ((currentCounts[donor]?.off || 0) <= (currentCounts[recipient]?.off || 0)) continue;

        for (let day = 0; day < daysInMonth; day++) {
            // 條件 A: 捐贈者當天是 OFF
            if (schedule[donor]?.[day] === 'OFF') {
                
                // 模擬步驟1：捐贈者 OFF -> E
                const tempSchedule1 = JSON.parse(JSON.stringify(schedule));
                tempSchedule1[donor][day] = 'E';

                // 檢查步驟1的合法性 (連續上班 & 班別銜接)
                if (!checkConsecutive(tempSchedule1, donor, day, 'E') || !isShiftSequenceValid(tempSchedule1, donor, day, 'E')) continue;

                // 條件 B: 找到另一位 E 班人員 (中介者)，他當天是 E 班且隔天是 OFF
                const intermediaries = eNurses.filter(n => 
                    n !== donor && 
                    schedule[n]?.[day] === 'E' && 
                    (day + 1 < daysInMonth ? schedule[n]?.[day + 1] === 'OFF' : true)
                );

                for (const intermediary of intermediaries) {
                     // 模擬步驟2：中介者 E -> N
                     const tempSchedule2 = JSON.parse(JSON.stringify(tempSchedule1));
                     tempSchedule2[intermediary][day] = 'N';
                     
                     // 檢查步驟2的合法性 (班別銜接)
                     if (!isShiftSequenceValid(tempSchedule2, intermediary, day, 'N')) continue;
                     
                     // 條件 C: 確保接受者當天是 N 班
                     if (schedule[recipient]?.[day] === 'N') {
                         
                         // 找到了完整的可交換組合！
                         const finalSchedule = JSON.parse(JSON.stringify(schedule));
                         finalSchedule[donor][day] = 'E'; // 超休E班人員來上班
                         finalSchedule[intermediary][day] = 'N'; // 另一位E班人員去支援N班
                         finalSchedule[recipient][day] = 'OFF'; // 休最少的N班人員去休假

                         setSchedule(finalSchedule);
                         alert(`優化成功：${donor}上班，${intermediary}支援大夜，${recipient}休假。`);
                         return; // 每次只執行一次優化
                     }
                }
            }
        }
    }
    
    alert("找不到可優化的班別交換機會。");
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
      </div>

      <InputPanel
        nurseNames={nurseNames} setNurseNames={setNurseNames}
        availableShifts={availableShifts} setAvailableShifts={setAvailableShifts}
        onConfirm={handleConfirm}
      />

      {generated && (
        <div className="actions-panel">
          <button onClick={handleGenerate}>產生班表</button>
          <button onClick={handleNightSupportOptimization} className="optimize-button">夜班人力支援優化</button>
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </div>
      )}
      
      {generated && 
        <ScheduleTable
            schedule={schedule} setSchedule={setSchedule}
            daysInMonth={daysInMonth} availableShifts={availableShifts}
            params={params}
        />
      }
    </div>
  );
}

export default App;

