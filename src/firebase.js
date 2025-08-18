    // 引入 Firebase 相關模組
    import { initializeApp } from "firebase/app";
    import { getAuth } from "firebase/auth";

    // 您的 Firebase 專案設定 (從 Firebase Console 複製)
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_API_KEY,
      authDomain: import.meta.env.VITE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_APP_ID,
      measurementId: import.meta.env.VITE_MEASUREMENT_ID,
    };

    // 初始化 Firebase
    const app = initializeApp(firebaseConfig);

    // 匯出 Authentication 服務，讓其他元件可以使用
    export const auth = getAuth(app);
