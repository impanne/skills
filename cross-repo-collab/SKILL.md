---
name: cross-repo-collab
description: Use when people and agents in separate backend or frontend repositories need one git place for requirements, agreements, and API files, or when that collaboration repository is not set up yet.
---

# 跨仓库协作

## 使用者目标

多个代码仓库分开开发，仓库里既有人也有 Agent。后端、用户端、管理端都算一方，前端之间也可以单独协作。他们要共同知道：现在做什么、已经约定了什么、接口文件在哪、哪件事等自己处理。

这些内容如果留在聊天里，另一个仓库里的 Agent 看不到。如果各写各的文档，字段和行为会对不上。因此另有一个 Git 仓库作为正本：文件放已确认的内容和接口文件，Issue 放讨论和派发。每个产品仓库把这个正本检出到自己的 `.collab/` 里再读写。

本 skill 是这套做法的定义。协作仓库一旦建好，里面的 `README.md` 和 `AGENTS.md` 就是给每天进来的人和 Agent 看的规则，内容来自 `templates/`。以后改做法，先改本 skill 的模板，再向协作仓库提合并请求，让两处一致。

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

格式 `<角色>/<昵称>`。角色取 `pm` `be` `fe` `qa` `ops`。昵称标识这个人，或这一台机器上的这一个 Agent。同一个前端仓库里可以同时有 `fe/cursor-k` 和 `fe/claude-02`，不要都叫成仓库名。人在后端仓库工作时用 `be`，在前端仓库工作时用 `fe`，除非用户指定别的角色。

还没有身份文件时，读检出里的 `collaborators.md`。选一个没有出现过的 id，向用户重复一遍并得到同意，先把一行写入名册（身份、人还是 Agent、所属产品仓库、日期），再写 TOML。名册的合并请求同样要在推送前得到用户同意。

## 每次开工

1. 进入 `.collab/<协作仓库目录>/`。`git status` 有未提交改动就停，不要拉取覆盖。然后 `git pull`。
2. 读本仓库的 `AGENTS.md`。它和本文日常步骤不一致时，以仓库里的 `AGENTS.md` 为准，并告诉用户两处已经分叉。
3. 列出未关闭、带 `to-<你的角色>` 的 Issue。GitLab 用 `glab issue list`，GitHub 用 `gh issue list`。具体仓库路径写在协作仓库 README 的命令里。
4. 逐个打开这些 Issue。只处理两类评论：`@` 到你的 id 的，以及 `@<你的角色>/*` 且还没有人回复的。再读评论里点名的 `reqs/*.md`。
5. 看 `reqs/README.md` 的认领列。等于你的 id 的是你已认领的；等于 `fe/*` 这种通配、且通配角色与你相同的，是这一角色还没人认领的。

不要把 `parties/` 和所有需求文件读一遍来找任务。

产品仓库的 `AGENTS.md` 只需要一句引导：跨仓库的需求、约定和接口文件以 `.collab/<目录>/AGENTS.md` 为准。不要在产品仓库里再抄一套规则。

## 说话和确认

讨论写在 Issue 评论里。每条以 `[<id>]` 开头。要某人处理时写 `@<id>` 或 `@<角色>/*`，并给 Issue 加上对方的 `to-*` 标签。对方做完就去掉这个标签；后面还有别人，再加上下一个。

回答必须用平台的「回复此评论」，这样后来的 Agent 能看出答的是哪一句，而不必通读整条 Issue。

```
[fe/cursor-k] 问 @be/*：验证码错误时，微信 code 是否仍可使用？
[be/claude-01] 答：仍可使用。短信验证码先校验，错误码 2012。
[pm/kevin] ✅ 确认
[fe/cursor-k] 接口变更申请 @be/*：注册响应需要让前端知道这次是不是新用户。
```

`✅ 确认` 的人必须不是被确认那条评论的作者。Agent 可以确认别人的结论，不能确认自己刚写的那条。确认之后开分支，把该结论写入需求文件的「约定」和「变更记录」。行为会改变某一端对外说明时，同时改 `parties/<id>/domains/` 下对应的文档。所有待确认点都进入「约定」后，状态改为 `已确认`，标签从 `discussing` 改为 `confirmed`。

实现落在产品仓库。产品仓库的变更合入后，再把协作仓库里的状态改为 `已实现`，标签改为 `done`，关闭 Issue。放弃则状态 `已废弃`，标签 `wontfix`。

推送、发表评论、创建 Issue 和合并请求之前向用户确认。主分支由人合并。一次合并请求只做一件事。

## 需求文件

一对一：`reqs/<主题>-<三位序号>.md` 加一个 Issue。编号取 `reqs/` 现有文件的下一号。文件结构用 `templates/req.md`。状态只用 `草稿` `讨论中` `已确认` `已实现` `已废弃`。

