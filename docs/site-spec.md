# 站点规格卡 · 医保政策实时监测工作台（GitHub Pages 只读版）

> 由 `requirement-architect` 产出。**这是全队唯一的施工依据**，前端、数据同步、部署三方都照本文实现。
> 七节齐全；第 5 节接口契约中字段名、类型、错误码全部冻结，不允许任何未确定的字段或错误码。
> 事实输入来自 Phase 0 取证与源 HTML 实读，取证行号在文中标注，实现方如需变更契约必须先改本文。

---

## 1. 站点定位

- **站点类型**：**工具站**（只读政策监测看板），附加**文档站**模块（政策知识库条目检索）。主类别为工具站，因此首屏即看板本身，不放介绍性铺垫。
- **目标访客**：澄江市凤麓街道社区卫生服务中心的医保经办、收费、院办人员。使用场景是：每日 08:30 同步后上班打开，或在收到上级口头/微信通知后，需要立刻确认「有没有新政策、对我中心的收费/结算/基金监管有什么影响、要不要上报澄江市医保局」。访客是**内部工作人员**，不是公众；站点公开可访问但内容定位为内部工作参考。
- **核心转化动作（一个）**：**在 30 秒内定位并读完一条与本中心相关的政策变动条目**（含解读要点与影响说明）。
  - 不设注册、不设留资、不设写入——本站点是只读发布物，转化是「查到并确认」，不是「提交」。
  - 完整可写工作台继续保留在 WorkBuddy 平台，本站点不替代它。

---

## 2. 站点地图

GitHub Pages 站点为**单页看板**，其余均为同源静态资源文件（无二级页面、无路由）。

```
https://Bing-ing-ic.github.io/yibao-policy-workbench/          # 发布根
├── /                                  → index.html        单页看板（唯一页面）
├── /data/policies.json                → 政策监测台账数据（表 DB_POLICY）
├── /data/state.json                   → 工作台状态与聚合数据（表 DB_STATE）
├── /data/kb.json                      → 医保政策知识库条目（表 KB_DB_ID）
├── /scripts/data-shim.js              → SDK 垫片（伪造 database，只读）
├── /scripts/ro-guard.js               → 只读守卫（写操作拦截 + 徽标），如已内联则不单独发布
├── /robots.txt                        → 抓取策略声明
└── /README.md                         → 仓库说明 / 数据口径 / 免责声明（不参与渲染）
```

> 发布根以仓库 `Settings → Pages` 实际显示的 URL 为准；大小写按 GitHub 用户名 `Bing-ing-ic` 原样使用，仓库名固定 `yibao-policy-workbench`（全小写）。

---

## 3. 页面清单

| 页面/文件 | URL | 用途 | 关键区块 | 需要后端数据 |
|---|---|---|---|---|
| 单页看板 | `/` | 三级政策流浏览 + 政策详情/解读 + 知识库检索 | 顶部只读徽标与同步时间、国家/云南省/玉溪市三级政策栏、政策列表与筛选、政策详情与解读要点、知识库检索、合规说明页脚 | 否（全部来自同源静态 JSON；无服务端、无数据库直连） |
| 政策台账数据 | `/data/policies.json` | 供 `data-shim` 的 `query(DB_POLICY)` 消费 | `{meta, rows}` | 否（构建时生成） |
| 状态数据 | `/data/state.json` | 供 `query(DB_STATE)` 消费，驱动同步时间与统计 | `{meta, rows}` | 否（构建时生成） |
| 知识库数据 | `/data/kb.json` | 供 `query(KB_DB_ID)` 消费 | `{meta, rows}` | 否（构建时生成） |
| SDK 垫片 | `/scripts/data-shim.js` | 注入 `window.__SMART_PAGE__.database`，让源页面逻辑零改动读取静态 JSON | `query/getRecord/getSchema/aggregate/onUpdated` + 写方法拒绝 | 否 |
| 只读守卫 | `/scripts/ro-guard.js` | 拦截写类交互、隐藏写控件、注入只读徽标 | 捕获阶段点击守卫、`.ro-badge`、写方法短路 | 否 |
| 抓取策略 | `/robots.txt` | 声明抓取规则；**不阻止**搜索引擎抓取公开说明页 | 纯文本 | 否 |
| 仓库说明 | `README.md` | 数据来源、同步机制、免责声明、维护人联系方式 | Markdown | 否 |

---

## 4. 功能清单

