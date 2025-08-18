    // 引入 Firebase 相關模組
    import { initializeApp } from "firebase/app";
    import { getAuth } from "firebase/auth";

    // 您的 Firebase 專案設定 (從 Firebase Console 複製)
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_apiKey,
      authDomain: import.meta.env.VITE_authDomain,
      projectId: import.meta.env.VITE_projectId,
      storageBucket: import.meta.VITE_storageBucket,
      messagingSenderId: import.meta.env.VITE_messagingSenderId,
      appId: import.meta.env.VITE_appId,
      measurementId: import.meta.env.VITE_measurementId,
    };

    // 初始化 Firebase
    const app = initializeApp(firebaseConfig);

    // 匯出 Authentication 服務，讓其他元件可以使用
    export const auth = getAuth(app);
