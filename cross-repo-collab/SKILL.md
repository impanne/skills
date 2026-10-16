---
name: cross-repo-collab
description: "Use when people and agents across separate repositories share requirements, agreements, and API files in a git collaboration checkout at .collab/, or when that checkout is missing. Agents only read and write the agents branch and pull --rebase before push. People open a merge request from agents into main. Triggers include 协作仓库, .collab, 接口变更, 需求约定, to-be, to-fe, and any change that depends on another repository's behavior."
---

# 跨仓库协作

## 使用者目标

多个代码仓库分开开发，仓库里既有人也有 Agent。后端、用户端、管理端都算一方，前端之间也可以单独协作。他们要共同知道：现在做什么、已经约定了什么、接口文件在哪、哪件事等自己处理。

这些内容如果留在聊天里，另一个仓库里的 Agent 看不到。如果各写各的文档，字段和行为会对不上。因此另有一个 Git 仓库作为正本：文件放已确认的内容和接口文件，Issue 放讨论和派发。每个产品仓库把这个正本检出到自己的 `.collab/` 里再读写。

日常读写的正本是协作仓库的 `agents` 分支。Agent 只操作这个分支，不读取、不推送 `main`。人从 `agents` 向 `main` 提合并请求。

本 skill 管三件所有协作仓库都一样的事：工作分支、推送前拉取、哪些操作不用询问。评论格式、状态和目录在 `templates/AGENTS.md`，初始化时写入协作仓库。开工后读检出里的那份并执行。

## 固定规则

下面三件以本 skill 为准。检出里的 `AGENTS.md` 还没有这些句子时，先用模板把规则文件更新到 `agents` 并推送，再继续别的事：

- `工作分支是 agents。`
- `git pull --rebase origin agents`
- `人从 agents 向 main 提合并请求。`

更新时用模板重新生成这三份，填回仓库里已经写好的远程、目录名、参与方、平台和编码后的仓库路径：`AGENTS.md`、`README.md`、`reqs/_template.md`。参与方自己的 README 留着，不要覆盖。产品仓库里 `<!-- cross-repo-collab:start -->` 到 `<!-- cross-repo-collab:end -->` 的区块换成 `templates/product-sync.md`。

需求正文、约定和接口文件以检出为准。

## 更新时机

何时进入协作仓库、何时把结论写回，正文以 `templates/product-sync.md` 为准。初始化时把这份正文写进产品仓库的 `AGENTS.md` 和 `CLAUDE.md`，两份相同。

- 文件不存在就创建，内容就是这个区块。
- 已有开始和结束标记就整段替换。
- 没有标记就追加到文件末尾。

产品仓库允许当前分支推送时，把这个区块单独提交并推送。推送被拒绝就留在工作区并说明，协作仓库的初始化不因此停下。

## 本地布局

```
<产品仓库>/.collab/identity.toml       本机身份，不进任何 git
<产品仓库>/.collab/<协作仓库目录>/     协作仓库的 git 检出
```

身份文件和检出目录并列，不放进检出目录里面。产品仓库必须把 `.collab/` 和 `.apifox/` 都排除出版本库，做法见「排除出版本库」。

身份是 TOML 的一行赋值：

```toml
id = "fe/cursor-k"
```

格式 `<角色>/<昵称>`。角色取 `pm` `be` `fe` `qa` `ops`。昵称标识这个人，或这一台机器上的这一个 Agent。同一个人换仓库时昵称不变，只改角色：后端里是 `be/kevin`，前端里是 `fe/kevin`，名册里各占一行。Issue 和提交说明里的 `[身份]` 必须能在 `collaborators.md` 对上。

没有身份文件时：

