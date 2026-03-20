# Git 分支管理规范整改 — Brainstorm

**日期**：2026-03-20
**方法**：派对模式（多视角专家讨论）
**参与专家**：李明远（架构师）、张晓峰（开发者）、陈思琪（分析师）

---

## 当前状态诊断

### Git 分支现状

```
main              @ cd65799  ← 停在 PR#3，积压 8 个提交未合并
refactor/ai-...   @ cd6b6ab  ← 直接塞了 8 个提交，变成第二条主线
feat/ai-reli...   @ dffcf0d  ← PR1+PR2，PR #4 指向 refactor 而非 main
```

### 三个结构性错误

**错误一：`refactor` 分支被当作第二条主线**

`refactor/ai-provider-vercel-sdk` 承载了 8 个不同类型的提交（refactor、fix、feat、chore），语义与实际用法严重脱节。"重构分支"本应做完即合并，而不是变成永久居所。

**错误二：fix 分支合并到 fix 分支**

`fix/phase1.5-canvas-ux` → `fix/provider-isolation-session-binding` → `main`（PR #3）。fix 分支互相包含而非各自独立 PR 到 main，导致关系难以追溯。

**错误三：PR #4 的 base 是 `refactor` 而非 `main`**

即使 PR #4 合并，`main` 也不会自动更新。`refactor` 上积压的 8 个提交永远不会到 `main`，除非再单独发一个 PR。

### 根本原因

当 `refactor` 分支越来越"重"时，开发者不敢直接合到 `main`，于是把它当作隔离区继续迭代。这是很常见的心理陷阱，结果是 `main` 越来越空洞，分支越来越重，形成正反馈的焦虑循环。

---

## 正规 Git 模型（GitHub Flow）

适合中小型项目，唯一规则：**`main` 是唯一基准**。

```
main
 ├─ feat/vercel-sdk-refactor       → PR → main → 合并删除
 ├─ fix/api-key-eye-icon           → PR → main → 合并删除
 ├─ feat/ai-connection-manager     → PR → main → 合并删除
 ├─ fix/security-audit             → PR → main → 合并删除
 └─ feat/ai-connection-reliability → PR → main → 合并删除
```

**正确的历史长相**：main 上有 5-6 个 Merge Commit，每个节点代表一次具体交付。没有分支活超过 7 天。没有分支变成第二条主线。

---

## 整改方案

### 选择：方案 A（最小整改，推荐）

接受历史不完美，优先让 `main` 追上来，从今天起严格规范。

**执行顺序（顺序不能颠倒）：**

```bash
# Step 1: 创建 refactor → main 的 PR（清偿积压债务）
gh pr create \
  --base main \
  --head refactor/ai-provider-vercel-sdk \
  --title "refactor(ai): Vercel AI SDK 重构 + 连接管理器 + 安全加固（积压集成）" \
  --body "将 8 个积压提交合并到 main：
- Vercel AI SDK 替换手写 client 层
- P1+P2 安全修复
- AI Connection Manager（多连接+自动格式嗅探）
- 26 项代码审查修复
- 7 项安全审计修复"

# Step 2: 合并 Step 1 的 PR（refactor → main）
gh pr merge <pr_number> --merge

# Step 3: 把 PR #4 的 base 改为 main（refactor 已并入，main 已追上）
gh pr edit 4 --base main

# Step 4: 合并 PR #4（feat/ai-connection-reliability → main）
gh pr merge 4 --merge

# Step 5: 清理 refactor 分支（使命完成）
git push origin --delete refactor/ai-provider-vercel-sdk
git branch -d refactor/ai-provider-vercel-sdk
```

### 方案 B（重写历史，个人项目可选）

```bash
# 在新分支上 squash 整理 refactor 变更
git checkout -b feat/clean-main main
git merge --squash refactor/ai-provider-vercel-sdk
git commit -m "feat(ai): Vercel AI SDK 重构 + 连接管理器 + 安全加固"

# PR feat/clean-main → main，合并后 rebase PR #4
git checkout feat/ai-connection-reliability
git rebase main
git push --force-with-lease origin feat/ai-connection-reliability
```

优点：main 时间线极度干净。缺点：重写历史，需要强推。

---

## 未来开发规范（五条铁律）

| # | 规则 | 说明 |
|---|------|------|
| 1 | **main 是唯一基准** | 任何新工作从 `git checkout main && git pull` 开始 |
| 2 | **分支生命周期 ≤ 7 天** | 超时未合并，主动关 PR 重开或拆小 |
| 3 | **commit 粒度 = 一个可独立验证的改动** | 不带 "WIP"、不带 "P1+P2 修复"（修 P1 就提 P1） |
| 4 | **修复同次引入的问题 → amend（未推送）或 fixup（squash 时）** | 不要让 fix 的 fix 独立存在 |
| 5 | **所有分支前缀都是短命分支** | `feat/`、`fix/`、`refactor/`、`chore/` 均为短命分支，不是长期驻留的环境 |

---

## 关键决策

- **选择 GitHub Flow 而非 Git Flow**：个人/小团队项目，不需要 develop 分支，main 直接作为唯一集成线
- **接受历史不完美**：用方案 A 快速追上，而非方案 B 重写历史带来的 force push 风险
- **PR #4 改 base 时机**：必须在 refactor→main 合并之后，否则 base 已过时

---

## 下一步

1. 执行整改方案 A 的 Step 1-5
2. 验证 `main` 包含所有最新代码（`git log main --oneline | head -15`）
3. 后续每次开发：`git checkout main && git pull && git checkout -b feat/xxx`
4. 运行 `/workflows:plan` 规划下一个功能
