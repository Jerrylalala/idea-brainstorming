# Git 自动化防护体系 — 全局配置参考手册

**适用环境**：Windows 11 + Git Bash + GitHub + Claude Code
**维护者**：个人开发者
**最后更新**：2026-03-20
**对应讨论**：`docs/brainstorms/2026-03-20-git-branch-management-brainstorm.md`

---

## 一、体系全貌（五层防护 + 批量工具）

```
层级  位置                        触发时机          作用
────  ──────────────────────────  ────────────────  ──────────────────────────────────
第1层  ~/.claude/CLAUDE.md        每次 Claude 会话  AI 决策层：自动遵循 GitHub Flow，
                                                    首次进入项目检测 Branch Protection
第2层  ~/.githooks/pre-commit     git commit        阻止在 main/master 直接 commit；
                                                    gitleaks 密钥扫描（有则用，否则正则兜底）
第3层  ~/.githooks/commit-msg     git commit        校验 Conventional Commits 格式
第4层  ~/.githooks/pre-push       git push          阻止直接 push 到 main/master；
                                                    首次 push 到新 GitHub 仓库时自动配置
                                                    Branch Protection
第5层  GitHub Branch Protection   PR 合并时         远端硬约束：禁止直接 merge，绕不过

工具  ~/scripts/audit-repos.sh   手动运行          列出所有仓库的 Branch Protection 状态
工具  ~/scripts/sync-repos.sh    手动运行          批量为旧仓库补齐 Branch Protection
工具  ~/.bashrc: new-repo()       手动调用          一条命令：建仓 + 初始化 + 自动配置保护
```

---

## 二、文件清单与位置

| 文件 | 路径 | 说明 |
|------|------|------|
| Git hooks 目录 | `~/.githooks/` | 所有全局 hook 放这里 |
| pre-commit hook | `~/.githooks/pre-commit` | 阻止 main commit + 密钥扫描 |
| commit-msg hook | `~/.githooks/commit-msg` | Conventional Commits 校验 |
| pre-push hook | `~/.githooks/pre-push` | 阻止 push + 自动配 BP |
| 审计脚本 | `~/scripts/audit-repos.sh` | 检查所有仓库保护状态 |
| 批量补齐脚本 | `~/scripts/sync-repos.sh` | 批量配置旧仓库 |
| Shell 函数 | `~/.bashrc` (new-repo 函数) | 新建仓库一键初始化 |
| Claude 全局规则 | `~/.claude/CLAUDE.md` | Claude 的 Git 行为规范 |

**启用全局 hooks 的命令（只需执行一次）：**
```bash
git config --global core.hooksPath ~/.githooks
```

---

## 三、每层详细说明

### 第2层：~/.githooks/pre-commit

**触发**：`git commit`（任何仓库）

**行为**：
1. 检查当前分支，如果是 `main` 或 `master` → 拒绝 commit，提示创建功能分支
2. 如果已安装 gitleaks → 扫描 staged 文件中的密钥
3. 如果未安装 gitleaks → 用正则兜底扫描常见密钥模式（api_key、secret_key 等）

**绕过方式**（紧急情况）：`git commit --no-verify`

---

### 第3层：~/.githooks/commit-msg

**触发**：`git commit`

**允许的格式**：
```
<type>(<scope>): <description>
<type>: <description>
```

**允许的 type**：`feat` `fix` `hotfix` `refactor` `chore` `docs` `test` `perf` `ci` `build` `revert`

**示例**：
```
feat(ai): 新增懒检查和错误记忆机制
fix(modal): 修复关闭时 AbortController 未取消的问题
chore: 升级依赖
docs: 更新 README
```

**自动跳过**：Merge commit、Revert commit（自动生成，不校验）
**绕过方式**：`git commit --no-verify`

---

### 第4层：~/.githooks/pre-push

**触发**：`git push`

**行为**：
1. 如果当前分支是 `main` 或 `master` → 拒绝 push
2. 如果 remote 是 GitHub 仓库，且 main 分支还没有 Branch Protection → 自动通过 `gh api` 配置（即"首次 push 自动配置"功能）

**注意**：自动配置只配置最基本的 PR 要求（`required_approving_review_count=0`）。如需禁止 force push，仍需手动在 GitHub 勾选。

**绕过方式**：`git push --no-verify`

---

### 第5层：GitHub Branch Protection

**位置**：GitHub → 仓库 → Settings → Branches

**公开仓库配置方式（Rulesets）**：
```
Settings → Rules → Rulesets → New branch ruleset
  Ruleset Name: protect-main
  Enforcement status: Active（必须改为 Active）
  Target: Add target → Include by pattern → main
  Rules:
    ✅ Require a pull request before merging（Required approvals: 0）
    ✅ Block force pushes
```

**私有仓库配置方式（Classic Rules，免费）**：
```
Settings → Branches → Branch protection rules → Add rule
  Branch name pattern: main
  ✅ Require a pull request before merging（Required approvals: 0）
  ✅ Do not allow bypassing the above settings
```

**重要**：私有仓库免费计划不支持 Rulesets 强制执行，必须用 Classic Rules。

