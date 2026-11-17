#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""兼容入口：转发到 scripts/build_pages_data.py（唯一构建真源）。

本文件不保留任何构建逻辑，仅为历史调用路径（tools/build_data.py）提供兼容。
真源位置由 Path(__file__).resolve().parents[2] / 'scripts' / 'build_pages_data.py' 计算，
sys.argv[1:] 与 sys.executable 原样转发；目标不存在时明确报错退出。
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parents[2] / "scripts" / "build_pages_data.py"


def main() -> None:
    if not TARGET.is_file():
        print("[build_data] 错误：构建真源不存在：%s" % TARGET, file=sys.stderr)
        raise SystemExit(1)
    raise SystemExit(subprocess.call([sys.executable, str(TARGET)] + sys.argv[1:]))


if __name__ == "__main__":
    main()
