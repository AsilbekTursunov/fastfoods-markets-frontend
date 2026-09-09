import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
	},
	// the built app needs the same /api proxy when checking it locally with `vite preview`
	preview: {
		port: Number(process.env.PREVIEW_PORT) || 4173,
		proxy: {
			'/api': { target: 'https://fastfood-markets-backend.up.railway.app', changeOrigin: true },
		},
	},
	server: {
		port: Number(process.env.PORT) || 5173,
		host: true,
		proxy: {
			// forwards /api/* to your backend during development
			'/api': { target: 'https://fastfood-markets-backend.up.railway.app', changeOrigin: true },
		},
		allowedHosts: ['d0bf-144-124-192-212.ngrok-free.app'],
	},
})
