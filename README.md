# blog-deploy 设计文档

## 一、概述

`blog` 是一个 Node.js CLI 工具，用于管理 Markdown 笔记文件夹中文章的发布流程。用户在其本地笔记目录中选择要发布的文章，CLI 将选中文章推送到一个独立的 GitHub 部署仓库，由 GitHub Actions 自动构建并部署到 GitHub Pages。

### 核心架构

```
用户的笔记目录 (源目录)                    部署仓库 (本地 clone)
┌──────────────────────────┐              ┌──────────────────────────────┐
│ ~/my-notes/              │   publish     │ ~/blog-deploy-repo/          │
│ ├── tech/                │  ───────→    │ ├── posts/     ← 扁平化存放  │
│ │   ├── docker.md        │   复制文件     │ │   ├── docker.md            │
│ │   └── go-routine.md    │              │ │   └── go-routine.md         │
│ ├── life/                │              │ ├── template/  ← HTML 模板    │
│ │   └── travel.md        │              │ │   ├── article.html          │
│ ├── ideas/               │              │ │   ├── index.html            │
│ │   └── random.md        │              │ │   ├── articles.html         │
│ └── .blogrc              │              │ │   ├── about.html            │
└──────────────────────────┘              │ │   └── css/style.css         │
                                          │ ├── build.js    ← 构建脚本    │
                                          │ └── .github/workflows/       │
                                          │     └── deploy.yml            │
                                          └──────────────────────────────┘
                                                     │  git push 触发
                                                     ▼
                                             GitHub Actions → GitHub Pages
```

### 职责边界

| 组件 | 职责 |
|------|------|
| **blog CLI** | 扫描源目录、管理 frontmatter、选择文章、搬运文件到部署仓库、git commit & push |
| **部署仓库** | 接受推送来的 markdown、通过 GitHub Actions 运行 build.js 生成静态站点、部署到 GitHub Pages |
| **GitHub Actions** | 触发 build.js、上传产物、部署到 Pages |

---

## 二、文章状态系统

### 四种状态

| 状态 | frontmatter 中 | 语义 | 出现在发布列表中 |
|------|---------------|------|:---:|
| **note (未分类)** | 无 frontmatter 或缺少 `status` 字段 | 普通笔记，从未被归类 | 否 |
| **idea (想法)** | `status: idea` | 明确标记为一时的想法，不参与发布 | 否 |
| **draft (草稿)** | `status: draft` | 已写好，准备发布 | **是** |
| **published (已发布)** | `status: published` + `published_at` | 已经发布到线上 | 否（除非内容有修改）|

### 状态转换

```
        (无 frontmatter)
             │
             ▼
          [note] ──── blog draft ────→ [draft]
                                        │
                                        │ blog publish
                                        ▼
                                     [published] ── blog unpublish ──→ [draft]
                                        │
                                        │ 编辑内容后
                                        ▼
                                     [已修改]
                                        │
                                        │ blog publish (重新发布)
                                        ▼
                                     [published]

  [note] ──── blog idea ────→ [idea]
```

### 关键设计原则

1. **没有 frontmatter 不等于草稿**。只有用户主动标记为 `draft` 的文章才纳入发布候选列表。
2. 初始状态下所有文章都是 `note`，`blog publish` 选择界面为空，用户需要手动把想发的文章标记为 `draft`。
3. `blog publish` 成功后，CLI 自动更新源文件的 frontmatter（添加/修改 `status: published` 和 `published_at`）。
4. `blog unpublish` 后，CLI 自动将源文件的 `status` 改回 `draft` 并移除 `published_at`。
5. `blog list` 会对比源文件内容与部署仓库中同名文件的内容，如果 `status: published` 但内容不一致，标记为 `[已修改]`。

---

## 三、Frontmatter 规范

每篇 Markdown 文件的 YAML frontmatter 格式：

```markdown
---
title: 文章标题
date: 2024-01-15
status: draft
---
正文内容...
```

