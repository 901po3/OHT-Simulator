import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // LAN 내 다른 기기에서 접속 허용 (0.0.0.0 바인딩)
    port: 5173,  // 기본 포트 고정
  },
})