| 功能 | 所属页面 | 优先级 | 验收标准 |
|---|---|---|---|
| SDK 垫片注入（只读 database 实现） | `/` | P0 | 页面加载后 `window.__SMART_PAGE__.database.query` 为函数；`__realImpls__.database` 已设置；2.1 秒后未被 RPC 兜底桥覆盖 |
| 三份静态 JSON 数据文件产出并提交 | `/data/*` | P0 | 三个文件可被浏览器 `fetch` 200 返回；`meta.rowCount` 与 `rows.length` 一致；`policies.json` 有三级政策各 ≥1 条 |
| 单页看板渲染真实数据 | `/` | P0 | 打开后三级政策流均显示真实标题、发布日期、发布机构；无「本地模式」「同步不了」提示 |
| 只读守卫与徽标 | `/` | P0 | 顶部显示「只读 · 同步自工作台」徽标；点击任一写类按钮被拦截并提示「只读部署版不可写入」；调用 `addRecord()` 返回 rejected Promise |
| HTML 强制 CRLF | `/index.html` | P0 | 文件字节中 `0D 0A` 为唯一换行序列，不存在孤立 `0A`；检测命令见第 7 节 |
| 零外链 CDN / 纯原生 | `/` | P0 | 全仓库 HTML/JS/CSS 中无 `http(s)://` 开头的 `<script src>` / `<link href>`（政策原文链接数据除外） |
| 无凭证入库 | 全仓库 | P0 | 全仓库关键词扫描无 `api_key/Authorization/Bearer/token/密钥` 实际值；仅 README 中保留「不得写入凭证」的文字说明 |
| 合规说明与免责声明 | `/` | P0 | 页脚固定展示：数据来源于公开政策文件与内部整理索引，仅供本中心内部工作参考，不构成对政策效力的认定或对外承诺；如有疑义以发文机关正式文本为准；发现错漏请联系维护人，我们将及时核实修订。**不使用「权威」「保证准确」「最终解释权」等定性词** |
| 每日 08:30 同步链路（本地触发） | 仓库数据 | P1 | 本地自动化每日 08:30 更新 `registry.jsonl` 后，由第10步独占触发 `scripts/build_pages_data.py`，三份 JSON 重新生成并提交；`meta.generatedAt` 为当日时间 |
| 同步时间与统计展示 | `/` | P1 | 顶部显示 `freshness.lastCheckedAt`；三级政策数量与 `state.json` 的 `counts` 一致 |
| 打印页头溯源 | `/` | P1 | 打印时页头带「只读分享版 · 同步自主版工作台 · 不可修改数据」与数据截止日期 |
| GitHub Actions 只读新鲜度告警 | 仓库 | P2 | workflow 每日**只读**校验数据新鲜度并在异常时告警；**不重建、不提交 JSON**。JSON 重建与提交由本地每日 08:30 自动化第10步独占 |
| 搜索引擎收录优化 | `/robots.txt` | P2 | `robots.txt` 可访问；README 提供站点用途说明 |

### 4.1 转化路径与摩擦点

**最短路径（落地 → 核心动作）**：

```
打开站点 → 首屏三级政策栏 → 点击目标层级中最新政策卡片
        → 读「政策摘要 / 解读要点 / 对玉溪影响 / 乡镇卫生院影响」→ 完成确认
```

| 步骤 | 摩擦点 | 削减建议 |
|---|---|---|
| 1. 打开站点 | 首屏被徽标、同步状态、导航占满，政策卡片落到折叠线以下 | 只读徽标收进顶部窄条；三级政策栏置于首屏第一屏；不加大段介绍 |
| 2. 选层级 | 访客不确定该看国家/省/市哪一层 | 默认展开「玉溪市」栏（执行层），国家与省作为依据链折叠展示；卡片上直接标「执行 / 参照 / 基线」角色 |
| 3. 找相关条目 | 664 条无差别平铺，找到本中心相关条目耗时 | 首屏按发布日期倒序；提供类别/影响等级筛选；「曝光标记=是」与「影响等级=高」条目置顶加标 |
| 4. 读详情 | 要点埋在长摘要里，需要滚动 | 详情区固定顺序：解读要点 → 对玉溪影响 → 乡镇卫生院影响 → 原文链接；链接新标签打开 |
| 5. 数据时效 | 访客怀疑看到的是旧数据 | 顶部直接显示 `freshness.lastCheckedAt` 与「每日 08:30 同步」说明，不显示「本地模式」 |

### 4.2 范围分层

| 层级 | 内容 | 砍掉后能否上线 |
|---|---|---|
| **首发必做** | P0 全部 8 项 | — |
| **首发可做** | P1 同步时间展示、打印溯源、本地 08:30 同步链路 | 可砍；站点仍是完整只读看板，只是不显示时效信息、数据靠手工更新 |
| **上线后迭代** | P2 GitHub Actions 只读新鲜度告警、收录优化 | 可砍；不影响上线 |

**预算/时间不足时**：保留 P0，砍 P1 的打印溯源与统计展示（保留数据文件生成），P2 全部延后。此时唯一代价是访客看不到自动同步时间，核心动作不受影响。

---

## 5. 接口契约（冻结）

### 5.1 静态文件接口

| 方法 | 路径 | 入参（字段:类型:必填） | 出参 | 错误码 |
|---|---|---|---|---|
| GET | `/data/policies.json` | 无 | `200 {meta:Meta, rows:PolicyRow[]}` | `404` 文件缺失 / `500` 站点配置异常 |
| GET | `/data/state.json` | 无 | `200 {meta:Meta, rows:StateRow[]}` | `404` / `500` |
| GET | `/data/kb.json` | 无 | `200 {meta:Meta, rows:KbRow[]}` | `404` / `500` |
| GET | `/scripts/data-shim.js` | 无 | `200 javascript` | `404` / `500` |

`Meta` 结构（三份 JSON 同构）：

```json
{
  "schemaVersion": "1.0",
  "sourceTable": "SyW9fBCPF4zBCd9EMdNlNm | h6rLvnHD0OZ9wyiNwJVAAE | 6EUj03WV4rV3ItQHH4tcZt",
  "sourceName": "政策监测台账 | 工作台状态与知识库 | 医保政策知识库",
  "generatedAt": "2026-11-17T08:30:00+08:00",
  "rowCount": 664,
  "sha256": "<rows 规范化摘要（不含 meta 与文件末尾换行），非整文件字节 SHA>",
  "pageSizeDefault": 200
}
```

> **`meta.sha256` 口径（R-10）**：取 `rows` 数组按 `ensure_ascii=False, indent=2` 序列化后的 UTF-8 SHA256，**不含 `meta` 自身，也不含文件末尾换行**；它不是整份 JSON 文件的字节 SHA256。发布/校验侧须按同一口径重算比对。注意它与 `state.json` 的 `syncMeta.enrichSha`（富化 CSV 文件正文字节 SHA256，见 §5.4.2）是两个不同字段、两种不同口径，不可混用。

