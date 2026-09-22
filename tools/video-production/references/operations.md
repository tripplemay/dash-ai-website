# 本机工具包操作

## 路径与启动

`CLI` 指向本 Skill 的 `scripts/video.py`；`WORKSPACE` 是存放多个项目的目录；`PROJECT` 是其中一个项目。
项目目录名使用 ASCII 字母、数字、下划线、连字符。媒体不要放在 Skill 目录。

```sh
python3 "$CLI" doctor
python3 "$CLI" --project "$PROJECT" init --title "新视频" --brief brief.json
python3 "$CLI" --project "$PROJECT" root sources /absolute/path/to/source-assets
python3 "$CLI" --project "$PROJECT" ingest /absolute/path/to/source-assets/shot.mp4 --root sources --role visual --unit S001 --label "S001 v1"
python3 "$CLI" --project "$PROJECT" status
python3 "$CLI" --project "$PROJECT" check asset-ID
python3 "$CLI" serve --workspace "$WORKSPACE" --port 8877
```

访问 `http://127.0.0.1:8877`。不绑定公网，不作为多用户服务部署；本机台账没有账户认证，审阅人是操作记录而非密码学身份。
首次使用可在浏览器查看候选、同秒对照、监听干声/混音、记录时间反馈、逐维度签收。
比较不同时间线时相同秒数不代表同一语义，需依据实际镜头定位。

状态存于 `PROJECT/.video-production/state.sqlite`，SQLite 事务、WAL、revision 防止并发覆盖。
事件表记录操作和 revision；批准、反馈、任务历史保留在状态内。它不是防篡改审计系统。
关闭服务器及其他写入者后，备份整个项目目录（含隐藏目录）；仍使用的外部来源根必须另外备份。
迁移前检查外部来源绝对路径；本版没有自动重定位根目录或云同步。

## 生成台账 / 恢复

工具包不提交付费生成。以下流程把外部 CLI / 网页步骤纳入可恢复台账：

1. 检查真实工具能力/登录/费用；用户明确授权后设置预算。
2. `prepare-job request.json` 保存请求指纹和输入 SHA；相同活动/成功请求拒绝重复创建。
3. 外部提交**之前** `job-state JOB submitting --evidence "用户授权范围和费用上限"`。
4. 使用已授权的原生 CLI/网页提交一次，立即把返回的原任务 ID 登记为 `accepted`。
5. 成功/失败以原任务查询证据登记。返回不明或进程中断时改为 `unknown`，先找回原任务。
6. 未知、处理中或成功的同一请求不能重新提交；不要通过改提示词绕过去重。

```json
{"provider":"dreamina","action":"frames2video","unit":"S001",
 "inputs":["asset-FIRST","asset-LAST"],
 "parameters":{"prompt":"已确认的提示词","model_version":"执行前核对"},
 "estimated_cost":5,"cost_unit":"credits"}
```

```sh
python3 "$CLI" --project "$PROJECT" budget credits 20
python3 "$CLI" --project "$PROJECT" prepare-job request.json
python3 "$CLI" --project "$PROJECT" job-state JOB submitting --evidence "用户授权单段，上限 5 credits"
# 此处才由助手使用真实工具提交一次；本工具包不会提交。
python3 "$CLI" --project "$PROJECT" job-state JOB accepted --submit-id ORIGINAL_ID --evidence "CLI 返回原任务 ID"
python3 "$CLI" --project "$PROJECT" query-job JOB
python3 "$CLI" --project "$PROJECT" job-state JOB succeeded --evidence "原任务查询 success" --actual-cost 5
python3 "$CLI" --project "$PROJECT" download-job JOB --role visual
```

`query-job` 只查询已登记原 ID，保存脱敏观察，不猜测不同版本服务端的成功枚举。
`download-job` 仅对已核实成功的原任务下载，新目录、登记 SHA、全流解码，不重提生成。
网页 TTS 可用 `provider: "dreamina-web-tts"` 手工记账，下载后 `ingest`；没有 CLI TTS 适配器。
失败任务未知费用仍保留估算，不能默认退款。不同计价单位分开汇总；本版不从余额差推断费用。
结算或退款证据晚到时用 `job-cost JOB NET_AMOUNT --evidence "实际账单依据"` 更新净费用，保留历史，不重开终态任务。
本台账约束本工具内操作，不能阻止在网页或其他 CLI 中绕过台账重复提交。

## 验收与交付

反馈和批准绑定工件 ID + SHA；`scope:"full"` 才是完整范围。区间批准不算整片通过。
后续否决会使该维度需复核；新工件不继承旧批准。素材/依赖变化会阻止验收及交付。
导出需要 latest render、全解码、brief 指定的完整维度批准、无相关未处理反馈、设备与使用依据记录。
默认四维度；无声音或无 UI 的片子应在初始化 brief 中明确 `required_layers`，不得临时减项绕过验收。

工作台可操作批准/导出；CLI 也支持 JSON 文件：

```json
{"asset":"asset-ID","layer":"voice","decision":"approved","scope":"full","author":"实际审阅人","text":"实际完整审听结论"}
```

```sh
python3 "$CLI" --project "$PROJECT" review --data review.json
python3 "$CLI" --project "$PROJECT" release --data release.json
python3 "$CLI" --project "$PROJECT" export /new/path/to/delivery-v1
```

release JSON 字段为 `asset, author, device_review, rights_review`，均需真实记录。
交付目录不可已存在，包含母版、manifest 和 checksums；**不是全部来源素材的自包含工程包**。
manifest 保留来源信息但隐藏本机来源根，工程恢复仍需项目目录和原始媒体。

## 边界

全流解码不自动检测情绪、黑帧、响度、音画口型或语义。相关测试应在项目检查报告补充。
本版提供硬切 conform 和换轨，不提供可视化剪辑时间线、自动 ASR、自动混音或自动模型选择。
任务/费用恢复功能有模拟测试；真实付费 API、下载响应兼容性需下一次授权生产时再验证。
