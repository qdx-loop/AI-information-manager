---
name: 信息管理 · AI 智能信息管理助手
description: 青瓷般安静的蓝绿扁平系统——Antd 企业级骨架，中文优先，橙色只做注意力点缀
colors:
  primary: "#0D9488"
  primary-deep: "#134E4A"
  primary-wash: "#F0FDFA"
  primary-edge: "#99F6E4"
  primary-edge-soft: "#CCEBE6"
  accent-amber: "#FA8C16"
  accent-amber-wash: "#FFF7E6"
  status-active: "#3F8600"
  surface: "#FFFFFF"
  canvas: "#F5F5F5"
  night-kiln: "#141414"
  night-edge: "#303030"
  ink-strong: "#333333"
  ink-body: "#475569"
  ink-muted: "#94A3B8"
  ink-faint: "#999999"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.35
  title:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  md: "8px"
  sm: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.md}"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.md}"
---

# Design System: 信息管理（info-manager）

## Overview

**Creative North Star: 「青瓷工作台 · The Celadon Desk」**

整个系统像一件青瓷器：釉色是唯一的装饰，器形靠比例与留白立住。蓝绿主色 #0D9488 是那层「釉」——出现在按钮、选中态、链接与品牌块上；界面其余部分是素坯般的白与浅灰，靠发丝线（1px 边框）和色调分层区分层次，几乎不用投影。橙色 #FA8C16 是「窑火」，只许在需要注意力的地方短暂出现（置顶、焦点行、AI 修改 diff），绝不参与品牌表达。

这是典型的 Operate 型产品：用户每天在这里录数据、查数据、跟 AI 对话，扫读效率与状态可预期高于一切表达欲。信息密度中等偏紧凑（表格 density=middle，间距节拍 8/12/16/24），圆角统一 8px，没有戏剧化的视觉事件。

**Key Characteristics:**
- 单一强调色体系：蓝绿承担全部品牌与交互语义
- 扁平优先：深度靠色调分层 + 发丝线，阴影只在 Antd 反馈层出现
- 中文优先排版：拉丁字体只装饰数字与品牌名，中文回退链必须完整
- 深浅双主题：暗色用 #141414 底 + #303030 边，同一套语义

## Colors

一句话：一支青绿走天下，灰阶做骨，琥珀点睛。

