# {{repo_name}}

这是 {{parties}} 的协作仓库。人和 Agent 在这里对齐需求、已确认的约定、各方说明和接口文件。聊天记录只是草稿。代码仍在各自的产品仓库里写。

两个前端可以只在本仓库里互相约定，不必每次都拉上后端。谁参加一份需求，写在该需求的「参与方」里。

远程：`{{remote_url}}`

工作分支是 `agents`。Agent 的日常读写、拉取、推送都走它，不读取、不推送 `main`。人从 `agents` 向 `main` 提合并请求。

本地不要把本仓库克隆到别的路径。在每个产品仓库里：

```
.collab/identity.toml                 本机身份，不提交
.collab/{{checkout_dir}}/             本仓库的检出，使用分支 agents
```

产品仓库的 `.gitignore` 必须包含 `.collab/` 和 `.apifox/`。进入检出之后按 `AGENTS.md` 开工。

## 目录

| 路径 | 谁来写 | 里面是什么 |
|---|---|---|
| `AGENTS.md` | 规则变更时直接提交到 `agents` | Agent 和人每次协作都要遵守的步骤 |
| `collaborators.md` | 协作者自己追加 | 身份、参与方、所属仓库。只写自己 |
| `parties/<id>/` | 这一方的第一位协作者 | 给其他方看的说明。`domains/` 按业务域一篇 |
| `parties/<id>/README.md` | 这一方的第一位协作者 | 角色。代码仓库在本人登记时写入 |
| `parties/_domain.md` | 初始化时放入 | 业务域说明的空模板 |
| `reqs/` | 提出需求的人 | 需求文件和索引。讨论不写在这里 |
| `reqs/_template.md` | 初始化时放入 | 新需求的空模板 |
| `api/<提供方>/` | 该提供方的角色 | 发布出来的接口文件，可以有多份 |

`parties/` 现有 {{parties}}。新的一端由该端第一位协作者登记名册时建立。不要预先收集别人的仓库地址。

产品仓库里的实现文档给该仓库自己的 Agent 看。其他方要依赖的行为，以本仓库 `agents` 分支上的 `parties/` 和 `reqs/` 为准。

## 一份需求从提出到完成

1. 在 `reqs/` 新增 `<主题>-<三位序号>.md`，状态写 `讨论中`，索引加一行。同时开一个 Issue，贴上 `discussing` 和需要响应的 `to-*` 标签。
2. 问题、答复、接口变更申请都写在这个 Issue 的评论里。评论以 `[角色/昵称]` 开头，并用 `re:<评论 URL>` 对上原句。
3. 不是原评论作者的人写下 `✅ 确认` 之后，把该结论写入需求文件的「约定」并推送到 `agents`。
4. 约定都落地后，状态改为 `已确认`。相关代码在产品仓库实现并合入后，改为 `已实现`，写上产品仓库提交号，关闭 Issue。

步骤细节在 `AGENTS.md`。

## 接口

调用方只读 `api/<提供方>/`。需要改接口时在对应 Issue 里提出，由提供方从自己的代码生成文件再提交到该目录。不要在前端仓库里维护第二份接口定义。

给人浏览或跑测试的工具不是本仓库的替代品。是否使用、用哪一个，写在 `api/README.md`。

## 命令

评论命令必须带上正文，避免打开编辑器。路径里的 `/` 在 API 地址中写成 `%2F`。

<!-- platform:gitlab -->

列出派给自己的 Issue：

```bash
glab issue list -R {{gitlab_path}} --label to-fe
```

查看评论：

```bash
glab issue view 12 -R {{gitlab_path}} --comments
```

新开一条讨论。`{{gitlab_path_encoded}}` 是仓库路径，每个 `/` 写成 `%2F`：

```bash
glab api -X POST "projects/{{gitlab_path_encoded}}/issues/12/discussions" -f body="$(cat <<'EOF'
[fe/cursor-k]
问 @backend：……
EOF
)"
```

