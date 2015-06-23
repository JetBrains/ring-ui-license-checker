import 'babel/polyfill';
import fs from 'fs';
import path from 'path';

import getLicences from './get-licences';

/**
 * @param {Object} options options
 * @param {boolean} options.devDependencies
 * @param {Array|Regexp} options.exclude
 * @param {string} options.directory
 */
export default class LicenseChecker {
  constructor(options) {
    this.options = options;

    const exclude = this.options.exclude;
    this.excludes = Array.isArray(exclude) ? exclude : [exclude]
  }

  static filterReasons(reason) {
    return typeof reason.userRequest === 'string' && reason.userRequest.match(/^[^!.\/$][^!?=]*$/);
  }

  filterModules(module) {
    return (module.built || module.name.indexOf('external ') === 0) &&
      module.name.indexOf('(webpack)') === -1 &&
      module.reasons.length > 0 && !this.excludes.some(it => it.test(module.name))
  }

  apply(compiler) {
    const options = this.options;
    const filterModules = this.filterModules.bind(this);

    compiler.plugin('emit', function (curCompiler, callback) {
      // FS aliases from webpack.
      //var mkdirp = compiler.outputFileSystem.mkdirp;
      //var writeFile = compiler.outputFileSystem.writeFile;
      let stats = curCompiler.getStats().toJson({
        assets: false,
        chunks: false,
        source: false
      });

      const modules = stats.modules.
        filter(filterModules).
        reduce(function (collected, module) {
          return collected.concat(module.reasons.
            filter(LicenseChecker.filterReasons).
            map(reason => reason.userRequest.split('/')[0]));
        }, options.modules || []);

      const uniqueModules = [...new Set(modules)];

      getLicences({
        directory: options.directory,
        production: !options.devDependencies
      }, uniqueModules, function (err, result) {
        console.log(result);
      })
    });
  }
}

