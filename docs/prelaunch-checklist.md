# 上线前检查表 · 医保政策实时监测工作台（只读分享版）

> 检查依据：`docs/site-spec.md` 第 7 节「验收标准（上线前逐条勾选）」8 条 + 部署检查。
> 检查方式：本文件记录的两类证据——
> **① 静态实测**：本次用本地 Python / 正则扫描对真实产物执行的检查，结果可直接复跑；
> **② 运行时实测**：由 `frontend-engineer` / `backend-engineer` 在真浏览器三档视口完成的验证（见各任务回报）。
> 凡涉及**已部署在线 URL** 的结论，本表一律标记 `PENDING`，由主理人部署后回填真实地址与实测结果；未回填前不宣称「已上线」。

检查对象与关键事实：

| 项 | 值 |
|---|---|
| 数据产物 | `policies.json` 664 行 / `state.json` 3 行 / `kb.json` 664 行，`generatedAt=2026-11-17T10:02:24+08:00` |
| 三级分布（以 `state.json` 的 `counts.byLevel` 为准） | 玉溪市 57 / 云南省 541 / 国家 66 |
| `index.html` | 747144 字节，CRLF 14311 处，孤立 LF 0 处 |
| 目标发布地址 | GitHub Pages `https://Bing-ing-ic.github.io/yibao-policy-workbench/`（待部署回填）；EdgeOne Pages 地址待定 |

---

## A. 契约第 7 节验收标准 8 条

| # | 验收项 | 判定 | 证据 |
|---|---|---|---|
| 1 | 打开发布 URL 显示真实政策数据，无「本地模式」「未检测到资料库运行环境」「云端查询被拒绝」提示 | **PENDING** | 在线地址尚未部署。已有前置证据：`site/scripts/data-shim.js` 第 251–260 行在注入 `database` 的同时设置 `__realImpls__.database`，规避源页面 2.1 秒 RPC 兜底覆盖；三份 JSON 已含真实数据（664/3/664 行，本次静态实测）。`frontend-engineer` 已在真浏览器三档视口验证真实数据渲染。**部署后需用真实 URL 复验并回填。** |
| 2 | 国家 / 云南省 / 玉溪市三级政策栏各有 ≥1 条真实条目 | **PASS** | 本次静态实测：`policies.json` 按 `行政层级` 计数为 云南省 541 / 玉溪市 57 / 国家 66，三级均 ≥1；与 `site/data/state.json` 第 20 行 `counts.byLevel` 完全一致。 |
| 3 | 政策卡片标题、发布日期、发布机构与 `policies.json` 对应行一致 | **PASS** | 本次静态实测：`policies.json` 首行含契约 §5.4.1 全部必填键，示例 `_id=YB-2026-001`、`政策标题=关于进一步明确基层医疗卫生机构“免收一般诊疗费”有关事项的通知`、`发布日期=2022-01-01`、`发布机构=云南省卫生健康委员会、云南省医疗保障局、云南省财政厅`；全量 664 行无空 `发布日期`、无非法 `原文链接`。渲染映射由 `data-shim.js` 直通原页面 `rowToPolicy()`，前端未做字段改写（运行时已由 `frontend-engineer` 三档视口核对）。 |
| 4 | 控制台执行 `query({databaseId:'SyW9fBCPF4zBCd9EMdNlNm',pageSize:50})` 返回 `results/nextCursor/hasMore/total` 且 `results.length>0` | **PASS（静态契约）** | 本次静态实测：`site/scripts/data-shim.js` 第 122–145 行 `query()` 返回对象恰为 `{results, nextCursor, hasMore, total}`，游标为十进制字符串偏移、`hasMore=(offset+pageSize)<total`，与契约 §5.3 一致；`SOURCES` 第 31–35 行含政策库 ID。**浏览器控制台实跑由部署后在线复验项覆盖（见 B 区 PENDING-1）。** |
| 5 | `addRecord({})` 被拒绝并提示「只读部署版不可写入」；写类按钮被拦截/隐藏，顶部有只读徽标 | **PASS（静态契约）** | 本次静态实测：`data-shim.js` 第 227–247 行将 `addRecord/updateRecord/deleteRecord/uploadImage/uploadFile` 等以 `writable:false, configurable:false` 定义为 `reject(E_READONLY)`，提示文案见第 10 行「只读部署版不可写入」；`site/index.html` 中「只读」出现 35 次、「只读分享版」13 次，只读徽标与写类守卫已内联。**浏览器实跑 reject 与徽标可见性由部署后在线复验项覆盖（见 B 区 PENDING-1）。** |
| 6 | `site/index.html` 通过 CRLF 校验 | **PASS** | 本次静态实测（`open('site/index.html','rb').read()`）：字节数 747144，`0D 0A` 计 14311 处，剥离 CRLF 后孤立 `0A` 计 **0** 处，满足「唯一换行序列为 CRLF」。 |
| 7 | 全仓库无 `<script src="http...">` / `<link href="http...">` 外链；无凭证实际值 | **PASS** | 本次静态实测：对 `site/index.html` 正则扫描，`<script src=http…>` 命中 **0** 处、`<link href=http…>` 命中 **0** 处；`data-shim.js` 以同步 `<script src="./scripts/data-shim.js">` 注入（无 `defer`/`async`，出现在页面脚本之前，字符偏移 261）。凭证扫描（各类 API Key、鉴权头值、令牌前缀、本地绝对路径）在 `site/` 与本次新增的 `README.md`、本检查表、workflow 中命中 0 处；仅施工依据 `docs/site-spec.md` 中出现路径与凭证的**文字级反例说明**（非发布内容，不随站点发布）。 |
| 8 | 打印页头含「只读分享版 · 同步自主版工作台 · 不可修改数据」与数据截止日期 | **PASS（静态）/ PENDING（打印实测）** | 本次静态实测：`site/index.html` 中「不可修改数据」出现 1 次、「同步自」2 次、打印溯源文案存在；数据截止日期取自 `freshness.lastCheckedAt`（`site/data/state.json` 第 15 行 `2026-11-17T10:02:24+08:00`）。**打印预览的实际版式由部署后在线复验项覆盖（见 B 区 PENDING-1）。** |

