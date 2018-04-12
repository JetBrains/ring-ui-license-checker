import 'babel-polyfill';
import {join, dirname} from 'path';

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
    const additionalModules = this.options.modules || [];
    const filename = this.options.filename || 'third-party-libs.xml';
    const pkg = require(join(directory, 'package.json'));
    const title = this.options.title || pkg.description + ' Front-End Libraries';

    const production = !this.options.devDependencies;
    const formatModules = this.options.format || format;
    const filterModules = this.filterModules.bind(this);
    const filterReasons = this.filterReasons.bind(this);
    const forceAddPackages = this.forceAddPackages;
    const customLicenses = this.customLicenses;
    const surviveLicenseErrors = this.options.surviveLicenseErrors;

    const emit =  (curCompiler, callback) =>  {
      // FS aliases from webpack.
      const mkdirp = compiler.outputFileSystem.mkdirp;
      const writeFile = compiler.outputFileSystem.writeFile;

      const stats = curCompiler.getStats().toJson({
        assets: false,
        chunks: false,
        source: false
      });

      const processModules = modules => modules.
        filter(filterModules).
        reduce((collected, module) => ((module.modules
          ? collected.concat(processModules(module.modules))
          : collected
        ).concat(module.reasons.
            filter(filterReasons).
            map(reason => reason.userRequest[0] === '@'
                ? reason.userRequest.split('/').splice(0, 2).join('/')
                : reason.userRequest.split('/')[0]))), []);

      const foundModules = processModules(stats.modules).concat(additionalModules);

      const modules = foundModules.concat(forceAddPackages);

      const uniqueModules = [...new Set(modules)];

      getLicences(uniqueModules, {directory, production, surviveLicenseErrors}, function (err, modules) {
        if (err) {
          return callback(err);
        }

        modules = modules.concat(customLicenses);
        const filePath = join(compiler.options.output.path, filename);

        mkdirp(dirname(filePath), function (err) {
          if (err) {
            return callback(err);
          }

          writeFile(
            filePath,
            formatModules({title, modules}),
            {flags: "w+"},
            callback
          );
        })
      })
    };

    if (compiler.hooks) {
      compiler.hooks.emit.tapAsync('RingUiLicenseCheckerPlugin', emit);
    } else {
      compiler.plugin('emit', emit);
    }
  }
}

