# Git 分支管理最优方案 — 跨项目复用

**日期**：2026-03-20
**方法**：派对模式（多视角专家讨论）+ Codex 外部验证
**参与**：李明远（架构师）、张晓峰（开发者）、陈思琪（分析师）、许创新（创新者）+ Codex gpt-5.4

---

## 背景：当前状态诊断

本次讨论由这个项目的 Git 历史混乱触发：
- `refactor/ai-provider-vercel-sdk` 被当作第二条主线（直接塞了 8 个提交）
- `main` 积压 8 个提交未合并
- PR #4 的 base 指向 refactor 而非 main

整改已完成（PR #5 + PR #4 合并 → main 追上来），本次 brainstorm 目的是确立可复用的长期方案。

---

## 三种策略对比

| 策略 | 核心结构 | 适合场景 | 复杂度 |
|------|---------|---------|--------|
| **GitHub Flow** | `main` + 短命 `feat/fix` | Web/SaaS、持续部署、小团队 | ⭐ 最低 |
| **Git Flow** | `main` + `develop` + `feature/release/hotfix` | 版本化软件（需同时维护多个版本） | ⭐⭐⭐ 高 |
| **Trunk-Based** | 单 `main`，功能标志隐藏 | 大团队（50+）、成熟 CI/CD + Feature Flags | ⭐⭐ 中 |

---

## 三方讨论综合结论

### Claude 多代理 vs Codex 对比

| 评估维度 | Claude 讨论 | Codex（搜索验证） | 共识 |
|----------|------------|------------------|------|
| 默认策略 | GitHub Flow | GitHub Flow | ✅ 完全一致 |
| npm 库策略 | → Git Flow | → GitHub Flow + tag（除非真需要多版本） | Codex 更保守，更合理 |
| pre-push hook | 值得做 | 值得做，但远端 Branch Protection 更重要 | Codex 补充了关键层 |
| commit-msg hook | 可全局强制 | 仅 semantic-release 仓库启用 | Codex 更宽松，更合理 |
| 模板仓库 | 可选加速器 | 仅做初始化，不做规则真相源 | 基本一致 |

### Codex 独有新见解

1. **GitHub Branch Protection / Rulesets** — 本地 hook 可被 `--no-verify` 绕过，远端保护才是真约束
2. **npm 库不需要 Git Flow** — `main + tag` 就够了，除非真需要同时维护多个已发布版本
3. **commit-msg 不要全局强制** — 只有使用 `semantic-release` 自动发版的仓库才需要
4. **6 个潜在坑**（最危险→最轻微）：
   - 把 Git Flow 当默认 → Web 项目过重，长期厌烦，规则形同虚设
   - 决策树写太复杂 → AI 和人都会误判
   - 只靠本地 hook → 换机器会丢，可 `--no-verify` 绕过
   - npm 包过早引入 release/hotfix 分支 → 个人库根本不需要
   - 模板仓库承载过多逻辑 → 后续升级所有仓库会很痛
   - 项目级覆盖没有明确入口 → AI agent 选错流程

---

## 最优解：四层防护结构

```
第一层：全局 CLAUDE.md 决策树      ← 默认策略，AI 自动执行
第二层：项目 CLAUDE.md 单行覆盖    ← 例外情况，项目级声明
第三层：全局 pre-push git hook     ← 本地兜底，防手滑
第四层：GitHub Branch Protection   ← 远端强制，真约束（绕不过）
```

缺少任何一层的风险：
- 缺第一层：每次开发都要想策略，容易出错
- 缺第二层：所有项目只能用同一套策略
- 缺第三层：手滑直接 push 到 main 没有拦截
- 缺第四层：本地 hook 可被绕过，策略不可靠

---

## 决策框架（一句话版）

```
Web App / SaaS / 脚本 / 内部工具 → GitHub Flow（默认）
npm 库 / CLI / 工具包             → GitHub Flow + tag（不需要多版本维护时）
需要同时维护多个已发布版本         → Git Flow
大团队 + 成熟 CI + Feature Flags  → Trunk-Based
```

---

## 可直接复用的配置

### 1. 全局 CLAUDE.md Git 章节（直接替换）