### 5.2 `window.__SMART_PAGE__.database` 方法契约

> 以下方法由 `scripts/data-shim.js` 实现。**方法签名与平台 SDK 一致，页面业务代码零改动。**

| 方法 | 路径/标识 | 入参（字段:类型:必填） | 出参 | 错误码 |
|---|---|---|---|---|
| `query` | `database.query` | `databaseId:string:必填`, `pageSize:number:选填(默认200,允许200/50)`, `startCursor:string\|undefined:选填`, `sorts:Array<{property:string,direction:'ascending'\|'descending'}>:选填` | `Promise<{results:Row[], nextCursor:string\|null, hasMore:boolean, total:number}>` | `E_DB_UNKNOWN` 未知 databaseId / `E_PAGE_SIZE` 非法 pageSize / `E_CURSOR` 非法游标 / `E_FETCH` 静态文件读取失败 |
| `getRecord` | `database.getRecord` | `databaseId:string:必填`, `recordId:string:必填` | `Promise<Row\|null>` | `E_DB_UNKNOWN` / `E_RECORD_NOT_FOUND` 记录不存在 |
| `getSchema` | `database.getSchema` | `databaseId:string:必填` | `Promise<{properties:Object<string,{type:'string'\|'number'\|'boolean'}>, total:number}>` | `E_DB_UNKNOWN` |
| `aggregate` | `database.aggregate` | `databaseId:string:必填`, `groupBy:string:选填`, `count:boolean:选填` | `Promise<{groups:Array<{key:string,count:number}>, total:number}>` | `E_DB_UNKNOWN` / `E_UNSUPPORTED_AGG` 不支持的聚合 |
| `addRecord` | `database.addRecord` | `任意` | `Promise.reject(Error('只读部署版不可写入'))` | `E_READONLY` |
| `updateRecord` | `database.updateRecord` | `任意` | `Promise.reject(Error('只读部署版不可写入'))` | `E_READONLY` |
| `deleteRecord` | `database.deleteRecord` | `任意` | `Promise.reject(Error('只读部署版不可写入'))` | `E_READONLY` |
| `uploadImage` | `database.uploadImage` | `任意` | `Promise.reject(Error('只读部署版不可写入'))` | `E_READONLY` |
| `uploadFile` | `database.uploadFile` | `任意` | `Promise.reject(Error('只读部署版不可写入'))` | `E_READONLY` |
| `getDownloadUrl` | `database.getDownloadUrl` | `任意` | `Promise.reject(Error('只读部署版不提供文件直链'))` | `E_READONLY_NO_FILE` |
| `getPreviewUrl` | `database.getPreviewUrl` | `任意` | `Promise.reject(Error('只读部署版不提供文件直链'))` | `E_READONLY_NO_FILE` |
| `onUpdated` | `database.onUpdated` | `callback:function:选填` | `false`（同步返回，无订阅能力） | 无 |

**前端必须为每个错误码准备可读提示**：`E_DB_UNKNOWN`→「数据源标识无效」；`E_PAGE_SIZE`→「分页参数无效」；`E_CURSOR`→「分页游标失效，请刷新」；`E_FETCH`→「数据文件读取失败，请检查网络后刷新」；`E_READONLY`→「只读部署版不可写入」；`E_READONLY_NO_FILE`→「只读部署版不提供文件直链」；`E_RECORD_NOT_FOUND`→「未找到该记录」；`E_UNSUPPORTED_AGG`→「不支持的统计方式」。

### 5.3 `query()` 返回结构 —— 取证结论（**不得改成 `rows`**）

实读源 HTML 得到以下结论，这是垫片能否驱动页面的关键：

| 结论 | 证据行 |
|---|---|
| 页面消费的结果是 **`r.results`**，不是 `r.rows` | 第 3738 行 `var rows = (r && r.results) \|\| [];`；第 3807 行、第 3819 行同样写法 |
| 下一页游标字段是 **`r.nextCursor`**，继续条件是 **`r.hasMore`** | 第 3740 行 `var next = r && r.nextCursor;`；第 3741 行 `(r && r.hasMore && next && next !== cursor && rows.length) ? next : null`；第 3809–3810 行同上 |
| 页面 `done()` 通过 `takePage()` 转换，再累加 `t.acc`、递归 `t.next` | 第 3747–3751 行 `function done(n,r){ ... var t = takePage(r, cursor, acc); if (t.next) return queryPolicyPage(t.next, t.acc, guard+1); return t.acc; }`；状态表第 3775–3779 行同构 |
| 入参为 `{databaseId, pageSize, sorts, startCursor}`，且 databaseId 必须以字面量写在调用括号内（静态校验） | 第 3755–3758 行（政策表 200+sorts）、3761–3763 行（200）、3765–3767 行（50）；第 3783–3789 行（状态表 200/50）；第 3803–3804 行（KB 表 200/50） |
| `results` 必须是数组；空数组会终止翻页 | 第 3741 行 `&& rows.length`、第 3810 行 `&& rows.length` |
| `nextCursor` 必须是一个与 `startCursor` 字符串**不相等**的值，否则翻页提前终止 | 第 3741 行 `next !== cursor` |

因此垫片返回对象**必须**是：

```js
{
  results:    [...],                       // 行数组，字段名固定 results
  nextCursor: "200" | null,                // 字符串偏移量；hasMore=false 时为 null
  hasMore:    true | false,                // 布尔
  total:      664                          // 数字，页面不消费但诊断需要
}
```

