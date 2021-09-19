// https://github.com/burl/mock-env/blob/master/index.js

const has = Object.prototype.hasOwnProperty;

function setVars(origEnv, setVars) {
  if (typeof setVars !== 'object' || Array.isArray(setVars)) {
    return;
  }

  for (const key in setVars) {
    if (has.call(setVars, key)) {
      if (!has.call(origEnv, key)) {
        origEnv[key] = [!!has.call(process.env, key), process.env[key]];
      }

      process.env[key] = setVars[key];
    }
  }
}

function setArgvVars(setVars) {
  if (!Array.isArray(setVars)) {
    return;
  }

  process.argv = [...process.argv, ...setVars];
}

function delVars(origEnv, deleteVars) {
  if (!Array.isArray(deleteVars)) {
    return;
  }

  const length = deleteVars.length;
  for (let i = 0; i < length; i++) {
    if (!has.call(origEnv, deleteVars[i])) {
      origEnv[deleteVars[i]] = [!!has.call(process.env, deleteVars[i]), process.env[deleteVars[i]]];
    }

    delete process.env[deleteVars[i]];
  }
}

function delArgvVars(origArgv, deleteVars) {
  if (!Array.isArray(deleteVars)) {
    return;
  }

  return process.argv.filter((a) => !deleteVars.includes(a));
}

function restoreEnv(origEnv) {
  for (const key in origEnv) {
    if (origEnv[key][0]) {
      process.env[key] = origEnv[key][1];
    } else {
      delete process.env[key];
    }
  }
}

function restoreArgv(origArgv) {
  process.argv = process.argv.filter((a) => origArgv.includes(a));
}

function setArgv(add) {
  const argv = [...process.argv];
  argv.push(...add);
  process.argv = Array.from(new Set(argv));
}

function delArgv(remove) {
  const argv = [...process.argv].filter((a) => !remove.includes(a));
  process.argv = Array.from(new Set(argv));
}

function morph(callback, { env = {}, argv = {} }) {
  const origEnv = {};
  const origArgv = [...process.argv];

  setVars(origEnv, env.add || {});
  delVars(origEnv, env.remove || {});

  setArgv(argv.add || []);
  delArgv(argv.remove || []);

  try {
    return callback();
  } catch (e) {
    throw e;
  } finally {
    restoreEnv(origEnv);
    process.argv = origArgv;
  }
}

module.exports = { morph };