「需求」写目标、范围和可以验收的条件。「约定」只写已经确认的行为：谁先做什么、出错时怎样、边界是什么。字段名和类型以 `api/` 里的文件为准，不抄进约定。

新建时从主分支开分支，写文件，更新 `reqs/README.md`，用 `templates/issue.md` 开 Issue，把编号写回文件，再开合并请求。参与方写 `parties/` 的 id。两个前端单独协作时参与方可以没有 `backend`。

认领是把 `fe/*` 改成自己的 id，在 Issue 里说明，并打上自己的 `to-*`。

## 接口文件

`api/<提供方>/` 可以有多份文件，文件名由提供方决定，不规定必须是单一的 `openapi.json`。调用方只读这些文件来写调用。发现文件里的形状不够用时，在 Issue 写「接口变更申请」，不要在前端仓库编一份平行的接口说明，也不要直接改 `api/`。

提供方（通常是 `be`）在自己的代码仓库修改接口定义并生成文件，把生成结果提交到 `api/<提供方>/`，然后回复原评论，写明文件名和路径。手改生成文件后再提交是不允许的，下一次生成会盖掉。

## 初始化协作仓库

用户还没有协作仓库时，先问清这三件事再动手：

- 空仓库的远程 URL（GitHub 或 GitLab）
- 检出目录名，也就是 `.collab/` 下面的那一层
- 参与方 id 列表，以及每一方的代码仓库地址。至少要有将要互相协作的那些端

然后在产品仓库执行：

1. `git clone <URL> .collab/<目录名>`。按「排除出版本库」写好 `.gitignore`，再做后面的事。
2. 把 `templates/README.md`、`templates/AGENTS.md` 写入检出根目录，替换 `{{repo_name}}` `{{parties}}` `{{checkout_dir}}` `{{remote_url}}` `{{gitlab_path}}` 或 `{{github_path}}`。用不到的那种平台命令从 README 删掉。
3. 写入 `templates/collaborators.md`、`templates/reqs-README.md`、`templates/api-README.md`。`api/README.md` 的 `{{external_tool}}` 先写成「尚未决定。第一次发布接口给人浏览或测试时，由发布方询问用户。」
4. 每个参与方：`parties/<id>/README.md` 用 `templates/party-README.md`，并建立 `parties/<id>/domains/`。
5. 每个会发布接口的提供方：`api/<id>/README.md` 用 `templates/api-provider-README.md`。
6. GitLab 把 `templates/issue.md` 放到 `.gitlab/issue_templates/需求.md`。GitHub 放到 `.github/ISSUE_TEMPLATE/需求.md`，并按该平台的模板格式补上 front matter。
7. 在产品仓库的 `AGENTS.md` 加上一句：跨仓库事项先读 `.collab/<目录名>/AGENTS.md`。
8. 开分支。向用户展示将要提交的文件列表，同意后再推送，并请用户打开主分支保护。

`templates/req.md` 留在 skill 里，供以后新建需求时填空，不必放进协作仓库。

## 对外接口工具

正本永远是协作仓库里的接口文件。Apifox 或其他同类工具只是把这些文件提供给人点选和测试。需求、约定、Issue 不放进这些工具。

不要去找 `.apifox/settings.json` 或任何产品仓库配置来推断用不用。用户此时通常还没准备过。第一次需要对外发布时，由发布方（一般是后端角色）向用户说明用途，请用户选择：

- 暂不使用。把这句话写进 `api/README.md`。之后开工不再追问，直到用户改口。
- 使用 Apifox。当时带领用户做完这些事：安装 `apifox-cli`；执行 `apifox auth login`，令牌只进入这条命令，不进入仓库和聊天记录；在 Apifox 创建或指定项目；把项目 ID 写入后端产品仓库的 `.apifox/settings.json`，内容只有 `projectId`。该目录按「排除出版本库」留在本地，不提交。再把「使用 Apifox」和项目 ID 写入协作仓库的 `api/README.md`。

接口文件进入 `api/<提供方>/` 并且合并之后，再按 Apifox CLI 导入这些文件。换用别的工具时，仍由发布方按同样的顺序询问用户、完成该工具自己的登录和项目设置，并把决定写进 `api/README.md`。工具写在产品仓库里的配置目录，一律按「排除出版本库」处理，不提交。

## 排除出版本库

`.collab/` 里有身份和协作仓库的检出，`.apifox/` 里有本机要用来导入接口的项目 ID。两处都只属于当前产品仓库的本地环境。协作仓库自己的 Git 历史才提交规则和接口文件。

在产品仓库根目录的 `.gitignore` 加入还没有的这两行：

```gitignore
.collab/
.apifox/
```

写完后向用户说明加了什么。若 `git status` 里这两处已经是已跟踪文件，先告诉用户，得到同意后再执行 `git rm -r --cached -- .collab .apifox`，只从索引去掉，不删除工作区里的文件。不要把这两处的内容写进提交说明以外的任何将要提交的文件。