| 字段 | 必需 | 类型 | 说明 |
|------|:---:|------|------|
| `title` | 否 | string | 文章标题，未提供时取文件名 |
| `date` | 否 | string (YYYY-MM-DD) | 文章日期 |
| `status` | 否 | `'draft'` \| `'published'` \| `'idea'` | 发布状态，缺失则视为 note |
| `published_at` | 否 | string (ISO 8601) | 首次发布时间，CLI 自动维护 |
| `updated_at` | 否 | string (ISO 8601) | 最后更新时间，CLI 自动维护 |

### CLI 对 frontmatter 的维护规则

| 操作 | frontmatter 变更 |
|------|-----------------|
| `blog draft <file>` | 添加/修改 `status: draft`，提取已有标题/日期 |
| `blog idea <file>` | 添加/修改 `status: idea` |
| `blog publish` | `status` → `published`；添加/更新 `published_at` 和 `updated_at` |
| `blog unpublish` | `status` → `draft`；移除 `published_at`，保留 `updated_at` |

**重要**：如果源文件原本没有 frontmatter，CLI 会在文件顶部自动添加完整的 frontmatter 块（`---\n...\n---\n\n`），保留原有正文内容不变。

---

## 四、命令参考

### 初始化

```bash
blog init --deploy <本地部署仓库路径>
```

- 在**当前目录**（源目录）创建 `.blogrc` 配置文件
- `.blogrc` 内容示例：
  ```json
  {
    "deployPath": "/Users/xxx/blog-deploy-repo"
  }
  ```

### 状态查看

```bash
blog list                # 精简模式：仅显示需要关注的（draft + 已修改）
blog list --all          # 全量显示（含已发布、idea、note）
blog list --published    # 只看已发布的
blog list --draft        # 只看草稿
blog list --modified     # 只看内容有修改的
blog list --idea         # 只看想法
```

精简模式输出示例：
```
状态        标题                              文件
────────────────────────────────────────────────────────
[草稿]      Docker 入门指南                    tech/docker.md
[草稿]      Go 协程调度原理                    tech/go-routine.md
[已修改]    PostgreSQL 索引优化                db/postgres.md
[草稿]      北海道游记                        life/travel.md

────────────────────────────────────────────────────────
已发布: 45 (正常) | 草稿: 3 | 已修改: 1 | 想法: 12 | 未分类: 87
```

### 标记草稿

```bash
blog draft <文件路径>        # 标记一篇为草稿
blog draft <文件路径>...     # 标记多篇
blog draft --interactive     # 交互式选择标记
```

行为：
- 如果文件无 frontmatter，自动生成（title 从文件名推断，date 用文件修改时间）
- 如果有 frontmatter 但 status 不是 draft，修改为 draft
- 如果已是 draft，无操作

### 标记想法

```bash
blog idea <文件路径>
```

行为：添加/修改 `status: idea`，明确排除出发布流程。

### 发布文章

```bash
blog publish                    # 交互式多选（默认模式）
blog publish --all              # 一键发布所有 draft + 已修改
blog publish --last             # 快速发布最近修改过的那篇 draft
blog publish <文件路径>...      # 直接指定文件
```

**交互式多选界面**（保持目录树结构）：

```
$ blog publish

? 选择要发布的文章 (空格选中/取消，方向键移动，回车确认):

 └─ 📁 tech/
 │  ├─ ☐ Docker 入门指南.md              [草稿]
 │  ├─ ☐ Go 协程调度原理.md               [草稿]
 │  └─ ☐ PostgreSQL 索引优化.md           [已修改]
 └─ 📁 life/
 │  └─ ☐ 北海道游记.md                    [草稿]
 └─ 📁 ideas/
    └─ ☐ 碎碎念.md                        [想法] ← 灰色，不可选

已选: 0 篇
```

**执行流程**（见第五节详情）。

### 下架文章

```bash
blog unpublish                  # 交互式多选（只列出已发布的）
blog unpublish <文件路径>...
```