**游标规则**：`startCursor` 使用十进制字符串形式的数组偏移量（`"0"` 为首页，不存在 `startCursor` 等价于 `"0"`）。`hasMore = (offset + pageSize) < total`；`nextCursor = hasMore ? String(offset + pageSize) : null`。禁止使用 Base64 或随机游标，否则第 3741 行的 `next !== cursor` 防死循环判断会与翻页逻辑冲突。

**排序规则**：页面政策表第 0 档带 `sorts:[{property:'发布日期', direction:'descending'}]`。垫片必须在返回前对数据副本做**稳定排序**（按 `property` 取值比较字符串/数字，`direction` 支持 `ascending`/`descending`），确保第 0 档尝试即成功，不触发页面的降级重试。

**注入时序（关键）**：源页面第 12671–12789 行的 RPC 兜底桥每 300ms 轮询，若 `window.__SMART_PAGE__.__realImpls__.database` 不存在，约 2.1 秒后会用 `makeRpcDatabase()` 覆盖 `database`（第 12783 行），届时 GitHub 上所有 `query()` 都会走 `postMessage` 并超时。**因此垫片必须在注入 `database` 的同时设置 `window.__SMART_PAGE__.__realImpls__ = { database: <垫片实现> }`**，并且 `data-shim.js` 必须以同步 `<script src>`（不得 `defer`/`async`）置于页面脚本之前。

### 5.4 三份 JSON 文件定义

#### 5.4.1 `data/policies.json` —— 政策监测台账（对应 `DB_POLICY = 'SyW9fBCPF4zBCd9EMdNlNm'`）

顶层：`{meta:Meta, rows:PolicyRow[]}`。`PolicyRow` 字段清单（**键名即中文字段名，与页面 `rowToPolicy()` 第 3869–3910 行逐字对应**）：

| 字段 | 类型 | 必填 | 页面消费位置 / 说明 |
|---|---|---|---|
| `_id` | string | 是 | 第 3875 行 `rid`，记录唯一标识 |
| `政策标题` | string | 是 | 第 3876 行 → `title`，缺省「（无标题）」 |
| `发布日期` | string `YYYY-MM-DD` | 是 | 第 3870–3878 行 → `date`；**空值会被页面填成今天**，构建时必须填 `1900-01-01` 兜底，禁止空串 |
| `发布机构` | string | 是 | 第 3877 行 → `org` |
| `行政层级` | enum `玉溪市\|云南省\|国家` | 是 | 第 3879 行 `pickOption(..., LEVELS, '云南省')`；见三级归属规则 |
| `所属县区` | string | 否 | 第 3882 行 → `county`，如「澄江市」 |
| `曝光标记` | enum `是\|否` | 是 | 第 3885 行 `row['曝光标记'] === '是'` → `exposure:boolean` |
| `政策类别` | enum CATS | 是 | 第 3886 行 `pickOption(..., CATS, '其他')` |
| `影响等级` | enum `高\|中\|低` | 是 | 第 3887 行 `pickOption(..., IMPACTS, '中')` |
| `关键词` | string（逗号分隔） | 否 | 第 3872、3888 行 `split(/[,，;；\s]+/)` |
| `政策摘要` | string | 否 | 第 3889 行 → `summary` |
| `原文链接` | string URL 或空串 | 否 | 第 3860–3866 行 `pickUrl()` 只接受 `http(s)://` 开头；**指向 `www.workbuddy.cn/space/` 时语义为「内部整理索引」，不是发文机关原文**，前端不得标注为官方原文（R-30） |
| `采集来源` | string | 否 | 第 3891 行 → `source`，缺省「云端台账」 |
| `已读` | boolean/string | 否 | 第 3892 行 `toBool()`，只认 `true/'true'/'1'/'yes'/'checked'` |
| `已收藏` | boolean/string | 否 | 同上 |
| `AI解读` | string | 否 | 第 3896 行 → `ai`；**无数据来源时写空串，不得臆造** |
| `解读要点` | string | 否 | 第 3897 行 → `points`；**可能包含迁移/整理备注，前端按原样展示，不得宣称全部为 AI 解读**（R-31） |
| `行动建议` | string | 否 | 第 3898 行 → `action` |
| `对玉溪影响` | string | 否 | 第 3899 行 → `yx` |
| `乡镇卫生院影响` | string | 否 | 第 3902 行 → `town`；空值页面显示「未评估」 |
| `解读状态` | string | 否 | 第 3903 行 → `anaState`，缺省「待解读」 |
| `变动类型` | string | 否 | 第 3904 行 → `change` |
| `上次核对` | string `YYYY-MM-DD` | 否 | 第 3905 行 `.slice(0,10)` |
| `上位依据` | string（JSON 字符串）或空串 | 否 | 第 3907、3914–3922 行 `parseUp()` 要求解析后对象含 `id` |
| `解读层级角色` | enum ROLES | 否 | 第 3908 行 → `role`，见角色映射 |
| `退出医保标记` | enum `是\|否` | 否 | **派生字段，非 registry 原值**；由 `政策标题` 经 `derive_exit_info()` 派生，见下方口径 |
| `退出方式` | enum `主动\|被动\|`（空串） | 否 | **派生字段，非 registry 原值**；仅命中退出时非空，未命中为空串 |
| `机构类别` | enum `医疗机构\|医药机构\|其他`（空串） | 否 | **派生字段，非 registry 原值**；仅命中退出时非空，未命中为空串 |

