# 协作规则

工作分支是 `agents`。`main` 只是给人留的快照，日常读写都不走它。远程已经有 `agents` 时，每次 `git push` 之前执行 `git pull --rebase origin agents`。远程还没有这个分支时，直接 `git push -u origin agents`。

本仓库是需求、已确认的约定、各方说明和接口文件的正本。聊天记录和各个产品仓库里的实现文档都不是跨方正本。代码仍在各自的产品仓库里改。

人和 Agent 使用同一套步骤。Agent 不能因为「只有自己看得到聊天」就把结论留在对话里。评论、认领、开 Issue、改标签、写入已确认的约定、提交生成的接口文件、更新需求状态、向 `agents` 推送，都直接做完，再告知结果。

## 身份

产品仓库里的 `.collab/identity.toml`：

```toml
id = "fe/cursor-k"
```

`id` 的格式是 `<角色>/<昵称>`。角色是 `pm` `be` `fe` `qa` `ops`。同一个人换仓库时昵称不变，只改角色，并在名册里另起一行。Issue 和提交说明里的 `[身份]` 必须能在 `collaborators.md` 对上这一行。

没有这个文件时：

1. 远程已有 `agents` 时，先拉取到最新。仓库还在初始化、远程没有这个分支时，跳过拉取。
2. 用 `git remote get-url origin` 读当前产品仓库地址。名册里已有一行的所属仓库与它相同，就用那一行的身份和参与方。
3. 对不上时只登记自己。用户说过参与方和角色就用用户的。没说过时，后端仓库用参与方 `backend`、角色 `be`，前端仓库用角色 `fe`。同一角色有多个参与方、又对不上仓库时，只问自己的参与方 id。不要问别人的仓库地址，也不要替别人加行。
4. 昵称：用户说过就用用户的。否则用 `<工具名>-<主机名末两位字母>`。名册里已有就在末尾加数字。Cursor 用 `cursor`，Claude Code 用 `claude`。
5. 在 `collaborators.md` 追加自己的一行：身份、参与方、`Agent` 或 `人`、上面读到的 origin、当天日期（`YYYY-MM-DD`）。`parties/<参与方>/` 不存在就创建，代码仓库写成这个 origin。已存在且代码仓库仍是「尚未写入」时，改成这个 origin。角色是 `be` 且还没有 `api/<参与方>/` 时，补上该目录的 README。
6. 提交到 `agents` 并推送。推送成功后再写身份文件。未成功或 id 已被占用时，换一个再推，不要用它发言。

此后每一条 Issue 评论、每一条提交说明，都用这个 id 署名。不要冒用别人的 id。

## 什么时候写回

产品仓库的 `AGENTS.md` 和 `CLAUDE.md` 负责提醒进来。进来之后，这些结论要写回本仓库并推送到 `agents`：

- 跨端行为已经说定：写进对应 Issue；已确认的行为写入需求文件的「约定」
- 本仓库生成了接口文件：提交到 `api/<提供方>/`，并在原评论下回复路径和来源提交
- 本仓库相关改动已经合入：需求改为 `已实现`，写上产品仓库提交号
- 约定或接口文件不够用：在 Issue 里提问或写「接口变更申请」

当前用户已经在对话里把行为说死时，直接写入 Issue 和「约定」，变更记录写 `用户确认`。

## 每次开工

在 `.collab/{{checkout_dir}}/` 中：

1. `git status --porcelain` 有输出就停，不要拉取覆盖。
2. `git fetch origin --prune`，然后 `git checkout agents`。本地还没有这个分支时：`git checkout -b agents --track origin/agents`。
3. 远程有 `main` 时执行 `git merge-base --is-ancestor origin/main origin/agents`。只有 `master` 时改用 `origin/master`。失败就停。
4. `git pull --rebase origin agents`。
5. 列出未关闭、且带有 `to-<你的角色>` 标签的 Issue。命令见 README。
6. 打开这些 Issue。自己的参与方还没认领、或认领已经是自己的 id 时才处理。读 `@` 到你的 id、你的参与方、或（仅当该角色只有一个参与方）`@<角色>/*` 的评论，以及它们指向的 `reqs/*.md`。
7. 读 `reqs/README.md` 里属于你的认领。

不要为了找任务把 `parties/` 和全部 `reqs/` 读一遍。处理完直接做，不要先问能不能做。

## 推送

工作分支是 `agents`。禁止强推，禁止改写已经推送的提交。远程还没有 `agents` 时，提交后直接 `git push -u origin agents`。远程已经有时，每次推送之前：

```bash
git checkout agents
git status --porcelain
```

有输出就停。没有输出再执行：

```bash
git pull --rebase origin agents
git push origin agents
```

变基冲突时：

- `reqs/README.md` 和 `collaborators.md`：两边的行都留下。
- 自己的新编号和已有文件撞号：换下一个编号，再提交、再拉取、再推送。
- 其他文件：`git rebase --abort`，告诉用户冲突路径，然后停。

推送被拒绝时停，说明需要允许协作者向 `agents` 直接推送。不要改成向 `main` 开合并请求。

一次提交只做一件事：新建一份需求、写入一项约定，或更新一个提供方的接口文件。提交说明以 `[<id>]` 开头，并写上 Issue 编号。

## 需求怎么走