交互式界面：
```
$ blog unpublish

? 选择要下架的文章:

 └─ ☐ Docker 入门指南.md                 2024-03-15 发布
 └─ ☐ Go 协程调度原理.md                 2024-02-01 发布
```

---

## 五、核心命令执行流程

### 5.1 blog publish 完整流程

```
blog publish (用户选中文件: tech/docker.md, life/travel.md)

步骤 1：读取并更新源文件 frontmatter
  ├─ 读取 ~/my-notes/tech/docker.md 的 frontmatter
  │   ├─ frontmatter 存在 → 修改 status 为 "published"
  │   ├─ 添加 published_at: "2025-05-25T10:30:00+08:00"
  │   └─ 添加/更新 updated_at: "2025-05-25T10:30:00+08:00"
  ├─ 将更新后的完整内容写回源文件
  │
  ├─ 对 ~/my-notes/life/travel.md 重复上述操作
  └─ ✅ 所有源文件 frontmatter 已更新

步骤 2：检查部署仓库状态
  ├─ 检查 <deployPath> 是否存在
  │   ├─ 不存在 → 报错：请先 clone 部署仓库
  │   └─ 存在 → 继续
  ├─ cd <deployPath>
  ├─ git status --porcelain  ← 检查是否有未提交的变更
  │   ├─ 有未提交变更 → 报错：请先处理部署仓库中的变更
  │   └─ 干净 → 继续
  └─ git pull origin main  ← 拉取最新

步骤 3：复制文件到部署仓库
  ├─ 对每个选中的文件：
  │   ├─ 源文件路径: ~/my-notes/tech/docker.md
  │   ├─ 目标路径:   <deployPath>/posts/docker.md
  │   │              (扁平化：只取文件名，不保留源目录结构)
  │   ├─ 检查目标目录 posts/ 是否存在，不存在则创建
  │   ├─ 如果目标已存在同名文件 → 覆盖
  │   └─ fs.copyFileSync(source, target)
  └─ ✅ 文件已复制

步骤 4：提交并推送
  ├─ cd <deployPath>
  ├─ git add posts/docker.md posts/travel.md
  ├─ git commit -m "publish: 2 articles — Docker 入门指南, 北海道游记"
  └─ git push origin main
      └─ ✅ 推送成功，GitHub Actions 将自动触发构建

完成输出：
  ✅ 已发布 2 篇文章：
     • tech/docker.md → Docker 入门指南
     • life/travel.md → 北海道游记
  部署将在几分钟内自动上线。
```

### 5.2 blog unpublish 完整流程

```
blog unpublish (用户选中: tech/docker.md)

步骤 1：读取源文件，修改 frontmatter
  ├─ 读取 ~/my-notes/tech/docker.md
  ├─ 修改 frontmatter：
  │   ├─ status: "published" → "draft"
  │   └─ 移除 published_at 字段
  └─ 写回源文件

步骤 2：检查部署仓库
  └─ (同 publish 步骤 2)

步骤 3：从部署仓库删除文件
  ├─ cd <deployPath>
  ├─ 检查 posts/docker.md 是否存在
  │   ├─ 存在 → git rm posts/docker.md
  │   └─ 不存在 → 跳过（仅更新源文件即可）
  └─ ✅

步骤 4：提交并推送
  ├─ git commit -m "unpublish: Docker 入门指南"
  └─ git push origin main

完成输出：
  ✅ 已下架 1 篇文章：Docker 入门指南
```

### 5.3 blog list 完整流程

```
blog list

步骤 1：扫描源目录
  ├─ 递归扫描源目录下所有 .md 文件
  ├─ 对每个 .md 文件，读取并解析 frontmatter
  │   ├─ 无 frontmatter 或 无 status → 归类为 note (未分类)
  │   ├─ status: "idea"    → 归类为 idea
  │   ├─ status: "draft"   → 归类为 draft
  │   └─ status: "published" → 归类为 published
  └─ 构建源文件状态列表

步骤 2：对比部署仓库（仅对 published 文件）
  ├─ 对每个 status: published 的文件：
  │   ├─ 检查 <deployPath>/posts/<文件名>.md 是否存在
  │   │   ├─ 不存在 → 标记为 [已修改]（被意外删除或从未实际推送）
  │   │   └─ 存在 → 对比内容 hash
  │   │       ├─ hash 相同 → 保持 [已发布]
  │   │       └─ hash 不同 → 标记为 [已修改]
  │   └─
  └─ ✅

步骤 3：格式化输出
  └─ 按状态分组，以表格形式展示
```