1. 远程已有 `agents` 时，先拉取到最新。初始化的第一次提交跳过拉取，名册行放进「初始化协作仓库」那一次提交，推送成功后再写身份文件。
2. 用 `git remote get-url origin` 读当前产品仓库地址。名册里已有一行的所属仓库与它相同，就用那一行的身份和参与方。
3. 对不上时只登记自己。用户说过参与方和角色就用用户的。没说过时，后端仓库用参与方 `backend`、角色 `be`，前端仓库用角色 `fe`。同一角色有多个参与方、又对不上仓库时，只问自己的参与方 id。不要问别人的仓库地址，也不要替别人加行。
4. 昵称：用户说过就用用户的。否则用 `<工具名>-<主机名末两位字母>`，例如 `cursor-k`。名册里已有就在末尾加数字。Cursor 用 `cursor`，Claude Code 用 `claude`，其他用工具的小写短名。
5. 在 `collaborators.md` 追加自己的一行：身份、参与方、`Agent` 或 `人`、上面读到的 origin、当天日期（`YYYY-MM-DD`）。`parties/<参与方>/` 不存在就创建，代码仓库写成这个 origin。已存在且仍是「尚未写入」时，改成这个 origin。角色是 `be` 且还没有 `api/<参与方>/` 时，补上该目录的 README。
6. 提交到 `agents` 并推送。推送成功后再写 `identity.toml`。推送未成功，或拉取后发现这个 id 已被占用，就换一个 id 再推，不要用它发言。

## 分支与推送

工作分支是 `agents`。Agent 只推这个分支。禁止强推，禁止改写已经推送的提交。

远程还没有 `agents` 时，先在本地提交，再执行 `git push -u origin agents`，不要先拉取。

远程已经有 `agents` 时，每次推送之前在检出目录执行：

```bash
git checkout agents
git status --porcelain
```

有输出就停，把状态告诉用户。没有输出再执行：

```bash
git pull --rebase origin agents
git push origin agents
```

先在本地提交，再执行上面的拉取和推送。`git pull` 不带 `--rebase` 不算数。

变基冲突时：

- `reqs/README.md` 和 `collaborators.md`：两边的行都留下，再继续变基。
- 自己的新需求编号和已有文件撞号：给自己的文件换下一个编号，再提交、再拉取、再推送。
- 其他文件：执行 `git rebase --abort`，告诉用户冲突路径，然后停。

开工时只取 `agents`：

```bash
git fetch origin --prune
git checkout agents || git checkout -b agents --track origin/agents
git pull --rebase origin agents
```

不比较、不合并、不推送 `main`。人从 `agents` 向 `main` 提合并请求，Agent 不代劳。

`agents` 推送被拒绝时停，并说明需要允许协作者向 `agents` 直接推送。不要改去操作 `main`。

## 不用询问的操作

评论、认领、开 Issue、改标签、把已确认的行为写入约定、提交生成出的接口文件、把需求标成已实现、向 `agents` 推送，都直接做。做完用几句话告知推送了什么、Issue 编号和当前身份。

当前用户已经在对话里把行为说死时，直接写入 Issue 和「约定」，变更记录写 `用户确认`。Agent 之间仍不能给自己刚写的评论打 `✅ 确认`。

只有这些情况停下来问：

- 远程有提交，但不是这套协作目录
- 判断不了自己的角色或参与方
- 检出工作区不干净
- 向 `agents` 的推送被拒绝
- 变基冲突落在约定正文、接口文件或其他不能按行合并的文件上
- 要废弃一份需求，或要删掉已经确认的约定
- 要使用 Apifox 或其他需要登录的外部工具

## 初始化

缺了协作仓库的远程 URL 才问。检出目录名能从 URL 最后一段得到就直接用。参与方只登记当前这一方，id 用 `backend`、`user`、`admin` 这种名字，不要用角色名当 id。代码仓库地址用本仓库的 `git remote get-url origin`。不要询问、不要填写其他协作者的身份或仓库地址。用户已经说出的其他参与方可以建目录，代码仓库写「尚未写入」。

然后：

