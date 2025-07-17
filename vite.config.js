import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Nursing-scheduling-system/', // ←這裡放你的 repo 名稱
  plugins: [react()],
})

