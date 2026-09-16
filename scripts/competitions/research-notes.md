# 教育部白名单（2025—2028学年）调研笔记

调研日期：2026-09-16。数据产出：`scripts/competitions/registry.json`。

## 名单公告

- 公告名称：教育部办公厅关于公布2025—2028学年面向中小学生的全国性竞赛活动的通知（教监管厅函〔2025〕7号）
- 公告 URL：http://www.moe.gov.cn/srcsite/A29/202510/t20251029_1418393.html （moe.gov.cn 官网原文）
- 名单附件（.doc）：http://www.moe.gov.cn/srcsite/A29/202510/W020251029471803160286.doc（若失效以公告页附件链接为准）
- 印发日期：2025-10-22（通知落款，registry 的 publishedAt 采用此日期）；官网生成日期 2025-10-24，网页发布日期 2025-10-29。
- 赛事总数：47 项。分类：自然科学素养类 22 项（序号 1–22）、人文综合素养类 12 项（23–34）、艺术体育类 13 项（35–47）。序号跨类别连续编号，与公告一致。
- 举办时间原则上为 2025年10月至2028年8月，每学年不超过 1 次、累计不超过 3 次。
- 交叉核对：教育部"全国校外教育培训监管与服务综合平台" https://xwpx.eduyun.cn/tol/toHomePageCompetitionActivities 同步公布了 47 项的主办单位、面向学段与举报渠道，与公告附件逐项一致。
- grades 映射：公告原文为"小学、初中、普通高中、中职"。registry 枚举为 小学/初中/高中/中专/职高，映射规则：普通高中→高中；中职→中专、职高（两个枚举值均计入）。

## 官网确认方式

- 默认用 FetchURL 实际访问并确认落地页内容（能识别赛事/主办方名称视为确认）。
- 个别站点拦截 FetchURL 或为 SPA，改用 curl 确认 HTTP 200，已在下表标注。
- 调研中发现多个同模板 SEO 仿冒/聚合站（如 dgboshi.cn、shuikejicn.cn、anquanyingji.cn、hschuancheng.cn、tszhbs.cn、xijuzg.com 等），均未采用；CESO 官网亦有防仿冒公告佐证 ceso.ssoc.org.cn 为正牌。

## 逐项确认状态

