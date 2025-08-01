import React, { useState } from 'react';
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

// 班別選項 (共享)
const SHIFT_OPTIONS = ['D', 'E', 'N', 'Fn', 'OFF', '公', 'R'];


function App() {
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({ __meta: { year: new Date().getFullYear(), month: new Date().getMonth() } });
  const [daysInMonth, setDaysInMonth] = useState(31); 
  const [generated, setGenerated] = useState(false);
  const [mutualSupport, setMutualSupport] = useState(false); // 夜班支援狀態

  const [params, setParams] = useState({
    D: 6, E: 4, N: 4, Fn: 1,
    minOff: 8, maxConsecutive: 5,
  });
  
  // 更新月份天數
  const handleDateChange = (year, month) => {
      const newDays = new Date(year, month + 1, 0).getDate();
      setDaysInMonth(newDays);
      setSchedule(prev => ({ ...prev, __meta: { year, month } }));
  };

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
  
  // ✅ 全新的 Excel 匯出函式
  const handleExportToExcel = () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel 匯出函式庫載入中，請稍後再試。');
      return;
    }

    const nurseList = Object.keys(schedule).filter(key => key !== '__meta');
    const data = [];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 定義樣式
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "E8EAF6" } } }; // 淡藍紫色
    const shortageStyle = { fill: { fgColor: { rgb: "FFCDD2" } } }; // 紅色
    const surplusStyle = { fill: { fgColor: { rgb: "FFF9C4" } } }; // 黃色
    const sumStyle = { font: { bold: true }, fill: { fgColor: { rgb: "F5F5F5" } } }; // 淡灰色

    // 建立表頭
    const header = ['護理師'];
    for (let i = 1; i <= daysInMonth; i++) header.push(String(i));
    header.push('休假');
    XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A1' });

    // 設定表頭樣式
    for (let i = 0; i < header.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
        if(ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    // 根據資格區分護理師群組
    const fnNurses = nurseList.filter(nurse => availableShifts['Fn']?.includes(nurse));
    const dNurses = nurseList.filter(nurse => availableShifts['D']?.includes(nurse) && !fnNurses.includes(nurse));
    const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
    const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));
    
    let currentRow = 1; // 從第二行開始填資料

    const processGroup = (group, shift) => {
        if (group.length === 0) return;
        // 填入護理師班表
        group.forEach(nurse => {
            const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R').length;
            const rowData = [nurse, ...schedule[nurse], offDays];
            XLSX.utils.sheet_add_aoa(ws, [rowData], { origin: `A${currentRow + 1}` });
            
            // Highlight 休假不足
            if (offDays < params.minOff) {
                const cellRef = XLSX.utils.encode_cell({ c: daysInMonth + 1, r: currentRow });
                ws[cellRef].s = shortageStyle;
            }
            // Highlight 連續上班超時
            const ranges = getOverlappingRanges(schedule[nurse], params.maxConsecutive);
            ranges.forEach(range => {
                for (let i = range.start; i <= range.end; i++) {
                     const cellRef = XLSX.utils.encode_cell({ c: i + 1, r: currentRow });
                     if(ws[cellRef]) ws[cellRef].s = shortageStyle;
                }
            });
            currentRow++;
        });

        // 填入總計
        if(shift){
            const totalRow = [`${shift} 班總計`];
            for (let day = 0; day < daysInMonth; day++) {
                const total = nurseList.reduce((count, nurse) => (schedule[nurse] && schedule[nurse][day] === shift ? count + 1 : count), 0);
                totalRow.push(total);
            }
            XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: `A${currentRow + 1}` });

            // 設定總計行樣式與 Highlight
            for (let i = 0; i < totalRow.length; i++) {
                const cellRef = XLSX.utils.encode_cell({ c: i, r: currentRow });
                if(ws[cellRef]) ws[cellRef].s = sumStyle;
                if(i > 0 && i <= daysInMonth){
                     const required = params[shift] || 0;
                     if(totalRow[i] < required) ws[cellRef].s = {...sumStyle, ...shortageStyle};
                     if(totalRow[i] > required) ws[cellRef].s = {...sumStyle, ...surplusStyle};
                }
            }
            currentRow++;
        }
        
        // 加入間隔行
        currentRow++;
    };

    processGroup([...dNurses, ...fnNurses], 'D');
    // processGroup(fnNurses, 'Fn'); // Fn總計已合併
    processGroup(eNurses, 'E');
    processGroup(nNurses, 'N');

    // 設定下拉選單 (Data Validation)
    const scheduleRange = { s: { c: 1, r: 1 }, e: { c: daysInMonth, r: currentRow } };
    ws['!dataValidation'] = [{
        sqref: XLSX.utils.encode_range(scheduleRange),
        type: 'list',
        formula1: `"${SHIFT_OPTIONS.join(',')}"`,
        showDropDown: true
    }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班表');
    XLSX.writeFile(wb, '護理班表.xlsx');
  };

  return (
    <div className="App">
      <h1>AI 護理排班系統</h1>
      <div className="controls">
          <button onClick={handleDemo} className="demo-button">DEMO</button>
      </div>
      <div className="inputs">
        <label>
          月份選擇:
          <input type="month" defaultValue={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
           onChange={e => handleDateChange(parseInt(e.target.value.split('-')[0]), parseInt(e.target.value.split('-')[1]) - 1)}
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

