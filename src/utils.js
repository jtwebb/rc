const fs = require('fs');
const ini = require('ini');
const path = require('path');
const stripJsonComments = require('@jtwebb/strip-json-comments')
const { join } = require('path');

const etc = '/etc';
const localEtc = join('/usr', 'local', 'etc');

const getFileContents = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error(e);
    }

    return false;
  }
}

const parseEnv = (prefix, env) => {
  env = env || process.env;
  const obj = {};
  const prefixLength = prefix.length;

  for(const key in env) {
    if (!key.toLowerCase().startsWith(prefix.toLowerCase())) {
      continue;
    }

    const keyPath = key.substring(prefixLength).split('__').filter((k) => k !== '');

    let cursor = obj;
    keyPath.forEach(function buildSubObj(subKey, i) {
      if (!subKey || typeof cursor !== 'object') {
        return;
      }

      if (i === keyPath.length - 1) {
        cursor[subKey] = env[key];
      }

      if (cursor[subKey] === undefined) {
        cursor[subKey] = {};
      }

      cursor = cursor[subKey];
    });
  }

  return obj;
}

const findFile = (filename) => {
  function find(start, filename) {
    const file = path.join(start, filename);

    if (fs.existsSync(file)) {
      return file;
    }

    if(path.dirname(start) !== start) {
      return find(path.dirname(start), filename);
    }

    return false;
  }

  return find(process.cwd(), filename);
}

const parsers = {
  '': (content) => {
    try {
      return JSON.parse(stripJsonComments(content));
    } catch (e) {
      return ini.parse(content);
    }
  },
  json: (content) => {
    try {
      return JSON.parse(stripJsonComments(content));
    } catch (e) {
      return false;
    }
  },
  ini: (content) => {
    return ini.parse(content);
  }
};

const availableParsers = () => {
  return Object.keys(parsers).map((p) => p === '' ? "''" : p).join(', ');
};

const getExt = (file) => {
  const ext = file.split('.').pop();

  if (ext.slice(-2) === 'rc') {
    return '';
  }

  return ext;
};

const parse = (contents, file, p = parsers) => {
  let ext = '';

  if (file) {
    ext = getExt(file);
  }

  if (typeof p[ext] !== 'function') {
    throw new Error(`Extension "${ext}" does not have a parser. Valid parsers: ${availableParsers()}`);
  }

  return p[ext](contents);
};

const suffix = (value) => {
  return value ? `.${value.toLowerCase()}` : '';
}

const getNonWindowsExtFiles = (prefix, name, parsers) => {
  const files = [];

  for (const parser in parsers) {
    if (!parser) {
      continue;
    }

    files.push(
      join(prefix, name, `config${suffix(parser)}`),
      join(prefix, `${name}rc${suffix(parser)}`)
    );
  }

  return files;
}

const getHomeExtFiles = (home, name, parsers) => {
  const files = [];

  for (const parser in parsers) {
    if (!parser) {
      continue;
    }

    files.push(
      join(home, '.config', name, `config${suffix(parser)}`),
      join(home, '.config', `${name}${suffix(parser)}`),
      join(home, `.${name}`, `config${suffix(parser)}`),
      join(home, `.${name}rc${suffix(parser)}`)
    );
  }

  return files;
}

const getConfigFiles = (name, parsers, isWindows, home) => {
  let files = [];

  if (!isWindows) {
    files = [
      join(etc, name, 'config'),
      join(etc, `${name}rc`),
      join(etc, `${name}.conf`),
      join(localEtc, name, 'config'),
      join(localEtc, `${name}rc`),
      join(localEtc, `${name}.conf`),
      ...getNonWindowsExtFiles(etc, name, parsers),
      ...getNonWindowsExtFiles(localEtc, name, parsers)
    ];
  }

  if (home) {
    files = [
      ...files,
      join(home, '.config', name, 'config'),
      join(home, '.config', name),
      join(home, `.${name}`, 'config'),
      join(home, `.${name}rc`),
      ...getHomeExtFiles(home, name, parsers)
    ];
  }

  const filename = (v) => `.${name}rc${v ? `.${v.toLowerCase()}` : ''}`;

  files = [
    ...files,
    ...Object.keys(parsers)
      .map((v) => findFile(filename(v)))
  ];

  // remove in dupes
  return Array.from(new Set(files.filter(Boolean)));
}

function check(file) {
  if (file && !fs.existsSync(file)) {
    throw new Error(`Explicitly passed config file could not be found at: ${file}`);
  }
}

module.exports = {
  parse,
  getFileContents,
  parseEnv,
  findFile,
  parsers,
  getExt,
  availableParsers,
  getConfigFiles,
  check,
  getNonWindowsExtFiles,
  getHomeExtFiles,
  suffix
};
