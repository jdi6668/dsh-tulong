/**
 * Offline smoke test for the dsh-tulong client module.
 *
 * Loads the bundle the same way the Harness loader does (window.__ModuleLoader__),
 * fakes the builtins the factory receives, and checks that apply() registers the
 * sidebar entry, the main page, the dictionaries and the stylesheet.
 *
 * Run: node tools/smoke-client.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.resolve(here, '..', 'dsh-tulong', 'client.js');
const source = fs.readFileSync(bundle, 'utf8');

const registrations = [];
const localeRegistrations = [];
const effects = [];
const styleSheets = [];
const styleTags = [];
let captured = null;

globalThis.document = {
  head: {
    append(tag) {
      styleSheets.push(tag.textContent);
      styleTags.push(tag);
    },
  },
  createElement() {
    return {
      dataset: {},
      textContent: '',
      removed: false,
      remove() {
        this.removed = true;
      },
    };
  },
  querySelectorAll() {
    return [];
  },
};

globalThis.window = {
  __ModuleLoader__: {
    load(config) {
      captured = config;
    },
  },
  localStorage: {
    _data: new Map(),
    getItem(key) {
      return this._data.has(key) ? this._data.get(key) : null;
    },
    setItem(key, value) {
      this._data.set(key, String(value));
    },
    removeItem(key) {
      this._data.delete(key);
    },
  },
  sessionStorage: {
    _data: new Map(),
    getItem(key) {
      return this._data.has(key) ? this._data.get(key) : null;
    },
    setItem(key, value) {
      this._data.set(key, String(value));
    },
    removeItem(key) {
      this._data.delete(key);
    },
  },
  crypto: {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i += 1) buf[i] = i * 31 + 7;
      return buf;
    },
  },
};

const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
};

new Function('window', source)(globalThis.window);

if (!captured || captured.id !== 'dsh-tulong') {
  throw new Error('client bundle did not register through window.__ModuleLoader__');
}

const moduleExports = captured.factory((id) => {
  if (id === 'react') return reactStub;
  throw new Error('unexpected require: ' + id);
});

const ctx = {
  locale: {
    bind: (ns) => (key) => ns + ':' + key,
    register: (...args) => {
      localeRegistrations.push(args);
      return () => {};
    },
  },
  effect: (callback, label) => {
    const dispose = callback();
    effects.push({ label, dispose });
    return dispose;
  },
  slots: {
    inject: (owner, factory) => {
      factory();
      return () => {};
    },
    register: (options, component) => {
      registrations.push({ options, component });
      return () => {};
    },
  },
};

moduleExports.apply(ctx);

const sidebar = registrations.find((entry) => entry.options.name === 'sidebar.panellist');
const main = registrations.find((entry) => entry.options.name === 'main');

const checks = [
  ['injects slots + locale', JSON.stringify(moduleExports.inject) === '["slots","locale"]'],
  ['sidebar entry id', sidebar && sidebar.options.id === 'dsh-tulong'],
  ['sidebar order', sidebar && sidebar.options.order === 30],
  ['sidebar icon component', sidebar && typeof sidebar.component === 'function'],
  ['main key', main && main.options.key === 'dsh-tulong'],
  ['main page component', main && typeof main.component === 'function'],
  ['locale dictionaries', localeRegistrations.length === 4],
  ['en dictionary', localeRegistrations.some((r) => r[1] === 'en' && r[2]['nav'] === 'Tulong')],
  ['zh dictionary', localeRegistrations.some((r) => r[1] === 'zh' && r[2]['nav'] === '屠龙')],
  ['stylesheet inserted', styleSheets.length === 1 && styleSheets[0].includes('.tl-root')],
  ['effect cleanup', effects.length === 1 && typeof effects[0].dispose === 'function'],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) failed += 1;
}

// Sidebar label thunk renders through the namespace-bound translator.
if (sidebar) {
  const label = sidebar.options.label();
  const labelOk = label === 'dsh-tulong:nav';
  console.log((labelOk ? 'PASS ' : 'FAIL ') + 'sidebar label thunk');
  if (!labelOk) failed += 1;
}

// Dictionary key parity between EN and ZH.
const en = localeRegistrations.find((r) => r[1] === 'en');
const zh = localeRegistrations.find((r) => r[1] === 'zh');
if (en && zh) {
  const missingZh = Object.keys(en[2]).filter((key) => !(key in zh[2]));
  const missingEn = Object.keys(zh[2]).filter((key) => !(key in en[2]));
  const parity = missingZh.length === 0 && missingEn.length === 0;
  console.log((parity ? 'PASS ' : 'FAIL ') + 'dictionary key parity');
  if (!parity) {
    console.log('  missing in zh:', missingZh);
    console.log('  missing in en:', missingEn);
    failed += 1;
  }
}

// Disposing the apply effect removes the owned stylesheet tag.
effects[0].dispose();
const styleRemoved = styleTags.length === 1 && styleTags[0].removed === true;
console.log((styleRemoved ? 'PASS ' : 'FAIL ') + 'style tag removed on dispose');
if (!styleRemoved) failed += 1;

process.exit(failed === 0 ? 0 : 1);