### 5.4 修改检测的具体实现

```
对比源文件与部署仓库中同名文件：

1. 对源文件内容计算 SHA256 hash（排除 frontmatter 后的正文部分）
2. 对部署仓库中同名文件计算 SHA256 hash（同样排除 frontmatter 后的正文部分）
3. 两个 hash 不同 → 标记为 [已修改]

注意：部署仓库中的文件已被 CLI 在 publish 时覆盖写入，
所以部署仓库中的文件内容 = 上次发布时的源文件内容。
因此 hash 不同 = 源文件在上次发布后又被修改过。
```

---

## 六、部署仓库结构

部署仓库是一个独立的 Git 仓库（如 `github.com/<user>/blog-deploy`），包含构建博客所需的一切。

```text
blog-deploy-repo/
├── posts/                        # ← blog CLI 推送的 markdown（扁平化）
│   ├── docker.md
│   ├── go-routine.md
│   └── postgres-optimization.md
├── template/                     # ← HTML 模板（静态，不随文章变化）
│   ├── post.html                 #   文章详情页模板
│   ├── index.html                #   首页模板
│   ├── articles.html             #   文章列表页模板
│   ├── about.html                #   关于页（静态）
│   └── css/
│       └── style.css             #   样式表
├── build.js                      # 构建脚本
├── package.json                  # 构建依赖 (gray-matter, marked)
└── .github/
    └── workflows/
        └── deploy.yml            # GitHub Actions 部署配置
```

**注意**：`template/` 和 `.github/` 目录是部署仓库自带的，blog CLI **不会**修改它们。CLI 只操作 `posts/` 目录。

### build.js 构建逻辑

```
posts/*.md ──┐
             │
             ├─ 1. 读取并解析每个 .md 文件的 frontmatter
             ├─ 2. 将 markdown 正文转换为 HTML
             ├─ 3. 按日期倒序排列
             ├─ 4. 生成每篇文章的详情页 (_site/<slug>.html)
             │     - 将 HTML 内容填入 template/post.html 的 {{{content}}} 占位符
             │     - 替换 {{{title}}}、{{{date}}} 等变量
             ├─ 5. 生成文章列表页 (_site/articles.html)
             ├─ 6. 生成首页 (_site/index.html)
             │     - 列出最近 N 篇文章
             ├─ 7. 复制静态资源 (CSS, about.html)
             └─ 8. 生成搜索索引 (JSON)
                      │
                      ▼
                 _site/  ← 部署到 GitHub Pages
```

### GitHub Actions 工作流 (deploy.yml)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      
      - name: Build site
        run: node build.js
      
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site/
      
      - uses: actions/deploy-pages@v4