---

## B. 部署检查与 PENDING 项

| # | 检查项 | 判定 | 证据 / 说明 |
|---|---|---|---|
| B-1 | `robots.txt` 存在且允许抓取 | **PASS（静态）/ PENDING（HTTP 200）** | `site/robots.txt` 实测内容为 `User-agent: *` + `Allow: /`，未设置 `Disallow`，注释说明单页站点暂不提供 sitemap。在线可访问性需部署后 `curl` 验证并回填。 |
| B-2 | 数据新鲜度 workflow 语法与权限 | **PASS（静态）** | 本次静态实测：`PyYAML 6.0.3` 严格 `safe_load` 解析通过，无 TAB 缩进；顶层键 `name/on/permissions/jobs` 完整，`on.schedule.cron='30 0 * * *'`、`workflow_dispatch` 存在，`permissions={contents:read, issues:write}`，`jobs.freshness-check.steps` 共 2 步（checkout + github-script，内嵌脚本 82 行）。仅用自动提供的 `secrets.GITHUB_TOKEN`，无凭证字面量、无写数据文件步骤、只读 `state.json`。注：PyYAML 按 YAML 1.1 把裸键 `on` 解析为布尔 `True`，这是解析器 quirk，GitHub Actions 用 YAML 1.2 语义识别 `on` 为字符串键，workflow 正确。权限见文内注释与下节说明。 |
| B-3 | 构建产物与环境变量 | **PASS** | `tools/build_data.py` 与 `tools/README.md` 已就位，路径参数化为 `YIBAO_REGISTRY` / `YIBAO_OUT`，仓库内无本地绝对路径；三份 JSON 可 `json.load` 且 `meta.rowCount == len(rows)`（664/664、3/3、664/664，本次实测）。 |
| **PENDING-1** | **GitHub Pages 在线地址** `https://Bing-ing-ic.github.io/yibao-policy-workbench/` 部署后复验 | **PENDING** | 主理人执行建仓、推送、启用 Pages 后回填：① 页面真实数据渲染、无降级提示；② 浏览器控制台 `query()` 返回结构与 `addRecord()` reject；③ 只读徽标可见、写类按钮被拦截；④ 打印页头版式；⑤ `robots.txt` 与三份 JSON 的 HTTP 200；⑥ 桌面/平板/手机三档视口。 |
| **PENDING-2** | **EdgeOne Pages 在线地址** 部署后复验 | **PENDING** | 地址待主理人部署后回填，复验内容同 PENDING-1。 |
| B-4 | 性能数字（首屏时间 / LCP / 资源体积与数量 / 缓存头） | **N-A（部署前无法测量）** | 未部署即无真实 URL 与响应头，不编造数字。建议部署后按 PENDING-1 的两个地址分别采集，并给出优化前后对比；本项不构成本次上线的阻塞项。 |

---

## 汇总

- 静态可判定项：**PASS 11 项**（A-2、A-3、A-4、A-5、A-6、A-7、A-8 静态部分、B-1 静态部分、B-2、B-3，以及 A-1 的前置静态证据），**FAIL 0 项**。
- 在线复验项：**PENDING 2 组**（GitHub Pages、EdgeOne Pages），由主理人部署后回填。
- 无 FAIL 项；但**两个在线地址未回填前，本表不构成「已上线」结论**。

## freshness-check workflow 权限说明（需用户/主理人知悉）

- workflow 使用 GitHub 自动提供的 `secrets.GITHUB_TOKEN`，由 `actions/github-script` 默认注入，**文件内无任何凭证字面量**。
- 创建 Issue 需要 `issues: write`；检出仓库需要 `contents: read`。已在 workflow 顶部用 `permissions:` 显式声明这两项。
- 若仓库或组织把 Actions 默认 Token 权限设为「只读」，并禁止工作流自行提权，则 `issues: write` 可能不生效、创建 Issue 会失败。此时需仓库管理员在 **Settings → Actions → General → Workflow permissions** 中选择 **Read and write permissions**（或由组织策略放行该仓库的 Actions 写 Issue 权限）。
- 该 workflow 为**独立任务**，只读取数据文件，不提交、不改写任何 JSON；其失败不会影响 GitHub Pages 发布（Pages 由独立部署流程触发，二者无依赖关系）。创建 Issue 失败时脚本降级为 `core.warning`，不使任务硬失败。
