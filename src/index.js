import 'babel/polyfill';
import {join} from 'path';

import getLicences from './get-licences';
import format from './format';

/**
 * @param {Object} options options
 * @param {boolean} options.devDependencies
 * @param {Array|RegExp} options.exclude
 * @param {string} options.directory
 */
export default class LicenseChecker {
  constructor(options = {}) {
    this.options = options;

    this.exclude = options.exclude && [].concat(options.exclude);
    this.excludeUserRequest = options.excludeUserRequest && [].concat(options.excludeUserRequest);
    
    this.forceAddPackages = options.forceAddPackages || [];
    this.customLicenses = options.customLicenses || [];
  }

  // TODO Exclude ProvidePlugin requests and aliases
  // See compiler.options.plugins["0"].definitions
  filterReasons(reason) {
    return typeof reason.userRequest === 'string' && reason.userRequest.match(/^[^!.\/$][^!?=]*$/) 
    && (!this.excludeUserRequest || !this.excludeUserRequest.some(it =>it.test(reason.userRequest)));
  }

  filterModules(module) {
    return (module.built || module.name.indexOf('external ') === 0) &&
      module.name.indexOf('(webpack)') === -1 &&
      module.reasons.length > 0 && (!this.exclude || !this.exclude.some(it => it.test(module.name)))
  }

  apply(compiler) {
    const directory = this.options.directory || process.cwd();
    const additionalModules = this.options.modules;
    const filename = this.options.filename || 'third-party-libs.xml';
    const pkg = require(join(directory, 'package.json'));
    const title = this.options.title || pkg.description + ' Front-End Libraries';

    const production = !this.options.devDependencies;
    const formatModules = this.options.format || format;
    const filterModules = this.filterModules.bind(this);
    const filterReasons = this.filterReasons.bind(this);
    const forceAddPackages = this.forceAddPackages;
    const customLicenses = this.customLicenses;

    compiler.plugin('emit', function (curCompiler, callback) {
      // FS aliases from webpack.
      const mkdirp = compiler.outputFileSystem.mkdirp;
      const writeFile = compiler.outputFileSystem.writeFile;

      const stats = curCompiler.getStats().toJson({
        assets: false,
        chunks: false,
        source: false
      });

      const foundModules = stats.modules.
        filter(filterModules).
        reduce((collected, module) => collected.concat(
          module.reasons.
            filter(filterReasons).
            map(reason => reason.userRequest.split('/')[0])
        ), additionalModules || []);


      const modules = foundModules.concat(forceAddPackages);

      const uniqueModules = [...new Set(modules)];

      getLicences(uniqueModules, {directory, production}, function (err, modules) {
        if (err) {
          return callback(err);
        }

        modules = modules.concat(customLicenses);

        mkdirp(compiler.options.output.path, function (err) {
          if (err) {
            return callback(err);
          }

          writeFile(
            join(compiler.options.output.path, filename),
            formatModules({title, modules}),
            {flags: "w+"},
            callback
          );
        })
      })
    });
  }
}