> **退出医保派生字段口径（K）**：由 `derive_exit_info(title)` 派生，不修改 registry.jsonl。命中条件为「动作词（解除/终止/中止/暂停/退出）+ 对象词（医保服务协议/医疗保障服务协议/医保定点/医疗保障定点/定点医药/定点医疗/定点零售/零售药店/药店/医院/卫生室/诊所/医药有限公司）+ 体裁词（公告/公示/通报/通告/决定）」三组同时出现，且不含排除词（管理办法/协议范本/签订/通知/规范/指南/自查/专项治理/监测处置/负面清单/印发/备案/评估/考核）。命中时 `退出医保标记='是'`；含「主动/申请/自愿」→`退出方式='主动'`，否则 `'被动'`；含「零售药店/药店/药房/药行/药业/医药有限公司」→`机构类别='医药机构'`，含「医院/诊所/卫生室/卫生院/医疗机构/医疗」→`'医疗机构'`，否则 `'其他'`。未命中时标记为 `'否'`，方式与类别均为空串。

枚举常量实读：第 3317–3319 行 `CATS = ['参保缴费','待遇报销','异地就医','药品目录','耗材管理','DRG/DIP支付','基金监管','长期护理保险','生育保险','门诊共济','集采药品','其他']`；`LEVELS = ['玉溪市','云南省','国家']`；`IMPACTS = ['高','中','低']`。第 3912 行 `ROLES = ['执行·玉溪市医保局政策','参照·省级依据','基线·国家方向']`。

#### 5.4.2 `data/state.json` —— 工作台状态（对应 `DB_STATE = 'h6rLvnHD0OZ9wyiNwJVAAE'`，页面 `radarRoot` 同表）

顶层：`{meta, rows}`。`StateRow` 固定三列：`{_id:string, 状态键:string, 内容:string(JSON字符串)}`。第 4145–4148 行页面读取 `r['状态键']`、`r._id`、`JSON.parse(r['内容'])`。构建时固定产出以下三条状态键：

| 状态键 | `内容` 解析后结构 | 用途 |
|---|---|---|
| `freshness` | `{lastCheckedAt:string ISO, nextCheckAt:string ISO, source:string, note:string}` | 第 4162–4163 行 `App.data.freshness`，页面顶部时效展示；**必须是对象，不能是字符串** |
| `counts` | `{policies:number, kb:number, byLevel:{玉溪市:number,云南省:number,国家:number}, byImpact:{高:number,中:number,低:number}}` | 三级政策流数量校验与诊断 |
| `syncMeta` | `{generatedAt:string ISO, sourceRevision:string, sha256:string, enrichSha:string, note:string}` | 构建溯源；`enrichSha` = 所用富化 CSV 的字节正文 sha256（未使用/文件不存在为 `''`），供发布脚本做幂等判据（R-08） |

#### 5.4.3 `data/kb.json` —— 政策知识库（对应 `KB_DB_ID = '6EUj03WV4rV3ItQHH4tcZt'`）

顶层：`{meta, rows}`。`KbRow` 字段清单（与第 3828–3845 行 `rowToKb()` 逐字对应）：

| 字段 | 类型 | 必填 | 页面消费位置 / 说明 |
|---|---|---|---|
| `_id` | string | 是 | 第 3831 行 → `id` 前缀 `ckb_` |
| `条目标题` | string | 是 | 第 3833 行 → `title` |
| `来源` | enum `IMA知识库\|官网采集\|本地文件` | 是 | 第 3829、3834 行 → `source` 的 `ima/auto/local` |
| `行政层级` | enum LEVELS（KB 缺省 `'玉溪市'`） | 是 | 第 3835 行 |
| `政策类别` | enum CATS | 是 | 第 3836 行 |
| `年份` | string | 否 | 第 3837 行 |
| `关键词` | string（逗号分隔） | 否 | 第 3838 行 `split(/[、,，;；\s]+/)` |
| `内容摘要` | string | 否 | 第 3839 行 |
| `文件路径` | string | 否 | 第 3840 行 → `url`；无链接时写空串 |
| `文号` | string | 否 | 第 3841 行 |
| `发布机构` | string | 否 | 第 3842 行 |

### 5.5 `registry.jsonl` → 三份 JSON 的字段映射（由 `build_data.py` 实现）

输入：`D:/WorkBuddy/2026-09-22-08-15-17/医保政策知识库/00-索引/registry.jsonl`（664 行，每行一个 JSON 对象）。输出：三份 JSON。**映射规则一次定死**，不得由脚本自行推断。

**三级归属规则（policies + kb 通用，按顺序命中即停）**：

1. `region` 含 `国家` → `国家`
2. `region` 含 `玉溪` 或 `澄江` → `玉溪市`
3. `region` 含 `云南` → `云南省`
4. 都不命中 → `云南省`（与页面 `pickOption` 默认一致）

**`registry.jsonl` → `PolicyRow`**：

