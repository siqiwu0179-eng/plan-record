# 计划与记录

一个基于 React、TypeScript、Vite、Tailwind CSS、Recharts、Lucide React 和 Supabase 开发的个人计划与生活记录 Dashboard。

## 产品文档

- [Plan & Record 产品需求文档（PRD）](docs/Plan_and_Record_PRD.md)

## 在线地址

- 正式网站：[https://plan-record-x5d8.vercel.app](https://plan-record-x5d8.vercel.app)
- GitHub 仓库：[https://github.com/siqiwu0179-eng/plan-record](https://github.com/siqiwu0179-eng/plan-record)
- Supabase 项目 API 地址：[https://bhmugpakjyxspspwljam.supabase.co](https://bhmugpakjyxspspwljam.supabase.co)

## 当前功能

- 首页总览：今日计划、周进度、心情和旅行摘要
- 每日计划：周切换、日期选择、返回本周
- 学习、锻炼、饮食、其他四类任务管理
- 添加、编辑、删除和勾选任务
- 每日完成率、分类完成数和本周统计实时计算
- Recharts 本周完成度趋势图
- 心情日记：记录每日心情、文字和标签
- 旅行记录：管理旅行路线、城市、日期和里程统计
- 个人资料：昵称、头像和明暗主题
- 手机号 + 密码注册、登录和退出
- 登录账户后通过 Supabase 在不同浏览器和设备间同步数据

## 数据保存与同步

项目已经连接 Supabase 项目 `plan-record-database`。

- `Supabase Auth`：负责账户注册、登录和会话
- `public.profiles`：保存用户昵称和头像路径
- `public.plan_tasks` / `public.task_completions`：保存每日任务和完成状态
- `public.mood_records` / `public.travel_records`：保存心情和旅行记录
- `public.long_term_plans` / `public.long_term_compass`：保存长期计划和人生罗盘
- `public.user_preferences`：保存主题和首页格言
- `Supabase Storage / avatars`：保存用户头像
- Row Level Security（RLS）：每位登录用户只能访问自己的数据

浏览器 LocalStorage 现在仅作为当前浏览器的运行缓存。用户登录后，系统以 Supabase 中该账户的数据为准并加载到浏览器；修改计划、心情、旅行记录或个人资料后，再同步回 Supabase。更换 Safari、Chrome 或其他设备登录同一账户时，不应再用新浏览器中的旧 LocalStorage 覆盖云端数据。

列表读取按稳定顺序每批请求 500 条，并核对精确总数，直到完整读取任务、完成状态及其他业务列表。不能将 Supabase 默认单次最多返回 1000 条当作账户的全部记录；中途读取失败或数量发生变化时，页面提示重新加载，避免把不完整的列表当成空记录继续编辑。

保存重试和长期计划的未保存草稿目前只在页面内存中运行，不能保证刷新或关闭网页后恢复尚未写入云端的改动。软删除保留已删除的业务行，供确认后恢复；升级前的手工数据库快照也不能代替持续备份。这些机制与列表完整读取分别解决不同问题。

## 已完成的主要更新

- 将原本仅保存在 LocalStorage 的项目升级为 Supabase 账户云同步
- 增加手机号 + 密码注册与登录
- 建立用户资料、用户数据、网站统计和头像存储
- 为用户数据和头像配置 RLS 隔离
- 修复新浏览器登录时，本地旧数据覆盖 Supabase 云端数据的问题
- 登录时改为优先读取 Supabase 中该账户的最新数据
- 完成生产数据备份与历史计划数据恢复
- GitHub `main` 分支连接 Vercel，提交后自动构建并部署正式网站
- Supabase 项目已授权连接 GitHub 仓库；当前不启用数据库自动生产部署

## 项目连接关系

```text
GitHub main
    │
    ├── Vercel 自动构建与部署
    │       └── https://plan-record-x5d8.vercel.app
    │
    └── Supabase GitHub 集成（已连接，数据库自动生产部署关闭）

网站前端
    └── Supabase plan-record-database
            ├── Auth
            ├── PostgreSQL Database
            └── Storage
```

GitHub 与 Supabase 的连接用于管理后续数据库迁移和项目配置，不会把正式数据库中的用户记录上传到 GitHub。真实用户数据仍保存在 Supabase 中。

## 本地运行

```bash
npm install
npm run dev
```

打开终端提示的本地地址即可查看页面。

本地需要配置以下环境变量：

```env
VITE_SUPABASE_URL=你的_Supabase_项目地址
VITE_SUPABASE_PUBLISHABLE_KEY=你的_Supabase_Publishable_Key
```

不要把真实密钥提交到 GitHub。

## 构建与预览

```bash
npm run build
npm run preview
```

Vercel 当前使用以下设置：

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Production Branch: main
```

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React
- React Globe GL
- Supabase Auth、PostgreSQL、Storage
- Vercel
