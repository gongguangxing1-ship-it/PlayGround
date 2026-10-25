import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const root = resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT || 3000)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/__health') {
      send(res, 200, 'ok')
      return
    }

    const pathname = decodeURIComponent(url.pathname)
    const requested = pathname === '/' ? '/index.html' : pathname
    let file = resolve(root, `.${requested}`)

    if (file !== root && !file.startsWith(root + sep)) {
      send(res, 403, 'Forbidden')
      return
    }

    try {
      const info = await stat(file)
      if (info.isDirectory()) file = join(file, 'index.html')
    } catch {
      if (extname(file)) {
        send(res, 404, 'Not found')
        return
      }
      file = join(root, 'index.html')
    }

    const data = await readFile(file)
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch (error) {
    console.error(error)
    send(res, 500, 'Internal server error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Neon Rush serving ${root} at http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
