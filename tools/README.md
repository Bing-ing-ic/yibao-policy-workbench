# 数据构建工具（build_data.py）

`tools/build_data.py` 是 `site/data/policies.json`、`site/data/state.json`、`site/data/kb.json` 三份文件的**唯一写入方**。
前端、SDK 垫片、GitHub Pages 一律只读这三份 JSON；任何人不得手工编辑它们。需要修改数据内容时，只能改registry 输入或本脚本的映射逻辑，然后重新运行构建。

## 构建命令

仅依赖 Python 标准库（已验证 Python 3.x），无需安装第三方包。

```bash
# 本地自动化：真实路径由环境变量注入（仓库内不保存任何本地绝对路径）
YIBAO_REGISTRY=<本地registry.jsonl路径> YIBAO_OUT=<本地输出目录> python tools/build_data.py
# 或直接用命令行参数提供真实路径
python tools/build_data.py --registry <本地registry.jsonl路径> --out <本地输出目录> [--enrich <CSV路径>]
```

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--registry` | 环境变量 `YIBAO_REGISTRY`；未设置时回退到仓库根下 `医保政策知识库/00-索引/registry.jsonl`（该回退文件不存在时会明确报错，要求传参） | 本地索引源文件 |
| `--out` | 环境变量 `YIBAO_OUT`；未设置时回退到仓库根下 `site/data` | 三份 JSON 的输出目录 |
| `--enrich` | 无 | 可选；`library_export` 导出的 CSV，仅覆盖解读类字段 |

本地运行时用 `YIBAO_REGISTRY` / `YIBAO_OUT` 环境变量或 `--registry` / `--out` 参数提供真实路径；命令行参数优先级高于环境变量。环境变量中的相对路径按仓库根解析，脚本基于 `__file__` 定位仓库根，因此任意 cwd 下运行结果一致。真实本地绝对路径只存在于本地自动化环境，绝不写进仓库文件。

输入缺失、空文件、JSON 解析失败、缺 `kb_id`、CSV 缺主键列等情况，脚本会打印 `[build_data] 错误：...` 并以非 0 退出码结束；写入采用同目录临时文件 + 原子替换，失败不会留下半文件或覆盖上一版可用数据。

## 字段口径（契约 `docs/site-spec.md` §5.5）

- 三级归属按 `国家 → 玉溪/澄江 → 云南 → 默认云南省` 顺序命中即停；`全国`、各县区名不含关键字者按默认落云南省。
- `publish_date` 为空时 `发布日期` 写 `1900-01-01`，避免源页面把空日期填成今天。
- `source_url` 仅以 `http(s)://` 开头时写入 `原文链接`/`文件路径`，否则空串。
- `解读状态` 默认 `待解读`；只有 CSV 真实富化后才可能变成 `已解读`。
- `AI解读`、`解读要点`、`行动建议`、`对玉溪影响`、`乡镇卫生院影响` 默认**全部空串**（页面显示「未评估」）。registry 自带的 `notes`/`change_points` 不被当作解读内容使用；脚本绝不生成或臆造解读。

## 可选富化 CSV（`--enrich`）

由 `library_export(DB_POLICY)` 导出真实台账后调用，CSV 需含 `kb_id` 或 `_id` 列，以及下列列名之一（按优先级）：

| 目标字段 | 可识别的 CSV 列名 |
|---|---|
| `AI解读` | `AI解读`、`notes` |
| `解读要点` | `解读要点`、`change_points` |
| `行动建议` | `行动建议` |
| `对玉溪影响` | `对玉溪影响` |
| `乡镇卫生院影响` | `乡镇卫生院影响` |
| `解读状态` | `解读状态`（不提供时，有任一非空解读字段则自动写 `已解读`） |

```bash
python tools/build_data.py --enrich <library_export导出的CSV路径>
```

CSV 为空值不覆盖；无匹配 `kb_id` 的行不影响其他记录。CSV 属于本地真实数据，不入库、不进公开仓库。

## 每日 08:30 同步链路

```
本地自动化 08:30 更新 registry.jsonl
  → 运行 python tools/build_data.py（有真实导出时加 --enrich）
  → 校验三份 JSON（rowCount 一致、三级分布非空、无绝对路径/凭证）
  → git add site/data/*.json && git commit && git push（main 分支）
  → GitHub Pages 发布 → 访客刷新读到新数据（准实时，非实时推送）
```

- `state.json` 的 `freshness.lastCheckedAt` 取本次构建的北京时间（+08:00），`nextCheckAt` 固定为次日 08:30+08:00；`syncMeta.sourceRevision` / `syncMeta.sha256` 分别是 `registry.jsonl` 文件正文 SHA256 的前 12 位与全值。
- `meta.sha256` 定义为 `json.dumps(rows, ensure_ascii=False, indent=2)` 的 UTF-8 字节 SHA256（正文摘要）；同一份输入重复构建结果完全一致。meta 内含 `generatedAt`，因此整文件字节哈希不是固定值。
- 每天推送前检查 git diff：若三份 JSON 无变化则无需提交；失败时保留上一版 JSON，不得提交空数据。

## 输出自检（构建后可复跑）

1. 三份文件均可 `json.load`，`meta.rowCount == len(rows)`。
2. `policies.json` 三级归属各 ≥1 条；实际分布以 `state.json` 的 `counts.byLevel` 为准。
3. `发布日期` 无空串/今天日期误填；`原文链接`/`文件路径` 全部 `http(s)://` 开头或空串。
4. `state.json` 的 `freshness`/`counts` 解析后是对象而不是字符串。
5. 全量扫描三份 JSON：无本地绝对路径，无凭证实际值。注意：公开政策通报原文中可能出现「银行密钥及密码」等案件叙述文字，属于政策正文而非凭证值，不改写源数据。
6. 报告中列明 registry 总行数、policies/kb 行数、三级分布与 `generatedAt`。
