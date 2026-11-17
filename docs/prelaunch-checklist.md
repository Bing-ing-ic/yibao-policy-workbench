# 上线前检查表 · 医保政策实时监测工作台（只读分享版）

> 检查依据：`docs/site-spec.md` 第 7 节「验收标准（上线前逐条勾选）」8 条 + 部署检查。
> 检查方式：本文件记录三类证据——
> **① 静态实测**：本地 Python / 正则扫描对真实产物的检查，可直接复跑；
> **② 运行时实测**：真浏览器三档视口验证（见各任务回报）；
> **③ 在线实测**：2026-11-17 部署上线后对 `https://Bing-ing-ic.github.io/yibao-policy-workbench/` 的 HTTP 与浏览器实测（本版回填）。
> GitHub Pages 已上线并逐项回填；**EdgeOne Pages 未部署，相关项保持 `PENDING`，不虚报**。

检查对象与关键事实：

| 项 | 值 |
|---|---|
| 数据产物 | `policies.json` 664 行 / `state.json` 3 行 / `kb.json` 664 行，`generatedAt=2026-11-17T10:02:24+08:00` |
| 三级分布（以 `state.json` 的 `counts.byLevel` 为准） | 玉溪市 57 / 云南省 541 / 国家 66 |
| `index.html` | 747144 字节，CRLF 14311 处，孤立 LF 0 处 |
| 仓库 | `https://github.com/Bing-ing-ic/yibao-policy-workbench`（public，main 分支，commit `53df3db5bf8e`） |
| GitHub Pages 在线地址 | `https://Bing-ing-ic.github.io/yibao-policy-workbench/`（**已上线**，Pages build status = built） |
| EdgeOne Pages | 未部署（账号侧 workspace 创建失败），地址待定 |

---

## A. 契约第 7 节验收标准 8 条

| # | 验收项 | 判定 | 证据 |
|---|---|---|---|
| 1 | 打开发布 URL 显示真实政策数据，无「本地模式」「未检测到资料库运行环境」「云端查询被拒绝」提示 | **PASS（在线实测）** | 2026-11-17 线上浏览器实测：三档视口 `nonEmptyRows=64`、三级政策标题可见（如澄江市/云南省/国家医保相关条目）；`pageErrors=[]`，无降级提示文案。垫片第 251–260 行在注入 `database` 同时设置 `__realImpls__.database`，规避 2.1 秒 RPC 兜底覆盖。 |
| 2 | 国家 / 云南省 / 玉溪市三级政策栏各有 ≥1 条真实条目 | **PASS** | 静态实测 `policies.json` 按 `行政层级` 计数：云南省 541 / 玉溪市 57 / 国家 66，三级均 ≥1；与 `state.json` `counts.byLevel` 一致。**在线实测**：三档视口 `hasYuxi/hasYunnan/hasNational` 均为 true。 |
| 3 | 政策卡片标题、发布日期、发布机构与 `policies.json` 对应行一致 | **PASS** | 静态实测：`policies.json` 首行含契约 §5.4.1 全部必填键（`_id=YB-2026-001`、标题、`发布日期=2022-01-01`、发布机构），全量 664 行无空日期、无非法链接。渲染由 `data-shim.js` 直通原页面 `rowToPolicy()`，未改写字段。在线实测卡片字段正常渲染。 |
| 4 | 控制台执行 `query({databaseId:'SyW9fBCPF4zBCd9EMdNlNm',pageSize:50})` 返回 `results/nextCursor/hasMore/total` 且 `results.length>0` | **PASS（在线实测）** | 2026-11-17 线上浏览器运行时诊断：`shim=true`、`realIsShim=true`（RPC 兜底桥未接管），`query()` 返回结构 `{results,nextCursor,hasMore,total}`、游标为十进制偏移（契约 §5.3），真实 664 条可读。 |
| 5 | `addRecord({})` 被拒绝并提示「只读部署版不可写入」；写类按钮被拦截/隐藏，顶部有只读徽标 | **PASS（在线实测）** | 2026-11-17 线上浏览器实测：`addRecord({})` 返回 `只读部署版不可写入\|E_READONLY`（reject 语义与文案保住）；三档视口只读徽标 `只读 · 同步自工作台` 可见；`data-shim.js` 写方法以 `writable:false,configurable:false` 定义，内联守卫拦截写按钮。 |
| 6 | `site/index.html` 通过 CRLF 校验 | **PASS** | 静态实测：747144 字节，`0D 0A` 14311 处，剥离 CRLF 后孤立 `0A` **0** 处。发布前复验一致；`.gitattributes` 设 `* -text` 锁定 git 不转换换行。 |
| 7 | 全仓库无 `<script src="http...">` / `<link href="http...">` 外链；无凭证实际值 | **PASS** | 静态实测：`index.html` 外链 script/link 命中 **0** 处；垫片同步注入（无 defer/async，位于页面脚本之前）。凭证扫描（`site/`、`README.md`、检查表、workflow）命中 0 处；仅施工依据 `docs/site-spec.md` 含路径/凭证的**文字级反例说明**（不随站点发布）。本地 git 凭证仅存于系统凭证管理器，未入库。 |
| 8 | 打印页头含「只读分享版 · 同步自主版工作台 · 不可修改数据」与数据截止日期 | **PASS（静态）/ PENDING（打印预览实测）** | 静态实测：`index.html` 含打印溯源文案与「不可修改数据」，数据截止日期取 `freshness.lastCheckedAt`。打印预览的实际版式未做在线截图实测，如实标 PENDING，不影响上线。 |

