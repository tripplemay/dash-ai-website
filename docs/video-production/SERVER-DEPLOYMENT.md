# 服务器部署：仅 SSH 隧道

工作台独立于官网部署，不增加 nginx location、域名、入站端口或官网登录入口。
Python 进程硬编码绑定 loopback；SSH 用户通过已有服务器授权建立隧道。

## 打开服务器工作台

使用你已有的服务器 SSH 别名或 `用户名@服务器地址`：

```sh
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:18877:127.0.0.1:18877 服务器SSH别名
```

保持该终端运行，浏览器打开 `http://127.0.0.1:18877`。Ctrl-C 关闭隧道。
18877 专用于远端隧道；原本机工作台仍可使用 8877。
本版 Host 检查要求浏览器端口与服务器端口一致，不能随意改为不同本地端口。
不要加 `-g` 或把隧道监听改成 `0.0.0.0`，也不要给 Python 服务添加公网代理。

本模式不是多用户权限系统：能访问该 SSH 隧道或服务器 loopback 的受信任用户能操作全部工作台项目。
逐人撤权在 SSH 层完成；需要项目级隔离或官网账号授权时另行实现。
部署验证使用 GitHub Actions 已有的部署 SSH 身份，没有创建、读取或分发个人私钥。

## 服务与数据

- 服务：`dash-video-workbench.service`，开机启动、异常退出自动重启。
- 运行账户：`dash-video`，无交互登录，非 root。
- 监听：`127.0.0.1:18877`，不监听公网或 IPv6 通配地址。
- 当前代码：`/opt/dash-video/current` -> `releases/<commit>-<run>-<attempt>`。
- 持久项目：`/opt/dash-video/projects`，权限 `dash-video:700`。
- 部署备份：`/opt/dash-video/backups/<commit>-<run>-<attempt>`。
- 健康：`/api/health`，包含确切提交 SHA 与项目目录可写状态，不包含 token 或本机路径。

首次部署只发布工具代码，项目列表为空。本机影片、配音、数据库和即梦登录状态不随代码上传。
后续导入需要单独转移媒体并重建服务器来源路径；不要直接复制含 macOS 绝对来源路径的 SQLite 台账冒充已迁移。

## 运维

```sh
sudo systemctl status dash-video-workbench
sudo journalctl -u dash-video-workbench -n 80 --no-pager
curl --fail http://127.0.0.1:18877/api/health
sudo -u dash-video /usr/bin/python3 /opt/dash-video/current/scripts/video.py \
  --project /opt/dash-video/projects/new-film init --title '新影片'
```

导入素材必须允许 `dash-video` 读取；Web 服务只能写持久项目目录。
服务重启后刷新浏览器，以获取新的写入 token。

## 发布与回滚

使用 `.github/workflows/deploy-video-workbench.yml`，复用仓库既有 SSH 密钥与固定主机公钥。
当前发布分支为 `release/video-production-*`，相关工具或部署文件更新会触发独立发布；不触发官网 main 部署。
工作流也声明了手动入口；在默认分支收录该工作流后可从 Actions 手动触发指定 ref。

顺序：CI 测试 -> 校验代码包 SHA -> 停止旧工作台 -> SQLite 一致性备份 -> 独立版本目录 -> 非 root 测试 -> systemd 切换 -> 版本/监听检查 -> 真实 SSH 隧道检查。
没有数据库 schema 迁移，也不重启官网 PM2。不会把旧 `main` 或其他未提交文件一起发到服务器。
切换前后的安装失败会恢复之前的工作台链接和 service 文件；旧 release 和数据库备份保留。
独立隧道验证失败会使 CI 失败，需要根据日志确认回滚；不把 CI 失败自动等同于远端未发生切换。

手工回滚前停止工作台，再用备份目录的 `previous-release` 和 `service.previous` 恢复链接与 service，执行 `daemon-reload` 和 `start`，核验 health SHA。
本版无 schema 迁移，通常无需还原数据库；不要覆盖回滚期间新增的用户反馈。
数据备份目前是本服务器本地备份，不是异地备份。
