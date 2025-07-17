// NurseScheduleApp.jsx
import React, { useState } from 'react';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';

const NurseScheduleApp = () => {
  const [year, setYear] = useState(dayjs().year());
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [minOffDays, setMinOffDays] = useState(8);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(5);
  const [blockedDays, setBlockedDays] = useState([]);

  const nurses = [
    '人員 1', '人員 2', '人員 3',
    '人員 4', '人員 5', '人員 6', '人員 7'
  ];

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const shiftOptions = ['D', 'E', 'N', 'OFF'];

  const [schedule, setSchedule] = useState(() => {
    const initial = {};
    nurses.forEach(nurse => {
      initial[nurse] = Array(daysInMonth).fill('');
    });
    return initial;
  });

  const handleShiftChange = (nurse, dayIndex) => {
    setSchedule(prev => {
      const next = { ...prev };
      const current = next[nurse][dayIndex];
      const nextShift = shiftOptions[(shiftOptions.indexOf(current) + 1) % shiftOptions.length];
      next[nurse][dayIndex] = nextShift;
      return next;
    });
  };

  const handleBlockedDaysChange = (e) => {
    const input = e.target.value;
    const selected = input.split(',').map(str => parseInt(str.trim(), 10)).filter(n => !isNaN(n));
    setBlockedDays(selected);
  };

  const autoGenerateSchedule = () => {
    const newSchedule = {};
    nurses.forEach(nurse => {
      const shifts = Array(daysInMonth).fill('');
      let offCount = 0;
      let consecutiveWork = 0;

      for (let day = 0; day < daysInMonth; day++) {
        const dayNum = day + 1;
        if (blockedDays.includes(dayNum)) {
          shifts[day] = 'OFF';
          offCount++;
          consecutiveWork = 0;
        } else if (offCount < minOffDays && Math.random() < 0.3) {
          shifts[day] = 'OFF';
          offCount++;
          consecutiveWork = 0;
        } else if (consecutiveWork >= maxConsecutiveDays) {
          shifts[day] = 'OFF';
          offCount++;
          consecutiveWork = 0;
        } else {
          const shiftType = shiftOptions[Math.floor(Math.random() * 3)];
          shifts[day] = shiftType;
          consecutiveWork++;
        }
      }

      for (let day = 0; day < daysInMonth && offCount < minOffDays; day++) {
        if (shifts[day] !== 'OFF') {
          shifts[day] = 'OFF';
          offCount++;
        }
      }

      newSchedule[nurse] = shifts;
    });

    setSchedule(newSchedule);
  };

  const exportCSV = () => {
    let csvContent = `姓名,${days.map(d => `${month}/${d}`).join(',')}\n`;
    nurses.forEach(nurse => {
      csvContent += `${nurse},${schedule[nurse].join(',')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `排班表_${year}_${month}.csv`);
  };

  return (
    <div className="p-4 max-w-screen overflow-x-auto">
      <h1 className="text-2xl font-bold mb-4">護理人員排班系統</h1>

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block font-semibold">年份：</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border px-2 py-1">
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-semibold">月份：</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border px-2 py-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-semibold">每人最少休假天數：</label>
          <input type="number" value={minOffDays} onChange={e => setMinOffDays(Number(e.target.value))} className="border px-2 py-1 w-20" />
        </div>

        <div>
          <label className="block font-semibold">最多連續上班天數：</label>
          <input type="number" value={maxConsecutiveDays} onChange={e => setMaxConsecutiveDays(Number(e.target.value))} className="border px-2 py-1 w-20" />
        </div>

        <div>
          <label className="block font-semibold">禁排日（以逗號分隔，如 5, 10, 15）：</label>
          <input type="text" onChange={handleBlockedDaysChange} className="border px-2 py-1 w-48" />
        </div>

        <button
          onClick={autoGenerateSchedule}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          自動排班
        </button>

        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          匯出 CSV
        </button>
      </div>

      <table className="border table-auto text-center text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">姓名</th>
            {days.map(day => (
              <th key={day} className="border px-2 py-1 w-10">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nurses.map(nurse => (
            <tr key={nurse}>
              <td className="border px-2 py-1 font-semibold bg-gray-50">{nurse}</td>
              {schedule[nurse].map((shift, i) => (
                <td
                  key={i}
                  className={`border px-2 py-1 cursor-pointer hover:bg-yellow-100 ${shift === 'OFF' ? 'text-red-600' : ''}`}
                  onClick={() => handleShiftChange(nurse, i)}
                >
                  {shift}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NurseScheduleApp;

