// 生产环境入口 — 用 @hono/node-server 启动 HTTP，服务静态文件 + API
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import api from './app'

// 创建独立的生产服务器实例，不修改 api 模块（P2-1）
const server = new Hono()

// API 路由挂载
server.route('/', api)

// 静态文件服务（Vite build 产物）
server.use('/*', serveStatic({ root: './dist' }))

// SPA fallback — 非 /api 路径返回 index.html
server.get('*', serveStatic({ root: './dist', path: '/index.html' }))

const port = Number(process.env.PORT) || 4173

serve({ fetch: server.fetch, port, hostname: '127.0.0.1' }, () => {
  console.log(`生产服务器已启动: http://localhost:${port}`)
})
