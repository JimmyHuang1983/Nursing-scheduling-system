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

// 歡迎視窗元件
const WelcomeModal = ({ onClose }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <button onClick={onClose} className="modal-close-button">&times;</button>
            <h2>歡迎使用 AI 護理排班系統</h2>
            <p>這是一個智慧化的排班工具，旨在幫助護理長快速、公平地產生每月班表。</p>
            
            <h3>快速上手指南</h3>
            <ol>
                <li><strong>設定參數：</strong>在主畫面上方設定每日各班別所需人數、每人應休天數及最多連上天數。</li>
                <li><strong>輸入人員名單：</strong>在「輸入人員名單」區塊中，填入所有護理師的名字，並用逗號分隔。</li>
                <li><strong>指定班別資格：</strong>在下方勾選每位護理師可以上的班別（例如，某人只能上白班 D）。</li>
                <li><strong>產生表格：</strong>點擊「確認人員與班別」，系統會產生一個空的班表。您可以在此手動預排特定人員的休假（R）。</li>
                <li><strong>AI 產生班表：</strong>點擊「產生班表」，系統會根據您的所有設定，自動產生一份最佳化的班表。</li>
                <li><strong>多次產生：</strong>若不滿意結果，可再次點擊「產生班表」，演算法會嘗試產生不同的組合。</li>
            </ol>

            <h3>特色功能</h3>
            <ul>
                <li><strong>智慧 Highlight：</strong>系統會自動用<strong><span style={{color: '#c62828'}}>紅色</span></strong>標示出不符合規則的儲存格（如人力不足、休假不足、連續上班超時）。</li>
                <li><strong>夜班人力支援：</strong>若勾選此項，演算法會在人力不足時，嘗試讓休假足夠的小夜班人員支援大夜班。</li>
                <li><strong>DEMO 模式：</strong>點擊 DEMO 按鈕，快速載入範例資料以體驗完整功能。</li>
                <li><strong>匯出至 Excel：</strong>完成排班後，可將結果匯出為 Excel 檔案。</li>
            </ul>
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
  const [showWelcome, setShowWelcome] = useState(true); // 控制歡迎視窗的狀態

  useEffect(() => {
    // 當月份改變時，自動更新天數
    const { year, month } = schedule.__meta;
    const newDays = new Date(year, month + 1, 0).getDate();
    setDaysInMonth(newDays);
  }, [schedule.__meta]);

  const [params, setParams] = useState({
    D: 6, E: 4, N: 4, Fn: 1,
    minOff: 8, maxConsecutive: 5,
  });

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
    // ... (此處省略匯出邏輯，以保持簡潔)
  };

  return (
    <div className="App">
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      
      <h1>AI 護理排班系統</h1>
      <div className="controls">
          <button onClick={handleDemo} className="demo-button">DEMO</button>
      </div>
      <div className="inputs">
        <label>
          月份選擇:
          <input type="month" defaultValue={`${schedule.__meta.year}-${String(schedule.__meta.month + 1).padStart(2, '0')}`}
           onChange={e => {
               const [year, month] = e.target.value.split('-');
               setSchedule(prev => ({ ...prev, __meta: { year: parseInt(year), month: parseInt(month) - 1 } }));
           }}
          />
        </label>
        <br/>
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
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </>
      )}
    </div>
  );
}

export default App;