| registry 字段 | 目标字段 | 转换规则 |
|---|---|---|
| `kb_id` | `_id` | 原值 |
| `title` | `政策标题` | 原值 |
| `publish_date` | `发布日期` | 原值；空串或缺失 → `1900-01-01` |
| `org` | `发布机构` | 原值 |
| `region` | `行政层级` | 三级归属规则 |
| `region` | `所属县区` | 含 `（...）` 时取括号内文本（如「玉溪市（澄江市）」→`澄江市`），否则空串 |
| `exposure` | `曝光标记` | `1`→`是`，`0`→`否` |
| `category` | `政策类别` | 在 CATS 中原值，否则 `其他` |
| `urgency` | `影响等级` | `P0`→`高`，`P1`→`中`，`P2`→`低`，其他→`中` |
| `keywords`（数组） | `关键词` | 用 `，` 连接为字符串 |
| `summary` | `政策摘要` | 原值 |
| `source_url` | `原文链接` | 仅以 `http(s)://` 开头时写入，否则空串 |
| `source_channel` | `采集来源` | 原值 |
| 固定 | `已读` / `已收藏` | `false` |
| `notes`、`change_points` | `AI解读` / `解读要点` / `行动建议` | 仅当 `library_export(DB_POLICY)` 导出 CSV 中存在同名富字段时覆盖；**无导出则空串，不得生成或臆造解读内容** |
| `status` | `解读状态` | `待解读`；仅当存在真实富化解读时写 `已解读` |
| `change_type` | `变动类型` | 原值 |
| `updated_at` | `上次核对` | `slice(0,10)` |
| `related`（数组） | `上位依据` | 有值时写 `JSON.stringify({id: related[0]})`，否则空串 |
| `行政层级`（派生） | `解读层级角色` | `国家`→`基线·国家方向`，`云南省`→`参照·省级依据`，`玉溪市`→`执行·玉溪市医保局政策` |
| `title`（派生） | `退出医保标记` / `退出方式` / `机构类别` | **派生字段，非 registry 原值**；由 `derive_exit_info(title)` 按 §5.4.1 口径派生，registry.jsonl 本身不写入这三字段 |

**`registry.jsonl` → `KbRow`**：

| registry 字段 | 目标字段 | 转换规则 |
|---|---|---|
| `kb_id` | `_id` | 原值 |
| `title` | `条目标题` | 原值 |
| `source_channel` | `来源` | 含 `IMA`/`ima` → `IMA知识库`；含 `官网采集` → `官网采集`；否则 `本地文件` |
| `region` | `行政层级` | 三级归属规则 |
| `category` | `政策类别` | 在 CATS 中原值，否则 `其他` |
| `publish_date` | `年份` | `slice(0,4)`；空则空串 |
| `keywords` | `关键词` | 用 `，` 连接 |
| `summary` | `内容摘要` | 原值 |
| `source_url` | `文件路径` | 以 `http(s)://` 开头时写入，否则空串 |
| `doc_no` | `文号` | 原值 |
| `org` | `发布机构` | 原值 |

**`StateRow[]`**：由 `build_data.py` 直接构造第 5.4.2 节三条状态键，`内容` 必须 `JSON.stringify()` 成字符串。

### 5.6 数据同步链路

```
本地自动化（每日 08:30，第10步独占发布）
  └─ 更新 registry.jsonl
       └─ scripts/build_pages_data.py 读取 registry.jsonl（+ 可选 library_export 导出的 CSV 富化）
            ├─ 生成 data/policies.json
            ├─ 生成 data/state.json（syncMeta.enrichSha = 所用富化 CSV 字节 sha256，供发布幂等判据）
            └─ 生成 data/kb.json
                 └─ git commit + push（main 分支）——仅本地自动化第10步执行
                      └─ GitHub Pages 发布（Actions 不重建、不提交 JSON，仅只读新鲜度告警）
                           └─ 访客下次刷新页面即读到新数据（准实时）
```

- **准实时定义**：数据新鲜度 = 上一次同步时刻，非真正实时。页面顶部必须显式展示 `freshness.lastCheckedAt` 与「每日 08:30 同步」说明，不得暗示实时推送。
- **发布独占（R-14）**：JSON 的重建与提交**仅由本地每日 08:30 自动化第10步执行**。GitHub Actions（P2）只做只读新鲜度告警：仓库内 `.github/workflows/freshness.yml` 每日只读校验新鲜度并在异常时告警，**不检出重建、不运行构建脚本、不提交任何 JSON**，避免两处写同一文件产生冲突。旧版承诺的「Actions 每日重新构建并提交 JSON / `sync.yml`」已废止。
- **接口约束**：`scripts/build_pages_data.py` 是唯一允许写三份 JSON 的程序（`tools/build_data.py` 仅为兼容转发入口）；前端与 Pages 侧只读，不回写。

---

## 6. 技术栈与托管

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | **纯原生 HTML/CSS/JS 单页**，以现有 v41 主版/只读分享版为基线，不引入 React/Vue/构建器 | 源页面一万两千行已实现全部看板、解读、检索逻辑；引入框架等于重写且必然丢功能。零构建步骤也让 Pages 部署只需推文件 |
| 只读基线 | **以「医保政策监测台(只读分享版).html」为 `index.html` 基线**，再叠加 `data-shim.js` | 该版已派生好 `.ro` 皮肤、只读徽标、写类点击守卫、空实现的密钥/诊断渲染函数（第 3011、14058–14279 行）；若用主版则需自行移植这些，工作量大且易漏 |
| SDK 适配 | `scripts/data-shim.js`，同步注入 `__SMART_PAGE__.database` 与 `__realImpls__.database` | 源页面逻辑零改动是本项目第一约束；不设置 `__realImpls__` 会被第 12783 行的 RPC 兜底覆盖（见第 5.3 节取证） |
| 样式方案 | 源页面内联 CSS + 只读皮肤内联样式，不引入外部样式表或 CDN | 零外链 CDN 的硬约束；离线/内网访问也能完整渲染 |
| 数据层 | **无数据库、无服务端**；三份同源静态 JSON 作为唯一数据源 | 用户已选「只读看板 + 定时同步（准实时）」；GitHub Pages 只服务静态文件，不提供运行时数据写入 |
| 数据构建 | `scripts/build_pages_data.py`（唯一真源，Python 标准库，读写 JSONL/JSON、计算 SHA256）；`tools/build_data.py` 仅为兼容转发入口 | 只做确定性转换，不依赖第三方包；构建与发布权收敛到本地自动化一处 |
| 数据富化 | `library_export`（node_id → CSV）为**可选**输入；导出结果仅覆盖 AI 解读类字段 | 富化数据必须来自真实台账，脚本不得自行生成解读内容 |
| 托管平台 | **GitHub Pages**，仓库 `Bing-ing-ic/yibao-policy-workbench`，发布源为仓库根（本地对应 `github-pages/`，`index.html`/`data/`/`scripts/` 直接在根下，**不存在 `site/` 子目录**）；发布由本地每日 08:30 自动化第10步独占提交，GitHub Actions 只做只读新鲜度告警 | 免费、公开可访问、与代码版本同源；发布权与构建权收敛到本地自动化一处，避免两处提交互相覆盖 |
| 域名与 HTTPS | 使用 GitHub 提供的 `*.github.io` 默认域名，HTTPS 由 GitHub 自动提供并强制跳转；**不配置自定义域名** | 自定义域名需额外 DNS 与证书维护，对内部工作看板无收益 |
| 换行约定 | **`index.html` 强制 CRLF（`0D 0A`）**，不得出现孤立 `0A`；JSON/JS/MD 用 UTF-8 + LF | 用户既有技术约定；提交前须校验（`python -c "d=open('index.html','rb').read(); assert b'\\n' not in d.replace(b'\\r\\n',b'')"`） |
| 安全 | 仓库内不得出现任何 API Key、Token、Bearer 值、平台鉴权 Cookie 或私有文件绝对路径 | 仓库为公开；凭证只保留在 WorkBuddy 平台侧与本地环境变量中，绝不入库 |

