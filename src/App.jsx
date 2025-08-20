import React, { useState, useEffect } from 'react';
// 引入 Firebase 相關服務
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, getRedirectResult } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// 引入我們的所有頁面元件
import InputPanel from './components/InputPanel';
import ScheduleTable from './components/ScheduleTable';
import SignIn from './components/SignIn';
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
                <li><strong>步驟四：確認與預班</strong> - 按下「確認人員與班別」按鈕，系統會產生一個空白的班表。您可以在此手動為特定人員預排休假（R）或「公」假。</li>
                <li><strong>步驟五：AI 產生班表</strong> - 按下「產生班表」按鈕，AI 將根據您設定的所有條件，自動計算並產生一份公平的班表。</li>
                <li><strong>步驟六：夜班人力優化</strong> - (可選) 在產生班表後，可多次點擊「夜班人力支援優化」（單次）或「一鍵優化夜班」（多次）按鈕，以平衡小夜與大夜班的休假天數。</li>
                <li><strong>步驟七：匯出Excel</strong> - 對班表滿意後，可點擊「匯出至Excel」將結果下載保存。</li>
            </ul>
        </div>
    </div>
);

// 將您原本的排班 App 核心功能獨立成一個元件
function NurseScheduleApp({ user }) {
  const [nurseNames, setNurseNames] = useState('');
  const [availableShifts, setAvailableShifts] = useState({ D: [], E: [], N: [], Fn: [] });
  const [schedule, setSchedule] = useState({ __meta: { year: new Date().getFullYear(), month: new Date().getMonth() } });
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [generated, setGenerated] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [mutualSupport, setMutualSupport] = useState(false);
  const [userPrefills, setUserPrefills] = useState({});

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
    setUserPrefills({});
    setGenerated(true);
  };

  const handleGenerate = () => {
    setUserPrefills(JSON.parse(JSON.stringify(schedule)));
    const newSchedule = autoGenerateSchedule(schedule, availableShifts, daysInMonth, params, mutualSupport);
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

  const handleDateChange = (year, month) => {
      const newDays = new Date(year, month + 1, 0).getDate();
      setDaysInMonth(newDays);
      setSchedule(prev => ({ ...prev, __meta: { year, month } }));
  };

  const handleExportToExcel = () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel 匯出函式庫載入中，請稍後再試。');
      return;
    }
    const nurseList = Object.keys(schedule).filter(key => key !== '__meta');
    const data = [];
    const header = ['護理師'];
    for (let i = 1; i <= daysInMonth; i++) {
      header.push(String(i));
    }
    header.push('休假');
    data.push(header);
    nurseList.forEach(nurse => {
      const offDays = schedule[nurse].filter(s => s === 'OFF' || s === 'R' || s === '公').length;
      const row = [nurse, ...schedule[nurse], offDays];
      data.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班表');
    XLSX.writeFile(wb, '護理班表.xlsx');
  };

  // --- 輔助函式 ---
  const getShiftCounts = (sch, nurseList) => {
        const counts = {};
        nurseList.forEach(nurse => {
            counts[nurse] = { D: 0, E: 0, N: 0, Fn: 0, OFF: 0, R: 0, '公': 0, work: 0, off: 0 };
            if (sch[nurse]) {
                sch[nurse].forEach(shift => {
                    if (counts[nurse][shift] !== undefined) counts[nurse][shift]++;
                    if (['D', 'E', 'N', 'Fn'].includes(shift)) counts[nurse].work++;
                    else if (['OFF', 'R', '公'].includes(shift)) counts[nurse].off++;
                });
            }
        });
        return counts;
    };

   const isShiftSequenceValid = (schedule, nurse, day, newShift) => {
        if (['OFF', 'R', '公', ''].includes(newShift)) return true;
        if (day > 0) {
            const prevShift = schedule[nurse][day - 1];
            if (prevShift === 'N' && (newShift === 'D' || newShift === 'E')) return false;
            if (prevShift === 'E' && newShift === 'D') return false;
        }
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
        let max = 0;
        let current = 0;
        for (let i = 0; i < daysInMonth; i++) {
             if (['D', 'E', 'N', 'Fn'].includes(tempSch[nurse][i])) {
                current++;
             } else {
                max = Math.max(max, current);
                current = 0;
             }
        }
        max = Math.max(max, current);
        return max <= params.maxConsecutive;
    };

  // 執行一次優化交換的核心邏輯
  const runOptimizationSwap = (currentSchedule) => {
    const nurseList = Object.keys(currentSchedule).filter(k => k !== '__meta');
    const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
    const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));

    if (eNurses.length < 2 || nNurses.length === 0) return null;

    const currentCounts = getShiftCounts(currentSchedule, nurseList);
    const donors = eNurses
        .filter(n => (currentCounts[n]?.off || 0) > params.minOff)
        .sort((a, b) => (currentCounts[b]?.off || 0) - (currentCounts[a]?.off || 0));
    const recipients = nNurses
        .sort((a, b) => (currentCounts[a]?.off || 0) - (currentCounts[b]?.off || 0));

    if (donors.length === 0 || recipients.length === 0) return null;
    
    const recipient = recipients[0];
    for (const donor of donors) {
        if ((currentCounts[donor]?.off || 0) <= (currentCounts[recipient]?.off || 0)) continue;
        for (let day = 0; day < daysInMonth; day++) {
            if (currentSchedule[donor]?.[day] === 'OFF') {
                const intermediaries = eNurses.filter(n => 
                    n !== donor && 
                    currentSchedule[n]?.[day] === 'E' && 
                    (day + 1 < daysInMonth ? currentSchedule[n]?.[day + 1] === 'OFF' : true)
                );
                for (const intermediary of intermediaries) {
                     if (currentSchedule[recipient]?.[day] === 'N') {
                         const newSchedule = JSON.parse(JSON.stringify(currentSchedule));
                         newSchedule[donor][day] = 'E';
                         newSchedule[intermediary][day] = 'N';
                         newSchedule[recipient][day] = 'OFF';
                         
                         if(
                            checkConsecutive(newSchedule, donor, day, 'E') && isShiftSequenceValid(newSchedule, donor, day, 'E') &&
                            checkConsecutive(newSchedule, intermediary, day, 'N') && isShiftSequenceValid(newSchedule, intermediary, day, 'N') &&
                            isShiftSequenceValid(newSchedule, recipient, day, 'OFF')
                         ) {
                            return { newSchedule, donor, intermediary, recipient };
                         }
                     }
                }
            }
        }
    }
    return null;
  };
  
  const handleSingleOptimization = () => {
    const result = runOptimizationSwap(schedule);
    if (result) {
        setSchedule(result.newSchedule);
        alert(`優化成功：${result.donor}上班，${result.intermediary}支援大夜，${result.recipient}休假。`);
    } else {
        alert("找不到可優化的班別交換機會。");
    }
  };
  
  const handleAutoOptimization = () => {
    const nurseList = Object.keys(schedule).filter(k => k !== '__meta');
    let tempSchedule = JSON.parse(JSON.stringify(schedule));
    let successfulSwaps = 0;

    const eNurses = nurseList.filter(nurse => availableShifts['E']?.includes(nurse));
    const nNurses = nurseList.filter(nurse => availableShifts['N']?.includes(nurse));

    const initialCounts = getShiftCounts(tempSchedule, nurseList);
    const eShiftSurplus = eNurses.reduce((sum, nurse) => sum + Math.max(0, (initialCounts[nurse]?.off || 0) - params.minOff), 0);
    const nShiftDeficit = nNurses.reduce((sum, nurse) => sum + Math.max(0, params.minOff - (initialCounts[nurse]?.off || 0)), 0);

    const loopsToRun = Math.floor(Math.min(eShiftSurplus, nShiftDeficit));
    
    if (loopsToRun <= 0) {
        alert("目前小夜與大夜班的休假天數已達平衡或無多餘休假可調動。");
        return;
    }

    for (let i = 0; i < loopsToRun; i++) {
        const result = runOptimizationSwap(tempSchedule);
        if (result) {
            tempSchedule = result.newSchedule;
            successfulSwaps++;
        } else {
            break;
        }
    }
    
    setSchedule(tempSchedule);
    alert(`一鍵優化完成！總共執行了 ${successfulSwaps} 次班別交換。`);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div>
       {showModal && <WelcomeModal onClose={() => setShowModal(false)} />}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', flexWrap: 'wrap' }}>
         <h1>AI 護理排班系統</h1>
         <div>
            <span>歡迎, {user.displayName || user.email}</span>
            <button onClick={handleLogout} style={{ marginLeft: '10px' }}>登出</button>
         </div>
       </div>
      
      <div className="controls">
          <button onClick={handleDemo} className="demo-button">DEMO</button>
      </div>
      <div className="inputs">
        <label>
          月份選擇:
          <input type="month" defaultValue={`${schedule.__meta.year}-${String(schedule.__meta.month + 1).padStart(2, '0')}`}
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
        <div className="actions-panel">
          <button onClick={handleGenerate}>產生班表</button>
          {/* ✅ 核心修正：將完整的按鈕組加回來 */}
          <button onClick={handleSingleOptimization} className="optimize-button">夜班人力支援優化 (單次)</button>
          <button onClick={handleAutoOptimization} className="auto-optimize-button">一鍵優化夜班</button>
          <button onClick={handleExportToExcel}>匯出至Excel</button>
        </div>
      )}
      
      {generated && 
        <ScheduleTable
            schedule={schedule} setSchedule={setSchedule}
            daysInMonth={daysInMonth} availableShifts={availableShifts}
            params={params}
            userPrefills={userPrefills}
        />
      }
    </div>
  );
}

