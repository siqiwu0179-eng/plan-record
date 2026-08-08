# 计划与记录

一个基于 React、TypeScript、Tailwind CSS、Recharts 和 Lucide React 的本地计划记录 dashboard。

## 功能

- 周切换、返回本周
- 周一到周日七天完成度卡片
- 学习、锻炼、饮食、其他四类任务管理
- 添加、编辑、删除、勾选任务
- 每日完成率、分类完成数、本周统计实时计算
- Recharts 本周完成度趋势折线图
- LocalStorage 本地保存，刷新后数据不丢失

## 运行

```bash
npm install
npm run dev
```

打开终端提示的本地地址即可查看页面。

## 直接打开版本

如果不想启动本地服务，可以直接打开：

```text
dist/计划与记录-直接打开.html
```

这个文件已经内嵌页面所需的样式和脚本，不依赖 `localhost:5173`。

## 构建

```bash
npm run build
```
