// Runs against the built package: `npm test` (build + this).
const assert = require('assert')

const licenseChecker = require('../vite')
const getLicences = require('../lib/get-licences')

const {packageNameFromId} = licenseChecker
const ASYNC_SETTLE_MS = 50

// --- packageNameFromId ---------------------------------------------------
assert.strictEqual(packageNameFromId('/a/node_modules/react/index.js'), 'react')
assert.strictEqual(packageNameFromId('/a/node_modules/@scope/pkg/dist/x.js'), '@scope/pkg')
assert.strictEqual(packageNameFromId('/a/node_modules/a/node_modules/b/i.js'), 'b')
assert.strictEqual(packageNameFromId('/src/app.js'), null)
// externals: bare ids only count when isExternal
assert.strictEqual(packageNameFromId('react', true), 'react')
assert.strictEqual(packageNameFromId('@scope/pkg', true), '@scope/pkg')
assert.strictEqual(packageNameFromId('node:path', true), null)
assert.strictEqual(packageNameFromId('./local', true), null)
assert.strictEqual(packageNameFromId('react', false), null)
// bare Node built-ins (incl. subpaths) are not packages
assert.strictEqual(packageNameFromId('fs', true), null)
assert.strictEqual(packageNameFromId('path', true), null)
assert.strictEqual(packageNameFromId('fs/promises', true), null)

// subpath export resolves to the plugin factory
const base = licenseChecker({directory: process.cwd()})
assert.strictEqual(base.name, 'ring-ui-license-checker')
assert.strictEqual(typeof base.generateBundle, 'function')

// mock Rollup plugin context
function ctx(ids, externals = []) {
  const ext = new Set(externals)
  const emitted = []
  return {
    emitted,
    getModuleIds: () => ids[Symbol.iterator](),
    getModuleInfo: id => ({isExternal: ext.has(id)}),
    emitFile(f) {
      emitted.push(f)
    }
  }
}

async function main() {
  // `oss-license-name-to-url` is a real dependency of this package
  const dep = 'oss-license-name-to-url'

  // --- discovery + emit -------------------------------------------------
  const plugin = licenseChecker({directory: process.cwd(), filename: 'libs.xml'})
  const c1 = ctx([`/x/node_modules/${dep}/index.js`, '/x/src/app.js'])
  await plugin.generateBundle.call(c1)
  assert.strictEqual(c1.emitted.length, 1)
  assert.strictEqual(c1.emitted[0].fileName, 'libs.xml')
  assert.ok(c1.emitted[0].source.includes(dep), 'discovered dep must appear in output')

  // --- exclude drops a module by id -------------------------------------
  const plugin2 = licenseChecker({directory: process.cwd(), exclude: [new RegExp(dep)]})
  const c2 = ctx([`/x/node_modules/${dep}/index.js`])
  await plugin2.generateBundle.call(c2)
  assert.ok(!c2.emitted[0].source.includes(dep), 'excluded dep must not appear')

  // --- a global /g exclude regex stays deterministic across ids ---------
  const plugin2b = licenseChecker({directory: process.cwd(), exclude: [new RegExp(dep, 'g')]})
  const c2b = ctx([`/x/node_modules/${dep}/a.js`, `/x/node_modules/${dep}/b.js`])
  await plugin2b.generateBundle.call(c2b)
  assert.ok(!c2b.emitted[0].source.includes(dep), 'global regex must exclude every matching id')

  // --- a relative directory resolves the manifest -----------------------
  const pluginRel = licenseChecker({directory: '.'})
  const cRel = ctx([`/x/node_modules/${dep}/index.js`])
  await pluginRel.generateBundle.call(cRel)
  assert.ok(cRel.emitted[0].source.includes(dep), 'relative directory must load and emit')

  // --- externals discovered from bare ids -------------------------------
  const plugin3 = licenseChecker({directory: process.cwd()})
  const c3 = ctx([dep], [dep])
  await plugin3.generateBundle.call(c3)
  assert.ok(c3.emitted[0].source.includes(dep), 'external dep must appear')

  // --- rejection path: a throwing formatter rejects the hook ------------
  const plugin4 = licenseChecker({
    directory: process.cwd(),
    format: () => {
      throw new Error('boom')
    }
  })
  await assert.rejects(
    plugin4.generateBundle.call(ctx([`/x/node_modules/${dep}/index.js`])),
    /boom/
  )

  // --- getLicences invokes a throwing success callback exactly once -----
  await new Promise((resolve, reject) => {
    let calls = 0
    const onUncaught = () => {} // swallow the error re-thrown out of the callback
    process.once('uncaughtException', onUncaught)
    getLicences([], {directory: process.cwd(), production: true}, () => {
      calls += 1
      setTimeout(() => {
        process.removeListener('uncaughtException', onUncaught)
        return calls === 1 ? resolve() : reject(new Error(`callback called ${calls}x`))
      }, ASYNC_SETTLE_MS)
      throw new Error('callback throws')
    })
  })

  // eslint-disable-next-line no-console
  console.log('ok')
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exitCode = 1
})
