// noinspection JSUnresolvedVariable

const test = require('ava');
const sinon = require('sinon');
const ini = require('ini');
const fs = require('fs');
const { morph } = require('./helpers');
const {
  parse,
  getFileContents,
  parseEnv,
  findFile,
  getExt,
  availableParsers,
  getConfigFiles,
  suffix,
  parsers
} = require('../src/utils');

test('getFileContents', (t) => {
  const contents = `{
  // json overrides default
  "option": false,
  /* env overrides json */
  "envOption": 24
}
`;

  t.false(getFileContents());
  t.false(getFileContents({}));
  t.false(getFileContents(undefined));
  t.false(getFileContents('something', {}));
  t.false(getFileContents(null));
  // noinspection JSCheckFunctionSignatures
  t.is(getFileContents(`${__dirname}/fixtures/utils.json`), contents);

  const spy = sinon.spy(fs, 'readFileSync');
  const results = getFileContents('fixtures/utils.json');
  t.false(results);
  t.true(fs.readFileSync.calledOnce);
  spy.restore();
});

test('parseEnv', (t) => {
  const prefix = `rc${Math.random()}_`;

  const env = {
    [`${prefix}_envOption`]: '42',
    [`${prefix}_opt__a__b`]: 'c',

    // Basic usage
    [`${prefix}_someOpt__a`]: '42',
    [`${prefix}_someOpt__x__`]: '99',
    [`${prefix}_someOpt__a__b`]: '186',
    [`${prefix}_someOpt__a__b__c`]: '243',
    [`${prefix}_someOpt__x__y`]: '1862',
    [`${prefix}_someOpt__z`]: '186577',

    // Should ignore empty strings from orphaned '__'
    [`${prefix}_someOpt__z__x__`]: '18629',
    [`${prefix}_someOpt__w__w__`]: '18629',

    // Leading '__' should ignore everything up to 'z'
    [`${prefix}___z__i__`]: '9999',

    // should ignore case for config name section.
    [`${prefix}_test_upperCase`]: '187',
  };

  morph(() => {
    const results = parseEnv(`${prefix}_`);

    t.is(results.someOpt.a, '42');
    t.is(results.someOpt.x, '99');
    // Should not override `a` once it's been set
    t.is(results.someOpt.a/*.b*/, '42');
    // Should not override `x` once it's been set
    t.is(results.someOpt.x/*.y*/, '99');
    t.is(results.someOpt.z, '186577');
    // Should not override `z` once it's been set
    t.is(results.someOpt.z/*.x*/, '186577');
    t.is(results.someOpt.w.w, '18629');
    t.is(results.z.i, '9999');

    t.is(results.test_upperCase, '187');

    t.is(results.envOption, '42');
    t.is(results.opt.a.b, 'c');
    t.is(results.someOpt.a, '42');
  }, { env: { add: env } });
});

test('findFile', (t) => {
  t.false(findFile('path/does/not/exist'));
  t.is(
    findFile('test/fixtures/utils.json'),
    `${process.cwd()}/test/fixtures/utils.json`
  );
});

test('getExt', (t) => {
  t.is(getExt('/fake/file/ends/withrc'), '');
  t.is(getExt('/fake/file/ends/with/no/ext'), '/fake/file/ends/with/no/ext');
  t.is(getExt('/fake/file/ends/with.json'), 'json');
  t.is(getExt('/fake/file/ends/with.ini'), 'ini');
  t.is(getExt('/fake/file/with/lots/of/.periods.rc.something'), 'something');
});

test('parse', (t) => {
  const fakeJson = '{/* fake comment */"fake": "contents"}';
  const fakeIni = 'something = fake';
  const fakeYml = 'fake: yml';

  const jsonSpy = sinon.spy(JSON, 'parse');
  const iniSpy = sinon.spy(ini, 'parse');

  let results = parse(fakeJson, '/fake/file/ends/withrc');
  t.true(JSON.parse.calledOnce);
  t.true(ini.parse.notCalled);
  t.deepEqual(results, { fake: 'contents' });

  jsonSpy.resetHistory();
  iniSpy.resetHistory();

  results = parse(fakeIni, '/fake/file/ends/withrc');
  t.true(JSON.parse.calledOnce);
  t.true(ini.parse.calledOnce);
  t.deepEqual(results, { something: 'fake' });

  jsonSpy.resetHistory();
  iniSpy.resetHistory();

  results = parse(fakeJson, '/fake/file/ends/withrc.json');
  t.true(JSON.parse.calledOnce);
  t.true(ini.parse.notCalled);
  t.deepEqual(results, { fake: 'contents' });

  jsonSpy.resetHistory();
  iniSpy.resetHistory();

  results = parse(fakeIni, '/fake/file/ends/withrc.ini');
  t.true(JSON.parse.notCalled);
  t.true(ini.parse.calledOnce);
  t.deepEqual(results, { something: 'fake' });

  t.throws(() => parse(fakeYml, '/fake/file/ends/withrc.yml'), {
    instanceOf: Error,
    message: `Extension "yml" does not have a parser. Valid parsers: ${availableParsers()}`
  });

  const obj = { hello: 'world' };
  const jsonString = parse(JSON.stringify(obj));
  const iniString = parse(ini.stringify(obj));
  t.deepEqual(jsonString, iniString);

  jsonSpy.resetHistory();
  iniSpy.resetHistory();

  // custom parser
  results = parse(fakeYml, '/fake/file/ends/withrc.yml', { yml: () => ({ fake: 'yml' }) });
  t.true(JSON.parse.notCalled);
  t.true(ini.parse.notCalled);
  t.deepEqual(results, { fake: 'yml' });

  jsonSpy.restore();
  iniSpy.restore();
});

test('getConfigFiles', (t) => {
  const name = `rc${Math.random()}`;

  // !isWindows && home
  let result = getConfigFiles(name, parsers, false, '/');
  // !isWindows = 14, !!home = 12, findFile = 0, total = 26
  t.is(result.length, 26);

  // !isWindows && !home
  result = getConfigFiles(name, parsers, false, false);
  // !isWindows = 14, !home = 0, findFile = 0, total = 14
  t.is(result.length, 14);

  // isWindows && home
  result = getConfigFiles(name, parsers, true, '/');
  // isWindows = 0, !!home = 12, findFile = 0, total = 12
  t.is(result.length, 12);

  // isWindows && !home
  result = getConfigFiles(name, parsers, true, false);
  // isWindows = 0, !home = 0, findFile = 0, total = 0
  t.is(result.length, 0);
});

test('console.error', (t) => {
  morph(() => {
    const origConsoleError = console.error;
    console.error = () => {};
    const spy = sinon.spy(console, 'error');

    let result = getFileContents('/fake/file/path');
    t.false(result);
    t.true(spy.calledOnce);

    spy.restore();
    console.error = origConsoleError;
  }, { env: { add: { NODE_ENV: 'development' } } });
});

test('parsers', (t) => {
  const result = parsers.json('not real json');
  t.false(result);
});

test('suffix', (t) => {
  t.is(suffix('json'), '.json');
  t.is(suffix('INI'), '.ini');
  t.is(suffix(''), '');
});
