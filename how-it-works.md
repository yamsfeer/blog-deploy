# How It Works

`@yams/blog-deploy` 是一个 CLI 工具，命令名 `blog`。它的核心职责是：**从你本地的笔记仓库中挑选 Markdown 文章，搬运到一个独立的 GitHub Pages 部署仓库，由 GitHub Actions 自动构建并部署上线。**

这是一个"关注点分离"的设计 —— CLI 只负责"挑选和搬运文章"，部署仓库独立负责"构建和展示"。

---

## 发布文章时发生了什么？

执行 `blog publish` 后，分 6 个阶段：

### 阶段 1：扫描源目录

`scanner.ts` 递归读取当前目录所有 `.md` 文件，解析每篇文章的 YAML frontmatter（状态、标题、日期等）。

### 阶段 2：对比修改

`diff.ts` 对已标记为 `published` 的文章做 SHA256 哈希对比（只计算正文，排除 frontmatter），判断源文件和部署仓库中的版本是否一致，标记 `isModified` 状态。

### 阶段 3：选择文章

`selector.ts` 通过 `file-tree.ts` 提供交互式文件树选择器，用真实的文件系统树结构展示可发布的文章（draft + 已修改的 published 文章）：

- 文件夹支持折叠/展开（←→ 方向键）
- 文件夹有三态 checkbox：☐ 空 / ◐ 部分 / ☑ 全选
- Space 在文件夹上切换全选/全不选，在文件上切换单个选择
- Enter 确认，q 退出
- 支持 viewport 滚动，处理大量文件时不超出终端

### 阶段 4：更新 frontmatter

`frontmatter.ts` 写入每篇选中文章的元数据：

```yaml
status: published          # 标记为已发布
published_at: "2026-05-25" # 首次发布时间
updated_at: "2026-05-25"   # 最后更新时间
```

### 阶段 5：部署到 Git 仓库

`deploy.ts` 执行 Git 操作：

1. 验证部署路径存在且是 Git 仓库
2. 检查工作区是否干净（无未提交变更）
3. `git pull origin main` 拉取最新代码
4. **同步模板** — 将 CLI 内置的最新 `build.js`、HTML 模板、CSS、CI workflow 复制到部署仓库
5. **复制文件**到 `<deployPath>/posts/` — 扁平化存储，不保留原始目录结构
6. `git add` → `git commit` → `git push origin main`

### 阶段 6：GitHub Actions 自动构建

推送后，`.github/workflows/deploy.yml` 自动触发，调用 `build.js` 构建脚本：

- 用 **gray-matter** 解析 `posts/` 目录下的 Markdown 文件
- 用 **marked** 把 Markdown 转为 HTML
- 按日期倒序排列所有文章
- 生成三类页面（填入 HTML 模板的 `{{{变量}}}` 占位符）：
  - **文章详情页** — `_site/<slug>.html`
  - **文章列表页** — `_site/articles.html`（含搜索功能）
  - **首页** — `_site/index.html`（显示最近 5 篇）
- 复制静态资源（CSS、about.html）
- 上传 `_site/` 到 GitHub Pages

---

## Template 文件夹的作用

`template/` 目录是**部署仓库的初始模板**，供 `blog init` 创建新仓库时复制。同时，每次 `blog publish` / `blog unpublish` 时会自动将最新的 `build.js`、HTML 模板、CSS 和 CI workflow 同步到部署仓库，确保构建基础设施始终保持最新。

| 文件/目录 | 作用 |
|----------|------|
| `template/package.json` | 构建依赖（`gray-matter` + `marked`） |
| `template/build.js` | 静态站点构建脚本，把 Markdown 转 HTML |
| `template/posts/.gitkeep` | 空占位文件，确保 `posts/` 目录存在 |
| `template/template/index.html` | 首页模板，`{{{recent_articles}}}` 占位 |
| `template/template/post.html` | 文章详情模板，`{{{title}}}` `{{{content}}}` `{{{toc_links}}}` 占位 |
| `template/template/articles.html` | 文章列表模板，`{{{article_list}}}` 占位 |
| `template/template/about.html` | 关于页（纯静态） |
| `template/template/css/style.css` | 完整的 CSS 设计系统（暖色羊皮纸配色，630 行） |
| `template/.github/workflows/deploy.yml` | GitHub Actions 部署流水线 |

**关键设计点**：Template 文件在每次发布时自动同步，你修改 CLI 仓库的模板后下次发布即可生效。如需自定义模板样式，建议在部署仓库中创建备份后再修改。

---

## 整体架构

```
你的笔记仓库                   部署仓库                      线上博客
┌──────────────┐  blog publish   ┌────────────────┐  GitHub Actions   ┌──────────┐
│ tech/docker.md │ ───复制───→ │ posts/docker.md │ ───build.js──→ │ _site/   │
│ life/travel.md  │             │ posts/travel.md │                  │ Pages    │
│ idea/xxx.md     │             │ template/       │                  └──────────┘
└──────────────┘             │ .github/       │
                                   └────────────────┘
```

CLI 只管"搬运 .md 文件"，部署仓库管"怎么展示它们"。模板引擎很简单，就是用 `String.replaceAll()` 替换 `{{{变量名}}}` 占位符，没有引入重型模板库。

---

## 文章状态系统

| 状态 | frontmatter 条件 | 语义 | 发布列表中可见 |
|------|-----------------|------|:---:|
| `note` (未分类) | 无 frontmatter 或缺少 `status` | 普通笔记，从未被归类 | 否 |
| `idea` (想法) | `status: idea` | 明确标记为临时想法 | 否 |
| `draft` (草稿) | `status: draft` | 已写好，准备发布 | **是** |
| `published` (已发布) | `status: published` | 已经发布到线上 | 否（除非内容有修改）|

**状态转换流程**：

```
note ──→ draft ──→ published ──→ [编辑后标记为已修改] ──→ published
                  ↑                    ↑
                  │                    │
            blog draft           blog publish
            blog unpublish ──────┘
```

---

## CLI 命令一览

| 命令 | 作用 |
|------|------|
| `blog init --deploy <path>` | 初始化配置，指定部署仓库路径 |
| `blog list` | 列出文章，默认显示 draft + 已修改 |
| `blog list --all` | 显示全部文章 |
| `blog draft <files>` | 标记文章为草稿 |
| `blog idea <files>` | 标记文章为想法 |
| `blog publish` | 交互式多选发布 |
| `blog publish --all` | 一键发布所有 draft + 已修改 |
| `blog publish --last` | 快速发布最近修改的一篇 draft |
| `blog unpublish` | 下架文章（恢复为 draft） |

---

## 核心模块职责

| 模块 | 文件 | 核心职责 |
|------|------|---------|
| **index** | `src/index.ts` | CLI 入口，用 commander 注册所有子命令 |
| **config** | `src/config.ts` | 读写 `.blogrc` 配置文件 |
| **scanner** | `src/scanner.ts` | 递归扫描源目录 `.md` 文件 |
| **frontmatter** | `src/frontmatter.ts` | YAML frontmatter 解析/序列化/更新 |
| **deploy** | `src/deploy.ts` | 部署仓库 Git 操作（验证、pull、复制、commit、push） |
| **diff** | `src/diff.ts` | 正文 SHA256 哈希对比 |
| **selector** | `src/selector.ts` + `src/file-tree.ts` | 交互式文件树选择器（支持文件夹展开/折叠、三态 checkbox） |
| **renderer** | `src/renderer.ts` | 终端彩色表格输出 |
