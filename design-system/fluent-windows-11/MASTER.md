# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Fluent Windows 11
**Generated:** 2026-11-01 18:40:43
**Category:** Productivity Tool
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 4/10 (Standard) | Density 6/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0D9488` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#14B8A6` | `--color-secondary` |
| On Secondary | `#0F172A` | `--color-on-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#134E4A` | `--color-card-foreground` |
| Muted | `#E8F1F4` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#99F6E4` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#0D9488` | `--color-ring` |

**Color Notes:** Teal focus + action orange [Accent adjusted from #F97316]

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** enterprise, saas, b2b, professional, indigo, modern, approachable, legible, ios dynamic type, android scaling
- **Google Fonts:** [Plus Jakarta Sans + Plus Jakarta Sans](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
```

### Spacing Variables

*Density: 6/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EA580C;
  color: #000000;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #134E4A;
  border: 2px solid #0D9488;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F0FDFA;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0D9488;
  outline: none;
  box-shadow: 0 0 0 3px #0D948820;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Flat Design

**Keywords:** 2D, minimalist, bold colors, no shadows, clean lines, simple shapes, typography-focused, modern, icon-heavy

**Best For:** Web apps, mobile apps, cross-platform, startup MVPs, user-friendly, SaaS, dashboards, corporate

**Key Effects:** No gradients/shadows, simple hover (color/opacity shift), fast loading, clean transitions (150-200ms ease), minimal icons

### Page Pattern

**Pattern Name:** Product Demo + Features

- **Conversion Strategy:** Use an interactive demo only when it explains value better than static media. Provide captions, transcript, visible play/pause controls, and a non-video fallback; do not autoplay under reduced motion. Pause media when offscreen or hidden and keep the final product state available as static content.
- **CTA Placement:** Video center + CTA right/bottom
- **Section Order:** Hero > Product video/mockup (center) > Feature breakdown per section > Comparison (optional) > CTA

---

## Motion

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger; Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Complex onboarding
- ❌ Slow performance

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Project Overrides（2026-11 · FLUENT UI REACT V9 / WINDOWS 11）

> 上方为 skill 通用生成；本项目按用户指定「microsoft/fluentui React v9 官方规范 + Windows 11 高级质感」做受控覆盖。实现在 `src/theme/fluent.ts`（FluentProvider 主题）+ `src/theme/index.ts` + `src/styles/index.css`，合同见 `redesign-brief/09-v7-fluent-win11.md`。

- **框架**：`@fluentui/react-components` v9.75 + `@fluentui/react-icons` v2.0.345 + `FluentProvider`（createLightTheme/createDarkTheme + Windows 11 品牌 ramp）。antd v5 继续承担既有数据组件（Table/Form/Modal/Upload 等），通过 antd theme + CSS 映射到 Fluent tokens，避免双组件体系。
- **材质（Mica）**：桌面 Bloom 壁纸 → 12px 圆角应用窗口（`backdrop-filter: blur(64px) saturate(150%)` + `rgba(243,243,243,.82)`）→ 内容层 `LayerFillColorDefault`（白 .55）→ Card 层（白 .78 + 1px 轮廓 + shadow2/4）。导航窗格 = Mica Alt（白 .34）；标题栏/命令栏 = Mica Alt（白 .34/.48）；浮层 = Acrylic（blur 30 + 白 .86）；对话框 = Mica 强层 + Smoke 遮罩。
- **Elevation（Windows 11 文档值）**：Layer 1 / Control 2 / Card 8 / Tooltip 16 / Flyout 32 / Dialog & Window 128；对应 Fluent shadow2/4/8/16/28/64，全部使用官方 token 数值，不发明投影。
- **Color（Fluent 2）**：`colorNeutralBackground1 #FFFFFF` / 2 `#FAFAFA` / 3 `#F5F5F5` / 4 `#F0F0F0`；foreground 1 `#242424` / 2 `#424242` / 3 `#616161` / 4 `#707070`；stroke 1 `#D1D1D1` / 2 `#E0E0E0`；品牌 Windows 11 强调蓝 `#0067C0`（hover `#005A9E`），暗色 `#60CDFF`；语义 danger `#C42B1C` / success `#0F7B0F` / warning `#9D5D00`。60-30-10，强调色只做 CTA/选中条/焦点。
- **Typography**：Segoe UI Variable Text/Display（Windows 系统）→ Selawik（OFL，非 Windows 平台的 Segoe 度量兼容回退）→ 中文 Microsoft YaHei UI/PingFang SC/Noto Sans CJK。Windows type ramp：caption 12/16、body 14/20、body strong 14/20 semibold、subtitle 20/28 semibold、title 28/36 semibold、title large 40/52、display 68/92；正文行长 50–60 字符；最小 12px regular / 14px semibold。
- **Geometry**：Fluent radius token：control 4/8、card 12（`borderRadius2XLarge`，按用户「12px 圆角」要求）、window/dialog 12、pill 999；1px 轮廓线。
- **Icons**：`@fluentui/react-icons`（Fluent System Icons / Segoe Fluent Icons 语义），Regular 线型，16/20/24，`fontSize` 控制；全站经 `src/components/common/icons.tsx` 映射，业务代码零改动。
- **Motion**：Fluent duration/curve：150–250ms；`curveEasyEase` / `curveDecelerateMid`；页面转场 200ms fade + 4px；reduced-motion 直接渲染终态。
- **Forbidden**：极光/玻璃内容卡、渐变霓虹、0 圆角、2px 硬边、硬投影、emoji 图标、12px 以下功能文字。
