import {join, resolve as resolvePath} from 'path'
import {builtinModules} from 'module'

import getLicences from './get-licences'
import format from './format'

const builtins = new Set(builtinModules || [])

// `fs`, `path`, `fs/promises`, `node:fs` -> true
function isBuiltin(id) {
  const bare = id.replace(/^node:/, '')
  return id.startsWith('node:') || builtins.has(bare) || builtins.has(bare.split('/')[0])
}

// node_modules/@scope/pkg/dist/x.js -> @scope/pkg ; node_modules/pkg/x.js -> pkg
// bare external id (react, @scope/pkg) -> same. builtins & relative -> null.
export function packageNameFromId(id, isExternal) {
  const parts = id.split(/node_modules[\\/]/)
  let head
  if (parts.length > 1) {
    head = parts[parts.length - 1]
  } else if (isExternal && /^(@[^/]+\/)?[^./]/.test(id) && !isBuiltin(id)) {
    head = id
  } else {
    return null
  }
  const seg = head.split(/[\\/]/)
  return seg[0][0] === '@' ? `${seg[0]}/${seg[1]}` : seg[0]
}

// Vite/Rollup plugin variant. Same options as the webpack plugin, minus
// webpack-only ones (devDependencies, excludeUserRequest). `exclude` is
// matched against resolved module ids.
export default function licenseChecker(options = {}) {
  const directory = resolvePath(options.directory || process.cwd())
  const filename = options.filename || 'third-party-libs.xml'
  // eslint-disable-next-line global-require
  const pkg = require(join(directory, 'package.json'))
  const title = options.title || `${pkg.description} Front-End Libraries`
  const formatModules = options.format || format
  const exclude = options.exclude && [].concat(options.exclude)

  return {
    name: 'ring-ui-license-checker',
    /* eslint-disable-next-line complexity */
    generateBundle() {
      const names = new Set(options.modules || [])
      // reset lastIndex so a reused /g or /y regex stays deterministic across ids
      const excluded = id => exclude.some(it => {
        it.lastIndex = 0
        return it.test(id)
      })
      for (const id of this.getModuleIds()) {
        if (exclude && excluded(id)) {
          continue
        }
        const info = this.getModuleInfo(id)
        const name = packageNameFromId(id, Boolean(info && info.isExternal))
        if (name) {
          names.add(name)
        }
      }
      (options.forceAddPackages || []).forEach(name => names.add(name))

      return new Promise((resolve, reject) => {
        getLicences(
          [...names],
          {
            directory,
            production: true,
            surviveLicenseErrors: options.surviveLicenseErrors,
            ignoreTeamcity: Boolean(options.ignoreTeamcity),
            teamcityMessageStatus: options.teamcityMessageStatus
          },
          (err, modules) => {
            if (err) {
              return reject(err)
            }
            const allModules = modules.concat(options.customLicenses || [])
            try {
              this.emitFile({
                type: 'asset',
                fileName: filename,
                source: formatModules({title, modules: allModules})
              })
            } catch (e) {
              return reject(e)
            }
            return resolve()
          }
        )
      })
    }
  }
}