**公开与私有边界**：

| 类别 | 具体项 | 是否可入公开仓库 |
|---|---|---|
| 公开 | 三份 JSON 中的政策标题、发布日期、发布机构、摘要、文号、政策类别、来源 URL、三级归属、状态统计 | 是 |
| 公开 | `采集来源` 字段中的来源标注，如 `WorkBuddy 个人空间·医保文件工作区`、`ima知识库「医保相关」`、`官网采集` | 是（仅为非敏感来源标识，**不是本地绝对路径、不是凭证**） |
| 私有/禁止入库 | 鉴权信息、真实密钥、API Key、Access Token、Bearer/Authorization 头值、`inject.js` 平台脚本副本、私有附件正文、本地绝对路径（如 `D:/WorkBuddy/...`） | 否 |
| 本地私有 | `registry.jsonl` 与每日自动化运行环境 | 否（仅作为构建输入，产物入库） |

> **边界澄清（R-18）**：`采集来源` 字段中的「`WorkBuddy 个人空间·医保文件工作区`」等来源标注属于**允许公开的非敏感来源标识**，不算本地绝对路径、不算凭证。禁止入库的是：鉴权信息、真实密钥/Token/Bearer、私有附件正文，以及 `D:/WorkBuddy/...` 这类本地绝对路径；来源标注文本本身可以公开。

**合规口径**：页面所有数据标注来源与同步时间，声明「仅供内部工作参考，以发文机关正式文本为准」；发现错漏由维护人核实修订。不使用定性词、不作效力认定、不作对外承诺。

---

## 7. 目录结构约定

```
yibao-policy-workbench/                 # Git 仓库根 = GitHub Pages 发布根（本地对应 github-pages/）
├── .github/
│   └── workflows/
│       └── freshness.yml               # P2：只读新鲜度告警；不重建、不提交 JSON
├── index.html                          # 单页看板（CRLF 强制，UTF-8）
├── robots.txt                          # 抓取策略
├── data/                               # 发布数据：唯一写入方 scripts/build_pages_data.py（位于仓库外上一级 scripts/）
│   ├── policies.json                   # DB_POLICY 镜像
│   ├── state.json                      # DB_STATE 镜像
│   └── kb.json                         # KB_DB_ID 镜像
├── scripts/
│   ├── data-shim.js                    # SDK 垫片（同步加载）
│   └── ro-guard.js                     # 只读守卫（如已内联则不发布）
├── tools/
│   └── build_data.py                   # 兼容入口：转发到 ../scripts/build_pages_data.py（唯一真源）
├── docs/
│   └── site-spec.md                    # 本文件：全队唯一施工依据
└── README.md                           # 仓库说明 + 数据口径 + 免责声明
```

> **勘误：发布根为仓库根，不存在 `site/` 子目录。** 本文历史版本曾出现 `site/` 目录写法，现已全文更正为仓库根实际结构：`index.html`、`data/`、`scripts/` 均直接位于 Git 仓库根（本地 `github-pages/`）下。构建脚本真源为仓库外的 `scripts/build_pages_data.py`，`tools/build_data.py` 仅作转发兼容入口。

**落文件约定**：

- 页面只有 `index.html` 一个，不新建二级页面；`data/` 只放第 5.4 节定义的三个 JSON。
- `index.html` 中注入顺序固定：`<script src="./scripts/data-shim.js"></script>`（无 `defer`/`async`）必须出现在页面原有脚本之前；只读守卫随后。
- 任何团队成员不得直接编辑 `data/*.json`，只能改 `scripts/build_pages_data.py` 并重新生成（`tools/build_data.py` 仅转发，不含构建逻辑）。
- 本地工作区产物路径（历史记录，仅说明本文件来源，**不代表发布根**）：`D:/WorkBuddy/2026-11-17-09-14-03/docs/site-spec.md`；前端/数据/部署产物由各自任务约定路径，最终统一归入上述仓库结构。发布根见本节开头勘误——为仓库根，不存在 `site/` 子目录。

### 验收标准（上线前逐条勾选）