一篇需求是一对东西：`reqs/<主题>-<三位序号>.md` 加上一个 Issue。编号在拉取之后取 `reqs/` 里已有文件的下一号，跳过 `_template.md`。讨论只写在 Issue。已有需求文件时沿用它们的结构；还没有时按 `reqs/_template.md`。

状态只用这些词：`讨论中` → `已确认` → `已实现` → `已废弃`。

参与方写 `parties/` 的 id，例如 `backend, user`。两个前端单独协作时可以是 `user, admin`。

认领写 `参与方=身份`，多个参与方用空格分开。还没有人接到时写 `user=fe/*` 这种形式。每个参与方各写一项。两个前端不要合成一个 `fe/*`。

某人认领：只改自己参与方的那一项，在 Issue 里说一声，并给该 Issue 打上自己角色的 `to-*`。回答还没人认领的 `@<参与方>` 之前，先完成认领并推送。

新建需求时：

1. 拉取 `agents`，取下一号。
2. 写入需求文件，状态为 `讨论中`，Issue 先写 `待开`，并在 `reqs/README.md` 加一行索引。
3. 提交并推送。
4. 用 Issue 模板开单。正文与「需求」节一致。标签加上 `discussing`，以及每个需要表态的参与方角色的 `to-*`。命令见 README，必须带上正文，避免打开编辑器。
5. 把 Issue 编号写回需求文件和索引，再提交并推送。

## 在 Issue 里说话

每条评论以 `[<id>]` 开头。回复哪一条，下一行写 `re:<该评论的 URL>`。点名写 `@<id>`，点某一边写 `@<参与方id>`。只有这一角色对应一个参与方时才可以写 `@<角色>/*`。

需要对方动手时加上对方角色的 `to-*`。自己这方处理完，先看认领栏：同一角色还有别的参与方没处理完，就留下 `to-*`；没有了再去掉。后面还有别人，再加上下一个。

GitLab 上回复已有讨论时，挂到原讨论上。挂不上时仍然发表评论。`re:` 那一行不能省。GitHub Issue 评论是平的，靠 `re:` 对上原句。

常用句式：

```
[fe/cursor-k] re:https://example.com/org/collab/issues/12#note_1
问 @backend：验证码错误时，微信 code 是否仍可使用？
[be/claude-01] re:https://example.com/org/collab/issues/12#note_2
答：仍可使用。短信验证码先校验，错误码 2012。
[pm/kevin] re:https://example.com/org/collab/issues/12#note_3
✅ 确认
[fe/cursor-k]
接口变更申请 @backend：注册响应需要让前端知道这次是不是新用户。
```

`✅ 确认` 的人必须不是被确认那条评论的作者。确认的是行为，不是接口字段表。看到别人的 `✅ 确认`，且「约定」里还没有这句话，就写入「约定」和「变更记录」，需要的话按 `parties/_domain.md` 同步 `parties/<id>/domains/`。全部待确认的点都写进「约定」之后，状态改为 `已确认`，标签从 `discussing` 改为 `confirmed`，并去掉已经处理完的 `to-*`。

实现完成、产品仓库已合入后，把状态改为 `已实现`，变更记录写上产品仓库提交号，Issue 标签改为 `done` 并关闭。废弃一份需求，或删掉已经确认的约定之前，先问用户。同意废弃后，状态写 `已废弃`，标签 `wontfix`，关闭 Issue。

## 接口文件

正本在 `api/<提供方>/`。一个提供方可以放多份文件，文件名由该方决定。其他方只读，按文件里的路径和字段编写调用。

只有该方 README 里写的角色可以改该目录。需要新字段或新行为时，在 Issue 里写「接口变更申请」，`@` 提供方，打上该方角色的 `to-*`。提供方在自己的代码仓库改接口定义，生成文件，再提交到 `api/<提供方>/`。提交说明和原评论的回复里写上文件路径、生成命令，以及来源的 `<代码仓库地址> <提交号>`。同时更新该目录 README 的生成命令和最近一次来源。手改生成文件后再提交是不允许的。

约定节里写行为、错误和顺序。字段表以 `api/` 里的文件为准，不抄进需求文件。

对外浏览或测试见 `api/README.md`。那里还没写决定时，由发布接口的角色询问用户，不根据产品仓库里有没有某个配置文件来猜测。选项只有两个：

- 暂不使用。把这句话写进 `api/README.md`。之后不再追问，直到用户改口。
- 使用 Apifox。带领用户安装 `apifox-cli`，执行 `apifox auth login`。令牌只进入这条命令，不进入仓库、Issue 和聊天记录。在 Apifox 创建或指定项目，把项目 ID 写入后端产品仓库的 `.apifox/settings.json`，内容只有 `projectId`。该目录留在本地。再把「使用 Apifox」和项目 ID 写入 `api/README.md`。

接口文件进入 `api/<提供方>/` 并且推送到 `agents` 之后，再按 Apifox CLI 导入这些文件。换用别的工具时，仍先询问用户，完成该工具自己的登录和项目设置，把决定写进 `api/README.md`。工具在产品仓库里的配置目录按 `.apifox/` 同样排除出版本库。

## 提交到产品仓库之外的事

产品仓库的 `.gitignore` 要有 `.collab/` 和 `.apifox/`。缺了就补上并告知。它们若已经被跟踪，用 `git rm -r --cached -- .collab .apifox` 从索引移除，不删除工作区文件。

本仓库的命令、标签和 Issue 模板见 `README.md`。
