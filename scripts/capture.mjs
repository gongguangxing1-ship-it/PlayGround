import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.CAPTURE_URL
const outputDir = process.env.CAPTURE_DIR

if (!url || !outputDir) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR before running capture.')
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

const startedAt = Date.now()
const log = (message) => {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2)
  console.log(`[capture +${seconds}s] ${message}`)
}

function withExitCode(error, code) {
  error.exitCode = code
  return error
}

const runtime = join(process.env.HOME || '', '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')

try {
  const wip = require(join(runtime, 'wip-screenshots.cjs'))
  wip.instrument({ chromium })
} catch (error) {
  console.warn(`WIP screenshot instrumentation skipped: ${error.message}`)
}

const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configFile, 'utf8'))

if (process.platform === 'linux' && !process.env.DISPLAY) {
  process.env.DISPLAY = `:${readFileSync(join(runtime, 'display'), 'utf8').trim()}`
}

let browser
let activeContext
try {
  browser = await chromium
    .launch({ ...config.browser.launchOptions, timeout: 30000 })
    .catch((error) => {
      throw withExitCode(error, 75)
    })
  log(`browser launched for ${url}`)

  const views = [
    { name: 'desktop', width: 1440, height: 900, mobile: false },
    { name: 'mobile', width: 390, height: 844, mobile: true }
  ]

  for (const view of views) {
    activeContext = await browser
      .newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: 1,
        isMobile: view.mobile,
        hasTouch: view.mobile
      })
      .catch((error) => {
        throw withExitCode(error, 75)
      })

    const page = await activeContext.newPage().catch((error) => {
      throw withExitCode(error, 75)
    })
    page.setDefaultTimeout(30000)

    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
      console.error(`[capture] pageerror: ${error.message}`)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[capture] console: ${message.text()}`)
    })

    const response = await page
      .goto(url, { waitUntil: 'load', timeout: 45000 })
      .catch((error) => {
        throw withExitCode(error, 75)
      })

    if (!response || !response.ok()) {
      const status = response ? response.status() : 0
      const temporary = !response || [408, 429, 500, 502, 503, 504].includes(status)
      throw withExitCode(
        new Error(`HTTP ${status || 'no response'} loading ${url}`),
        temporary ? 75 : 1
      )
    }
    log(`${view.name}: loaded ${url} (HTTP ${response.status()})`)

    try {
      await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 })
    } catch (error) {
      const appError = await page
        .evaluate(() => document.body.dataset.appError || '')
        .catch(() => '')
      if (appError) {
        throw withExitCode(new Error(`App reported a rendering error: ${appError}`), 1)
      }
      if (!browser.isConnected()) throw withExitCode(error, 75)
      throw withExitCode(new Error(`App never became ready: ${error.message}`), 1)
    }
    log(`${view.name}: renderer ready`)

    const frozen = await page
      .evaluate(() => {
        if (!window.__PEACE || typeof window.__PEACE.freeze !== 'function') return false
        window.__PEACE.freeze(true)
        return true
      })
      .catch(() => false)
    log(`${view.name}: bot freeze ${frozen ? 'enabled' : 'unavailable'}`)

    const play = page.locator('#play-btn')
    if (!(await play.isVisible().catch(() => false))) {
      throw withExitCode(new Error('Play control is not visible'), 1)
    }

    await play.click({ timeout: 5000 }).catch((error) => {
      if (!browser.isConnected()) throw withExitCode(error, 75)
      throw withExitCode(error, 1)
    })
    log(`${view.name}: Play clicked`)

    try {
      await page.waitForSelector('body[data-game-started="true"]', { timeout: 5000 })
      const startingFrames = await page.evaluate(() => window.__PEACE_STATE?.frames || 0)
      await page.waitForFunction(
        (start) => (window.__PEACE_STATE?.frames || 0) > start + 24,
        startingFrames,
        { timeout: 20000 }
      )
    } catch (error) {
      if (!browser.isConnected()) throw withExitCode(error, 75)
      throw withExitCode(new Error(`Gameplay did not start: ${error.message}`), 1)
    }

    await page.waitForTimeout(700)

    const status = await page
      .evaluate(() => ({
        frames: window.__PEACE_STATE?.frames || 0,
        drawCalls: window.__PEACE_STATE?.drawCalls || 0,
        alive: window.__PEACE_STATE?.alive || 0,
        kills: window.__PEACE_STATE?.kills || 0,
        started: Boolean(window.__PEACE_STATE?.started),
        over: Boolean(window.__PEACE_STATE?.over),
        webgl: Boolean(window.__PEACE_STATE?.webgl)
      }))
      .catch((error) => {
        if (!browser.isConnected()) throw withExitCode(error, 75)
        throw withExitCode(error, 1)
      })

    log(
      `${view.name}: frames=${status.frames} drawCalls=${status.drawCalls} alive=${status.alive} kills=${status.kills} over=${status.over}`
    )

    if (!status.webgl || !status.started || status.over || status.drawCalls < 1) {
      throw withExitCode(new Error(`Unexpected gameplay state for ${view.name}: ${JSON.stringify(status)}`), 1)
    }
    if (pageErrors.length > 0) {
      throw withExitCode(new Error(`Page errors during ${view.name} capture: ${pageErrors.join(' | ')}`), 1)
    }

    const file = join(outputDir, `final-${view.name}.png`)
    await page.screenshot({ path: file, timeout: 30000 }).catch((error) => {
      if (error.name === 'TimeoutError' || !browser.isConnected()) {
        throw withExitCode(error, 75)
      }
      throw withExitCode(error, 1)
    })

    const bytes = statSync(file).size
    if (bytes < 15000) {
      throw withExitCode(new Error(`${file} is suspiciously small (${bytes} bytes)`), 1)
    }
    log(`${view.name}: saved ${file} (${(bytes / 1024).toFixed(1)} KiB)`)

    await activeContext.close().catch(() => {})
    activeContext = undefined
  }

  log('all views captured')
} catch (error) {
  console.error(error)
  process.exitCode = error.exitCode || 1
} finally {
  if (activeContext) await activeContext.close().catch(() => {})
  if (browser) {
    await browser.close().catch((error) => {
      console.error(error)
      process.exitCode ||= 75
    })
  }
}
