<!-- cross-repo-collab:start -->
## 跨仓库协作

跨仓库的需求、约定和接口文件在 `.collab/{{checkout_dir}}/`，正本是该检出里的 `agents` 分支。Agent 只操作这个分支。人从 `agents` 向 `main` 提合并请求。

这些时机要先进入该目录，执行 `git fetch origin --prune`、`git checkout agents`、`git pull --rebase origin agents`，再读 `AGENTS.md`：

- 这次会话第一次涉及需求、接口、错误码、字段或另一端行为之前
- 修改接口定义、请求或响应之前
- 实现依赖另一端的功能之前

这些时机要把结论写回该目录并推送到 `agents`，不必等用户吩咐：

- 跨端行为已经说定：写进对应 Issue；已确认的行为写入需求文件的「约定」
- 本仓库生成了接口文件：提交到 `api/<提供方>/`，并在原评论下回复路径
- 本仓库相关改动已经合入：需求改为 `已实现`，写上产品仓库提交号
- 约定或接口文件不够用：在 Issue 里提问或写「接口变更申请」

步骤以 `.collab/{{checkout_dir}}/AGENTS.md` 为准。
<!-- cross-repo-collab:end -->
