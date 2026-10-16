# skills

面向 AI Agent 的技能仓库（Agent Skills），通过 [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI 一条命令安装。

## 技能列表

### [cross-repo-collab](cross-repo-collab/SKILL.md)

多个代码仓库分开开发时（后端、用户端、管理端，仓库里既有开发者也有 Agent），用一个独立的 Git 协作仓库作为正本，集中管理需求、约定和接口文件：文件放已确认的内容，Issue 放讨论和派发。每个产品仓库把它检出到 `.collab/` 里。日常正本是 `agents` 分支，Agent 只读写这个分支，推送前先拉取。人从 `agents` 向 `main` 提合并请求。产品仓库的 `AGENTS.md` 和 `CLAUDE.md` 写明何时同步、何时把结论写回。

## 安装

需要 [Node.js](https://nodejs.org/) 环境：

```bash
# 安装指定技能
npx skills add impanne/skills --skill cross-repo-collab

# 或安装仓库内全部技能
npx skills add impanne/skills
```

CLI 会自动检测本机已安装的 Agent（Claude Code、Codex、Cursor、OpenCode 等），并把技能装入各自的技能目录。

查看已安装的技能：

```bash
npx skills list
```

## 使用

安装后无需额外配置，向 Agent 描述对应场景时技能自动生效，例如「后端和前端是两个仓库，需要一起管理需求和接口约定」。具体规则见各技能的 `SKILL.md`。

## License

[MIT](LICENSE)
