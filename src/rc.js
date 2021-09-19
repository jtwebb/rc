const deepExtend = require('deep-extend');
const utils = require('./utils');

module.exports = (name, defaults = {}, argv, parsers = utils.parsers) => {
  const isWindows = process.platform === 'win32';
  const home = isWindows ? process.env.USERPROFILE : process.env.HOME;

  if (typeof name !== 'string') {
    throw new Error(`rc(name): name must be string. "${typeof name}" given.`);
  }

  if (!argv) {
    argv = require('minimist')(process.argv.slice(2));
  }

  if (typeof defaults !== 'object' || Array.isArray(defaults)) {
    throw new Error('`defaults` has to be an object');
  }

  const env = utils.parseEnv(`${name}_`);

  const files = utils.getConfigFiles(name, parsers, isWindows, home);

  if (env.config) {
    utils.check(env.config);
    files.push(env.config);
  }

  if (argv.config) {
    utils.check(argv.config);
    files.push(argv.config);
  }

  const configs = [defaults];
  const configFiles = [];

  for (const file of files) {
    if (configFiles.includes(file)) {
      continue;
    }

    const fileConfig = utils.getFileContents(file);
    if (fileConfig) {
      configs.push(utils.parse(fileConfig));
      configFiles.push(file);
    }
  }

  const configObject = configFiles.length
    ? { configs: configFiles, config: configFiles[configFiles.length - 1] }
    : undefined;

  return deepExtend.apply(null, configs.concat([env, argv, configObject]));
};
