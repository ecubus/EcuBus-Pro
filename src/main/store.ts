// import conf from 'conf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conf = require('conf')

/** ESM default interop: bundler may expose { default } when outputting CJS */
const Conf = (conf as { default?: typeof conf }).default ?? conf

/**
 * Application config store using conf (replaces electron-store).
 * Uses Electron's userData path for consistent config location.
 */
export const store = new Conf({
  projectName: 'ecubuspro',
  projectSuffix: ''
  // configName: 'config'
})
