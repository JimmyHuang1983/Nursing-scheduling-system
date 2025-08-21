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

// --- 通用 Modal 元件 ---
const Modal = ({ title, children, onClose }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <button onClick={onClose} className="modal-close-button">&times;</button>
            <h2>{title}</h2>
            {children}
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
  const [mutualSupport, setMutualSupport] = useState(false);
  const [userPrefills, setUserPrefills] = useState({});

  const [params, setParams] = useState({
    D: 6, E: 4, N: 4, Fn: 1,
    minOff: 8, maxConsecutive: 5,
  });
  
  // --- 漢堡選單與其 Modal 的狀態 ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modalContent, setModalContent] = useState(null); // 'guide', 'history', 'about'

  useEffect(() => {
    if (schedule.__meta) {
      const { year, month } = schedule.__meta;
      const newDays = new Date(year, month + 1, 0).getDate();
      setDaysInMonth(newDays);
    }
  }, [schedule]);
  
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

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
            if (prevShift === 'N' && (newShift === 'D' || newShift === 'E' || newShift === 'Fn')) return false;
            if (prevShift === 'E' && newShift === 'D') return false;
            if (prevShift === 'Fn' && newShift === 'D') return false;
        }
        if (day < daysInMonth - 1) {
            const nextShift = schedule[nurse][day + 1];
            if (newShift === 'N' && (nextShift === 'D' || nextShift === 'E' || nextShift === 'Fn')) return false;
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

  const renderModalContent = () => {
    switch(modalContent) {
        case 'guide':
            return <Modal title="使用說明" onClose={() => setModalContent(null)}>
                <ul>
                    <li><strong>步驟一：設定條件</strong> - 在畫面頂端輸入每日各班別的人力需求、每人應休天數上限與最多連續上班天數。</li>
                    <li><strong>步驟二：輸入人員名單</strong> - 在「輸入人員名單」區塊，填入所有參與排班的護理師姓名，請用英文逗號 <code>,</code> 隔開。</li>
                    <li><strong>步驟三：勾選班別資格</strong> - 系統會自動產生勾選清單，請為每位護理師勾選他/她具備的班別資格。</li>
                    <li><strong>步驟四：確認與預班</strong> - 按下「確認人員與班別」按鈕，系統會產生一個空白的班表。您可以在此手動為特定人員預排休假（R）或「公」假。</li>
                    <li><strong>步驟五：AI 產生班表</strong> - 按下「產生班表」按鈕，AI 將根據您設定的所有條件，自動計算並產生一份公平的班表。</li>
                    <li><strong>步驟六：夜班人力優化</strong> - (可選) 在產生班表後，可多次點擊「夜班人力支援優化」（單次）或「一鍵優化夜班」（多次）按鈕，以平衡小夜與大夜班的休假天數。</li>
                    <li><strong>步驟七：匯出Excel</strong> - 對班表滿意後，可點擊「匯出至Excel」將結果下載保存。</li>
                </ul>
            </Modal>;
        case 'history':
            return <Modal title="版本歷史紀錄" onClose={() => setModalContent(null)}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '14px' }}>
{`AI 護理排班系統 - 版本歷史紀錄

### v7.1 (當前版本)
- 新增漢堡設定選單 (深色模式, 使用說明, 版本歷史, 問題回報, 關於)
- 新增「Fn 班後不能接 D 班」的排班規則與視覺提示
- 在班表表頭新增「星期幾」資訊列
- 修正 Fn 班總計在週末的 Highlight 邏輯
- 調整班別下拉選單順序

### v7.0 
- 新增「一鍵優化夜班」功能，自動多次執行交換邏輯以平衡休假
- 新增使用者預填班別 Highlight 功能，方便手動微調
- 新增「人力過剩」的黃底 Highlight 警示

### v6.0
- 成功整合 Firebase Firestore 資料庫
- 實現使用者「一個月試用期」與管理員「永久使用權」
- 解決因非同步讀取資料庫導致的登入迴圈問題，確保登入流程穩定

### v5.0
- 建立 feature/authentication 開發分支，將主線 (main) 與新功能（帳號系統）的開發完全隔離
- 成功整合 Firebase Authentication，實現安全的 Google 帳號登入/登出
- 引入環境變數 (.env.local) 與 GitHub Secrets，安全管理 API 金鑰

### v4.0
- 建立穩定、可用的核心排班功能，被定義為第一個成功的版本。
- 新增「夜班人力支援優化」按鈕，提供使用者在 AI 產生班表後，手動、單次地進行人力平衡微調的彈性。
- 新增使用者教學，在首次進入頁面時彈出引導視窗。
- 修復並保留「公」假，確保使用者預排的公假不會被 AI 演算法覆蓋。

### v3.0
- 大幅優化排班演算法，引入綜合評分機制，解決先前版本休假天數嚴重不公（有人休26天，有人只休5天）的問題。
- 新增「人力過剩」的黃底 Highlight 警示，讓班表狀態更一目了然。

### v2.0
- 重構表格顯示邏輯，解決 UI 元件重複渲染導致畫面內容出現兩次的問題。
- 實現「人力不足」、「休假不足」與「連續上班超時」的紅底 Highlight 警示功能。
- 新增「匯出至 Excel」功能。
- 新增 DEMO 按鈕，方便快速展示系統功能。

### v1.0
- 專案初始化，使用 React + Vite 建立基本 UI 介面。
- 解決部署後空白頁面、路徑錯誤、CSS 樣式錯誤等多項基礎建設問題。
- 完成 GitHub Actions 自動化部署流程，成功發布第一個可在線上操作的版本。`}
                </pre>
            </Modal>;
        case 'about':
            return <Modal title="關於本系統" onClose={() => setModalContent(null)}>
                <p>AI 護理排班系統 v7.1</p>
                <p>開發者： JimmyHuang1983</p>
            </Modal>;
        default:
            return null;
    }
  };

  return (
    <div>
       {renderModalContent()}
       <div className="header-bar">
         <div className="hamburger-container" onMouseEnter={() => setIsMenuOpen(true)} onMouseLeave={() => setIsMenuOpen(false)}>
            <button className="hamburger-menu">
                &#9776;
            </button>
            {isMenuOpen && (
              <div className="side-menu">
                  <ul>
                      <li>
                          <div className="menu-item">
                              <span>深色模式</span>
                              <label className="toggle-switch">
                                  <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
                                  <span className="slider"></span>
                              </label>
                          </div>
                      </li>
                      <li><button className="menu-item-button" onClick={() => {setModalContent('guide'); setIsMenuOpen(false);}}>使用說明</button></li>
                      <li><button className="menu-item-button" onClick={() => {setModalContent('history'); setIsMenuOpen(false);}}>版本歷史</button></li>
                      <li><a href="mailto:jay198377@gmail.com?subject=AI護理排班系統 問題回報/功能建議" target="_blank" rel="noopener noreferrer" className="menu-item-link">問題回報 / 功能建議</a></li>
                      <li><button className="menu-item-button" onClick={() => {setModalContent('about'); setIsMenuOpen(false);}}>關於</button></li>
                  </ul>
              </div>
            )}
         </div>
         <h1>
            AI 護理排班系統 
            <span className="version-tag">v7.1</span>
         </h1>
         <div className="user-info">
            <span>歡迎, {user.displayName || user.email}</span>
            <button onClick={handleLogout}>登出</button>
         </div>
       </div>
      
      <div className="main-content">
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

          <div className="input-container-with-demo">
            <InputPanel
              nurseNames={nurseNames} setNurseNames={setNurseNames}
              availableShifts={availableShifts} setAvailableShifts={setAvailableShifts}
              onConfirm={handleConfirm}
            />
            <button onClick={handleDemo} className="demo-button">DEMO</button>
          </div>


          {generated && (
            <div className="actions-panel">
              <button onClick={handleGenerate}>產生班表</button>
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
    </div>
  );
}

// 登入頁面
function AuthPage() {
    return (
        <div>
            <h1 style={{marginBottom: '40px', textAlign: 'center'}}>AI 護理排班系統</h1>
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
        <button onClick={() => signOut(auth)}>登出</button>
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

