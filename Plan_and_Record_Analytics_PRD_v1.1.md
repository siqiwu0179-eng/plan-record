# Plan & Record Analytics --- 轻量 PRD v1.1

## 1. 目标

为 Plan & Record 建立完整但轻量的数据分析系统。

**数据链路：Plan & Record → Event Tracking → Supabase → analytics.html**

当前主要为单用户使用，但指标体系按未来多用户产品设计。只展示真实数据，不生成模拟数据。

## 2. 核心指标

  ------------------------------------------------------------------------------------------------------
  模块                                指标
  ----------------------------------- ------------------------------------------------------------------
  用户                                DAU、WAU、MAU、新增用户、DAU/MAU

  留存                                D1 / D7 / D30 Retention、Churn Rate

  转化                                注册 → 首次创建任务 → 首次完成任务 → 7日后仍活跃

  Daily Plan                          创建任务数、完成任务数、任务完成率、活跃计划天数、人均完成任务数

  分类                                学习 / 锻炼 / 饮食 / 其他的任务数与完成率

  Long-term                           Goal数、Step数、Step完成率、Step → Daily转化率

  功能使用                            Daily / Long-term / Completion / Travel / Mood
                                      的使用人数、次数、Feature Adoption Rate

  趋势                                每日 / 周 / 月活跃、任务创建与完成趋势
  ------------------------------------------------------------------------------------------------------

**North Star Metric：Weekly Completed Tasks per Active
User（周活跃用户人均完成任务数）**

## 3. 埋点

至少支持：
`user_signed_up`、`user_logged_in`、`page_viewed`、`task_created`、`task_completed`、`task_deleted`、`task_carried_over`、`goal_created`、`longterm_step_created`、`longterm_step_completed`、`longterm_step_added_to_daily`、`mood_created`、`travel_created`。

事件至少记录：`event_name`、`user_id`、`timestamp`、`module`、`object_id`、`properties`。具体结构根据现有
Supabase 和业务表合理设计。

## 4. Analytics Dashboard

交付一个**完全独立的 `analytics.html` 文件**：

-   与 Plan & Record 用户端分离，不嵌入主产品，不创建 `/analytics`
    路由。
-   暂不部署，作为独立数据分析工具使用。
-   直接读取现有 Supabase 的真实数据。
-   支持时间范围筛选。
-   展示 KPI、活跃/任务趋势、Retention、Conversion
    Funnel、任务分类、Feature Adoption、Long-term 数据。
-   无数据时显示 `0` 或 `No data`，禁止模拟数据。
-   风格简洁、专业，与 Plan & Record 保持基本视觉一致。

## 5. 数据规则

-   Supabase 为统一数据源。
-   主产品负责产生埋点；`analytics.html` 只读取和展示，不修改业务数据。
-   优先利用现有业务数据计算历史指标；无法还原的指标从新埋点上线后统计。
-   数据结构按未来多用户产品设计。
-   不破坏现有业务表、登录、功能及历史数据。
