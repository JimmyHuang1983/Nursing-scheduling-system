import React from 'react';

function InputPanel({ nurseNames, setNurseNames, availableShifts, setAvailableShifts, onConfirm }) {
  const allNames = nurseNames.split(',').map(n => n.trim()).filter(Boolean);

  const handleCheckboxChange = (shift, name) => {
    const list = new Set(availableShifts[shift]);
    list.has(name) ? list.delete(name) : list.add(name);
    setAvailableShifts(prev => ({ ...prev, [shift]: Array.from(list) }));
  };

  return (
    <div className="input-panel">
      <label>
        輸入人員名單（用逗號分隔）：
        <textarea
          value={nurseNames}
          onChange={e => setNurseNames(e.target.value)}
          rows={3}
        />
      </label>
      <div className="checkbox-groups">
        {['D', 'E', 'N'].map(shift => (
          <div key={shift}>
            <strong>{shift} 班可上人員</strong>
            {allNames.map(name => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={availableShifts[shift]?.includes(name)}
                  onChange={() => handleCheckboxChange(shift, name)}
                />
                {name}
              </label>
            ))}
          </div>
        ))}
      </div>
      <button onClick={onConfirm}>確認人員與班別</button>
    </div>
  );
}

export default InputPanel;