| # | 赛事 | officialSite | 状态与依据 |
|---|------|--------------|------------|
| 1 | 全国青少年人工智能创新挑战赛 | http://aiic.china61.org.cn/ | FetchURL ✓ 赛事专题站；主办方 china61.org.cn 通知指明该网址 |
| 2 | 世界机器人大会青少年机器人设计与信息素养大赛 | https://www.worldrobotconference.com/ | FetchURL ✓；竞赛页 /contest/YouthRobotDesignContest/2026.html 明确"主办单位：中国电子学会" |
| 3 | 全国青少年无人机大赛 | http://www.int-ede.com/ | curl HTTP 200（FetchURL 网络失败）；中国航空学会第十届大赛通知写明该网址为官方网站 |
| 4 | 宋庆龄少年儿童发明奖 | https://sclaci.sclc2017.org/ | FetchURL ✓ 含"通知公告"栏目 |
| 5 | 全国中学生天文知识竞赛 | https://www.bjp.org.cn/qgzxstwzsjs/ | FetchURL ✓ 北京天文馆竞赛专栏 |
| 6 | "地球小博士"全国地理科普知识大赛活动 | http://www.geodoctor.cn/ | FetchURL ✓；中国地理学会官网声明"大赛官方网站为 www.geodoctor.cn" |
| 7 | 全国中学生水科技发明比赛暨斯德哥尔摩青少年水奖中国区选拔赛 | https://www.naturesch.cn/ | FetchURL ✓ 生态环境教育信息服务平台；主办方第23届通知指定 naturesch.cn 为报送网站；新闻列表用 chinaeol.net/tzgga/ |
| 8 | 全国中学生地球科学奥林匹克竞赛 | https://ceso.ssoc.org.cn/ | FetchURL ✓ 含赛事公告/新闻资讯 |
| 9 | 全国中学生数学奥林匹克竞赛 | https://www.cms.org.cn/ | FetchURL ✓ 中国数学会官网 |
| 10 | 全国中学生物理奥林匹克竞赛 | https://www.cps-net.org.cn/ | FetchURL ✓ 中国物理学会官网 |
| 11 | 全国中学生化学奥林匹克竞赛 | https://www.chemsoc.org.cn/ | FetchURL ✓ 中国化学会官网 |
| 12 | 全国中学生生物学奥林匹克竞赛 | http://www.botany.org.cn/swxjs/zchssxz/ | FetchURL ✓ 中国植物学会"生物学竞赛"栏目；中国动物学会官网 https://www.czs.org.cn/ 已验证（列 newsPages） |
| 13 | 全国中学生信息学奥林匹克竞赛 | https://www.noi.cn/ | FetchURL ✓ NOI 官网（CCF） |
| 14 | 全国青少年科技创新大赛 | https://cyscc.org/castic/ | FetchURL ✓ 中国科协青少年科技中心官网大赛专区 |
| 15 | 全国青少年航天创新大赛 | http://nysic.declare.htgjjl.com/ | FetchURL ✓ 大赛官网（2025—2026学年通知称其为"大赛官方信息唯一指定发布平台"） |
| 16 | 丘成桐中学科学奖 | https://www.yau-awards.com/ | FetchURL ✓ 含通知公告栏目 |
| 17 | 全球发明大会（中国）竞赛活动 | https://icc.cffpd.org.cn/ | FetchURL ✓ ICC 官网（中国友好和平发展基金会域名下） |
| 18 | 全国青少年人工智能大赛 | https://aic.cwicp.cn/ | FetchURL ✓；2026-02-04 官网上线（上观新闻/中新网报道） |
| 19 | 全国青少年科学实验能力大赛 | https://www.ceeia.cn/ | FetchURL ✓ 主办方中国教育装备行业协会官网；大赛通知发布于"工作动态"栏目 /news/1/ |
| 20 | 全国青少年科学探究建模能力大赛 | https://simcc.bnu.edu.cn/sszn/index.htm | FetchURL ✓ 北师大大赛官网；赛事公告栏目 /ssgg/index.htm 已验证 |
| 21 | 全国青少年心理成长知识与应用创新大赛 | https://www.camh-edu.org.cn/ | FetchURL ✓ 大赛官网（甘肃/云南赛区通知均指向该站注册报名） |
| 22 | 全国青少年安全与应急科普创新大赛 | https://www.nyseic.cn/ | FetchURL ✓ 大赛官网；主办方中国灾害防御协会官网公告确认 |
| 23 | 全国青少年禁毒知识竞赛 | https://www.2-class.com/ | FetchURL ✓（200，页面为 SPA）；青骄第二课堂为官方参赛/答题平台 |
| 24 | 世界华人学生作文大赛 | http://www.zuowendasai.com/ | FetchURL ✓；中国侨联第27届启事声明官网为 zuowendasai.com |
| 25 | "外研社杯"全国中学生外语素养大赛 | https://events.fltrp.com/ | FetchURL ✓ 外研社官方赛事平台 |
| 26 | 高中生创新能力大赛 | https://www.iccedu.com.cn/ | FetchURL ✓；大赛动态列表 /cms/mingdan.html 已验证 |
| 27 | 全国中学生环境保护优秀作文征集活动 | http://www.huanbaozuowen.com/ | FetchURL ✓ 第七届大赛官网 |
| 28 | "美丽中国"全国版图知识竞赛（中小学组） | https://www.pecmnr.cn/gjbt/ | FetchURL ✓；多省自然资源厅通知指定该竞赛官网 |
| 29 | 全国青少年劳动技能与智能设计大赛 | http://aild.org.cn/ | curl HTTP 200（FetchURL 网络失败）；动态列表 /news.aspx curl 200；中国自动化学会镜像站 aild.caa.org.cn 已 FetchURL 验证 |
| 30 | 中华诗词美育大赛 | http://www.zhscmyds.com/ | FetchURL ✓ 大赛官网（明确名单第30项）；中华诗词学会官网 zhscxh.com 发布大赛章程 |
| 31 | 鲁迅青少年文学大赛 | https://www.luxunwenxue.com/ | FetchURL ✓；大赛组委会反仿冒声明确认其为唯一官网 |
| 32 | 全国青少年红色文化传承与实践创新大赛 | https://www.hswh.org.cn/ | FetchURL ✓ 主办方中国红色文化研究会官网；会员之家栏目 /wzzx/hyzx/ 含多条大赛通知/声明 |
| 33 | "讲好中国故事"全国中小学语言素养大赛 | https://www.centv.cn/ | FetchURL ✓ 主办方中国教育电视协会通过中国教育网络电视台发布公告；截至调研日未见独立赛事官网 |
| 34 | 同颂中华·全国青少年志愿文学创作与诵读大赛 | http://h5.cyol.com/special/2025baimingdan/share/index.html | FetchURL ✓ 中国青年报大赛官方 H5 页面；官方唯一参赛平台为中国青年报客户端 |
| 35 | 全国中小学生绘画书法作品比赛 | https://www.ccc.org.cn/ | FetchURL ✓ 主办方中国儿童中心官网；赛事动态栏目 /col/col283/ 已验证；官方唯一报名渠道为微信公众号"学与玩杂志" |
| 36 | "我爱祖国海疆"全国青少年航海模型教育竞赛 | https://cmma.sports.cn/jyjs/wazghj/ | FetchURL ✓ 中国航海模型运动协会官网专栏 |
| 37 | "驾驭未来"全国青少年车辆模型教育竞赛 | http://cmac.sports.cn/ | FetchURL ✓ 中国车辆模型运动协会官网；通知公告栏目 /tzgg/ 已验证 |
| 38 | 全国青少年模拟飞行锦标赛 | https://www.sport.gov.cn/hgzx/ | FetchURL ✓ 主办方国家体育总局航管中心官网；公告列表 /hgzx/n11026/index.html；另有赛事服务平台 http://yg.asfcyy.com/gs 可作补充渠道 |
| 39 | "飞向北京·飞向太空"全国青少年航空航天模型教育竞赛活动 | http://www.asfc.org.cn/ | FetchURL ✓ 中国航空运动协会官网；公告栏目 /dynamic/announcement/ 已验证；竞赛规程 PDF 发布于 sport.gov.cn/hgzx |
| 40 | 全国青少年传统体育项目比赛 | http://www.cnypa.org/qgqsncttyxmbs/index.jhtml | FetchURL ✓ 中国青少年宫协会官网比赛专栏；报名平台 qsnedu.com 返回 403（需浏览器），仅作补充 |
| 41 | "希望颂"——全国青少年书画艺术大展 | http://www.xiwangsong.com/ | curl HTTP 200（SPA，FetchURL 无法提取正文）；多届征稿启事写明官网为 www.xiwangsong.com |
| 42 | 全国中小学生海洋文化创意设计大赛 | http://mcdnpss.com/ | FetchURL ✓ 大赛官网；三主办方联合征集公告指定其为官网报名通道 |
| 43 | 全国青少年国防素养大赛 | https://www.gfsy.org.cn/ | FetchURL ✓ 大赛官网（南理工及新华网报名通知均指向该站） |
| 44 | "戏剧中国"全国青少年戏剧文化艺术大赛 | https://www.zgxjwxxh.com/ | FetchURL ✓ 主办方中国戏剧文学学会官网；动态栏目 /list.html?section=news 含2025-11-29大赛通知 |
| 45 | 全国青少年人工智能辅助生成数字艺术创作者大赛 | https://www.mcasc.com.cn/ | FetchURL ✓ 主办方文化和旅游部艺术发展中心官网；通知公告栏目 /tongzhis/ 已验证 |
| 46 | 学校美育助力行动——青少年视觉艺术传承与创新工作坊展示 | https://www.ccpae.cn/ | FetchURL ✓ 中国艺术教育促进会官网，首页即活动通知与报名入口（2025-12-01 至 2026-03-31） |
| 47 | "常青藤"全国青少年校园戏剧创意大赛 | http://cqtxj.org.cn/ | FetchURL ✓ 大赛官网（含大赛动态/成绩查询）；主办方中央戏剧学院官网通知可作补充 |

## 统计

- 总数 47：自然科学素养类 22、人文综合素养类 12、艺术体育类 13。
- 官网确认率 47/47（100%）：44 项 FetchURL 落地页确认；3 项（#3 int-ede.com、#29 aild.org.cn、#41 xiwangsong.com）curl HTTP 200 确认；#33 为主办方官方公告平台（centv.cn），非独立赛事官网。
- 无 officialSite 为 null 的赛事。
