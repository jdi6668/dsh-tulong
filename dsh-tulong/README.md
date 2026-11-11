# dsh-tulong

《屠龙 · 龙渊降临》— a DeepSeek Harness UI bundle. It adds a shield-and-sword
icon to the left sidebar; the page behind it is the game's login and
registration screen, with a character profile after sign-in.

## What it does

- **Sidebar entry** — a new `sidebar.panellist` icon (`id: dsh-tulong`, order 30)
  that opens the `main` panel keyed `dsh-tulong`.
- **Sign in / create account** — client-side demo auth with validation,
  password visibility toggle, password strength meter, Caps Lock hint and a
  "remember me" session.
- **Character page** — level, experience, gold and three daily commissions that
  can be claimed once each.
- **Localized** — English and Chinese dictionaries via the Client locale
  service (`en`, `zh`, `zh-CN`), both light and dark themes through
  `--dsw-alias-*` tokens.

## Demo account

```
account   dragonslayer
password  tulong2026
```

Accounts and the session are stored in this browser only (`localStorage` /
`sessionStorage`); passwords are kept as a salted demo digest, never as
plaintext. This is a demo, not an authentication backend.

## Install

The bundle is a normal DSH bundle directory: install it into a profile (Plugin
Manager → install bundle, or `dsh plugin --profile desktop add <path>`), then
enable `dsh-tulong`. A newly installed bundle is picked up without restarting
the app.

## Layout

| File | Purpose |
| --- | --- |
| `index.js` | no-op host half |
| `client.js` | sidebar icon + login / register / character UI |
| `cordis.patch.yml` | inserts the plugin row into the profile |
| `locale/*.json` | display metadata |
| `icon.svg` | package icon |