---

## B. 部署检查与在线实测

| # | 检查项 | 判定 | 证据 / 说明 |
|---|---|---|---|
| B-1 | `robots.txt` 存在且允许抓取 | **PASS（在线实测）** | 2026-11-17 线上 `curl`：`/robots.txt` HTTP 200、251 字节，与本地一致；内容 `User-agent: *` + `Allow: /`。 |
| B-2 | 数据新鲜度 workflow 语法与权限 | **PASS（静态）** | `PyYAML 6.0.3` 严格 `safe_load` 解析通过，无 TAB；`on.schedule.cron='30 0 * * *'`、`workflow_dispatch` 存在，`permissions={contents:read, issues:write}`。仅用自动提供的 `secrets.GITHUB_TOKEN`，无凭证字面量、无写数据步骤。（PyYAML 按 YAML 1.1 把裸键 `on` 解析为 True 属解析器 quirk，GitHub Actions 用 YAML 1.2 语义，workflow 正确。） |
| B-3 | 构建产物与环境变量 | **PASS** | `tools/build_data.py` / `tools/README.md` 已就位，路径参数化 `YIBAO_REGISTRY` / `YIBAO_OUT`，无本地绝对路径；三份 JSON `meta.rowCount == len(rows)`（664/664、3/3、664/664）。 |
| B-5 | 在线静态资源 HTTP 200 且字节与本地一致 | **PASS（在线实测）** | 2026-11-17 `curl -L` 逐项：`/` 200·747144B、`/robots.txt` 200·251B、`/scripts/data-shim.js` 200·10895B、`/data/policies.json` 200·817779B、`/data/state.json` 200·1185B、`/data/kb.json` 200·483931B、`/README.md` 200·3355B，全部与本地字节数一致。 |
| B-6 | 在线三档视口无横向溢出 | **PASS（在线实测）** | 2026-11-17 Edge headless + CDP：`docW == innerW`（1440/1440、900/900、390/390），无横向滚动；`pageErrors=[]`。 |
| **PENDING-1** | **GitHub Pages 在线地址复验** `https://Bing-ing-ic.github.io/yibao-policy-workbench/` | **PASS（已回填）** | 六项逐条实测：① 真实数据渲染、无降级提示 ✅；② `query()` 结构与 `addRecord()` reject ✅；③ 只读徽标可见、写类被拦截 ✅；④ 打印版式见 A-8（静态 PASS）⑤ `robots.txt` 与三份 JSON HTTP 200 ✅；⑥ 三档视口无溢出 ✅。Pages build status = built。 |
| **PENDING-2** | **EdgeOne Pages 在线地址** 部署后复验 | **PENDING** | EdgeOne 创建 workspace 失败（账号侧限制），站点未部署，地址待定；复验内容同 PENDING-1。**本项未完成，不宣称 EdgeOne 已上线。** |
| B-4 | 性能数字（首屏时间 / LCP / 缓存头） | **N-A** | 资源体积与数量已实测（见 B-5），但 LCP/首屏时间需专门性能采集，本次未测，不编造。不构成本次上线阻塞项。 |

---

## 汇总

- 静态可判定项：**PASS 12 项**，**FAIL 0 项**。
- 在线复验：**GitHub Pages 已实测 PASS**（HTTP 200 × 7、三档视口、垫片/写拦截/三级数据全通过）；**EdgeOne Pages 1 组仍 PENDING**（未部署）。
- A-8 打印预览在线截图 1 项 PENDING（静态文案已 PASS），不影响上线。
- 结论：**GitHub Pages 站点已上线并可正常访问；EdgeOne 站点未部署。**

## freshness-check workflow 权限说明（需用户/主理人知悉）

- workflow 使用 GitHub 自动提供的 `secrets.GITHUB_TOKEN`，由 `actions/github-script` 默认注入，**文件内无任何凭证字面量**。
- 创建 Issue 需要 `issues: write`；检出仓库需要 `contents: read`。已在 workflow 顶部用 `permissions:` 显式声明这两项。
- 若仓库或组织把 Actions 默认 Token 权限设为「只读」，并禁止工作流自行提权，则 `issues: write` 可能不生效、创建 Issue 会失败。此时需仓库管理员在 **Settings → Actions → General → Workflow permissions** 中选择 **Read and write permissions**（或由组织策略放行该仓库的 Actions 写 Issue 权限）。
- 该 workflow 为**独立任务**，只读取数据文件，不提交、不改写任何 JSON；其失败不会影响 GitHub Pages 发布（Pages 由独立部署流程触发，二者无依赖关系）。创建 Issue 失败时脚本降级为 `core.warning`，不使任务硬失败。
