# dsh-tulong

屠龙（Tulong）— 一个 DSH Web UI 插件：左侧栏入口 + 游戏风格的登录 / 注册界面。

- 侧栏新增「屠龙」图标，点击进入独立主面板。
- 登录、注册、演示账号、角色面板（等级 / 经验 / 金币 / 每日委托）、退出登录。
- 全部数据保存在浏览器本地，密码只存加盐摘要，不落明文。
- 中英文界面，跟随 Harness 语言自动切换；深色 / 浅色主题自适应。

## 仓库结构

```
dsh-tulong/              # 插件包（package.json 所在目录）
  client.js              # 侧栏图标与主面板页面
  index.js               # 宿主侧空实现
  cordis.patch.yml
  locale/{en,zh}.json
  icon.svg
tools/smoke-client.mjs   # 离线冒烟测试
```

## 安装

在 DSH 中通过插件管理安装本仓库的 `dsh-tulong/` 目录，或：

```
plugin_manager install_bundle  target = <repo>/dsh-tulong
```

安装后刷新页面，左侧栏出现「屠龙」入口。

## 演示账号

- 账号 `dragonslayer` / 密码 `tulong2026`
- 或在登录卡片点击「填入演示账号」

## 测试

```
node tools/smoke-client.mjs
```
