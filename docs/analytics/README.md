# Plan & Record Analytics

独立文件：仓库根目录 `analytics.html`。未部署，没有 `/analytics` 路由，没有主产品入口，不参与 Vite 的主产品构建。

## 打开

推荐双击仓库根目录的 `打开 Analytics.command`，它会启动本地服务并在 Google Chrome 打开页面（本次启动的终端窗口需保持打开）。也可直接打开 `analytics.html`，或在仓库目录运行 `python3 scripts/serve-analytics.py`，然后访问 `http://127.0.0.1:4318/analytics.html`。该服务只监听本机，只提供 Dashboard 文件，不暴露源码目录或 `.env`。

使用现有手机号和密码登录（支持原产品的 `+86` / `@plan-record.local` 账号规则）。文件只内嵌已有项目的公开 publishable key，不包含 service role key。访问令牌和刷新令牌只在页面内存中，刷新/关闭页面后需重新登录。退出只清除 Dashboard 会话，不注销主产品。Dashboard 的登录、浏览、刷新不记录为产品使用事件。

当前项目 `bhmugpakjyxspspwljam` 的现有唯一账户已加入 Analytics reader 名单。其他注册账户默认无权读全站指标；只能提交绑定自身身份的有限客户端事件。后续管理员在可信 SQL 环境中管理 `analytics_private.readers`，不能在浏览器中自行授予权限。

## 数据结构与安全

已应用迁移：`supabase/migrations/20261012152503_analytics_v1.sql`（与远端 migration version 一致）。

- `analytics_private.events`：不可由客户端直接读写的事件表。字段包含事件 ID、幂等键、事件名、user_id、occurred_at、received_at、module、object_id、properties、source。
- `analytics_private.readers`：分析读者名单。
- `analytics_private.settings`：实际采集起点。
- 以上三表启用 RLS，撤销客户端表权限，没有开放行策略，默认拒绝直接访问。private schema 不加入 Data API 暴露列表。
- `public.analytics_track`：调用带身份检查的私有函数；user_id 使用 `auth.uid()`，只接受页面访问、登录和 Step → Daily 事件，不允许伪造服务端业务事件。Step 关联核验任务和步骤属于当前用户。
- `public.analytics_dashboard`：调用带 reader 检查的私有聚合函数，仅返回指标，不返回姓名、联系方式、任务文本、心情内容等明细。
- 私有 SECURITY DEFINER 函数固定空 search_path；公开包装函数为 SECURITY INVOKER。匿名角色无执行权，私有触发器函数不可由客户端调用。

