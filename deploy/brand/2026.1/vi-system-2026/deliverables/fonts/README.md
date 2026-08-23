# CORECOORD 字体包

## 文件

| 文件 | 家族 | 版本 | 用途 | SHA-256 |
|---|---|---:|---|---|
| `NotoSansSC-VF.ttf` | Noto Sans SC | 2.004 | 中文/英文标题与正文，100–900 可变字重 | `d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964` |
| `NotoSansMonoCJKsc-VF.ttf` | Noto Sans Mono CJK SC | 2.004 | 代码、坐标、数据与技术标签，400–700 | `9fe57a71eb48e50cccb77903123d08857edefcf289c7b309462c4c3d82208126` |
| `OFL-1.1.txt` | SIL Open Font License | 1.1 | 许可证 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |

## 来源

- 官方仓库：`https://github.com/notofonts/noto-cjk`
- 固定发布标签：`Sans2.004`
- 标准字体：`Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf`
- 等宽字体：`Sans/Variable/TTF/Mono/NotoSansMonoCJKsc-VF.ttf`

选择 TTF 可变字体是为了用两个文件覆盖正式字重并提高跨平台兼容性。Logo 中的中英文仍使用官方转曲字形，不由这些字体重建。

运行 `download_fonts.sh` 会从固定标签重新下载到临时目录，校验 SHA-256 后替换本地副本。字体更新视为 VI 依赖变更，必须重新检查换行、字重和所有模板。

