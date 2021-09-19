const test = require('ava');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');

const rc = require('../src/rc');
const utils = require('../src/utils');
const prefix = `rc${Math.random()}`;
const { morph } = require('./helpers');

test('rc', (t) => {
  morph(() => {
    const config = rc(prefix, { option: true });

    t.true(config.option);
    t.is(config.envOption1, '42');
  }, {
    env: { add: { [`${prefix}_envOption1`]: '42' }  }
  });
});

test('rc - throw error if name is not a string', (t) => {
  t.throws(() => rc({}), {
    instanceOf: Error,
    message: 'rc(name): name must be string. "object" given.'
  });
});

test('rc - custom args', (t) => {
  const args = {
    option: false,
    envOption2: 24,
    argv: {
      remain: [],
      cooked: ['--no-option', '--envOption', '24'],
      original: ['--no-option', '--envOption=24']
    }
  };

  const config = rc(prefix, { option: true }, args);

  t.false(config.option);
  t.is(config.envOption2, 24);
});

test('rc - default errors', (t) => {
  const errorWorthyTypes = ['asdf', 1, [], function() {}];

  for (const type of errorWorthyTypes) {
    let errorThrown = false;

    try {
      rc(prefix, type);
    } catch (e) {
      errorThrown = true;
    }

    t.true(errorThrown);
  }
});

test('rc - commented json', (t) => {
  const rcFile = path.resolve(__dirname, './fixtures/utils.json');
  const jsonrc = path.resolve(`.${prefix}rc`);

  try {
    fs.copyFileSync(rcFile, jsonrc);

    const config = rc(prefix, { option: true });

    t.false(config.option);
    t.is(config.envOption, 24);
    t.is(config.config, jsonrc);
    t.is(config.configs.length, 1);
    t.is(config.configs[0], jsonrc);
  } catch (e) {
    throw e;
  } finally {
    fs.unlinkSync(jsonrc);
  }
});

test('rc - does not duplicate files', (t) => {
  const rcFile = path.resolve(__dirname, './fixtures/utils.json');

  morph(() => {
    const config = rc(prefix);
    console.log(config);
    t.is(config.configs.length, 1);
  }, {
    env: { add: { [`${prefix}_config`]: rcFile } },
    argv: { add: ['--config', rcFile] }
  });
});

test('rc - thrown error for missing --config file', (t) => {
  morph(() => {
    t.throws(() => rc(prefix), {
      message: 'Explicitly passed config file could not be found at: .filedoesnotexistrc',
      instanceOf: Error
    });
  }, {
    argv: { add: ['--config', '.filedoesnotexistrc'] }
  });
});

test('rc - contrived test just for code coverage', (t) => {
  const spy = sinon.spy(utils, 'getConfigFiles');
  Object.defineProperty(process, 'platform', { value: 'win32' });

  rc('fake');

  t.true(spy.getCall(0).args[2]);

  spy.resetHistory();

  Object.defineProperty(process, 'platform', { value: 'darwin' });

  rc('fake');

  t.false(spy.getCall(0).args[2]);

  spy.restore();
});
