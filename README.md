ring-ui-license-checker
=======================

[![official JetBrains project](http://jb.gg/badges/official-flat-square.svg)](https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub)
[![npm (scoped)](https://img.shields.io/npm/v/@jetbrains/ring-ui-license-checker.svg)](npmjs.com/package/@jetbrains/ring-ui-license-checker)


This repository SSH URL: ssh://github.com/JetBrains/ring-ui-license-checker.git
This repository HTTPS URL: https://github.com/JetBrains/ring-ui-license-checker.git

Develop with pleasure(R)

#### Options

- `filename`: String
- `format`: (params = {modules: module[]}) => String
- `exclude`: RegExp
- `forceAddPackages`: module[]
- `customLicenses`: module[]
- `surviveLicenseErrors`: Boolean
- `teamcityMessageStatus`: String - message status to report (NORMAL, WARNING, FAILURE, ERROR)

Options usage and `module` object structure example:

```javascript
      new LicenseChecker({
        filename: 'third-party-licenses.txt',
        format: params =>
          params.modules
            .map(
              mod => `${mod.name} (${mod.url})
${mod.license.name} (${mod.license.url})`,
            )
            .join('\n\n'),
        // stackframe has wrong license field in 0.3.1
        exclude: [/stackframe/],
        customLicenses: [{
          name: 'stackframe',
          version: '0.3.1',
          url: 'https://www.npmjs.com/package/stackframe',
          license: {
            name: 'Unlicense',
            url: 'http://unlicense.org/'
          }
        }],
        surviveLicenseErrors: true,
      }),
```