回复已有讨论时，把讨论 id 填进去：

```bash
glab api -X POST "projects/{{gitlab_path_encoded}}/issues/12/discussions/DISCUSSION_ID/notes" -f body="$(cat <<'EOF'
[be/claude-01] re:https://gitlab.example/group/repo/-/issues/12#note_1
答：……
EOF
)"
```

讨论挂不上时：

```bash
glab issue note 12 -R {{gitlab_path}} -m "$(cat <<'EOF'
[be/claude-01] re:<评论 URL>
答：……
EOF
)"
```

改标签、开单、关闭：

```bash
glab issue update 12 -R {{gitlab_path}} --label to-be --unlabel to-fe
glab issue create -R {{gitlab_path}} -t "标题" -d "$(cat <<'EOF'
正文
EOF
)" -l discussing,to-be
glab issue close 12 -R {{gitlab_path}}
```

补标签（已存在就跳过）：

```bash
glab label create -R {{gitlab_path}} --name discussing --color "#FBCA04" --description "讨论中"
glab label create -R {{gitlab_path}} --name confirmed  --color "#0E8A16" --description "已确认"
glab label create -R {{gitlab_path}} --name done       --color "#5319E7" --description "已实现"
glab label create -R {{gitlab_path}} --name wontfix    --color "#B60205" --description "已废弃"
glab label create -R {{gitlab_path}} --name to-pm      --color "#C5DEF5" --description "待产品处理"
glab label create -R {{gitlab_path}} --name to-be      --color "#BFD4F2" --description "待后端处理"
glab label create -R {{gitlab_path}} --name to-fe      --color "#D4C5F9" --description "待前端处理"
glab label create -R {{gitlab_path}} --name to-qa      --color "#FEF2C0" --description "待测试处理"
glab label create -R {{gitlab_path}} --name to-ops     --color "#C2E0C6" --description "待运维处理"
```

把 `to-fe` 换成 `to-pm`、`to-be`、`to-qa` 或 `to-ops`。

<!-- /platform:gitlab -->

<!-- platform:github -->

列出派给自己的 Issue：

```bash
gh issue list --repo {{github_path}} --label to-fe --state open
```

查看评论：

```bash
gh issue view 12 --repo {{github_path}} --comments
```

发表评论。GitHub Issue 没有楼中楼，用 `re:` 对上原句：

```bash
gh issue comment 12 --repo {{github_path}} --body "$(cat <<'EOF'
[fe/cursor-k] re:https://github.com/org/repo/issues/12#issuecomment-1
问 @backend：……
EOF
)"
```

改标签、开单、关闭：

```bash
gh issue edit 12 --repo {{github_path}} --add-label to-be --remove-label to-fe
gh issue create --repo {{github_path}} --title "标题" --body-file ./issue-body.md --label discussing --label to-be
gh issue close 12 --repo {{github_path}} --reason completed
gh issue close 12 --repo {{github_path}} --reason "not planned"
```

补标签：

```bash
gh label create discussing --repo {{github_path}} --description "讨论中" --color FBCA04 --force
gh label create confirmed  --repo {{github_path}} --description "已确认" --color 0E8A16 --force
gh label create done       --repo {{github_path}} --description "已实现" --color 5319E7 --force
gh label create wontfix    --repo {{github_path}} --description "已废弃" --color B60205 --force
gh label create to-pm      --repo {{github_path}} --description "待产品处理" --color C5DEF5 --force
gh label create to-be      --repo {{github_path}} --description "待后端处理" --color BFD4F2 --force
gh label create to-fe      --repo {{github_path}} --description "待前端处理" --color D4C5F9 --force
gh label create to-qa      --repo {{github_path}} --description "待测试处理" --color FEF2C0 --force
gh label create to-ops     --repo {{github_path}} --description "待运维处理" --color C2E0C6 --force
```

把 `to-fe` 换成 `to-pm`、`to-be`、`to-qa` 或 `to-ops`。

<!-- /platform:github -->
