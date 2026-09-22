# 本机视频制作工具包 v1

实施日期：2026-09-22。源代码与可复用 Skill：`tools/video-production/`。

## 现在如何使用

### 1. 直接打开工作台

本机服务入口：**http://127.0.0.1:8877**。

服务停止后在项目根运行：

```sh
python3 tools/video-production/scripts/video.py serve \
  --workspace output/video-workbench/projects --port 8877
```

这是独立 Python 服务，不需要启动官网、不写官网数据库、不开放到公网。
结束运行使用运行该命令的终端中的 Ctrl-C。不要把它配置成公网服务。

### 2. 下次让助手按流程制作

已安装个人 Skill：`~/.codex/skills/video-production`，软链接指向本仓库的工具包。
外置卷需要挂载；移动/删除本仓库会使软链接失效，届时重新安装完整目录或更新链接。
新会话可使用：

```text
请使用 $video-production 开始一个新视频项目。
用途：……
受众与核心信息：……
期望片长与硬上限：……
素材、平台、声音要求、预算与截止日期：……
先建项目、制定叙事和难点小样方案，未经我确认不要付费生成。
```

如果当前会话尚未重新发现 Skill，明确让助手读取
`~/.codex/skills/video-production/SKILL.md`。发现 Skill 不等于授权外部生成或自动批准。

### 3. 新项目初始化

```sh
CLI="$HOME/.codex/skills/video-production/scripts/video.py"
PROJECT="/absolute/path/to/video-projects/new-film"
python3 "$CLI" doctor
python3 "$CLI" --project "$PROJECT" init --title "新影片"
python3 "$CLI" --project "$PROJECT" root originals /absolute/path/to/media
python3 "$CLI" --project "$PROJECT" ingest /absolute/path/to/media/shot.mp4 \
  --root originals --role visual --unit S001 --label "S001 候选 v1"
python3 "$CLI" serve --workspace /absolute/path/to/video-projects --port 8877
```

正式项目先填写 Skill 中 `assets/brief.json`，以 `init --brief FILE` 导入。
项目名需为 ASCII 字母、数字、下划线或连字符；显示标题可以中文。
新项目的状态和媒体独立存放，不写回 Skill；外部来源根只读引用，不自动复制或迁移。

## 已实现

| 层次 | 能力 |
| --- | --- |
| Skill | 制作总流程；配音与情感；局部修订与时间线；工具操作；新项目模板 |
| 台账 | SQLite 持久化；事务与 revision；素材版本、SHA、元数据、递归依赖、当前渲染与批准交付分离 |
| 任务 | 请求指纹去重；输入 SHA；原任务 ID；状态恢复；预算预留；不同费用单位分账；晚到结算 |
| 即梦适配 | 原任务查询、脱敏观察、成功任务下载与媒体验证；不含付费提交或网页 TTS |
| 后期 | 相同 CFR/尺寸的显式帧范围硬切 conform；画面流复制换音轨；视频包哈希与时序保护 |
| 审阅 | 项目与候选列表、主版本切换、同秒 A/B 对照、干声/混音播放、旁白定位、时间点反馈、处理记录 |
| 验收 | 指定版本的画面/旁白/配乐/UI 四维度；技术与人工分开；新版本不继承旧批准；不完整验收阻止交付 |
| 导出 | 新目录母版、manifest、checksums；不覆盖；核验母版 SHA；不等于整套源工程打包 |
| 本机保护 | 仅 loopback；Host/Origin 检查；写入 token；根目录及 symlink containment；Range/HEAD 媒体播放 |

CLI 命令帮助：`python3 tools/video-production/scripts/video.py --help`。
完整操作说明：`tools/video-production/references/operations.md`。

## 本片导入状态

- 项目：`output/video-workbench/projects/corecoord-promo/`。
- 台账：`.video-production/state.sqlite`，位于上述项目目录内。
- 只读引用 7 个原工件，没有复制大视频或改动原 CURRENT 指针。
- 默认审阅：`jimeng-voice-20260922/full-v2/full_film_ui_jimeng_calm_pro_v2.mp4`。
- 当前整片 SHA：`1d605e7e16822a1d986952a8552289fc5d4f7b962f0d8ba1a18976e0b39f50cd`。
- 当前整片 1280×720、24 fps、152.875 秒；已重新核验 SHA、来源依赖、全流解码。
- 画面分支 v6 是 154.708 秒，不和声音/UI 分支混为同一时间线。
- 旧说明作为历史证据保留；**没有自动导入人工作品批准，没有新建正式交付批准**。
- 现有旁白 cue 可点击定位；排比修订首句约 125.412 秒，仍需要用户完整审听确认。

## 哪些仍是后续阶段

1. **付费提交自动化**：当前需使用真实工具经授权提交一次，再登记原任务。自动提交、轮询调度、排队、并发和额度联动尚未接入。
2. **网页 TTS**：仍在真实网页生成、下载、登记。本版没有伪造一个“CLI 沉稳声音”接口。
3. **高级后期**：ASR/精确对齐、响度测量/自动混音、几何修复、光流、字幕/UI 渲染不是通用内核能力，沿用独立可验证工序。
4. **完整生产工作台**：本版是轻量审阅台，不是在线剪辑器。没有拖拽 EDL、多用户账户、跨设备同步或自动艺术验收。
5. **生产适配器验证**：即梦查询/下载已做模拟响应验证，未为测试消耗额度；真实接口兼容性需下一次授权任务验证。

## 测试与恢复

```sh
python3 -m unittest discover -s tools/video-production/tests -v
node --check tools/video-production/web/app.js
```

浏览器测试使用 `tests/browser_fixture.py` 生成的色块/正弦波素材，独立于真实项目。
当前证据见 [VALIDATION-20260922.md](VALIDATION-20260922.md)。

关闭所有写入者后备份整个项目目录，包括隐藏的 `.video-production/`，以及所有外部来源目录。
只保存交付包不足以恢复源工程。台账可追溯但不防人为篡改；审阅人字段也不是身份认证。
运行状态与测试数据在 `output/video-workbench/`；工具代码与文档可提交 Git，本轮未提交、推送或部署。
