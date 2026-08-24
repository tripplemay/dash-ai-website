# Content Validation

本仓库的课程目录、逐课详情和资源目录使用 JSON 种子文件维护。基础校验器是只读的，不会重写或迁移任何数据。

在仓库根目录运行：

```bash
node scripts/validate-content.mjs
```

校验器会确认：

- `scripts/lessons-seed.json` 与 `scripts/lessons-content.json` 的课程键一致；
- 每门课程的课节数量一致，课节编号连续，并且两份数据合计均为 135 节；
- `scripts/resources-seed.json` 的 `file_key` 唯一且路径位于 `files/` 下；
- 每条资源都具备非空的中文/英文标题和分类字段（`title`、`title_en`、`category`、`category_en`）。

需要供 CI 或其他工具读取结构化结果时，使用 `--json`：

```bash
node scripts/validate-content.mjs --json
```

通过时退出码为 `0`，发现数据问题或参数错误时退出码为 `1`。脚本不依赖 `node_modules`，也不需要修改 `package.json`。