Supabase 官方安全参考：[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。本项目的权限效果另有实际角色测试验证，不以文档代替测试。

## 埋点位置

| 事件 | 采集位置 / 语义 |
| --- | --- |
| user_signed_up | auth.users 成功插入后 |
| user_logged_in | 主产品 AuthScreen 密码登录成功后；不把刷新令牌或恢复会话当成新登录 |
| page_viewed | 主产品账户数据就绪后进入页面；progress 映射为 completion |
| task_created | plan_tasks 成功插入后 |
| task_completed | task_completions 从未完成变为完成（重复保存不重复计事件） |
| task_deleted | plan_tasks 从未删除变为软删除 |
| task_carried_over | plan_tasks 的计划日期发生改变；现有产品没有另加顺延入口 |
| goal_created | long_term_plans 成功插入后 |
| longterm_step_created | 长期计划 JSON 数组中新增 Step ID |
| longterm_step_completed | Step 的 done 从 false/不存在变为 true |
| longterm_step_added_to_daily | 主产品加入 Daily 的任务 RPC 成功后，发送目标 task ID 与源 goal/step ID |
| mood_created | mood_records 成功插入后 |
| travel_created | travel_records 成功插入后 |

数据库触发器与业务写入在同一事务内，业务回滚不会留下事件。触发器采集异常被捕获并发出数据库 warning，不阻止业务保存。没有改写已有业务 RPC、业务表字段或业务 RLS。

客户端埋点为非阻塞 best effort：最多三次尝试，超时 5 秒，重试复用 UUID，切换账号时取消后续发送；每次请求固定已核对的会话令牌，防止并发切换把旧事件归属给新账户。所有失败只记录不含敏感内容的控制台警告。关闭页面或长时间离线仍可能丢失客户端事件；没有为了埋点阻塞业务或持久化敏感缓存。

## 指标口径

统一使用 Asia/Shanghai 自然日，日期筛选双端包含，最多 731 天，不接受未来结束日期。

- **历史还原**：使用真实业务表中的注册、任务创建、仍标记完成的任务最后 recorded completed_at、Goal 创建、Mood/Travel 创建时间。source=history，绝不伪造历史登录/页面访问/Step 时间。导入的业务日期可能早于账户注册，因此漏斗只从注册后的已知事件开始。
- **活跃**：source 非 history 的真实行为事件（排除注册）；DAU 为结束日，WAU 为结束日前 7 天，MAU 为结束日前 30 天。历史回填不冒充实际活跃。页面明确说明窗口未覆盖时仅为“已观测值”。
- **新增用户**：所选日期内真实 auth.users 注册人数。DAU/MAU 分母为零时 No data。
- **North Star**：截至结束日的滚动 7 日“首次已知完成任务数 / 活跃用户数”。需要完整采集窗口和非零分母；否则 No data。
- **创建/完成趋势**：按事件日期；任务完成按 `(user_id, object_id)` 的首次已知完成去重，反复勾选不会重复贡献。创建包括之后被删除的任务。历史只能恢复迁移时仍完成的任务最后已知时间，并非完整历史转换流水。
- **Daily 完成率 / 分类**：按计划日期筛选当前未删除的任务及其当前完成状态。它与按行为日期计算的完成事件数是不同口径。活跃计划天数为去重计划日，同时返回用户计划日数。
- **期间人均完成**：期间首次已知完成任务 / 期间活跃用户；不完整行为窗口或零分母为 No data。
- **Retention**：所选期间注册且注册日在首个完整采集日以后的用户，注册后第 N 个自然日活跃。仅纳入观察日已结束且不晚于所选结束日的成熟用户；D1/D7/D30 都展示分子和分母。无成熟用户显示 No data。
- **Churn**：结束日前第 60–31 天活跃，但最后 30 天完全不活跃的人数 / 前 30 天活跃人数。两个窗口未完整覆盖或分母为零显示 No data。
- **Conversion**：期间注册 → 注册后首次已知创建 → 首次已知完成 → 注册至少 7 天后且完成后仍活跃。最后阶段仅使用完整采集期内注册、已成熟的用户，不能用旧用户缺失的活跃历史做假留存。
- **Feature Adoption**：Daily/Long-term/Completion/Travel/Mood 的访问人数、页面进入次数，以及访问人数 / 期间活跃人数。不把自动加载数据算作功能使用。
- **Long-term**：Goal、Step 及完成率为当前未删除计划的快照；新增和 Step 完成事件按期间筛选。Step → Daily 为当前 Step 中，期间有成功关联记录的去重 Step 数 / 当前 Step 数；历史没有关联，不补造。
- **周/月趋势**：选定范围内按自然周（周一开始）和自然月分组；活跃人数由 SQL 按用户去重，不能累加 DAU。边界周/月只包含所选范围内的日期。任务数按每日事件数求和。

无记录的计数为 0；无分母、缺少观察历史或窗口未成熟时 No data。网络/权限错误显示错误并隐藏旧结果，不能伪装成空数据。

## 验证

- `npm run build`：通过。仅保留既有的大 bundle 提示；`dist` 没有 analytics.html。
- `node tests/statistics.test.mjs`：通过。
- `node --test tests/optimisticSaveQueue.test.mjs tests/longTermStore.test.mjs tests/analytics.test.mjs tests/analytics-dashboard.test.mjs`：22 个测试通过。
- `supabase/tests/analytics.sql`：11 组远端数据库验证通过，包括真实指标对账、权限隔离、日期校验、重复保存/重试去重、13 类事件相关路径、失败隔离和原始业务数据不变。SQL 在 repeatable-read 事务内运行，业务转换仅在临时副本上演练，最后整体 ROLLBACK。未创建测试账户，未留下测试埋点。
- 浏览器：用户真实登录后直接调用现有 Supabase；2026-08-01 至 2026-10-12 显示创建 501、首次已知完成 406；当前计划任务 473、已完成 394；Goal 4、Step 25、完成 Step 7。日期筛选、每周/每月分组、2000-01-01 至 2000-01-02 的真实空范围均通过。页面没有控制台错误。
- 安全 advisor：Analytics 三张私有表的 `RLS enabled no policy` 为有意的拒绝直接访问设计（INFO）。另有原项目已有的密码泄漏保护未启用提示，本次未改变认证策略。

开发前后业务数据基线完全一致：

| 表 | 行数 | 内容 MD5 |
| --- | ---: | --- |
| plan_tasks | 793 | 1326d9e5594b21c395379af83309be12 |
| task_completions | 793 | 3b1ee21d8a1a8f03f3d111a1793771ff |
| long_term_plans | 8 | 0ad20310d444959d99f838be4aa0aa2d |
| mood_records | 40 | ecdad96014cafe2e46df0ea6df4a7b35 |
| travel_records | 17 | a03d5f5888e37e4a113deccd43f142d9 |

2026-10-13 验证结束时，Analytics 中只有来自真实业务的 1,504 条历史事件（793 创建、645 完成、8 Goal、40 Mood、17 Travel、1 注册），没有测试事件或假行为历史。

## 当前生效范围

Analytics 数据库结构与服务端业务触发器已经生效；本地源码中的页面/登录/Step → Daily 客户端埋点尚未发布，正式网页不会提前拥有这些新埋点。Dashboard 本身是已可使用的本地工具。没有部署、推送或创建新的站点；本次也没有修改原有业务行或仓库中其他未提交工作。
