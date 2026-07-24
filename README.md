# 计划与记录

一个简洁清爽的个人计划与打卡记录网页应用，采用现代 productivity dashboard 风格设计。

## 在线访问

已部署版本：

https://plan-record-x5d8.vercel.app

## 项目说明

「计划与记录」用于按周管理每日任务。页面包含周切换、七天完成度卡片、四类任务卡片、本周完成度趋势图和本周总结。

数据保存在浏览器 LocalStorage 中，不需要后端，也不需要登录注册。刷新网页后数据不会丢失；但不同浏览器、不同设备之间的数据不会自动同步。

## 主要功能

- 周一到周日七天计划视图
- 上一周、下一周、返回本周
- 点击日历图标选择任意日期，并自动跳转到该日期所在周
- 学习、锻炼、饮食、其他四类任务管理
- 添加、编辑、删除、勾选任务
- 完成任务后文字变灰并显示删除线
- 每日完成率、分类完成数、本周统计实时计算
- Recharts 本周完成度趋势折线图
- LocalStorage 本地持久化保存

## 技术栈

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React
- LocalStorage

## 本地运行

```bash
npm install
npm run dev
```

然后打开终端显示的本地地址，通常是：

```text
http://localhost:5173
```

## 构建

```bash
npm run build
```

构建后的文件会生成在 `dist` 目录。

## Vercel 部署设置

如果在 Vercel 重新导入或重新部署，使用以下配置：

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

## 数据保存说明

本项目目前使用 LocalStorage 保存数据：

- 同一个浏览器再次打开，记录仍然存在
- Chrome 和 Safari 的数据彼此独立
- 电脑和手机的数据彼此独立
- 如果需要跨设备同步，需要后续接入云端数据库
