/**
 * dsh-tulong Client half.
 *
 * A sidebar entry (shield + sword) that opens the game's login / registration
 * page. Accounts of this demo live in the browser storage; nothing is sent to a
 * server. Text goes through the Client locale service, colours through the
 * Harness theme tokens.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tulong',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const NS = 'dsh-tulong';
    const ACCOUNTS_KEY = 'dsh-tulong/accounts/v1';
    const SESSION_KEY = 'dsh-tulong/session/v1';
    const LAST_USER_KEY = 'dsh-tulong/last-user/v1';
    const XP_STEP = 120;
    const DEMO = { username: 'dragonslayer', password: 'tulong2026', name: 'Aurelia' };

    /** Bound to the Client locale service in apply(); reads the live locale. */
    let t = (key) => key;

    /* ------------------------------------------------------------------ */
    /* storage                                                             */
    /* ------------------------------------------------------------------ */

    const memory = new Map();

    function storeOf(kind) {
      try {
        return window[kind] || null;
      } catch (err) {
        return null;
      }
    }

    function readRaw(kind, key) {
      const store = storeOf(kind);
      if (store) {
        try {
          const value = store.getItem(key);
          if (value !== null) return value;
        } catch (err) {
          /* fall through to memory */
        }
      }
      return memory.has(kind + ':' + key) ? memory.get(kind + ':' + key) : null;
    }

    function writeRaw(kind, key, value) {
      const store = storeOf(kind);
      if (store) {
        try {
          store.setItem(key, value);
          return;
        } catch (err) {
          /* fall through to memory */
        }
      }
      memory.set(kind + ':' + key, value);
    }

    function removeRaw(kind, key) {
      const store = storeOf(kind);
      if (store) {
        try {
          store.removeItem(key);
        } catch (err) {
          /* ignore */
        }
      }
      memory.delete(kind + ':' + key);
    }

    function readJSON(kind, key) {
      const raw = readRaw(kind, key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* demo accounts                                                       */
    /* ------------------------------------------------------------------ */

    function digest(text) {
      let a = 0x811c9dc5;
      let b = 0x9e3779b9;
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        a = Math.imul(a ^ code, 0x01000193) >>> 0;
        b = Math.imul(b ^ (code + 0x9e37), 0x85ebca6b) >>> 0;
        b = (b ^ (b >>> 13)) >>> 0;
      }
      return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
    }

    function hashPassword(password, salt) {
      let seed = salt + ':' + password + ':' + NS;
      let out = '';
      for (let i = 0; i < 4; i += 1) {
        seed = digest(seed + ':' + i + ':' + out);
        out += seed;
      }
      return out;
    }

    function randomSalt() {
      let out = '';
      try {
        const buf = new Uint8Array(8);
        window.crypto.getRandomValues(buf);
        for (let i = 0; i < buf.length; i += 1) out += buf[i].toString(16).padStart(2, '0');
      } catch (err) {
        for (let i = 0; i < 8; i += 1) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      }
      return out;
    }

    function accountKey(username) {
      return String(username || '').trim().toLowerCase();
    }

    function loadAccounts() {
      const parsed = readJSON('localStorage', ACCOUNTS_KEY);
      return parsed || null;
    }

    function saveAccounts(accounts) {
      writeRaw('localStorage', ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    function seedAccounts() {
      const existing = loadAccounts();
      if (existing) return existing;
      const salt = randomSalt();
      const accounts = {};
      accounts[accountKey(DEMO.username)] = {
        username: DEMO.username,
        name: DEMO.name,
        salt,
        hash: hashPassword(DEMO.password, salt),
        createdAt: Date.now() - 86400000 * 23,
        xp: 268,
        gold: 120,
        quests: {},
      };
      saveAccounts(accounts);
      return accounts;
    }

    function readSession() {
      const local = readJSON('localStorage', SESSION_KEY);
      if (local && typeof local.username === 'string') return local;
      const temp = readJSON('sessionStorage', SESSION_KEY);
      if (temp && typeof temp.username === 'string') return temp;
      return null;
    }

    function writeSession(username, remember) {
      const payload = JSON.stringify({ username, at: Date.now() });
      if (remember) {
        writeRaw('localStorage', SESSION_KEY, payload);
        removeRaw('sessionStorage', SESSION_KEY);
      } else {
        writeRaw('sessionStorage', SESSION_KEY, payload);
        removeRaw('localStorage', SESSION_KEY);
      }
    }

    function clearSession() {
      removeRaw('localStorage', SESSION_KEY);
      removeRaw('sessionStorage', SESSION_KEY);
    }

    function accountForSession() {
      const session = readSession();
      if (!session) return null;
      const accounts = loadAccounts();
      const record = accounts ? accounts[accountKey(session.username)] : null;
      if (!record) {
        clearSession();
        return null;
      }
      return record;
    }

    /* ------------------------------------------------------------------ */
    /* helpers                                                             */
    /* ------------------------------------------------------------------ */

    function delay(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    function levelOf(xp) {
      return 1 + Math.floor(Math.max(0, xp || 0) / XP_STEP);
    }

    function rankKey(level) {
      if (level >= 5) return 'c.rank3';
      if (level >= 3) return 'c.rank2';
      return 'c.rank1';
    }

    function isoDate(stamp) {
      try {
        return new Date(stamp).toISOString().slice(0, 10);
      } catch (err) {
        return '—';
      }
    }

    function passwordScore(password) {
      if (!password) return 0;
      let score = 1;
      if (password.length >= 8) score += 1;
      if (password.length >= 12) score += 1;
      if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score += 1;
      return Math.min(4, score);
    }

    const QUESTS = [
      { id: 'training', key: 'q.1', gold: 40, xp: 60 },
      { id: 'dungeon', key: 'q.2', gold: 80, xp: 120 },
      { id: 'dragon-soul', key: 'q.3', gold: 60, xp: 90 },
    ];

    const MOTES = [
      { x: '16%', y: '26%', s: 3, d: 6.4, delay: 0 },
      { x: '72%', y: '18%', s: 2, d: 7.2, delay: 1.1 },
      { x: '84%', y: '52%', s: 4, d: 8.1, delay: 0.4 },
      { x: '28%', y: '72%', s: 2, d: 6.8, delay: 2.2 },
      { x: '62%', y: '84%', s: 3, d: 7.6, delay: 1.6 },
      { x: '10%', y: '58%', s: 2, d: 9.2, delay: 2.8 },
      { x: '48%', y: '12%', s: 2, d: 8.4, delay: 3.4 },
      { x: '92%', y: '76%', s: 3, d: 7.9, delay: 0.9 },
    ];

    /* ------------------------------------------------------------------ */
    /* icons                                                               */
    /* ------------------------------------------------------------------ */

    function Svg({ size = 20, children, className, strokeWidth = 1.7, style }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
          className,
          style,
        },
        children,
      );
    }

    function IconUser(props) {
      return h(
        Svg,
        props,
        h('circle', { cx: 12, cy: 8.2, r: 3.5 }),
        h('path', { d: 'M4.9 19.4c1-3.4 3.7-5.2 7.1-5.2s6.1 1.8 7.1 5.2' }),
      );
    }

    function IconLock(props) {
      return h(
        Svg,
        props,
        h('rect', { x: 4.8, y: 10.2, width: 14.4, height: 10, rx: 2.2 }),
        h('path', { d: 'M8.4 10.2V7.9a3.6 3.6 0 0 1 7.2 0v2.3' }),
        h('circle', { cx: 12, cy: 15.1, r: 1.2 }),
      );
    }

    function IconEye(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z' }),
        h('circle', { cx: 12, cy: 12, r: 2.7 }),
      );
    }

    function IconEyeOff(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M4.2 8.1C3.1 9.3 2.6 12 2.6 12S6 17.8 12 17.8c1.8 0 3.3-.5 4.6-1.2' }),
        h('path', { d: 'M9.6 6.6c.8-.2 1.6-.4 2.4-.4 6 0 9.4 5.8 9.4 5.8s-.9 1.6-2.5 3' }),
        h('path', { d: 'M4 4l16 16' }),
      );
    }

    function IconShield(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M12 3.1l7.2 2.8v6c0 4.6-3 7.9-7.2 10.3C7.8 19.8 4.8 16.5 4.8 11.9v-6Z' }),
        h('path', { d: 'M8.8 12.1l2.3 2.3 4.3-4.5' }),
      );
    }

    function IconSword(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M20.4 3.6 10.6 13.4' }),
        h('path', { d: 'M7.9 10.7l5.4 5.4' }),
        h('path', { d: 'M9.3 14.7 5.7 18.3' }),
        h('path', { d: 'M4.2 19.8l1.6-1.6' }),
      );
    }

    function IconFlame(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M12 3.2c3.5 4.6 5.5 7.8 5.5 11 0 4-2.4 6.6-5.5 7.9-3.1-1.3-5.5-3.9-5.5-7.9 0-3.2 2-6.4 5.5-11Z' }),
        h('path', { d: 'M12 9.7c1.7 2.2 2.6 3.8 2.6 5.5 0 1.9-1.1 3.2-2.6 4.1-1.5-.9-2.6-2.2-2.6-4.1 0-1.7.9-3.3 2.6-5.5Z' }),
      );
    }

    function IconCrown(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M4 17.5 5.6 8l4.1 3.6L12 6.3l2.3 5.3L18.4 8 20 17.5Z' }),
        h('path', { d: 'M5.2 20h13.6' }),
      );
    }

    function IconCoin(props) {
      return h(
        Svg,
        props,
        h('circle', { cx: 12, cy: 12, r: 8.1 }),
        h('path', { d: 'M12 7.6l1.4 3.1 3.1 1.4-3.1 1.4L12 16.6l-1.4-3.1-3.1-1.4 3.1-1.4Z' }),
      );
    }

    function IconSpark(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M12 3.6l1.8 5.2 5.2 1.8-5.2 1.8L12 17.6l-1.8-5.2L5 10.6l5.2-1.8Z' }),
      );
    }

    function IconCheck(props) {
      return h(Svg, props, h('path', { d: 'M4.8 12.4l4.4 4.4L19.2 6.6' }));
    }

    function IconAlert(props) {
      return h(
        Svg,
        props,
        h('circle', { cx: 12, cy: 12, r: 8.6 }),
        h('path', { d: 'M12 7.6v5' }),
        h('path', { d: 'M12 16.2h.01' }),
      );
    }

    function IconLogout(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M15.2 4.2h3a1.4 1.4 0 0 1 1.4 1.4v12.8a1.4 1.4 0 0 1-1.4 1.4h-3' }),
        h('path', { d: 'M10.2 8.2 6.4 12l3.8 3.8' }),
        h('path', { d: 'M6.6 12h9' }),
      );
    }

    function IconEmblem({ size = 24 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', {
          d: 'M12 2.4l7.6 3v6.4c0 4.9-3.2 8.5-7.6 10.8C7.6 20.3 4.4 16.7 4.4 11.8V5.4Z',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          style: { fill: 'color-mix(in srgb, currentColor 12%, transparent)' },
        }),
        h('path', {
          d: 'M12 6.5c2.2 2.8 3.4 4.8 3.4 6.9 0 2.6-1.5 4.4-3.4 5.5-1.9-1.1-3.4-2.9-3.4-5.5 0-2.1 1.2-4.1 3.4-6.9Z',
          fill: 'currentColor',
          opacity: 0.88,
        }),
      );
    }

    /** Large hero artwork: rune rings, wings, shield and dragon flame. */
    function Emblem() {
      return h(
        'svg',
        {
          className: 'tl-emblem',
          viewBox: '0 0 360 360',
          'aria-hidden': true,
          focusable: 'false',
        },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'tl-flame-grad', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', style: { stopColor: 'var(--dsw-alias-state-warn-primary)' } }),
            h('stop', { offset: '100%', style: { stopColor: 'var(--dsw-alias-brand-primary)' } }),
          ),
        ),
        h(
          'g',
          { className: 'tl-ring tl-spin-slow', opacity: 0.34 },
          h('circle', {
            cx: 180,
            cy: 180,
            r: 150,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1,
            strokeDasharray: '2 10',
          }),
        ),
        h(
          'g',
          { className: 'tl-ring tl-spin-rev', opacity: 0.22 },
          h('circle', {
            cx: 180,
            cy: 180,
            r: 128,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1,
            strokeDasharray: '24 16',
          }),
        ),
        h('circle', {
          cx: 180,
          cy: 180,
          r: 112,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 0.75,
          opacity: 0.14,
        }),
        h(
          'g',
          { fill: 'currentColor', opacity: 0.1, stroke: 'currentColor', strokeOpacity: 0.3, strokeWidth: 1 },
          h('path', { d: 'M126 236c-34-8-58-30-68-62 28 8 50 24 66 44 5 6 9 12 11 18Z' }),
          h('path', {
            d: 'M234 236c34-8 58-30 68-62-28 8-50 24-66 44-5 6-9 12-11 18Z',
          }),
        ),
        h(
          'g',
          null,
          h('path', {
            d: 'M180 88l66 26v64c0 45-30 78-66 96-36-18-66-51-66-96v-64Z',
            fill: 'none',
            stroke: 'currentColor',
            strokeOpacity: 0.42,
            strokeWidth: 1.6,
          }),
          h('path', {
            d: 'M180 88l66 26v64c0 45-30 78-66 96-36-18-66-51-66-96v-64Z',
            style: { fill: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent)' },
          }),
          h('path', {
            d: 'M180 124c20 25 31 44 31 63 0 24-13 42-31 54-18-12-31-30-31-54 0-19 11-38 31-63Z',
            fill: 'url(#tl-flame-grad)',
            opacity: 0.94,
          }),
          h('path', {
            d: 'M180 162c9 12 14 21 14 31 0 12-6 21-14 27-8-6-14-15-14-27 0-10 5-19 14-31Z',
            style: { fill: 'var(--dsw-alias-bg-base)' },
            opacity: 0.62,
          }),
        ),
        h(
          'g',
          { fill: 'currentColor', opacity: 0.5 },
          h('path', { d: 'M180 34l2.6 6.1 6.1 2.6-6.1 2.6-2.6 6.1-2.6-6.1-6.1-2.6 6.1-2.6Z' }),
          h('path', { d: 'M78 150l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8Z' }),
          h('path', { d: 'M286 214l1.6 3.7 3.7 1.6-3.7 1.6-1.6 3.7-1.6-3.7-3.7-1.6 3.7-1.6Z' }),
        ),
      );
    }

    function TulongIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 20;
      const active = Boolean(props.active);
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: 'false',
          style: {
            display: 'block',
            fill: active ? 'color-mix(in srgb, currentColor 18%, transparent)' : 'none',
          },
        },
        h('path', { d: 'M12 2.6 19.2 5.4v6.2c0 4.8-3.1 8.4-7.2 11-4.1-2.6-7.2-6.2-7.2-11V5.4Z' }),
        h('path', { d: 'M12 7v8.6' }),
        h('path', { d: 'M9 9.4h6' }),
        h('path', { d: 'M10.2 18.2 12 20l1.8-1.8' }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* small building blocks                                               */
    /* ------------------------------------------------------------------ */

    function Field({ id, label, error, hint, children }) {
      return h(
        'div',
        { className: 'tl-field' },
        h('label', { className: 'tl-label', htmlFor: id }, label),
        children,
        error
          ? h('p', { className: 'tl-fielderr', id: id + '-err' }, error)
          : hint
            ? h('p', { className: 'tl-hint' }, hint)
            : null,
      );
    }

    function Notice({ kind, children }) {
      if (!children) return null;
      return h(
        'div',
        {
          className: 'tl-notice tl-notice-' + (kind === 'ok' ? 'ok' : 'error'),
          role: kind === 'ok' ? 'status' : 'alert',
        },
        h(kind === 'ok' ? IconCheck : IconAlert, { size: 14 }),
        h('span', null, children),
      );
    }

    function Strength({ password }) {
      if (!password) return null;
      const score = passwordScore(password);
      const labels = ['s.weak', 's.fair', 's.good', 's.strong'];
      return h(
        'div',
        { className: 'tl-strength', 'aria-label': t('aria.strength') },
        h(
          'div',
          { className: 'tl-segs' },
          [0, 1, 2, 3].map((index) =>
            h('i', {
              key: index,
              className:
                'tl-seg' + (index < score ? ' tl-seg-fill tl-seg-lv' + score : ''),
            }),
          ),
        ),
        h('span', { className: 'tl-strength-label' }, t(labels[score - 1])),
      );
    }

    function PasswordField({ id, label, value, onChange, placeholder, error, autoComplete }) {
      const [visible, setVisible] = useState(false);
      const [caps, setCaps] = useState(false);
      return h(
        Field,
        { id, label, error },
        h(
          'div',
          { className: 'tl-inputwrap tl-with-eye' + (error ? ' tl-invalid' : '') },
          h('span', { className: 'tl-inputicon' }, h(IconLock, { size: 17 })),
          h('input', {
            id,
            className: 'tl-input',
            type: visible ? 'text' : 'password',
            value,
            onChange: (event) => onChange(event.target.value),
            placeholder,
            autoComplete,
            spellCheck: false,
            onKeyUp: (event) => {
              if (event.getModifierState) setCaps(event.getModifierState('CapsLock'));
            },
            onBlur: () => setCaps(false),
            'aria-invalid': error ? 'true' : 'false',
            'aria-describedby': error ? id + '-err' : undefined,
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'tl-eye',
              onClick: () => setVisible((current) => !current),
              'aria-label': t(visible ? 'aria.hidePw' : 'aria.showPw'),
              'aria-pressed': visible ? 'true' : 'false',
            },
            h(visible ? IconEyeOff : IconEye, { size: 17 }),
          ),
        ),
        caps ? h('p', { className: 'tl-hint tl-caps' }, t('hint.caps')) : null,
      );
    }

    function CheckLine({ checked, onChange, children }) {
      return h(
        'label',
        { className: 'tl-check' },
        h('input', { type: 'checkbox', checked, onChange: (event) => onChange(event.target.checked) }),
        h('span', { className: 'tl-box' }, h(IconCheck, { size: 11 })),
        h('span', null, children),
      );
    }

    /* ------------------------------------------------------------------ */
    /* hero                                                                */
    /* ------------------------------------------------------------------ */

    function Hero() {
      return h(
        'section',
        { className: 'tl-hero' },
        h(
          'div',
          { className: 'tl-art', 'aria-hidden': true },
          h('div', { className: 'tl-art-glow' }),
          h(Emblem),
          MOTES.map((mote, index) =>
            h('i', {
              key: index,
              className: 'tl-mote',
              style: {
                '--m-x': mote.x,
                '--m-y': mote.y,
                '--m-s': mote.s + 'px',
                '--m-d': mote.d + 's',
                '--m-delay': mote.delay + 's',
              },
            }),
          ),
        ),
        h(
          'div',
          { className: 'tl-hero-in' },
          h(
            'div',
            { className: 'tl-brand' },
            h('span', { className: 'tl-brand-mark' }, h(IconEmblem, { size: 26 })),
            h('span', { className: 'tl-brand-name' }, t('brand.studio')),
            h('span', { className: 'tl-season' }, h('i'), t('brand.season')),
          ),
          h('h1', { className: 'tl-title' }, t('hero.title')),
          h('p', { className: 'tl-kicker' }, t('hero.sub')),
          h('p', { className: 'tl-tagline' }, t('hero.tagline')),
          h(
            'div',
            { className: 'tl-feats' },
            h('span', { className: 'tl-feat' }, h(IconSword, { size: 14 }), t('hero.f1')),
            h('span', { className: 'tl-feat' }, h(IconCrown, { size: 14 }), t('hero.f2')),
            h('span', { className: 'tl-feat' }, h(IconFlame, { size: 14 }), t('hero.f3')),
          ),
          h(
            'div',
            { className: 'tl-stats' },
            h('div', { className: 'tl-stat' }, h('b', null, t('hero.stat1v')), h('span', null, t('hero.stat1l'))),
            h('div', { className: 'tl-stat' }, h('b', null, t('hero.stat2v')), h('span', null, t('hero.stat2l'))),
            h('div', { className: 'tl-stat' }, h('b', null, t('hero.stat3v')), h('span', null, t('hero.stat3l'))),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* login                                                               */
    /* ------------------------------------------------------------------ */

    function LoginForm({ busy, onLogin, onSwitch }) {
      const [username, setUsername] = useState(() => readRaw('localStorage', LAST_USER_KEY) || '');
      const [password, setPassword] = useState('');
      const [remember, setRemember] = useState(true);
      const [errors, setErrors] = useState({});
      const [notice, setNotice] = useState(null);
      const accountRef = useRef(null);

      useEffect(() => {
        if (accountRef.current) accountRef.current.focus();
      }, []);

      function fillDemo() {
        setUsername(DEMO.username);
        setPassword(DEMO.password);
        setErrors({});
        setNotice(null);
        if (accountRef.current) accountRef.current.focus();
      }

      function submit(event) {
        event.preventDefault();
        if (busy) return;
        const name = username.trim();
        const next = {};
        if (!name) next.username = t('e.usernameReq');
        if (!password) next.password = t('e.passwordReq');
        setErrors(next);
        setNotice(null);
        if (Object.keys(next).length) return;
        const pending = onLogin({ username: name, password, remember });
        if (pending && pending.then) {
          pending
            .then((result) => {
              if (result && result.error) setNotice(result.error);
            })
            .catch(() => setNotice(t('e.network')));
        }
      }

      return h(
        'div',
        { role: 'tabpanel', id: 'tl-panel-login', 'aria-labelledby': 'tl-tab-login' },
        h('h2', { className: 'tl-card-title' }, t('auth.loginTitle')),
        h('p', { className: 'tl-card-sub' }, t('auth.loginHint')),
        h(
          'form',
          { className: 'tl-fields', onSubmit: submit, noValidate: true },
          h(
            Field,
            { id: 'tl-login-user', label: t('f.username'), error: errors.username },
            h(
              'div',
              { className: 'tl-inputwrap' + (errors.username ? ' tl-invalid' : '') },
              h('span', { className: 'tl-inputicon' }, h(IconUser, { size: 17 })),
              h('input', {
                id: 'tl-login-user',
                ref: accountRef,
                className: 'tl-input',
                type: 'text',
                value: username,
                onChange: (event) => setUsername(event.target.value),
                placeholder: t('f.usernamePh'),
                autoComplete: 'username',
                spellCheck: false,
                'aria-invalid': errors.username ? 'true' : 'false',
                'aria-describedby': errors.username ? 'tl-login-user-err' : undefined,
              }),
            ),
          ),
          h(PasswordField, {
            id: 'tl-login-pass',
            label: t('f.password'),
            value: password,
            onChange: setPassword,
            placeholder: t('f.passwordPh'),
            error: errors.password,
            autoComplete: 'current-password',
          }),
          h(
            'div',
            { className: 'tl-row' },
            h(CheckLine, { checked: remember, onChange: setRemember }, t('f.remember')),
            h(
              'button',
              {
                type: 'button',
                className: 'tl-link',
                onClick: () => setNotice(t('t.forgot')),
              },
              t('f.forgot'),
            ),
          ),
          h(
            'button',
            { className: 'tl-btn', type: 'submit', disabled: busy },
            busy ? h('span', { className: 'tl-spin' }) : h(IconShield, { size: 16 }),
            busy ? t('b.busy') : t('b.login'),
          ),
          h(Notice, { kind: 'error' }, notice),
          h(
            'p',
            { className: 'tl-alt' },
            t('ui.no'),
            ' ',
            h(
              'button',
              {
                type: 'button',
                className: 'tl-link',
                onClick: onSwitch,
              },
              t('ui.switchRegister'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'tl-demo' },
          h('span', { className: 'tl-demo-label' }, t('hint.demo')),
          h('code', null, DEMO.username),
          h('code', null, DEMO.password),
          h('button', { type: 'button', className: 'tl-link', onClick: fillDemo }, t('hint.fill')),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* register                                                            */
    /* ------------------------------------------------------------------ */

    function RegisterForm({ busy, onRegister, onSwitch }) {
      const [username, setUsername] = useState('');
      const [password, setPassword] = useState('');
      const [confirm, setConfirm] = useState('');
      const [role, setRole] = useState('');
      const [agree, setAgree] = useState(false);
      const [errors, setErrors] = useState({});
      const [notice, setNotice] = useState(null);

      function submit(event) {
        event.preventDefault();
        if (busy) return;
        const name = username.trim();
        const next = {};
        if (!name) next.username = t('e.usernameReq');
        else if (!/^[A-Za-z0-9_\u4e00-\u9fa5]{3,16}$/.test(name)) next.username = t('e.usernameBad');
        if (!password) next.password = t('e.passwordReq');
        else if (password.length < 6) next.password = t('e.passwordBad');
        else if (password.toLowerCase() === name.toLowerCase()) next.password = t('e.passwordSame');
        if (!confirm) next.confirm = t('e.confirmBad');
        else if (confirm !== password) next.confirm = t('e.confirmBad');
        if (!agree) next.agree = t('e.agree');
        setErrors(next);
        setNotice(null);
        if (Object.keys(next).length) return;
        const pending = onRegister({
          username: name,
          password,
          roleName: role.trim().slice(0, 16),
        });
        if (pending && pending.then) {
          pending
            .then((result) => {
              if (result && result.error) setNotice(result.error);
            })
            .catch(() => setNotice(t('e.network')));
        }
      }

      return h(
        'div',
        { role: 'tabpanel', id: 'tl-panel-register', 'aria-labelledby': 'tl-tab-register' },
        h('h2', { className: 'tl-card-title' }, t('auth.registerTitle')),
        h('p', { className: 'tl-card-sub' }, t('auth.registerHint')),
        h(
          'form',
          { className: 'tl-fields', onSubmit: submit, noValidate: true },
          h(
            Field,
            { id: 'tl-reg-user', label: t('f.username'), error: errors.username },
            h(
              'div',
              { className: 'tl-inputwrap' + (errors.username ? ' tl-invalid' : '') },
              h('span', { className: 'tl-inputicon' }, h(IconUser, { size: 17 })),
              h('input', {
                id: 'tl-reg-user',
                className: 'tl-input',
                type: 'text',
                value: username,
                onChange: (event) => setUsername(event.target.value),
                placeholder: t('f.usernamePh'),
                autoComplete: 'username',
                spellCheck: false,
                'aria-invalid': errors.username ? 'true' : 'false',
                'aria-describedby': errors.username ? 'tl-reg-user-err' : undefined,
              }),
            ),
          ),
          h(PasswordField, {
            id: 'tl-reg-pass',
            label: t('f.password'),
            value: password,
            onChange: setPassword,
            placeholder: t('f.passwordPh'),
            error: errors.password,
            autoComplete: 'new-password',
          }),
          h(Strength, { password }),
          h(PasswordField, {
            id: 'tl-reg-confirm',
            label: t('f.confirm'),
            value: confirm,
            onChange: setConfirm,
            placeholder: t('f.confirmPh'),
            error: errors.confirm,
            autoComplete: 'new-password',
          }),
          h(
            Field,
            { id: 'tl-reg-role', label: t('f.role'), hint: t('f.rolePh') },
            h(
              'div',
              { className: 'tl-inputwrap' },
              h('span', { className: 'tl-inputicon' }, h(IconCrown, { size: 17 })),
              h('input', {
                id: 'tl-reg-role',
                className: 'tl-input',
                type: 'text',
                value: role,
                maxLength: 16,
                onChange: (event) => setRole(event.target.value),
                placeholder: t('f.rolePh'),
                autoComplete: 'nickname',
                spellCheck: false,
              }),
            ),
          ),
          h(
            'div',
            { className: 'tl-field' },
            h(
              'label',
              { className: 'tl-check' + (errors.agree ? ' tl-check-bad' : '') },
              h('input', {
                type: 'checkbox',
                checked: agree,
                onChange: (event) => setAgree(event.target.checked),
              }),
              h('span', { className: 'tl-box' }, h(IconCheck, { size: 11 })),
              h('span', null, t('f.agree')),
            ),
            errors.agree ? h('p', { className: 'tl-fielderr' }, errors.agree) : null,
          ),
          h(
            'button',
            { className: 'tl-btn', type: 'submit', disabled: busy },
            busy ? h('span', { className: 'tl-spin' }) : h(IconEmblem, { size: 16 }),
            busy ? t('b.busy') : t('b.register'),
          ),
          h(Notice, { kind: 'error' }, notice),
          h(
            'p',
            { className: 'tl-alt' },
            t('ui.have'),
            ' ',
            h(
              'button',
              {
                type: 'button',
                className: 'tl-link',
                onClick: onSwitch,
              },
              t('ui.switchLogin'),
            ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* auth card                                                           */
    /* ------------------------------------------------------------------ */

    function AuthCard({ busy, onLogin, onRegister }) {
      const [tab, setTab] = useState('login');
      return h(
        'section',
        { className: 'tl-card', 'aria-label': t('nav') },
        h(
          'div',
          { className: 'tl-card-top' },
          h('span', { className: 'tl-online' }, h('i'), t('ui.online'), h('span', null, '· ' + t('ui.ping'))),
          h('span', { className: 'tl-local' }, h(IconCheck, { size: 11 }), t('ui.demo')),
        ),
        h(
          'div',
          { className: 'tl-tabs', role: 'tablist', 'aria-label': t('brand.studio') },
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              id: 'tl-tab-login',
              'aria-selected': tab === 'login' ? 'true' : 'false',
              className: 'tl-tab' + (tab === 'login' ? ' tl-tab-on' : ''),
              onClick: () => setTab('login'),
            },
            t('auth.login'),
          ),
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              id: 'tl-tab-register',
              'aria-selected': tab === 'register' ? 'true' : 'false',
              className: 'tl-tab' + (tab === 'register' ? ' tl-tab-on' : ''),
              onClick: () => setTab('register'),
            },
            t('auth.register'),
          ),
        ),
        tab === 'login'
          ? h(LoginForm, { busy, onLogin, onSwitch: () => setTab('register') })
          : h(RegisterForm, { busy, onRegister, onSwitch: () => setTab('login') }),
        h('p', { className: 'tl-foot' }, t('ui.footer')),
      );
    }

    /* ------------------------------------------------------------------ */
    /* character panel                                                     */
    /* ------------------------------------------------------------------ */

    function CharacterPanel({ account, onClaim, onLogout }) {
      const [flash, setFlash] = useState('');
      const level = levelOf(account.xp);
      const into = ((account.xp || 0) % XP_STEP + XP_STEP) % XP_STEP;
      const percent = Math.min(100, Math.round((into / XP_STEP) * 100));
      const quests = account.quests && typeof account.quests === 'object' ? account.quests : {};
      const displayName = account.name || account.username;

      useEffect(() => {
        if (!flash) return undefined;
        const timer = setTimeout(() => setFlash(''), 2600);
        return () => clearTimeout(timer);
      }, [flash]);

      function claim(quest) {
        if (quests[quest.id]) return;
        onClaim(quest);
        setFlash(t('q.done'));
      }

      return h(
        'section',
        { className: 'tl-card', 'aria-label': displayName },
        h(
          'div',
          { className: 'tl-card-top' },
          h('span', { className: 'tl-online' }, h('i'), t('ui.online')),
          h('span', { className: 'tl-local' }, h(IconCheck, { size: 11 }), t('ui.demo')),
        ),
        h(
          'div',
          { className: 'tl-char' },
          h(
            'div',
            { className: 'tl-char-head' },
            h(
              'div',
              { className: 'tl-avatar' },
              h(IconEmblem, { size: 38 }),
              h('span', { className: 'tl-avatar-lv' }, 'Lv.' + level),
            ),
            h(
              'div',
              null,
              h(
                'div',
                { className: 'tl-char-name' },
                displayName,
                h('span', { className: 'tl-rank' }, t(rankKey(level))),
              ),
              h(
                'div',
                { className: 'tl-char-meta' },
                '@' + account.username + ' · ' + t('c.joined') + ' ' + isoDate(account.createdAt),
              ),
            ),
          ),
          h(
            'div',
            null,
            h(
              'div',
              { className: 'tl-xp-head' },
              h('span', null, t('c.xp')),
              h('span', null, into + ' / ' + XP_STEP),
            ),
            h('div', { className: 'tl-bar', role: 'progressbar', 'aria-valuenow': into, 'aria-valuemin': 0, 'aria-valuemax': XP_STEP }, h('div', { className: 'tl-bar-fill', style: { width: percent + '%' } })),
          ),
          h(
            'div',
            { className: 'tl-statgrid' },
            h(
              'div',
              { className: 'tl-statbox' },
              h('em', null, h(IconCrown, { size: 12 }), t('c.level')),
              h('b', null, level),
            ),
            h(
              'div',
              { className: 'tl-statbox' },
              h('em', null, h(IconCoin, { size: 12 }), t('c.gold')),
              h('b', null, account.gold || 0),
            ),
            h(
              'div',
              { className: 'tl-statbox' },
              h('em', null, h(IconSword, { size: 12 }), t('c.clears')),
              h('b', null, level > 2 ? level - 2 : 0),
            ),
          ),
          h(
            'div',
            { className: 'tl-quests' },
            h(
              'div',
              { className: 'tl-quests-head' },
              h('span', null, t('c.quests')),
              h('span', null, Object.keys(quests).length + ' / ' + QUESTS.length),
            ),
            QUESTS.map((quest) => {
              const done = Boolean(quests[quest.id]);
              return h(
                'div',
                { key: quest.id, className: 'tl-quest' + (done ? ' tl-quest-on' : '') },
                h(
                  'span',
                  { className: 'tl-quest-text' },
                  t(quest.key),
                ),
                h(
                  'span',
                  { className: 'tl-quest-rewards' },
                  h('span', null, h(IconCoin, { size: 12 }), quest.gold),
                  h('span', null, h(IconSpark, { size: 12 }), quest.xp),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tl-claim',
                    disabled: done,
                    onClick: () => claim(quest),
                  },
                  done ? t('c.claimed') : t('c.claim'),
                ),
              );
            }),
          ),
          h(
            'div',
            { className: 'tl-actions' },
            h(
              'button',
              { type: 'button', className: 'tl-btn', onClick: () => setFlash(t('ui.battleSoon')) },
              h(IconSword, { size: 16 }),
              t('c.battle'),
            ),
            h(
              'button',
              { type: 'button', className: 'tl-btn tl-ghost', onClick: onLogout },
              h(IconLogout, { size: 16 }),
              t('c.logout'),
            ),
          ),
          h('p', { className: 'tl-flash', role: 'status' }, flash),
        ),
        h('p', { className: 'tl-foot' }, t('ui.footer')),
      );
    }

    /* ------------------------------------------------------------------ */
    /* page                                                                */
    /* ------------------------------------------------------------------ */

    function TulongPage() {
      const [me, setMe] = useState(accountForSession);
      const [busy, setBusy] = useState(false);
      const busyRef = useRef(false);

      async function submitLogin(payload) {
        if (busyRef.current) return { error: null };
        busyRef.current = true;
        setBusy(true);
        try {
          await delay(420);
          const accounts = seedAccounts();
          const record = accounts[accountKey(payload.username)];
          if (!record || record.hash !== hashPassword(payload.password, record.salt)) {
            return { error: t('e.credentials') };
          }
          writeSession(record.username, payload.remember);
          writeRaw('localStorage', LAST_USER_KEY, record.username);
          setMe(record);
          return { ok: true };
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      }

      async function submitRegister(payload) {
        if (busyRef.current) return { error: null };
        busyRef.current = true;
        setBusy(true);
        try {
          await delay(480);
          const accounts = seedAccounts();
          const key = accountKey(payload.username);
          if (accounts[key]) return { error: t('e.exists') };
          const salt = randomSalt();
          const record = {
            username: payload.username,
            name: payload.roleName || payload.username,
            salt,
            hash: hashPassword(payload.password, salt),
            createdAt: Date.now(),
            xp: 0,
            gold: 60,
            quests: {},
          };
          accounts[key] = record;
          saveAccounts(accounts);
          writeSession(record.username, true);
          writeRaw('localStorage', LAST_USER_KEY, record.username);
          setMe(record);
          return { ok: true };
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      }

      function logout() {
        clearSession();
        setMe(null);
      }

      function claimQuest(quest) {
        const accounts = loadAccounts();
        if (!accounts) return;
        const record = accounts[accountKey(me.username)];
        if (!record) return;
        const quests = record.quests && typeof record.quests === 'object' ? record.quests : {};
        if (quests[quest.id]) return;
        const next = {
          ...record,
          gold: (record.gold || 0) + quest.gold,
          xp: (record.xp || 0) + quest.xp,
          quests: { ...quests, [quest.id]: Date.now() },
        };
        accounts[accountKey(me.username)] = next;
        saveAccounts(accounts);
        setMe(next);
      }

      return h(
        'div',
        { className: 'tl-root' },
        h(
          'div',
          { className: 'tl-shell' },
          h(Hero),
          me
            ? h(CharacterPanel, { account: me, onClaim: claimQuest, onLogout: logout })
            : h(AuthCard, { busy, onLogin: submitLogin, onRegister: submitRegister }),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS = `
.tl-root{position:relative;height:100%;overflow-y:auto;overflow-x:hidden;background:radial-gradient(1100px 620px at 12% -12%,color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent),transparent 62%),radial-gradient(900px 520px at 92% 112%,color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent),transparent 60%),var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.tl-root *{box-sizing:border-box}
.tl-shell{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,400px);gap:clamp(22px,4.6vw,60px);align-items:center;max-width:1120px;min-height:100%;margin:0 auto;padding:clamp(22px,4.6vh,52px) clamp(18px,3.2vw,34px)}
.tl-hero{position:relative;min-width:0;padding:6px 0}
.tl-hero-in{position:relative;z-index:2;max-width:540px}
.tl-brand{display:flex;align-items:center;gap:9px;margin-bottom:clamp(18px,4vh,34px)}
.tl-brand-mark{display:inline-flex;color:var(--dsw-alias-brand-primary)}
.tl-brand-name{font-size:11px;font-weight:700;letter-spacing:.18em;color:var(--dsw-alias-label-secondary)}
.tl-season{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:10px;letter-spacing:.12em;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 55%,transparent);white-space:nowrap}
.tl-season i{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 8px var(--dsw-alias-state-success-primary)}
.tl-title{margin:0;font-size:clamp(44px,6.4vw,68px);line-height:1.02;font-weight:800;letter-spacing:.04em;background:linear-gradient(112deg,var(--dsw-alias-label-primary) 6%,var(--dsw-alias-brand-primary) 54%,var(--dsw-alias-state-warn-primary) 96%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.tl-kicker{margin:14px 0 0;font-size:11px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.tl-tagline{margin:18px 0 0;max-width:430px;font-size:13px;line-height:1.75;color:var(--dsw-alias-label-secondary)}
.tl-feats{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.tl-feat{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 70%,transparent);font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.tl-feat svg{color:var(--dsw-alias-brand-primary)}
.tl-stats{display:flex;flex-wrap:wrap;gap:22px;margin-top:clamp(22px,5vh,40px);padding-top:18px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 70%,transparent);max-width:430px}
.tl-stat{display:flex;flex-direction:column;gap:2px}
.tl-stat b{font-size:18px;font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.tl-stat span{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.tl-art{position:absolute;top:50%;right:clamp(-70px,-2vw,-30px);width:min(42vw,440px);aspect-ratio:1;transform:translateY(-50%);pointer-events:none;z-index:0;opacity:.92}
.tl-art-glow{position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,transparent),transparent 68%);filter:blur(6px);animation:tl-breathe 7s ease-in-out infinite}
.tl-emblem{position:relative;display:block;width:100%;height:100%;color:var(--dsw-alias-label-primary);animation:tl-float 9s ease-in-out infinite}
.tl-ring{transform-origin:180px 180px}
.tl-spin-slow{animation:tl-spin 90s linear infinite}
.tl-spin-rev{animation:tl-spin 130s linear infinite reverse}
.tl-mote{position:absolute;left:var(--m-x);top:var(--m-y);width:var(--m-s);height:var(--m-s);border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 0 10px color-mix(in srgb,var(--dsw-alias-brand-primary) 80%,transparent);opacity:0;animation:tl-mote var(--m-d) ease-in-out infinite;animation-delay:var(--m-delay)}
.tl-card{position:relative;z-index:2;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:20px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 90%,transparent);box-shadow:0 26px 70px color-mix(in srgb,#000 22%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 6%,transparent);padding:20px 22px 22px;backdrop-filter:blur(14px);animation:tl-rise .5s cubic-bezier(.2,.7,.25,1) both}
.tl-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px}
.tl-online{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.tl-online i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent);animation:tl-pulse 2.6s ease-in-out infinite}
.tl-online span{font-variant-numeric:tabular-nums;opacity:.7}
.tl-local{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.08em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 60%,transparent);white-space:nowrap}
.tl-local svg{color:var(--dsw-alias-state-success-primary)}
.tl-tabs{position:relative;display:flex;gap:6px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);margin-bottom:18px}
.tl-tab{flex:1;appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;font-weight:600;letter-spacing:.04em;padding:9px 10px;border-radius:9px;cursor:pointer;transition:color .18s,background-color .18s,box-shadow .18s}
.tl-tab:hover{color:var(--dsw-alias-label-primary)}
.tl-tab-on{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 2px 8px color-mix(in srgb,#000 12%,transparent)}
.tl-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tl-card-title{margin:0;font-size:17px;font-weight:700;letter-spacing:.01em}
.tl-card-sub{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.tl-fields{display:flex;flex-direction:column;gap:13px;margin-top:18px}
.tl-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.tl-label{font-size:11.5px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}
.tl-inputwrap{position:relative;display:flex;align-items:center}
.tl-input{width:100%;height:42px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 12px 0 38px;outline:none;transition:border-color .18s,box-shadow .18s,background-color .18s}
.tl-input::placeholder{color:color-mix(in srgb,var(--dsw-alias-label-secondary) 70%,transparent)}
.tl-input:hover{border-color:var(--dsw-alias-border-l2)}
.tl-input:focus{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.tl-invalid .tl-input{border-color:var(--dsw-alias-state-error-primary)}
.tl-invalid .tl-input:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,transparent)}
.tl-inputicon{position:absolute;left:12px;display:inline-flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.tl-eye{position:absolute;right:6px;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tl-eye:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.tl-eye:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tl-with-eye .tl-input{padding-right:42px}
.tl-hint{margin:0;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tl-caps{color:var(--dsw-alias-state-warn-primary)}
.tl-fielderr{margin:0;font-size:10.5px;color:var(--dsw-alias-state-error-primary)}
.tl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px}
.tl-check{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;position:relative}
.tl-check input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.tl-box{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;border-radius:5px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:transparent;transition:background-color .16s,border-color .16s,color .16s}
.tl-check input:checked+.tl-box{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.tl-check input:focus-visible+.tl-box{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tl-check:hover .tl-box{border-color:var(--dsw-alias-label-secondary)}
.tl-check-bad .tl-box{border-color:var(--dsw-alias-state-error-primary)}
.tl-link{appearance:none;border:0;background:transparent;font:inherit;font-size:11.5px;color:var(--dsw-alias-brand-primary);cursor:pointer;padding:0;border-radius:4px}
.tl-link:hover{text-decoration:underline;text-underline-offset:2px}
.tl-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tl-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border:0;border-radius:11px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.06em;cursor:pointer;transition:filter .18s,transform .12s,box-shadow .18s;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,#fff);box-shadow:0 8px 22px color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}
.tl-btn:hover:not(:disabled){filter:brightness(1.07)}
.tl-btn:active:not(:disabled){transform:translateY(1px)}
.tl-btn:disabled{opacity:.72;cursor:progress}
.tl-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tl-ghost{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);box-shadow:none;font-weight:600}
.tl-ghost:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-layer-2))}
.tl-spin{width:14px;height:14px;border:2px solid color-mix(in srgb,currentColor 30%,transparent);border-top-color:currentColor;border-radius:50%;animation:tl-spin .8s linear infinite}
.tl-alt{margin:14px 0 0;text-align:center;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.tl-alt .tl-link{margin-left:2px}
.tl-notice{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:9px;font-size:11.5px;line-height:1.5;border:1px solid transparent}
.tl-notice svg{flex:none;margin-top:1px}
.tl-notice-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);color:var(--dsw-alias-state-error-primary)}
.tl-notice-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 30%,transparent);color:var(--dsw-alias-state-success-primary)}
.tl-strength{display:flex;align-items:center;gap:8px;margin-top:-4px}
.tl-segs{display:flex;gap:4px;flex:1}
.tl-seg{height:4px;border-radius:2px;flex:1;background:color-mix(in srgb,var(--dsw-alias-border-l2) 65%,transparent);transition:background-color .2s}
.tl-seg-fill{background:var(--dsw-alias-state-error-primary)}
.tl-seg-lv2{background:var(--dsw-alias-state-warn-primary)}
.tl-seg-lv3{background:var(--dsw-alias-brand-primary)}
.tl-seg-lv4{background:var(--dsw-alias-state-success-primary)}
.tl-strength-label{font-size:10px;letter-spacing:.08em;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}
.tl-demo{margin-top:16px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:9px 11px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tl-demo-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.tl-demo code{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 5px}
.tl-demo .tl-link{margin-left:auto;font-size:10.5px}
.tl-foot{margin:16px 0 0;text-align:center;font-size:10px;line-height:1.6;color:color-mix(in srgb,var(--dsw-alias-label-secondary) 78%,transparent)}
.tl-char{display:flex;flex-direction:column;gap:16px}
.tl-char-head{display:flex;align-items:center;gap:14px}
.tl-avatar{position:relative;flex:none;width:62px;height:62px;border-radius:18px;display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,var(--dsw-alias-border-l1));background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent),transparent 60%),var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.tl-avatar-lv{position:absolute;right:-6px;bottom:-6px;min-width:24px;height:20px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-brand-primary);border:2px solid var(--dsw-alias-bg-layer-1);font-variant-numeric:tabular-nums}
.tl-char-name{font-size:17px;font-weight:700;letter-spacing:.01em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tl-char-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px;word-break:break-all}
.tl-rank{font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);border-radius:999px;padding:1px 7px}
.tl-xp-head{display:flex;justify-content:space-between;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin-bottom:6px;font-variant-numeric:tabular-nums}
.tl-bar{height:7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-border-l2) 55%,transparent);overflow:hidden}
.tl-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-brand-primary),var(--dsw-alias-state-warn-primary));transition:width .4s cubic-bezier(.2,.7,.3,1)}
.tl-statgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.tl-statbox{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);min-width:0}
.tl-statbox em{font-style:normal;display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.tl-statbox b{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}
.tl-quests{display:flex;flex-direction:column;gap:7px}
.tl-quests-head{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.tl-quest{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent)}
.tl-quest-on{opacity:.66}
.tl-quest-text{flex:1;min-width:0;font-size:11.5px;line-height:1.4}
.tl-quest-rewards{display:flex;gap:6px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;font-variant-numeric:tabular-nums}
.tl-quest-rewards span{display:inline-flex;align-items:center;gap:3px}
.tl-claim{appearance:none;flex:none;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary);font:inherit;font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:7px;cursor:pointer}
.tl-claim:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent)}
.tl-claim:disabled{cursor:default;color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l1);background:transparent}
.tl-claim:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tl-actions{display:flex;gap:8px}
.tl-actions .tl-btn{height:40px;font-size:12px}
.tl-flash{margin:0;min-height:14px;text-align:center;font-size:10.5px;color:var(--dsw-alias-state-success-primary)}
@keyframes tl-spin{to{transform:rotate(360deg)}}
@keyframes tl-float{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}
@keyframes tl-breathe{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.95;transform:scale(1.04)}}
@keyframes tl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes tl-mote{0%{opacity:0;transform:translateY(10px) scale(.7)}25%{opacity:.75}100%{opacity:0;transform:translateY(-48px) scale(1.15)}}
@keyframes tl-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width:900px){.tl-shell{grid-template-columns:minmax(0,1fr);gap:26px;padding-top:26px;padding-bottom:34px}.tl-art{position:relative;top:auto;right:auto;transform:none;width:min(64vw,300px);margin:-4px auto 0;opacity:.72}.tl-hero-in{max-width:none}.tl-stats{margin-top:18px}.tl-card{max-width:440px;width:100%;margin:0 auto}}
@media (max-width:700px){.tl-art{display:none}.tl-title{font-size:44px}.tl-shell{padding:20px 16px 30px;gap:20px}.tl-hero{padding:0}.tl-brand{margin-bottom:16px}.tl-season{font-size:9px}.tl-tagline{font-size:12px}.tl-stats{gap:16px}}
@media (prefers-reduced-motion:reduce){.tl-emblem,.tl-art-glow,.tl-ring,.tl-mote,.tl-online i,.tl-spin{animation:none}.tl-card{animation-duration:.01s}.tl-bar-fill{transition:none}}
`;

    const STYLE_ID = NS + '/styles.css';

    function insertStyles() {
      if (typeof document === 'undefined') return () => {};
      const selector = 'style[data-plugin-css="' + STYLE_ID + '"]';
      document.querySelectorAll(selector).forEach((node) => node.remove());
      const tag = document.createElement('style');
      tag.dataset.plugin = NS;
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.append(tag);
      return () => {
        tag.remove();
      };
    }

    /* ------------------------------------------------------------------ */
    /* locale dictionaries                                                 */
    /* ------------------------------------------------------------------ */

    const EN = {
      nav: 'Tulong',
      'brand.studio': 'TULONG STUDIO',
      'brand.season': 'SEASON I · DRAGONFALL',
      'hero.title': 'Tulong',
      'hero.sub': 'DRAGONFALL · SEASON I',
      'hero.tagline':
        'When the last elder dragon opens its eye, only the swordbearer decides the dawn. Sign in to your dragonkin record and finish the expedition.',
      'hero.f1': 'Cross-server wars',
      'hero.f2': 'Epic raids',
      'hero.f3': 'Dragon soul growth',
      'hero.stat1v': '1.28M',
      'hero.stat1l': 'Hunters',
      'hero.stat2v': '47',
      'hero.stat2l': 'Elder dragons',
      'hero.stat3v': '24/7',
      'hero.stat3l': 'Night watch',
      'auth.login': 'Sign in',
      'auth.register': 'Register',
      'auth.loginTitle': 'Welcome back, hunter',
      'auth.loginHint': 'Sign in to continue your expedition.',
      'auth.registerTitle': 'Join the expedition',
      'auth.registerHint': 'Create a dragonkin record and claim the starter pack.',
      'f.username': 'Account',
      'f.usernamePh': '3–16 letters, digits or Chinese characters',
      'f.password': 'Password',
      'f.passwordPh': 'At least 6 characters',
      'f.confirm': 'Confirm password',
      'f.confirmPh': 'Enter the password again',
      'f.role': 'Character name (optional)',
      'f.rolePh': 'Defaults to your account name',
      'f.remember': 'Remember me',
      'f.forgot': 'Forgot password?',
      'f.agree': 'I have read and accept the Dragonkin Pact',
      'b.login': 'Sign in',
      'b.register': 'Create account',
      'b.busy': 'Contacting the Dragon Abyss…',
      'hint.demo': 'Demo account',
      'hint.fill': 'Fill in',
      'hint.caps': 'Caps Lock is on',
      's.weak': 'Weak',
      's.fair': 'Fair',
      's.good': 'Good',
      's.strong': 'Strong',
      'e.usernameReq': 'Enter your account name',
      'e.passwordReq': 'Enter your password',
      'e.usernameBad': 'Use 3–16 letters, digits or Chinese characters',
      'e.passwordBad': 'Password must be at least 6 characters',
      'e.passwordSame': 'Password must differ from the account name',
      'e.confirmBad': 'The two passwords do not match',
      'e.exists': 'That account name is already taken',
      'e.credentials': 'Incorrect account name or password',
      'e.agree': 'Accept the Dragonkin Pact to continue',
      'e.network': 'Connection failed. Try again.',
      't.forgot': 'Password recovery is not available in this demo. Create a new account instead.',
      'c.level': 'Level',
      'c.xp': 'Experience',
      'c.gold': 'Gold',
      'c.clears': 'Dragons felled',
      'c.joined': 'Joined',
      'c.quests': 'Daily commissions',
      'c.claim': 'Claim',
      'c.claimed': 'Claimed',
      'c.logout': 'Sign out',
      'c.battle': 'Enter the battlefield',
      'c.rank1': 'Dragonkin · Squire',
      'c.rank2': 'Dragonkin · Hunter',
      'c.rank3': 'Dragonkin · Dragonbane',
      'q.1': 'Swing your sword 3 times in the training yard',
      'q.2': 'Clear one dungeon with your guild',
      'q.3': 'Feed your dragon soul once',
      'q.done': 'Commission reward claimed',
      'ui.online': 'Dragon Abyss · Online',
      'ui.ping': '28ms',
      'ui.demo': 'Local demo',
      'ui.footer': 'Demo build · accounts stay in this browser only',
      'ui.no': 'New to Tulong?',
      'ui.have': 'Already have an account?',
      'ui.switchLogin': 'Sign in',
      'ui.switchRegister': 'Create one',
      'ui.battleSoon': 'The battlefield opens in the full release.',
      'aria.showPw': 'Show password',
      'aria.hidePw': 'Hide password',
      'aria.strength': 'Password strength',
    };

    const ZH = {
      nav: '屠龙',
      'brand.studio': '屠龙工作室',
      'brand.season': '第一赛季 · 龙渊降临',
      'hero.title': '屠龙',
      'hero.sub': '龙渊降临 · 第一赛季',
      'hero.tagline': '当最后一条古龙睁开眼，只有持剑者能决定黎明。登录你的龙裔档案，继续未完的远征。',
      'hero.f1': '跨服战场',
      'hero.f2': '史诗团本',
      'hero.f3': '龙魂养成',
      'hero.stat1v': '128万',
      'hero.stat1l': '猎龙者',
      'hero.stat2v': '47',
      'hero.stat2l': '古龙',
      'hero.stat3v': '24h',
      'hero.stat3l': '守夜',
      'auth.login': '登录',
      'auth.register': '注册',
      'auth.loginTitle': '欢迎回来，猎龙者',
      'auth.loginHint': '输入账号信息，继续你的远征。',
      'auth.registerTitle': '加入远征',
      'auth.registerHint': '创建龙裔档案，领取新手礼包。',
      'f.username': '账号',
      'f.usernamePh': '3–16 位字母、数字或中文',
      'f.password': '密码',
      'f.passwordPh': '至少 6 位字符',
      'f.confirm': '确认密码',
      'f.confirmPh': '再次输入密码',
      'f.role': '角色名（可选）',
      'f.rolePh': '留空则使用账号名',
      'f.remember': '记住我',
      'f.forgot': '忘记密码？',
      'f.agree': '我已阅读并同意《龙裔公约》',
      'b.login': '进入龙渊',
      'b.register': '创建角色',
      'b.busy': '正在连接龙渊…',
      'hint.demo': '演示账号',
      'hint.fill': '一键填入',
      'hint.caps': '大写锁定已开启',
      's.weak': '弱',
      's.fair': '一般',
      's.good': '良好',
      's.strong': '很强',
      'e.usernameReq': '请输入账号',
      'e.passwordReq': '请输入密码',
      'e.usernameBad': '账号需为 3–16 位字母、数字或中文',
      'e.passwordBad': '密码至少 6 位字符',
      'e.passwordSame': '密码不能与账号相同',
      'e.confirmBad': '两次输入的密码不一致',
      'e.exists': '该账号已被注册',
      'e.credentials': '账号或密码不正确',
      'e.agree': '请先同意《龙裔公约》',
      'e.network': '连接失败，请重试。',
      't.forgot': '演示环境暂不支持找回密码，请注册新账号。',
      'c.level': '等级',
      'c.xp': '经验',
      'c.gold': '金币',
      'c.clears': '屠龙',
      'c.joined': '加入于',
      'c.quests': '每日委托',
      'c.claim': '领取',
      'c.claimed': '已领取',
      'c.logout': '退出登录',
      'c.battle': '进入战场',
      'c.rank1': '龙裔 · 见习屠龙者',
      'c.rank2': '龙裔 · 猎龙手',
      'c.rank3': '龙裔 · 屠龙勇者',
      'q.1': '在训练场完成 3 次挥剑',
      'q.2': '与公会伙伴通关 1 次副本',
      'q.3': '喂养龙魂 1 次',
      'q.done': '委托奖励已领取',
      'ui.online': '龙渊一区 · 在线',
      'ui.ping': '28ms',
      'ui.demo': '本地演示',
      'ui.footer': '演示版本 · 账号仅保存在本机浏览器',
      'ui.no': '还没有账号？',
      'ui.have': '已有账号？',
      'ui.switchLogin': '返回登录',
      'ui.switchRegister': '免费注册',
      'ui.battleSoon': '战场正在维护中，敬请期待。',
      'aria.showPw': '显示密码',
      'aria.hidePw': '隐藏密码',
      'aria.strength': '密码强度',
    };

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [
            ctx.locale.register(NS, 'en', EN),
            ctx.locale.register(NS, 'zh', ZH),
            ctx.locale.register(NS, 'zh-CN', ZH),
            ctx.locale.register(NS, 'zh-Hans', ZH),
            insertStyles(),
          ];
          return () => {
            disposers.forEach((dispose) => {
              try {
                dispose();
              } catch (err) {
                /* already disposed */
              }
            });
          };
        }, 'dsh-tulong: styles and dictionaries');

        t = ctx.locale.bind(NS);

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'dsh-tulong',
              order: 30,
              label: () => t('nav'),
              locale: NS,
            },
            TulongIcon,
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'dsh-tulong', locale: NS }, TulongPage),
        );
      },
    };
  },
});
