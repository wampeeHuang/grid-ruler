---
name: grid-ruler
display_name: 网格标尺
category: 视觉与设计
description: |
  把"大一点/小一点、靠近一点/远一点"这类口头表达，换成确定的 px；把任意间距值吸附到 8 的倍数；
  检查 CSS/TSX 里的间距是否落在 8px 基准的尺子上。给的是数字和证据，不是审美判断。

  同一把尺子也做成了浏览器扩展（网格标尺）：人在页面上看见网格，Agent 在源码上算准数字。

  Use this skill when the user says: "这里加大一点", "再靠近一点", "这个间距是多少",
  "间距用 8 的倍数", "对齐到栅格", "看看这个页面/这段 CSS 的间距合不合规",
  "字号和间距心里没数", "帮我抠一下间距细节", "grid", "spacing scale", "8pt grid".

  Also trigger when: the user asks for a concrete pixel value to replace a vague adjective
  ("make it bigger", "tighter", "more breathing room"); when a layout needs auditing against a
  spacing scale; when a design review turns into "how many px exactly?".
---

# grid-ruler · 网格标尺

> 抠细节时，人和 Agent 缺的不是审美，是**同一把尺子**。
> 人看到的是网格覆盖层，Agent 拿到的是数字——两边读同一个 `scale.json`，才不会各说各的。

## 这样能解决什么

| 人说的话 | 没有尺子时 | 有尺子时（本技能的输出） |
| --- | --- | --- |
| 「这里加大一点」 | Agent 猜 4px 或 10px | `24px -> 32px（+8，即 +1 个 8 的档）` |
| 「再靠近一点」 | Agent 改 6px，还没对齐 | `48px -> 40px（-8）` |
| 「这间距合适吗」 | 「看起来还行」 | `20px 不在 8 的倍数上，最近的档是 16 或 24` |
| 「页面整体节奏对不对」 | 无从判断 | 按 8 / 32 / 128 三档报告分布 |

## 尺子（唯一真相源）

基准 **8px**，档位 `8 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128 / 160 / 192 / 256`。

| 档 | 角色 | 用途 |
| --- | --- | --- |
| 8 | 细 | 最细粒度，元素对齐用 |
| 32 | 中 | 组件内间距、栅格半格 |
| 128 | 大 | 版面分区、整屏节奏 |

定义在仓库根的 `scale.json`。浏览器扩展的 `content.js` 里的三个常量**由它生成**（`test/gen-scale.js`），
两边漂移会被检查器拦下——不要手改 `content.js` 的 `@scale:begin/@scale:end` 区间。

## 怎么用

脚本就在本技能目录里（`bin/grid.js` + `../scale.json` 升一级在仓库根，见下方「文件构成」），
纯 Node、零依赖、不需要装包。**下例用 `$SKILL` 占位技能目录**，执行时替换成你自己的绝对路径即可：

```bash
SKILL=/path/to/grid-ruler/skill            # 本机：D:\agent-skills\skills\grid-ruler

# 1) 口头表达 -> 确定 px（最常用）
node "$SKILL/bin/grid.js" nudge --from 24 --to 大一点
#    「大一点」：24px -> 32px（+8，即 +1 个 8 的档）
#    别的可选：32 / 40 / 48px

# 2) 任意值吸附到尺子
node "$SKILL/bin/grid.js" snap 20 13 4.5
#    20 -> 16px（-4）    13 -> 16px（+3）    4.5 -> 8px（+3.5）

# 3) 检查文件里的间距是否在尺子上
node "$SKILL/bin/grid.js" check src/app.css src/Card.tsx
#    3 个间距值，1 个不在 8 的倍数上
#      src/app.css:2 margin: 60px -> 64px（+4）

# 4) 打印档位表
node "$SKILL/bin/grid.js" scale
```

所有子命令都支持 `--json`，给需要机器读的场景用。

## 文件构成

| 文件 | 作用 |
| --- | --- |
| `SKILL.md` | 本文件：尺子定义、命令用法、边界 |
| `bin/grid.js` | 换算脚本，无依赖 |
| `bin/scale.json` | **唯一真相源**：基准、档位、口头表达词表（与脚本同目录） |

**本技能是自足的**：这三个文件复制到任何地方都能跑，脚本按 `__dirname/scale.json` 找尺子，
缺了会明确报错而不是用默认值瞎算。浏览器扩展不在包内——它从**同一份** `bin/scale.json` 生成
（扩展仓库里 `test/gen-scale.js`，漂移会被拦），所以人和 Agent 用的永远是同一把尺子。


## 支持的表达

会先查 `scale.json` 的 `aliases`，命中就用它的档位；没命中会报错并列出可用词，不会瞎猜。
已收录：`大一点 / 大一些 / 大很多 / 稍大 / 稍微大一点 / 小一点 / 小一些 / 小很多 / 稍小 / 稍微小一点 / 靠近一点 / 紧一点 / 紧凑一点 / 再靠近一点 / 远一点 / 松一点 / 疏一点 / 再远一点`。

## 能力边界（诚实边界）

| 边界 | 说明 |
| --- | --- |
| **看不见渲染结果** | 本技能只算数、只读源码。页面上实际占了多少像素，要靠浏览器扩展（人看）或你自己读代码。**不要声称"我看了你的页面"**。 |
| **不做审美判断** | 它只说"20 不在尺子上，最近是 16 或 24"，不说哪个好看。选哪个由人和设计意图定。 |
| **不自动改代码** | `check` 只报告不修改。要改由你按报告动手，或问过用户再改。 |
| **不改动尺子** | 不允许为了迁就某个值去改 `scale.json`。尺子变了，历史判断全部失效。用户明确要求换基准时才动，并说明影响。 |
| **8 不是普适真理** | 8px 基准适合界面间距；4px 基准（物料密度更高）或 10px（部分移动端）也常见。用户的项目已有既定基准时，先问，不要覆盖。 |

## 和浏览器扩展的分工

| | 浏览器扩展（给人） | 本技能（给 Agent） |
| --- | --- | --- |
| 输入 | 当前页面的真实渲染 | 源码 / 用户的描述 |
| 输出 | 屏幕上的网格与像素刻度 | 确定的 px 数字与偏差 |
| 何时用 | 目测"这里是不是大了" | "到底大多少"、"改成多少" |

两者读同一份 `scale.json`。扩展见 `D:\workspace\grid-ruler`（Chrome MV3，`chrome://extensions` 加载已解压），
工具栏图标或 `Alt+Shift+G` 开关。