1. `https://Bing-ing-ic.github.io/yibao-policy-workbench/` 打开后显示真实政策数据，无「本地模式」「未检测到资料库运行环境」「云端查询被拒绝」提示。
2. 国家 / 云南省 / 玉溪市三级政策栏各有 ≥1 条真实条目（以 `state.json` 的 `counts.byLevel` 为准）。
3. 政策卡片标题、发布日期、发布机构与 `policies.json` 对应行一致。
4. 浏览器控制台执行 `window.__SMART_PAGE__.database.query({databaseId:'SyW9fBCPF4zBCd9EMdNlNm',pageSize:50})` 返回含 `results/nextCursor/hasMore/total` 的对象，且 `results.length > 0`。
5. 执行 `addRecord({})` 被拒绝，错误信息为「只读部署版不可写入」；页面写类按钮被拦截或隐藏，顶部有只读徽标。
6. `index.html` 通过 CRLF 校验命令（见第 6 节）。
7. 全仓库无 `<script src="http...">` / `<link href="http...">` 外链；无凭证实际值。
8. 打印页头含「只读分享版 · 同步自主版工作台 · 不可修改数据」与数据截止日期。

---

## 范围建议（砍到哪层能上线）

砍掉 P1 的打印溯源与统计展示、P2 的 GitHub Actions 只读告警与收录优化后，仅保留 P0（SDK 垫片、三份 JSON、单页看板渲染、只读守卫、CRLF、零外链、无凭证、合规说明）即可上线，核心动作「查到并确认一条政策」不受影响；代价仅是数据需手工同步、访客看不到自动同步时间。

## 最大风险（一句话）

源页面第 12783 行的 RPC 兜底桥会在 2.1 秒后覆盖未标记 `__realImpls__.database` 的垫片，使 GitHub 上所有查询超时并显示数据归零。

## 需要用户拍板的 1–3 个决策

1. **只读基线确认**：是否同意以「只读分享版 HTML」为 `index.html` 基线（推荐，守卫与徽标已就绪）？若坚持用 v41 主版，需额外移植只读皮肤与守卫。
2. **公开可见范围**：仓库与 Pages 站点均为公开，三份 JSON 中的政策标题/摘要/文号对互联网可见——是否确认接受？（如需仅内部可见，需改用私有仓库 + 鉴权方案，不再是纯 GitHub Pages。）
3. **富化数据来源**：AI 解读、解读要点、乡镇卫生院影响等字段是否允许由 `library_export(DB_POLICY)` 的真实台账导出覆盖？未覆盖时这些字段留空并显示「未评估」，脚本不生成解读内容。

---

## 8. 2026-11-17 人类视角重构（当前生效版本）

> 本节为**后续追加的生效口径**；与前七节冲突时，以本节为准。数据契约（第 5 节）与构建真源不变，仅重构页面信息架构与交互。

### 8.1 设计原则

站点从「数据管理台」改为「**人每天打开要解决问题的入口**」。排序依据不是数据类型，而是乡镇卫生院医保专干的问题链：

```
今天有什么要紧的？ → 有没有踩红线的？ → 政策变了什么？
→ 这条对我们意味着什么、怎么做？ → 我关注的有更新吗？ → 原文在哪？
```

视觉从密集表格改为高对比青蓝→靛紫渐变、大圆角卡片、明确留白、轻动效；保留明暗主题、移动端底部导航与「服务于澄江市乡镇卫生院」定位标识。

### 8.2 模块映射：9 → 7

| 新模块 | 原模块 | 处置 | 人的问题 |
|---|---|---|---|
| 今日必读 | 监测看板 | 重构 | 今天先做什么 |
| 政策库 | 政策列表 | 精简（去增删改/采集） | 查得到、能看到原文 |
| 政策解读 | 政策解读 | 强化「卫生院影响/怎么做」 | 这条对我们意味着什么 |
| 问一问 | 智能问答 | 保留并加推荐问题与出处 | 用大白话直接问 |
| 我的关注 | 订阅管理 + 收藏 | 合并 | 关注过的有没有更新 |
| 更新动态 | 日报周报 + 历史归档 | 合并为时间轴 + 日报生成 | 政策怎么变 |
| 知识库 | 知识库 | 保留检索（去上传） | 找原件、核文号 |

**移除**：设置（备份/示例数据/偏好）、采集导入、监测源管理、上传、增删改。静态只读发布版不承担写入职责。

### 8.3 新增能力

- 今日行动卡（高影响/曝光/退出/可解读计数）与「今天要处理」优先队列
- 三级政策感知轨道（执行 / 参照 / 基线，含已读进度）
- 红线提醒：曝光 55 / 退出 45 可点标签 → 名单弹窗 → 政策详情下钻；雷达改为风险构成（曝光/退出/常规）
- 政策对比（勾 2～3 条，9 个维度并排）
- 本地关注（收藏 + 关键词，仅存浏览器 localStorage，不上传）
- 日报一键生成（复制/打印）、政策库与名单 CSV 导出
- 全局搜索建议、精确到条目的下钻、空状态引导、朗读要点
- 移动端底部 Tab、明暗主题切换

### 8.4 不变约束

- 业务真源仍为 `registry.jsonl` → `build_pages_data.py` → `data/*.json`，页面只读
- `data-shim.js` 仍为首个同步脚本；只读标识与写类操作拒绝保留
- `index.html` 纯 CRLF；G1–G9 发布断言全部通过才可发布
- 保留 G9 要求的补丁函数锚点：`wbIsExit / wbExitList / wbMergeExposureIntoStrip / initRadarFix`；`aiBlock / ipReadHtml` 渲染继续统一 `esc()`
