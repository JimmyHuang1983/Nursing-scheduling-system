import React, { useState } from 'react';
import { auth } from '../firebase'; // 引入我們設定好的 Firebase auth
// ✅ 引入 sendEmailVerification 函式
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(''); // 用來顯示成功訊息

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // ✅ 註冊成功後，立刻寄送驗證信
      await sendEmailVerification(userCredential.user);
      
      console.log("註冊成功，驗證信已寄出!", userCredential.user);
      setMessage("註冊成功！一封驗證信已寄送到您的信箱，請點擊信中連結以啟用帳號。");
    } catch (err) {
      console.error("註冊失敗:", err.message);
      setError("註冊失敗：" + err.message);
    }
  };

  return (
    <div>
      <h2>註冊新帳號</h2>
      <form onSubmit={handleSignUp}>
        <div>
          <label>
            電子郵件:
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入您的電子郵件"
              required
            />
          </label>
        </div>
        <div>
          <label>
            密碼:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請設定您的密碼 (至少6位數)"
              required
            />
          </label>
        </div>
        <button type="submit">註冊</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </div>
  );
}

export default SignUp;