1. 按「排除出版本库」写好产品仓库的 `.gitignore`。
2. `git clone <URL> .collab/<目录名>`。
3. 判断能不能初始化。在检出里执行 `git rev-list --all --count`。`HEAD` 还不存在时当作计数 `0`。不要在判断之前写入文件。
4. 计数是 `0`：执行 `git checkout --orphan agents`，然后初始化。
5. 计数大于 `0`：列出全部文件。
   - 已有 `AGENTS.md`、`collaborators.md`、`parties/`、`reqs/`、`api/` 之一：不要初始化，改走「已经有协作仓库」。
   - 只有 `README.md`、`README`、`LICENSE`、`LICENSE.md`、`.gitignore` 这些平台种子文件：可以初始化。在当前提交上执行 `git checkout -B agents`，保留已有提交。不要使用 `--orphan`。
   - 还有别的文件：停下来，列出文件。

初始化：

1. 写入 `templates/README.md`、`templates/AGENTS.md`。替换 `{{repo_name}}` `{{parties}}` `{{checkout_dir}}` `{{remote_url}}` `{{gitlab_path}}` `{{github_path}}` `{{gitlab_path_encoded}}`。`{{gitlab_path_encoded}}` 是 `{{gitlab_path}}` 的每个 `/` 换成 `%2F`。删掉用不到的 `<!-- platform:gitlab -->` 或 `<!-- platform:github -->` 整段。
2. 写入 `templates/collaborators.md`、`templates/reqs-README.md`（放到 `reqs/README.md`）、`templates/req.md`（放到 `reqs/_template.md`）、`templates/api-README.md`、`templates/domain.md`（放到 `parties/_domain.md`）。`api/README.md` 的 `{{external_tool}}` 写成「尚未决定。第一次发布接口给人浏览或测试时，由发布方询问用户。」
3. 当前参与方：`parties/<id>/README.md` 用 `templates/party-README.md`，代码仓库填本仓库 origin，并建立 `parties/<id>/domains/`。用户点过名的其他参与方同样建目录，代码仓库写「尚未写入」。
4. 角色是 `be` 且人已经在场的参与方：`api/<id>/README.md` 用 `templates/api-provider-README.md`。其他方先不建 `api/` 目录。
5. 按「身份」只把当前协作者写入名册，放进同一次提交。先不要单独推送。
6. GitLab 把 `templates/issue.md` 放到 `.gitlab/issue_templates/需求.md`。GitHub 把 `templates/github-issue.md` 放到 `.github/ISSUE_TEMPLATE/需求.md`。
7. 提交，说明写 `初始化协作仓库`。远程还没有 `agents`，直接 `git push -u origin agents`。推送成功后再写 `identity.toml`。
8. 只执行 README 里留下的那一平台的「补标签」命令。已存在就跳过，其他错误停。
9. 写入产品仓库的同步区块。
10. 告知用户：Agent 只推 `agents`，需要允许协作者直接推送这个分支。人从 `agents` 向 `main` 提合并请求。然后按检出里的 `AGENTS.md` 开工。

## 已经有协作仓库

不要重跑初始化，不要覆盖已有需求、约定和接口文件。

1. `git fetch origin --prune`。
2. 没有 `origin/agents` 时，从当前默认分支的尖端建立 `agents` 并 `git push -u origin agents`。推送被拒绝就停。之后只操作 `agents`。
3. 按「分支与推送」拉取 `agents`。不要查看 `main`。
4. 规则文件缺了固定句子时，按「固定规则」更新并推送。
5. 产品仓库的同步区块缺了或和 `templates/product-sync.md` 不一致时补上。
6. 缺身份就登记。缺标签就按 README 补。
7. 读检出里的 `AGENTS.md` 并执行。

## 排除出版本库

`.collab/` 里有身份和协作仓库的检出，`.apifox/` 里有本机要用来导入接口的项目 ID。两处都只属于当前产品仓库的本地环境。协作仓库自己的 Git 历史才提交规则和接口文件。

在产品仓库根目录的 `.gitignore` 加入还没有的这两行：

```gitignore
.collab/
.apifox/
```

写完后告知用户加了什么。若 `git status` 里这两处已经是已跟踪文件，执行 `git rm -r --cached -- .collab .apifox`，只从索引去掉，不删除工作区里的文件。不要把这两处的内容写进提交说明以外的任何将要提交的文件。
