import nlf from 'nlf';
import ossname2url from 'oss-license-name-to-url';

const licenseUrlPrefix = 'http://opensource.org/licenses/';
const alternatives = {
  'http://creativecommons.org/publicdomain/zero/1.0/': 'cc0-1.0',
  'http://unlicense.org/': 'Unlicense',
  'http://www.wtfpl.net/about/': 'wtfplv2'
};

const npmUrlPrefix = 'https://www.npmjs.com/package/';
const permissiveLicenses = {
  'MIT': true,
  'BSD-2-Clause': true,
  'BSD-3-Clause': true,
  'Apache-2.0': true,
  'wtfplv2': true,
  'ISC': true,
  'Unlicense': true
};

const additionalAliases = {
  'BSD-like' :'BSD-2-Clause'
};

const additionalLicences = {
  Unlicense: 'http://unlicense.org/'
};

function url2name(url) {
  return url.split(licenseUrlPrefix)[1] || alternatives[url];
}

function name2url(name) {
  return additionalLicences[name] || ossname2url(name);
}

function chooseLicense(licences) {
  for (let i = 0; i < licences.length; i++) {
    let license = licences[i];
    let names = license.license && [license.license] || typeof license.names === 'function' && license.names();

    if (!names) {
      return;
    }

    for (let j = 0; j < names.length; j++) {
      if (names[j]) {
        let url = name2url(names[j]);
        let canonicalName;

        if (!url) {
          canonicalName = additionalAliases[names[j]];
          url = canonicalName && licenseUrlPrefix + canonicalName;
        } else {
          canonicalName = url2name(url);
        }

        if (!url) {
          continue;
        }

        if (permissiveLicenses[canonicalName]) {
          return {
            name: canonicalName,
            url: license.url !== '(none)' && license.url || url
          };
        }
      }
    }
  }
}

export default function (modules, params, callback) {
  try {
    nlf.find(params, function processModules(err, licenses) {
      if (err) {
        throw err;
      }

      const result = modules.sort().
        filter(module => module.indexOf('jetbrains-') !== 0 && module.indexOf('ring-ui') !== 0).
        map(name => licenses.find(module => module.name === name)).
        filter(module => module).
        map(function (module) {
          const sources = module.licenseSources;

          const licensesCount = sources.package.sources.length +
            sources.license.sources.length +
            sources.readme.sources.length;

          if (!licensesCount) {
            throw new Error('No license found for package ' + module.name);
          }

          const license = chooseLicense(sources.package.sources) ||
            chooseLicense(sources.license.sources) ||
            chooseLicense(sources.readme.sources);

          if (!license) {
            throw new Error('No *permissive* license found for package ' + module.name);
          }

          return {
            license,
            name: module.name,
            version: module.version,
            url: npmUrlPrefix + module.name
          }
        });

      callback(null, result);
    });
  } catch (e) {
    callback(e);
  }
}

