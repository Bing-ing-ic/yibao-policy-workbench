#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""registry.jsonl -> 三份静态 JSON（policies.json / state.json / kb.json）。

本脚本是 site/data/*.json 的唯一写入方，只做确定性转换，不生成任何解读内容。
真实本地路径不写入仓库文件：由环境变量 YIBAO_REGISTRY / YIBAO_OUT 提供，或未设置时用仓库内相对路径回退。
用法：
    python tools/build_data.py [--registry <path>] [--out <dir>] [--enrich <csv>]
命令行参数优先级高于环境变量；--out 默认为仓库根下的 site/data，任意 cwd 下均可运行。

仅使用 Python 标准库。失败时向 stderr 输出明确错误并以非 0 退出码结束，绝不静默产出空数据。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime, time, timedelta, timezone

# ---------------------------------------------------------------- 常量（契约 site-spec.md §5.5） ----------------------------------------------------------------

# 仓库内不得出现本地绝对路径：真实路径由 YIBAO_REGISTRY / YIBAO_OUT 环境变量或命令行参数注入。
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tools/ 的上一级即仓库根
FALLBACK_REGISTRY = os.path.join(REPO_ROOT, "医保政策知识库", "00-索引", "registry.jsonl")
FALLBACK_OUT = os.path.join(REPO_ROOT, "site", "data")


def env_path(name: str, fallback: str) -> str:
    """环境变量优先；相对路径按仓库根解析，保证任意 cwd 下运行结果一致。"""
    value = os.environ.get(name, "").strip()
    if not value:
        return fallback
    return value if os.path.isabs(value) else os.path.join(REPO_ROOT, value)

CATS = [
    "参保缴费", "待遇报销", "异地就医", "药品目录", "耗材管理", "DRG/DIP支付",
    "基金监管", "长期护理保险", "生育保险", "门诊共济", "集采药品", "其他",
]

TABLES = {
    "policies": "SyW9fBCPF4zBCd9EMdNlNm",
    "state": "h6rLvnHD0OZ9wyiNwJVAAE",
    "kb": "6EUj03WV4rV3ItQHH4tcZt",
}
NAMES = {
    "policies": "政策监测台账",
    "state": "工作台状态与知识库",
    "kb": "医保政策知识库",
}

ROLE_BY_LEVEL = {
    "国家": "基线·国家方向",
    "云南省": "参照·省级依据",
    "玉溪市": "执行·玉溪市医保局政策",
}
IMPACT_BY_URGENCY = {"P0": "高", "P1": "中", "P2": "低"}

# 解读类字段只能由 --enrich 传入的真实 library_export CSV 覆盖；键为目标字段，值为可接受的 CSV 列名（按优先级）。
ENRICH_FIELDS = {
    "AI解读": ("AI解读", "notes"),
    "解读要点": ("解读要点", "change_points"),
    "行动建议": ("行动建议",),
    "对玉溪影响": ("对玉溪影响",),
    "乡镇卫生院影响": ("乡镇卫生院影响",),
    "解读状态": ("解读状态",),
}
INTERPRETATION_FIELDS = ("AI解读", "解读要点", "行动建议", "对玉溪影响", "乡镇卫生院影响")

TZ8 = timezone(timedelta(hours=8))


# ---------------------------------------------------------------- 基础工具 ----------------------------------------------------------------

def sval(value) -> str:
    """把任意源值安全转为字符串；None -> 空串。"""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def join_keywords(value) -> str:
    """keywords 数组用中文逗号连接；已是字符串则原样返回。"""
    if isinstance(value, (list, tuple)):
        return "，".join(sval(item) for item in value)
    return sval(value)


def region_level(region: str) -> str:
    """三级归属：按顺序命中即停，都不命中 -> 云南省。"""
    text = sval(region)
    if "国家" in text:
        return "国家"
    if "玉溪" in text or "澄江" in text:
        return "玉溪市"
    if "云南" in text:
        return "云南省"
    return "云南省"


def county_from_region(region: str) -> str:
    """region 含括号时取括号内文本，否则空串。"""
    match = re.search(r"[（(]([^）)]*)[）)]", sval(region))
    return match.group(1).strip() if match else ""


def safe_url(value) -> str:
    """仅 http(s):// 开头的原文链接入产物，其余一律空串。"""
    text = sval(value)
    return text if text.startswith(("http://", "https://")) else ""


def cat_of(value) -> str:
    text = sval(value)
    return text if text in CATS else "其他"


def die(message: str) -> None:
    print("[build_data] 错误：" + message, file=sys.stderr)
    raise SystemExit(1)


# ---------------------------------------------------------------- 输入读取 ----------------------------------------------------------------

def load_registry(path: str) -> list:
    if not os.path.isfile(path):
        die("registry 文件不存在或不是文件：%s（请用 --registry 或环境变量 YIBAO_REGISTRY 提供真实路径）" % path)
    rows = []
    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            for lineno, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as exc:
                    die("registry 第 %d 行 JSON 解析失败：%s" % (lineno, exc))
                if not isinstance(obj, dict):
                    die("registry 第 %d 行不是 JSON 对象" % lineno)
                if not sval(obj.get("kb_id")).strip():
                    die("registry 第 %d 行缺少非空 kb_id" % lineno)
                rows.append(obj)
    except OSError as exc:
        die("无法读取 registry：%s" % exc)
    if not rows:
        die("registry 为空或没有有效记录：%s" % path)
    return rows


def load_enrichment(path: str) -> dict:
    """读取 library_export CSV，返回 {kb_id: {目标字段名: 非空字符串}}。"""
    if not os.path.isfile(path):
        die("富化 CSV 不存在或不是文件：%s" % path)
    result = {}
    try:
        with open(path, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            headers = [sval(h).strip() for h in (reader.fieldnames or [])]
            if not headers:
                die("富化 CSV 没有表头：%s" % path)
            id_col = None
            for candidate in ("kb_id", "_id", "KB_ID", "记录ID"):
                if candidate in headers:
                    id_col = candidate
                    break
            if id_col is None:
                die("富化 CSV 缺少 kb_id/_id 列，无法匹配台账：%s" % path)
            for lineno, raw in enumerate(reader, 2):
                clean = {sval(k).strip(): sval(v).strip() for k, v in raw.items() if k is not None}
                key = clean.get(id_col, "").strip()
                if not key:
                    continue  # 无主键行直接跳过，不参与富化
                values = {}
                for target, aliases in ENRICH_FIELDS.items():
                    for alias in aliases:
                        if alias in clean and clean[alias]:
                            values[target] = clean[alias]
                            break
                if values:
                    result[key] = values
    except (OSError, csv.Error) as exc:
        die("无法读取富化 CSV：%s" % exc)
    return result


# ---------------------------------------------------------------- 行构造 ----------------------------------------------------------------

def build_policy_rows(registry_rows: list, enrich: dict) -> list:
    out = []
    for src in registry_rows:
        kb_id = sval(src.get("kb_id"))
        level = region_level(src.get("region"))
        row = {
            "_id": kb_id,
            "政策标题": sval(src.get("title")),
            "发布日期": sval(src.get("publish_date")) or "1900-01-01",
            "发布机构": sval(src.get("org")),
            "行政层级": level,
            "所属县区": county_from_region(src.get("region")),
            "曝光标记": "是" if sval(src.get("exposure")).strip() in ("1", "true", "True", "是") else "否",
            "政策类别": cat_of(src.get("category")),
            "影响等级": IMPACT_BY_URGENCY.get(sval(src.get("urgency")).strip(), "中"),
            "关键词": join_keywords(src.get("keywords")),
            "政策摘要": sval(src.get("summary")),
            "原文链接": safe_url(src.get("source_url")),
            "采集来源": sval(src.get("source_channel")),
            "已读": False,
            "已收藏": False,
            "AI解读": "",
            "解读要点": "",
            "行动建议": "",
            "对玉溪影响": "",
            "乡镇卫生院影响": "",
            "解读状态": "待解读",
            "变动类型": sval(src.get("change_type")),
            "上次核对": sval(src.get("updated_at"))[:10],
            "上位依据": "",
            "解读层级角色": ROLE_BY_LEVEL[level],
        }
        related = src.get("related")
        if isinstance(related, (list, tuple)) and related:
            row["上位依据"] = json.dumps({"id": related[0]}, ensure_ascii=False)

        # 仅 CSV 真实导出可覆盖解读类字段；registry 自带的 notes/change_points 不参与，绝不臆造解读。
        rich = enrich.get(kb_id)
        if rich:
            for field in INTERPRETATION_FIELDS:
                if field in rich:
                    row[field] = rich[field]
            if "解读状态" in rich:
                row["解读状态"] = rich["解读状态"]
            elif any(row[field] for field in INTERPRETATION_FIELDS):
                row["解读状态"] = "已解读"
        out.append(row)
    return out


def build_kb_rows(registry_rows: list) -> list:
    out = []
    for src in registry_rows:
        channel = sval(src.get("source_channel"))
        if "IMA" in channel or "ima" in channel:
            source = "IMA知识库"
        elif "官网采集" in channel:
            source = "官网采集"
        else:
            source = "本地文件"
        out.append({
            "_id": sval(src.get("kb_id")),
            "条目标题": sval(src.get("title")),
            "来源": source,
            "行政层级": region_level(src.get("region")),
            "政策类别": cat_of(src.get("category")),
            "年份": sval(src.get("publish_date"))[:4],
            "关键词": join_keywords(src.get("keywords")),
            "内容摘要": sval(src.get("summary")),
            "文件路径": safe_url(src.get("source_url")),
            "文号": sval(src.get("doc_no")),
            "发布机构": sval(src.get("org")),
        })
    return out


def build_state_rows(policy_rows: list, kb_rows: list, generated_at: str,
                     next_check_at: str, registry_sha256: str) -> list:
    by_level = {level: 0 for level in ("玉溪市", "云南省", "国家")}
    by_impact = {impact: 0 for impact in ("高", "中", "低")}
    for row in policy_rows:
        by_level[row["行政层级"]] += 1
        by_impact[row["影响等级"]] += 1
    contents = {
        "freshness": {
            "lastCheckedAt": generated_at,
            "nextCheckAt": next_check_at,
            "source": "registry.jsonl 每日08:30自动化",
            "note": "准实时同步，非实时推送",
        },
        "counts": {
            "policies": len(policy_rows),
            "kb": len(kb_rows),
            "byLevel": by_level,
            "byImpact": by_impact,
        },
        "syncMeta": {
            "generatedAt": generated_at,
            "sourceRevision": registry_sha256[:12],
            "sha256": registry_sha256,
            "note": "由 build_data.py 生成，请勿手工编辑",
        },
    }
    return [
        {"_id": key, "状态键": key, "内容": json.dumps(value, ensure_ascii=False)}
        for key, value in contents.items()
    ]


# ---------------------------------------------------------------- 输出组装与写入 ----------------------------------------------------------------

def rows_digest(rows: list) -> str:
    """meta.sha256 定义：rows 正文按 ensure_ascii=False, indent=2 序列化后的 UTF-8 SHA256。"""
    payload = json.dumps(rows, ensure_ascii=False, indent=2).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def make_document(kind: str, rows: list, generated_at: str) -> dict:
    return {
        "meta": {
            "schemaVersion": "1.0",
            "sourceTable": TABLES[kind],
            "sourceName": NAMES[kind],
            "generatedAt": generated_at,
            "rowCount": len(rows),
            "sha256": rows_digest(rows),
            "pageSizeDefault": 200,
        },
        "rows": rows,
    }


def write_json_atomic(path: str, document: dict) -> None:
    """先写同目录临时文件再替换，避免中途失败留下半文件。"""
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(document, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(tmp, path)
    except OSError as exc:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        die("写入 %s 失败：%s" % (path, exc))


# ---------------------------------------------------------------- 主流程 ----------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="由 registry.jsonl 确定性生成 policies.json / state.json / kb.json（本脚本是唯一写入方）"
    )
    parser.add_argument("--registry", default=env_path("YIBAO_REGISTRY", FALLBACK_REGISTRY),
                        help="registry.jsonl 路径（优先于环境变量 YIBAO_REGISTRY）")
    parser.add_argument("--out", default=env_path("YIBAO_OUT", FALLBACK_OUT),
                        help="输出目录（优先于环境变量 YIBAO_OUT；默认仓库内 site/data）")
    parser.add_argument("--enrich", default=None, help="可选：library_export 导出的 CSV，仅覆盖解读类字段")
    args = parser.parse_args()

    registry_rows = load_registry(args.registry)
    enrich = load_enrichment(args.enrich) if args.enrich else {}

    with open(args.registry, "rb") as handle:
        registry_sha256 = hashlib.sha256(handle.read()).hexdigest()

    now = datetime.now(TZ8)
    generated_at = now.isoformat(timespec="seconds")
    next_check_at = datetime.combine((now + timedelta(days=1)).date(), time(8, 30), tzinfo=TZ8).isoformat(timespec="seconds")

    policy_rows = build_policy_rows(registry_rows, enrich)
    kb_rows = build_kb_rows(registry_rows)
    state_rows = build_state_rows(policy_rows, kb_rows, generated_at, next_check_at, registry_sha256)

    documents = {
        "policies.json": make_document("policies", policy_rows, generated_at),
        "state.json": make_document("state", state_rows, generated_at),
        "kb.json": make_document("kb", kb_rows, generated_at),
    }

    os.makedirs(args.out, exist_ok=True)
    for filename, document in documents.items():
        write_json_atomic(os.path.join(args.out, filename), document)

    print("[build_data] registry=%d 行，sha256=%s" % (len(registry_rows), registry_sha256[:12]))
    print("[build_data] generatedAt=%s enrich=%s" % (generated_at, args.enrich or "无（解读字段全部留空）"))
    for filename, document in documents.items():
        print("[build_data] 写入 %s（%d 行）" % (os.path.join(args.out, filename), document["meta"]["rowCount"]))


if __name__ == "__main__":
    main()
