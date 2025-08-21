import React from 'react';

function InputPanel({ nurseNames, setNurseNames, availableShifts, setAvailableShifts, onConfirm, setParams }) {
  const allNames = (nurseNames || '').split(',').map(n => n.trim()).filter(Boolean);

  const handleCheckboxChange = (shift, name) => {
    const currentShifts = availableShifts[shift] || [];
    const list = new Set(currentShifts);
    list.has(name) ? list.delete(name) : list.add(name);
    setAvailableShifts(prev => ({ ...prev, [shift]: Array.from(list) }));
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

  return (
    <div className="input-panel">
      {/* ✅ 核心修改：標籤與輸入框的容器，用於垂直置中 */}
      <div className="nurse-input-section">
        <label className="nurse-input-label">
          輸入人員名單（用逗號分隔）：
        </label>
        <textarea
          value={nurseNames || ''}
          onChange={e => setNurseNames(e.target.value)}
          rows={3}
          className="nurse-textarea"
        />
      </div>
      
      <div className="checkbox-groups">
        {['D', 'Fn', 'E', 'N'].map(shift => (
          <div key={shift}>
            <strong>{shift} 班可上人員</strong>
            <div className="checkbox-list">
              {allNames.map(name => (
                <label key={name} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={availableShifts[shift]?.includes(name)}
                    onChange={() => handleCheckboxChange(shift, name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ 核心修改：將確認按鈕與 DEMO 按鈕放在一起 */}
      <div className="panel-actions">
        <button onClick={onConfirm}>確認人員與班別</button>
        <button 
          onClick={handleDemo} 
          className="demo-button"
          title="自動輸入預設demo人員名單"
        >
          DEMO
        </button>
      </div>
    </div>
  );
}

export default InputPanel;

