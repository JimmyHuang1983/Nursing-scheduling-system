import React, { useState } from 'react';

function InputPanel({ onConfirm }) {
  const [input, setInput] = useState('');
  const [availability, setAvailability] = useState({ D: [], E: [], N: [] });

  const handleConfirm = () => {
    const names = input.split('\n').map(n => n.trim()).filter(n => n);
    onConfirm(names, availability);
  };

  const toggle = (shift, name) => {
    setAvailability(prev => {
      const set = new Set(prev[shift]);
      set.has(name) ? set.delete(name) : set.add(name);
      return { ...prev, [shift]: Array.from(set) };
    });
  };

  const names = input.split('\n').map(n => n.trim()).filter(n => n);

  return (
    <div className="input-panel">
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={5} placeholder="請輸入所有人員，一行一位" />
      {['D', 'E', 'N'].map(shift => (
        <div key={shift}>
          <strong>{shift} 班</strong>
          {names.map(name => (
            <label key={name}>
              <input type="checkbox" checked={availability[shift]?.includes(name)} onChange={() => toggle(shift, name)} />
              {name}
            </label>
          ))}
        </div>
      ))}
      <button onClick={handleConfirm}>確認</button>
    </div>
  );
}

export default InputPanel;