---

### 工具：audit-repos

**用途**：检查所有 GitHub 仓库的 Branch Protection 状态

```bash
audit-repos          # 等同于 ~/scripts/audit-repos.sh
# 或直接运行
~/scripts/audit-repos.sh --limit 200
```

**输出示例**：
```
仓库名                                    可见性     默认分支     BP状态       禁止ForcePush
my-webapp                                public     main         ✅ 已配置    ✅ 禁止
old-project                              private    main         ❌ 未配置    N/A
```

---

### 工具：sync-repos

**用途**：批量为缺少 Branch Protection 的仓库补齐保护规则

```bash
sync-repos --dry-run   # 先预览，不实际修改
sync-repos             # 实际执行
~/scripts/sync-repos.sh --limit 200   # 指定仓库数量上限
```

**说明**：
- 已有保护的仓库自动跳过
- 空仓库（没有任何 commit）自动跳过
- Fork 仓库/无 admin 权限的仓库会跳过并显示原因

---

### 工具：new-repo() 函数

**用途**：一条命令完成新仓库的全部初始化

```bash
new-repo <仓库名> [public|private]

# 示例
new-repo my-new-project private
new-repo my-open-source public
```

**自动完成**：`git init` → 建 main 分支 → 初始提交 → `gh repo create` → push → 配置 Branch Protection

---

## 四、新项目接入流程（每次新建项目）

```bash
# 方法 A：使用 new-repo 函数（推荐）
new-repo <project-name> private   # 或 public
# 完成后去 GitHub 手动勾选 "Block force pushes"（自动配置不含此项）

# 方法 B：手动接入已有目录
git init
git checkout -b main
git remote add origin <github-url>
git add README.md && git commit -m "chore: initial commit"
git push -u origin main
# → pre-push hook 会自动尝试配置 Branch Protection
# → 如失败，手动在 GitHub Settings 配置
```

**确认全局 hooks 已生效（只需确认一次）**：
```bash
git config --global core.hooksPath
# 应输出：C:/Users/<用户名>/.githooks 或 /c/Users/<用户名>/.githooks
```

---

## 五、旧仓库一次性治理流程

```bash
# Step 1：先看有哪些仓库未保护
audit-repos

# Step 2：预览将要修改哪些仓库
sync-repos --dry-run

# Step 3：批量配置
sync-repos

# Step 4：对需要改为公开的仓库，先做全历史密钥扫描
gitleaks git --redact --source <repo-path>
# 如发现问题 → 用 git filter-repo 清理历史，再强推
```

---

## 六、Claude Code 自动检测能力

| 能力 | 自动/手动 | 机制 |
|------|---------|------|
| 检查当前分支，在 main 上自动建功能分支 | ✅ 自动 | 写进 CLAUDE.md，每次改代码前触发 |
| 首次进入项目检测 Branch Protection | ✅ 自动 | CLAUDE.md 规则，检测 + 询问是否配置 |
| Commit 消息遵循 Conventional Commits | ✅ 自动（双重）| CLAUDE.md + commit-msg hook 双重保障 |
| PR base 指向 main | ✅ 自动 | CLAUDE.md 默认行为 |
| 密钥扫描（pre-commit） | ✅ 自动 | gitleaks + 正则，每次 commit 自动触发 |
| 全历史密钥扫描（公开前） | 🔲 手动触发 | 问 Claude "扫一下有没有泄露" |

---

## 七、常用命令速查

```bash
# 验证 hooks 生效
git config --global core.hooksPath

# 审计所有仓库保护状态
audit-repos

# 批量补齐旧仓库保护（先 dry-run）
sync-repos --dry-run
sync-repos

# 新建仓库（含自动配置）
new-repo <name> [public|private]

# 密钥扫描（当前仓库 staged 文件）
gitleaks protect --staged --verbose

# 全历史扫描（公开仓库前必做）
gitleaks git --redact --source .

# 测试 commit-msg hook
echo "wrong message" > /tmp/test-msg && ~/.githooks/commit-msg /tmp/test-msg
echo "feat: correct message" > /tmp/test-msg && ~/.githooks/commit-msg /tmp/test-msg

# 绕过所有 hooks（紧急情况）
git commit --no-verify
git push --no-verify
```

---

## 八、已知限制与注意事项

| 问题 | 说明 |
|------|------|
| `--no-verify` 可绕过本地 hooks | 本地 hook 是降低失误概率的，真正的硬约束是 GitHub Branch Protection |
| pre-push 自动配置不含"禁止 force push" | 需手动在 GitHub 设置中勾选 |
| Rulesets 对私有仓库免费计划不强制执行 | 私有仓库必须用 Classic Branch Protection Rules |
| Hook 在 GUI/IDE 中可能不触发 | 部分 GUI 工具（如 GitHub Desktop）有自己的 Git 环境，可能绕过全局 hooks |
| fork 仓库无法配置 Branch Protection | 无 admin 权限，sync-repos 会跳过并提示 |
| 空仓库（无提交）无法配置 Branch Protection | 必须有至少一个 commit 才能设置分支保护 |
