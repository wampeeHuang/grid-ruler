# grid-ruler — Agent 规则

## 用途

Chrome 扩展：一键开关网页半透明网格覆盖层，参考字体大小与间距

## 边界

- 持久工作必须保留在本项目根内。
- 扩展根目录禁止任何 `_` 开头的一级项（`_runtime` 等）——Chrome 加载扩展直接拒绝。测试产物放根内 `test/`（已 gitignore）。
- 增加一级入口前，先勘察现有结构。
- 除非当前工作确实需要，否则不要创建运行、输出、归档或文档目录。
- 保留框架所有路径和用户改动。

## 检查

改动 `content.js` 后必须跑 `python test/verify_final.py`（Playwright 无头：面板几何 + DOM 断言 + 像素采样），通过输出「ALL REQUIREMENTS PASS」。按需再跑：`python test/check_corners.py`（圆角 alpha 轮廓）、`python test/check_bookmarklet.py`（书签路径冒烟，改完 `bookmarklet.txt` 后必跑）。