// 登入頁面
function AuthPage() {
    return (
        <div>
            <h1 style={{marginBottom: '40px'}}>AI 護理排班系統</h1>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '400px', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                    <SignIn />
                </div>
            </div>
        </div>
    );
}

// 試用期結束時顯示的頁面
const TrialExpiredPage = ({ user }) => (
    <div style={{ textAlign: 'center', marginTop: '50px', padding: '20px' }}>
        <h1>試用期已結束</h1>
        <p>感謝您的試用！ {user.email}</p>
        <p>如需繼續使用，請聯繫管理員(jay198377@gmail.com)以開通您的帳號, 信件主旨 "AI護理排班系統續用申請"。</p>
        <button onClick={() => signOut(auth)} style={{ marginTop: '20px' }}>登出</button>
    </div>
);


// 最外層的主 App 元件
function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRedirectResult(auth).catch((error) => console.error("Redirect Result 處理失敗", error));
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) { 
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          alert(`Hi, ${currentUser.displayName || currentUser.email}！歡迎加入！您已獲得一個月的完整功能試用期。`);
          const newProfile = {
            email: currentUser.email,
            role: 'user',
            trialStartedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          const newDocSnap = await getDoc(userRef);
          setUserProfile(newDocSnap.data());
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div style={{textAlign: 'center', marginTop: '50px', fontSize: '1.2em'}}>載入中...</div>;
  }

  const renderContent = () => {
      if (user && userProfile) {
          if (userProfile.role === 'admin') {
              return <NurseScheduleApp user={user} />;
          }
          if (userProfile.trialStartedAt?.toDate) { 
              const trialStartDate = userProfile.trialStartedAt.toDate();
              const trialEndDate = new Date(trialStartDate.getTime() + 30 * 24 * 60 * 60 * 1000); 
              if (new Date() < trialEndDate) {
                  return <NurseScheduleApp user={user} />;
              } else {
                  return <TrialExpiredPage user={user} />;
              }
          }
          return <div style={{textAlign: 'center', marginTop: '50px', fontSize: '1.2em'}}>正在驗證使用者權限...</div>;
      } else if(user && !userProfile) {
          return <div style={{textAlign: 'center', marginTop: '50px', fontSize: '1.2em'}}>正在讀取使用者資料...</div>;
      }
      else {
          return <AuthPage />;
      }
  };

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}

export default App;