```markdown
## Git 分支管理（强制）

> **铁律：任何代码改动，无论大小，都必须在独立分支上完成，通过 PR 合并，禁止直接向任何长期分支 push commits。**

### 默认策略：GitHub Flow

除非项目 CLAUDE.md 另有声明，所有项目使用 GitHub Flow：
- `main` 是唯一长期分支，永远保持可部署状态
- 所有开发从 `main` 拉出短命分支（feat/、fix/、chore/、docs/、refactor/）
- 完成后开 PR，合并方式优先 squash merge
- 合并后立即删除分支

### 策略决策规则

使用 GitHub Flow 当：
- 项目是 Web App、SaaS、内部工具、脚本或服务
- 持续部署，不需要维护多个发布版本

使用 Git Flow 仅当以下条件**全部成立**：
- 项目是 npm 库 / CLI / SDK / 有版本生命周期的软件
- 需要同时维护多个已发布版本（1.x 和 2.x 并行）
- 需要 release 分支、hotfix 分支或回补补丁

使用 Trunk-Based 仅当：
- 团队规模大或提交频率非常高
- CI 快速稳定
- 有 Feature Flags 基础设施

### 防护规则
- 永远不直接 push 到 main，除非用户明确要求
- 如果不确定，选 GitHub Flow
- 如果项目 CLAUDE.md 有分支规则，以项目级规则为准
```

### 2. 项目级 CLAUDE.md 覆盖模板

**Web App 项目**（可省略，是默认）：
```markdown
## Branch Strategy Override
This project uses GitHub Flow.
All work should be done on short-lived branches from `main`.
```

**npm 库（不维护旧版本）**：
```markdown
## Branch Strategy Override
This project uses GitHub Flow with semantic version tags.
Do not use Git Flow unless explicitly asked for release branch maintenance.
```

**需要多版本维护的库/CLI**：
```markdown
## Branch Strategy Override
This project uses Git Flow.
Use `develop` for integration, `release/*` for releases, `hotfix/*` for urgent production fixes.
```

### 3. 全局 pre-push hook（Windows PowerShell）

文件位置：`~/.githooks/pre-push`（或 `~/.config/git/hooks/pre-push`）

```bash
#!/bin/bash
# 阻止直接 push 到 main/master
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
  echo "❌ 不允许直接 push 到 $current_branch，请通过 PR 合并。"
  echo "   如果确实需要，请用 git push --no-verify"
  exit 1
fi
```

启用命令：
```bash
mkdir -p ~/.githooks
# 保存上面的 bash 脚本到 ~/.githooks/pre-push
chmod +x ~/.githooks/pre-push
git config --global core.hooksPath ~/.githooks
```

### 4. GitHub Branch Protection 配置清单

每个 GitHub 仓库，在 Settings → Branches → Add rule 中配置：

- [x] Branch name pattern: `main`
- [x] Require a pull request before merging
- [x] Require approvals: 0（个人项目可为 0，不阻塞但留下记录）
- [x] Do not allow bypassing the above settings
- [ ] Require status checks（有 CI 时开启）

---

## 复用流程：新项目启动清单

```bash
# 1. 创建项目 + 初始化 git
git init && git remote add origin <url>

# 2. 在项目根目录创建 CLAUDE.md（只写例外，默认不需要写）
# 如果是 npm 库或有特殊需求才写，否则留空让全局 CLAUDE.md 生效

# 3. 在 GitHub 设置 main 分支保护（一次性操作）

# 4. 确认全局 hook 已生效
git config --global core.hooksPath  # 应该输出 ~/.githooks

# 5. 开始工作（每次都这样做）
git checkout main && git pull
git checkout -b feat/xxx
# ...
gh pr create --base main
```

---

## 关键决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 默认策略 | GitHub Flow | 最低成本，覆盖 80%+ 场景，对 AI agent 最友好 |
| npm 库默认策略 | GitHub Flow + tag | 个人库很少需要维护多个版本，过早引入 Git Flow 是过度设计 |
| commit-msg hook | 不全局强制 | 全局强制增加摩擦，AI 生成废话，单人项目收益不高 |
| 远端保护 | 必须配置 | 本地 hook 可绕过，Branch Protection 是真约束 |
| 模板仓库 | 仅初始化用 | 不能作为规则真相源，否则所有仓库难以升级 |

---

## 下一步行动

- [x] 整改完成：PR #5 + PR #4 已合并到 main
- [ ] 更新全局 `~/.claude/CLAUDE.md` 的 Git 章节（替换为本文"可直接复用的配置"第 1 条）
- [ ] 配置全局 pre-push hook
- [ ] 在 GitHub 给现有仓库设置 Branch Protection
- [ ] 新项目启动时：遵循"复用流程"清单

---

**参考资料**：
- GitHub Flow 官方文档: https://docs.github.com/en/get-started/using-github/github-flow
- Git hooks: https://git-scm.com/docs/githooks
- GitHub Branch Protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- Git Flow 详解: https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow
- Trunk-Based Development: https://trunkbaseddevelopment.com/