```

### 为什么部署仓库有 template/ 而 CLI 只管 posts/

这是刻意分离的关注点：

- **CLI**：只管"哪些文章要发"，只搬运 .md 文件
- **部署仓库**：管"文章怎么展示"，控制模板、样式、构建逻辑

这样你可以独立更新博客样式，而不需要更新 CLI 工具。反之亦然。

---

## 七、禁止重复发布检测

`blog publish` 执行时需检查以下情况：

| 情况 | 行为 |
|------|------|
| 选中的文件中有 `published` 且内容未修改 | 自动排除，不重复发布 |
| 选中的文件中有 `published` 且内容有修改 | 重新发布（更新 `updated_at`） |
| 选中的文件中有 `draft` | 正常发布 |
| 选中的文件中有 `idea` | 交互界面中不可选 |
| 部署仓库中有同名文件但内容不同（不应该出现） | 覆盖，以源文件为准 |

---

## 八、错误处理

| 错误场景 | 处理 |
|---------|------|
| 当前目录无 `.blogrc` | 提示先执行 `blog init` |
| `.blogrc` 中指定的 `deployPath` 不存在 | 提示去 clone 部署仓库 |
| 部署仓库有未提交的变更 | 拒绝操作，提示先处理 |
| 部署仓库网络操作失败 (pull/push) | 显示 git 错误信息，终止操作 |
| 文件写入失败（权限问题） | 显示错误并跳过该文件 |
| 选中 0 个文件确认发布 | 提示"未选择任何文章"并退出 |
| push 失败（冲突） | 提示手动处理：`cd <deployPath> && git pull --rebase` |

---

## 九、交互界面技术选型

使用 `prompts` 库实现交互式多选：

```
npm install prompts
```

特性：
- 支持多选 (multiselect)
- 支持单选
- 支持分组/树形展示
- 支持搜索/过滤
- 方向键导航、空格选中、回车确认

---

## 十、使用场景示例

### 首次使用

```
$ cd ~/my-notes
$ blog init --deploy ~/blog-deploy-repo
  ✅ 已创建 .blogrc

$ blog list
  已发布: 0 | 草稿: 0 | 已修改: 0 | 想法: 0 | 未分类: 312

$ blog draft tech/docker.md
  ✅ 已标记为草稿：tech/docker.md

$ blog publish
  → 选择 docker.md → 回车
  ✅ 已发布 1 篇文章：Docker 入门指南

$ blog list --all
  [已发布] Docker 入门指南
  [未分类] ... (311 篇)
```

### 日常发布

```
$ cd ~/my-notes

$ blog list
  [草稿]      Go 协程调度原理
  [草稿]      Kubernetes 调度器实战
  [草稿]      北海道游记
  ────────────────────────
  已发布: 45 (正常) | 草稿: 3

$ blog publish
  → 全选 → 回车
  ✅ 已发布 3 篇文章
```

### 修改后重新发布

```
$ vim tech/docker.md   # 编辑已发布的文章

$ blog list
  [已修改]    Docker 入门指南    ← CLI 检测到内容变化

$ blog publish
  → 选中 docker.md → 回车
  ✅ 已重新发布 1 篇文章：Docker 入门指南
```

### 下架旧文章

```
$ blog unpublish
  → 选中不再需要的文章 → 回车
  ✅ 已下架 2 篇文章
```

---

## 十一、项目结构（CLI 工具本身）

```
blog-deploy/                          ← npm 包项目
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                      # CLI 入口，注册命令
│   ├── config.ts                     # .blogrc 读取与写入
│   ├── scanner.ts                    # 扫描源目录，枚举 .md 文件
│   ├── frontmatter.ts               # frontmatter 解析、更新、写入
│   ├── deploy.ts                     # 部署仓库操作：复制文件、git 操作
│   ├── diff.ts                       # 文件内容对比（hash）
│   ├── renderer.ts                   # 终端输出格式化
│   ├── selector.ts                   # 交互式多选界面（基于 prompts）
│   └── commands/
│       ├── init.ts                   # blog init
│       ├── list.ts                   # blog list
│       ├── draft.ts                  # blog draft
│       ├── idea.ts                   # blog idea
│       ├── publish.ts                # blog publish
│       └── unpublish.ts              # blog unpublish
└── template/                         # 供 init 时复制到部署仓库的初始模板
    ├── post.html
    ├── index.html
    ├── articles.html
    ├── about.html
    ├── css/
    │   └── style.css
    ├── build.js
    ├── package.json
    └── .github/
        └── workflows/
            └── deploy.yml
```

其中 `template/` 目录下的文件在新用户 `blog init` 时作为初始模板复制到部署仓库。用户后续可以自行修改部署仓库中的模板和样式，不影响 CLI 的使用。

---

*最后更新: 2026-05-25*