### Primary
- **青瓷釉 Celadon Glaze** (#0D9488)：所有主动作——主按钮、链接、选中菜单项、AI 面板用户气泡、登录页品牌块。任何一屏中占比应 ≤10%。
- **深窑青 Deep Kiln Teal** (#134E4A)：浅青背景上的标题文字（登录页、管理后台），替代纯黑以保持色温一致。
- **青瓷粉底 Celadon Wash** (#F0FDFA)：全局布局底色与管理后台页面底色，让白色卡片浮出而不靠阴影。
- **釉边 Glaze Edge** (#99F6E4 / 柔和变体 #CCEBE6)：登录页分栏线、次级边框。#CCEBE6 是 Antd `colorBorderSecondary` 的既定值。

### Secondary
- **窑火琥珀 Kiln Amber** (#FA8C16)：注意力专用——表格焦点行左侧 3px 内嵌条、AI「修改」diff 高亮、3 天内到期标签。红色仅用于删除类危险操作（Antd danger 语义）。
- **琥珀底 Amber Wash** (#FFF7E6 / 置顶行变体 #FFFBE6)：焦点行与置顶行的底色，与琥珀条同族。
- **常青绿 Evergreen** (#3F8600)：「有效用户」等正向统计数字的文字色（比 Antd 默认 success 深两档以保证白底对比度）。

### Neutral
- **白瓷 Porcelain White** (#FFFFFF)：卡片、侧栏、表单区表面。
- **素坯 Blank Bisque** (#F5F5F5)：内容画布、assistant 气泡、次级表面。
- **夜窑 Night Kiln** (#141414) + **夜釉边 Night Edge** (#303030)：暗色主题的底与线。
- **墨阶 Ink Scale**：#333333（气泡正文）→ #475569（说明文字）→ #94A3B8(输入图标) → #999999（辅助注脚）。四档足够，不许再发明灰。

### Named Rules
**The One Glaze Rule.** 蓝绿是唯一的品牌色，负责一切「可点击/已选中」语义；想用新颜色时先问：是注意力场景（→琥珀）还是危险场景（→Antd 红），都不是就用墨阶。

**The Amber Discipline Rule.** 琥珀橙只表达三件事：行级焦点、内容被修改、临期提醒。它永远不作为按钮或链接的主色。

## Typography

**Display Font:** Plus Jakarta Sans（仅拉丁字符与数字）
**Body Font:** 系统中文链：-apple-system → PingFang SC → Hiragino Sans GB → Microsoft YaHei

**Character:** 几何人文的拉丁字体给数字和英文带来现代感；中文完全交给系统字体保证渲染速度与熟悉感——这是数据工具，不是杂志。

### Hierarchy
- **Display** (700, 32px, 1.35)：仅登录页左栏主标语。
- **Title** (700, 20px, 1.4)：页面级标题与管理后台卡片标题。
- **Body** (400, 14px, 1.6)：默认正文与表格单元格。
- **Label** (400, 12px, 1.5)：辅助说明、时间戳、表单 help、气泡元信息。

### Named Rules
**The System-CJK Rule.** 任何 font-family 必须携带完整中文回退链（至少 PingFang SC 与 Microsoft YaHei）；禁止为中文引入网络字体。

## Layout

桌面端：左侧 240px 可折叠导航（Sider），右侧 64px Header + 内容滚动区。内容内边距 16–24px，卡片间距 12px。移动端 ≤768px 时侧栏转为左侧 Drawer（260px），Header 左侧出现汉堡按钮。登录页 ≥900px 左右分栏（品牌区/表单区各半），之下隐藏品牌区。AI 助手为右侧 Drawer，桌面 460px、移动全屏。间距节拍取 4 的倍数：4 / 8 / 12 / 16 / 24。

## Elevation & Depth

扁平底色系。深度不靠阴影，靠三层手段：① 青瓷粉底或素坯画布上的纯白表面；② 1px 发丝线（亮 #F0F0F0 / 暗 #303030）；③ Antd 自带悬停反馈。唯一的结构性「阴影」是表格焦点行的 `inset 3px 0 0 #FA8C16` 内嵌条——它是标记不是光影。

### Named Rules
**The Hairline Rule.** 需要分隔时先加 1px 线，线不够再考虑色调差，最后才考虑阴影。禁止自创 box-shadow。

## Shapes

统一 8px 圆角贯穿按钮、卡片、输入框、弹窗；行级元素（模板编辑行）用 6px 小一号圆角形成层级差；头像与聊天气泡头像用正圆。边框语言：常态发丝线，悬停转主色，无粗描边。

## Components

组件全部基于 Antd v5，本系统通过 theme token 收编其默认外观；以下记录「收编后」的形态与自定义部件。

### Buttons
- **Shape:** 圆角 8px；主按钮实心青瓷釉白字，hover 由 Antd 自动加深
- **Secondary/Ghost:** 白底 + 默认发丝边；危险操作一律 Antd `danger` 红并配 Popconfirm
- **Icon Buttons:** 表格行操作用 type="link" 小号图标钮

### Cards / Containers
- **Corner Style:** 8px；白瓷底；管理后台整页铺青瓷粉底
- **Shadow Strategy:** 无常驻阴影
- **Internal Padding:** 卡片 16px，紧凑卡 12px

### Inputs / Fields
- **Style:** 白底、发丝线、8px 圆角；前缀图标用 ink-muted (#94A3B8)
- **Focus:** Antd 主色描边 + 淡青晕；**Error:** Antd 红描边 + 校验文案

### Navigation
- **Style:** Sider 内联菜单，选中项青瓷釉高亮；按分类两级 group；每行 ⋯ 下拉承载重命名/删除
- **Mobile:** Drawer 全高，底部固定「AI 助手 / 退出」按钮区，显示到期日与剩余天数标签

### Chat Bubbles (AI 助手签名组件)
- **User:** 实心青瓷釉底 + 白字，右对齐，圆形头像
- **Assistant:** 素坯底 + #333 字，左对齐；内嵌可折叠「思考过程」（灰）与「执行过程 N 步」（青）
- 消息内可点击的条目 chip（绿 Tag）跳转定位；撤回按钮为 12px link

### Status Tags
- **有效期:** 绿=正常（附剩余天数）、橙=≤3 天、红=已到期、灰=已停用；日期 `YYYY-MM-DD`
- **回收站类型:** 橙=管理库、绿=条目

## Do's and Don'ts

### Do:
- **Do** 用 #0D9488 表达一切可交互与已选中语义；新界面先铺墨阶，最后上釉。
- **Do** 时间戳统一 `YYYY-MM-DD HH:mm`（dayjs zh-cn）。
- **Do** 复用现有 token；确需新颜色先扩展本文件 frontmatter 再使用。
- **Do** 保持 ≤768px Drawer / ≥900px 登录分栏断点行为。

### Don't:
- **Don't** 为中文引入网络字体；Google Fonts 在目标市场不可靠。
- **Don't** 自创 box-shadow、渐变或新的强调色相（紫/蓝/粉一律拒绝）。
- **Don't** 让琥珀橙出现在按钮、链接或大面积背景上。
- **Don't** 绕过 Antd token 直接写死会破坏暗色主题的颜色（如给文字写死 #000）。
