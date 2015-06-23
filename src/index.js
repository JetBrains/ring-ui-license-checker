import fs from 'fs';
import path from 'path';

import getLicences from './get-licences';

function filterModule(module) {
  return (module.built || module.name.indexOf('external ') === 0) &&
    module.name.indexOf('(webpack)') === -1 &&
    module.reasons.length > 0;
}

const requestPattern = /^[^!.\/$][^!?=]*$/;
function filterReasons(reason) {
  return typeof reason.userRequest === 'string' && reason.userRequest.match(requestPattern);
}

/**
 * @param {Object} options options
 * @param {boolean} options.devDependencies
 * @param {Array|Regexp} options.exclude
 * @param {string} options.directory
 */
export default class LicenseChecker {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    let options = this.options;
    function exclude(path) {
      const excludes = Array.isArray(options.exclude) ? options.exclude : [options.exclude];

      return excludes.some(it => it.test(path))
    }

    compiler.plugin('emit', function (curCompiler, callback) {
      // FS aliases from webpack.
      //var mkdirp = compiler.outputFileSystem.mkdirp;
      //var writeFile = compiler.outputFileSystem.writeFile;
      let modules = {};

      let stats = curCompiler.getStats().toJson({
        assets: false,
        chunks: false,
        source: false
      });

      stats.modules.
        filter(filterModule).
        forEach(function (module) {
          module.reasons.
            filter(filterReasons).
            forEach(function (reason) {
              var userRequest = reason.userRequest.split('/')[0];

              if (!modules[userRequest] && !exclude(module.name)) {
                modules[userRequest] = module;
              }
            });
        });

      getLicences({
        directory: options.directory,
        production: !options.devDependencies
      }, modules, function (err, result) {
        console.log(result);
      })
    });
  }
}

