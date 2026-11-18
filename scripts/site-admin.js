/* 医保政策监测台 · 站点配置管理面板（管理员）
   挂在「设置 → 网站配置（管理员）」卡片内。
   门槛说明：静态站点无法做服务器级鉴权，密码门槛用于防止误操作；
   线上发布走 GitHub contents API，令牌仅存 sessionStorage、永不写入代码或数据文件。
   依赖：SiteCfg（scripts/site-config.js）已加载。 */
(function () {
  'use strict';

  var REPO = 'Bing-ing-ic/yibao-policy-workbench';
  var CFG_PATH = 'data/config.json';
  var BRANCH = 'main';
  var SS_AUTH = 'wbcfg_admin';
  var SS_TOKEN = 'wbcfg_token';

  function $(sel) { return document.querySelector(sel); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    if (typeof window.toast === 'function') { window.toast(msg, type); return; }
    try { console.log('[cfg] ' + msg); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 配置差异：发布前先看清改了什么 ----------
     只比对会真正落到线上的字段，忽略 version / updatedAt，
     否则每次打开面板都会显示「有改动」。 */
  var DIFF_FIELDS = [
    ['site.title', '标签页标题'],
    ['site.brand', '侧栏站名'],
    ['site.subtitle', '副标题'],
    ['site.footer', '页脚署名'],
    ['announcement.enabled', '公告横幅'],
    ['announcement.style', '公告样式'],
    ['announcement.text', '公告文本'],
    ['features.qa', '智能问答入口'],
    ['features.exposure', '曝光台并入待办']
  ];
  var STYLE_TXT = { info: '信息（蓝）', warn: '提醒（橙）', alert: '紧急（红）' };

  function pick(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== 'object') { return undefined; }
      cur = cur[parts[i]];
    }
    return cur;
  }

  function rawVal(path, v) {
    if (v === undefined || v === null) { return '（未设置）'; }
    if (path === 'announcement.enabled' || path === 'features.qa' || path === 'features.exposure') {
      return v ? '开启' : '关闭';
    }
    if (path === 'announcement.style') { return STYLE_TXT[v] || String(v); }
    return String(v).replace(/\s+/g, ' ').trim() || '（空）';
  }

  function clip(s, n) {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function diffList(next, base) {
    var out = [];
    DIFF_FIELDS.forEach(function (pair) {
      var a = pick(base || {}, pair[0]);
      var b = pick(next || {}, pair[0]);
      if (String(a === undefined ? '' : a) !== String(b === undefined ? '' : b)) {
        var fa = rawVal(pair[0], a);
        var fb = rawVal(pair[0], b);
        out.push({ label: pair[1], from: clip(fa, 34), to: clip(fb, 34), fromFull: clip(fa, 160), toFull: clip(fb, 160) });
      }
    });
    return out;
  }

  function sha256Hex(text) {
    if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest)) {
      return Promise.reject(new Error('当前环境不支持安全哈希（需 HTTPS）'));
    }
    var bytes = new TextEncoder().encode(text);
    return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      var arr = new Uint8Array(buf);
      var out = '';
      for (var i = 0; i < arr.length; i++) {
        out += ('0' + arr[i].toString(16)).slice(-2);
      }
      return out;
    });
  }

  function isAuthed() { return sessionStorage.getItem(SS_AUTH) === '1'; }

  /* 从面板表单收集配置（不含 security，security 走改密专用流程） */
  function collectForm() {
    var cur = (window.SiteCfg && window.SiteCfg.get()) || {};
    var val = function (id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    };
    var chk = function (id) {
      var el = document.getElementById(id);
      return !!(el && el.checked);
    };
    var out = {
      version: cur.version || 1,
      updatedAt: new Date().toISOString(),
      site: {
        title: val('cfgTitle').trim(),
        brand: val('cfgBrand').trim(),
        subtitle: val('cfgSubtitle').trim(),
        footer: val('cfgFooter').trim()
      },
      announcement: {
        enabled: chk('cfgAnnOn'),
        style: val('cfgAnnStyle') || 'info',
        text: val('cfgAnnText')
      },
      features: {
        qa: chk('cfgFeatQa'),
        exposure: chk('cfgFeatExp')
      },
      security: cur.security || { salt: '', passwordHash: '' }
    };
    return out;
  }

  function fillForm(cfg) {
    var site = cfg.site || {};
    var ann = cfg.announcement || {};
    var feat = cfg.features || {};
    var set = function (id, v) { var el = document.getElementById(id); if (el) { el.value = v === undefined || v === null ? '' : String(v); } };
    var setc = function (id, v) { var el = document.getElementById(id); if (el) { el.checked = !!v; } };
    set('cfgTitle', site.title);
    set('cfgBrand', site.brand);
    set('cfgSubtitle', site.subtitle);
    set('cfgFooter', site.footer);
    setc('cfgAnnOn', ann.enabled);
    set('cfgAnnStyle', ann.style || 'info');
    set('cfgAnnText', ann.text);
    setc('cfgFeatQa', feat.qa !== false);
    setc('cfgFeatExp', feat.exposure !== false);
  }

  var ICON_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>';

  function lockHtml() {
    return '' +
      '<div class="wcfg"><div class="wcfg-lock">' +
      '  <span class="wcfg-lock-ic">' + ICON_LOCK + '</span>' +
      '  <h3>需要管理密码</h3>' +
      '  <p class="wcfg-lead">用于修改站点名称、顶部公告与功能开关。静态站点的密码门槛只防误操作，不能替代服务器级鉴权。</p>' +
      '  <div class="wcfg-lock-row">' +
      '    <input id="cfgPwd" class="wcfg-in" type="password" autocomplete="current-password" placeholder="输入管理密码">' +
      '    <button class="btn primary sm" id="cfgLogin" type="button">进入管理</button>' +
      '  </div>' +
      '  <p class="wcfg-msg" id="cfgLoginMsg"></p>' +
      '</div></div>';
  }

  /* 单条文本输入 */
  function fieldHtml(id, label, hint, value, placeholder) {
    return '' +
      '<div class="wcfg-f">' +
      '  <label class="wcfg-lb" for="' + id + '">' + label + '</label>' +
      '  <input id="' + id + '" class="wcfg-in" type="text" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '">' +
      (hint ? '  <p class="wcfg-hint">' + hint + '</p>' : '') +
      '</div>';
  }

  /* 单条开关行 */
  function switchHtml(id, title, desc, checked) {
    return '' +
      '<label class="wcfg-sw" for="' + id + '">' +
      '  <input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + '>' +
      '  <span>' +
      '    <span class="wcfg-sw-t">' + title + '</span>' +
      '    <span class="wcfg-sw-d">' + desc + '</span>' +
      '  </span>' +
      '</label>';
  }

  function panelHtml(cfg) {
    var site = cfg.site || {};
    var ann = cfg.announcement || {};
    var feat = cfg.features || {};
    var st = ann.style || 'info';
    var opt = function (v, t) {
      return '<option value="' + v + '"' + (st === v ? ' selected' : '') + '>' + t + '</option>';
    };

    return '' +
      '<div class="wcfg">' +

      '  <div class="wcfg-hd">' +
      '    <span class="wcfg-chip"><i></i>已登录管理</span>' +
      '    <span class="wcfg-dirty" id="cfgDirty">有未保存的修改</span>' +
      '    <span class="wcfg-chip out" id="cfgOutSync"></span>' +
      '    <p class="wcfg-lead">改动先存到本机预览，确认无误再「发布到线上」写入仓库，全站生效约 1—3 分钟。本机预览只影响这台电脑的浏览器。</p>' +
      '  </div>' +

      /* 1. 站点标识 */
      '  <div class="wcfg-sec first">' +
      '    <h3 class="wcfg-st">站点标识<em>01</em></h3>' +
      '    <div class="wcfg-grid">' +
      fieldHtml('cfgTitle', '浏览器标签页标题', '出现在浏览器标签与搜索结果里', site.title, '医保政策监测台') +
      fieldHtml('cfgBrand', '侧栏站名', '左上角品牌区显示的名称', site.brand, '医保政策工作台') +
      fieldHtml('cfgSubtitle', '副标题', '顶栏徽章与侧栏小字，一句话说明服务对象', site.subtitle, '服务于××市××卫生院') +
      fieldHtml('cfgFooter', '页脚署名', '页面最底部的版权/责任单位一行', site.footer, '数据来源于公开政策文件') +
      '    </div>' +
      '  </div>' +

      /* 2. 顶部公告 */
      '  <div class="wcfg-sec">' +
      '    <h3 class="wcfg-st">顶部公告<em>02</em></h3>' +
      switchHtml('cfgAnnOn', '启用顶部公告横幅', '开启后所有访客在页面顶部看到一条通栏提示，适合停更说明、维护通知或数据口径变更提醒。', !!ann.enabled) +
      '    <div class="wcfg-grid" style="margin-top:14px">' +
      '      <div class="wcfg-f">' +
      '        <label class="wcfg-lb" for="cfgAnnStyle">横幅样式</label>' +
      '        <select id="cfgAnnStyle" class="wcfg-in">' +
      opt('info', '信息 · 蓝色') + opt('warn', '提醒 · 橙色') + opt('alert', '紧急 · 红色') +
      '        </select>' +
      '        <p class="wcfg-hint">颜色只表达轻重，不影响显示位置。</p>' +
      '        <label class="wcfg-lb" style="margin-top:14px">常用模板</label>' +
      '        <div class="wcfg-tpl">' +
      '          <button type="button" class="wcfg-tpl-b" data-ann="sync">数据同步说明</button>' +
      '          <button type="button" class="wcfg-tpl-b" data-ann="maint">临时维护通知</button>' +
      '          <button type="button" class="wcfg-tpl-b" data-ann="stop">暂停更新说明</button>' +
      '        </div>' +
      '        <p class="wcfg-hint">点一下填入下方文本框，可按需改写。</p>' +
      '      </div>' +
      '      <div class="wcfg-f">' +
      '        <label class="wcfg-lb" for="cfgAnnText">公告文本</label>' +
      '        <textarea id="cfgAnnText" class="wcfg-in" rows="3" maxlength="140" placeholder="例：本站数据同步至 2026-11-18，仅供政策查阅参考。">' + esc(ann.text || '') + '</textarea>' +
      '        <p class="wcfg-hint">建议控制在 60 字以内，上限 140 字：<span id="cfgAnnCount">0</span> / 140</p>' +
      '      </div>' +
      '    </div>' +
      '    <div class="wcfg-pv info" id="cfgAnnPv"><span></span></div>' +
      '  </div>' +

      /* 3. 功能开关 */
      '  <div class="wcfg-sec">' +
      '    <h3 class="wcfg-st">功能开关<em>03</em></h3>' +
      '    <div class="wcfg-grid">' +
      switchHtml('cfgFeatQa', '智能问答入口', '控制侧边导航项、悬浮按钮与问答视图。关闭后访客只能检索与浏览政策。', feat.qa !== false) +
      switchHtml('cfgFeatExp', '曝光台并入「今天要处理」', '关闭后曝光案例只在政策列表可查，不进入待办清单首位。', feat.exposure !== false) +
      '    </div>' +
      '  </div>' +

      /* 4. 保存 / 预览操作 */
      '  <div class="wcfg-bar">' +
      '    <button class="btn primary sm" id="cfgSavePreview" type="button">保存预览（本机生效）</button>' +
      '    <button class="btn sm" id="cfgDownload" type="button">下载 config.json</button>' +
      '    <button class="btn sm" id="cfgClearPreview" type="button">清除本机预览</button>' +
      '    <button class="btn sm" id="cfgLogout" type="button">退出管理</button>' +
      '    <p class="wcfg-hint">预览只影响当前浏览器，刷新后仍保留；要影响所有访客必须发布到线上。</p>' +
      '  </div>' +

      /* 5. 发布 */
      '  <div class="wcfg-sec">' +
      '    <h3 class="wcfg-st">发布到线上<em>04</em></h3>' +
      '    <div class="wcfg-box">' +
      '      <p class="wcfg-hint" style="margin:0 0 12px">把当前表单写入 <b style="color:var(--txt-2)">' + esc(REPO) + '</b> 的 <code style="font-family:var(--mono)">' + esc(CFG_PATH) + '</code>，GitHub Pages 自动重建。令牌只存在本会话，关页面即失效，不写入任何文件；需要该仓库 Contents 读写权限。</p>' +
      '      <div class="wcfg-grid one">' +
      '        <div class="wcfg-f">' +
      '          <label class="wcfg-lb" for="cfgPat">GitHub 访问令牌（PAT）</label>' +
      '          <input id="cfgPat" class="wcfg-in" type="password" autocomplete="off" placeholder="ghp_… 或 github_pat_…">' +
      '          <p class="wcfg-hint">出于安全，令牌不落盘、不记住到下次开机；同一浏览器会话内只需粘贴一次。</p>' +
      '        </div>' +
      '      </div>' +
      '      <div class="wcfg-diff" id="cfgPubDiff" hidden></div>' +
      '      <div class="wcfg-btn-row">' +
      '        <button class="btn primary sm" id="cfgPublish" type="button">发布到线上</button>' +
      '        <span class="wcfg-msg" id="cfgPubMsg">发布后会自动回读线上文件校验，确认真的生效。</span>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      /* 6. 改密 */
      '  <div class="wcfg-sec">' +
      '    <h3 class="wcfg-st">修改管理密码<em>05</em></h3>' +
      '    <div class="wcfg-grid">' +
      '      <div class="wcfg-f"><label class="wcfg-lb" for="cfgOldPwd">当前密码</label>' +
      '        <input id="cfgOldPwd" class="wcfg-in" type="password" autocomplete="off"></div>' +
      '      <div class="wcfg-f"><label class="wcfg-lb" for="cfgNewPwd">新密码</label>' +
      '        <input id="cfgNewPwd" class="wcfg-in" type="password" autocomplete="new-password">' +
      '        <p class="wcfg-hint">至少 8 位，建议字母加数字。</p></div>' +
      '      <div class="wcfg-f"><label class="wcfg-lb" for="cfgNewPwd2">确认新密码</label>' +
      '        <input id="cfgNewPwd2" class="wcfg-in" type="password" autocomplete="new-password"></div>' +
      '    </div>' +
      '    <div class="wcfg-btn-row">' +
      '      <button class="btn sm" id="cfgChgPwd" type="button">更新密码</button>' +
      '      <span class="wcfg-msg" id="cfgPwdMsg">改密先在本机生效，发布后所有访客的门槛同步更新。</span>' +
      '    </div>' +
      '  </div>' +

      '</div>';
  }

  /* 未保存提示 */
  function markDirty(on) {
    var el = document.getElementById('cfgDirty');
    if (!el) { return; }
    if (on) { el.classList.add('on'); } else { el.classList.remove('on'); }
  }

  /* 公告实时预览：跟随开关 / 样式 / 文本即时变化 */
  function syncPreview() {
    var pv = document.getElementById('cfgAnnPv');
    if (!pv) { return; }
    var on = document.getElementById('cfgAnnOn');
    var sel = document.getElementById('cfgAnnStyle');
    var tx = document.getElementById('cfgAnnText');
    var style = (sel && sel.value) || 'info';
    var enabled = !!(on && on.checked);
    var text = tx ? String(tx.value).trim() : '';
    pv.className = 'wcfg-pv ' + (enabled ? style : 'off');
    pv.innerHTML = '<span>' + (enabled
      ? (text ? esc(text) : '（公告文本为空，横幅不会显示）')
      : '（公告已关闭，顶部不展示横幅）') + '</span>';
    var cnt = document.getElementById('cfgAnnCount');
    if (cnt) { cnt.textContent = String(text.length); }
  }

  function bindPanel() {
    var btn;
    btn = document.getElementById('cfgSavePreview');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = collectForm();
        window.SiteCfg.savePreview(next);
        markDirty(false);
        syncOutBadge();
        toast('已保存本机预览并即时生效；刷新页面可复核', 'ok');
      });
    }
    btn = document.getElementById('cfgDownload');
    if (btn) {
      btn.addEventListener('click', function () {
        var text = JSON.stringify(collectForm(), null, 2) + '\n';
        var blob = new Blob([text], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      });
    }
    btn = document.getElementById('cfgClearPreview');
    if (btn) {
      btn.addEventListener('click', function () {
        window.SiteCfg.clearPreview();
        toast('已清除本机预览，正在恢复线上配置…', 'ok');
        /* 只删 localStorage 不会把已应用的配置撤回，必须重新加载才能回到线上版本 */
        window.setTimeout(function () { window.location.reload(); }, 600);
      });
    }
    btn = document.getElementById('cfgLogout');
    if (btn) {
      btn.addEventListener('click', function () {
        sessionStorage.removeItem(SS_AUTH);
        sessionStorage.removeItem(SS_TOKEN);
        resetPublishConfirm();
        render();
        toast('已退出管理', 'ok');
      });
    }
    btn = document.getElementById('cfgPublish');
    if (btn) {
      btn.addEventListener('click', onPublishClick);
    }
    btn = document.getElementById('cfgChgPwd');
    if (btn) {
      btn.addEventListener('click', changePwd);
    }
    bindTemplates();
  }

  /* 公告模板：点一下填入文本并自动打开开关 */
  function bindTemplates() {
    var tpls = document.querySelectorAll('#cfgMgr [data-ann]');
    var texts = {
      sync: function (d) {
        return '本站数据同步至 ' + d + '，仅供政策查阅参考，具体执行口径以经办机构通知为准。';
      },
      maint: function () {
        return '本站正在维护，部分内容可能暂时无法访问，预计 24 小时内恢复。';
      },
      stop: function () {
        return '本站在线更新已暂停，政策原文请以各级医保局官网发布为准。';
      }
    };
    Array.prototype.forEach.call(tpls, function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-ann');
        var ta = document.getElementById('cfgAnnText');
        var on = document.getElementById('cfgAnnOn');
        if (!ta || !texts[key]) { return; }
        var d = new Date();
        var ymd = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        ta.value = texts[key](ymd);
        if (on) { on.checked = true; }
        markDirty(true);
        syncPreview();
        ta.focus();
      });
    });
  }

  function b64Unicode(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  /* ---------- 本机 / 线上一致性徽章 ---------- */
  function syncOutBadge() {
    var el = document.getElementById('cfgOutSync');
    if (!el || !document.getElementById('cfgTitle')) { return; }
    var base = window.__wbCfgRemote;
    if (!base) { el.classList.remove('on'); return; }
    /* 比的是"本机已保存/已应用的配置"与线上，而不是正在编辑的表单，
       否则一敲键就同时亮两个徽章，反而说不清是没保存还是没发布 */
    var d = diffList((window.SiteCfg && window.SiteCfg.get()) || {}, base);
    if (d.length) {
      el.textContent = '本机与线上有 ' + d.length + ' 处不同 · 未发布';
      el.classList.add('on');
    } else {
      el.classList.remove('on');
    }
  }

  /* ---------- 发布：两步确认（看清差异再提交） ---------- */
  var _pubPending = false;
  var _pubTimer = 0;

  function resetPublishConfirm() {
    _pubPending = false;
    if (_pubTimer) { window.clearTimeout(_pubTimer); _pubTimer = 0; }
    var b = document.getElementById('cfgPublish');
    if (b) { b.textContent = '发布到线上'; }
    var d = document.getElementById('cfgPubDiff');
    if (d) { d.hidden = true; d.innerHTML = ''; }
  }

  function renderDiff(list) {
    var box = document.getElementById('cfgPubDiff');
    if (!box) { return; }
    var html = '<p class="wcfg-diff-t">本次将改动 ' + list.length + ' 项</p><ul>';
    list.forEach(function (it) {
      html += '<li><b>' + esc(it.label) + '</b><span class="wcfg-diff-v">' +
        '<span class="wcfg-diff-f" title="' + esc(it.fromFull) + '">' + esc(it.from) + '</span>' +
        '<i>→</i><span class="wcfg-diff-t2" title="' + esc(it.toFull) + '">' + esc(it.to) + '</span>' +
        '</span></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
    box.hidden = false;
  }

  function onPublishClick() {
    var msg = document.getElementById('cfgPubMsg');
    var next = collectForm();
    if (_pubPending) {
      resetPublishConfirm();
      doPublish(next);
      return;
    }
    var diff = diffList(next, window.__wbCfgRemote || {});
    if (!diff.length) {
      if (msg) { msg.className = 'wcfg-msg'; msg.textContent = '当前表单与线上配置一致，没有需要发布的改动。'; }
      return;
    }
    var patInput = document.getElementById('cfgPat');
    var token = (patInput && patInput.value.trim()) || sessionStorage.getItem(SS_TOKEN) || '';
    if (!token) {
      if (msg) { msg.className = 'wcfg-msg err'; msg.textContent = '请先粘贴 GitHub 令牌，再点发布。'; }
      if (patInput) { patInput.focus(); }
      return;
    }
    renderDiff(diff);
    _pubPending = true;
    var b = document.getElementById('cfgPublish');
    if (b) { b.textContent = '确认发布 · ' + diff.length + ' 项改动'; }
    if (msg) { msg.className = 'wcfg-msg'; msg.textContent = '核对上面清单后，再点一次按钮提交；10 秒内未确认自动取消。'; }
    _pubTimer = window.setTimeout(resetPublishConfirm, 10000);
  }

  function mapPublishError(status, apiMsg) {
    var m = String(apiMsg || '').replace(/\s+/g, ' ').trim();
    if (status === 401) { return '令牌无效或已过期（401）：请重新生成 PAT，并确认勾选该仓库的 Contents 读写权限。'; }
    if (status === 403) { return '令牌权限不足或被限流（403）：需要 Contents: Read and write；若为限流请稍后重试。' + (m ? ' 原始信息：' + m : ''); }
    if (status === 404) { return '仓库或文件不存在（404）：请确认 ' + REPO + ' 的 ' + BRANCH + ' 分支上存在 ' + CFG_PATH + '，且令牌有权访问该仓库。'; }
    if (status === 422) { return '提交被拒绝（422）：' + (m || '内容校验未通过，可能是分支保护或文件过大') + '。'; }
    return '发布失败（HTTP ' + status + '）' + (m ? '：' + m : '') + '。';
  }

  function putConfig(token, next, retried) {
    var text = JSON.stringify(next, null, 2) + '\n';
    var apiBase = 'https://api.github.com/repos/' + REPO + '/contents/' + CFG_PATH;
    return fetch(apiBase + '?ref=' + BRANCH + '&_t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cur) {
        var body = {
          message: 'config: 站点配置更新（管理员面板）',
          content: b64Unicode(text),
          branch: BRANCH
        };
        if (cur && cur.sha) { body.sha = cur.sha; }
        return fetch(apiBase, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      })
      .then(function (resp) {
        /* 409 = sha 冲突（别处刚提交过），重取一次 sha 再试，避免用户手动处理 */
        if (resp.status === 409 && !retried) { return putConfig(token, next, true); }
        if (!resp.ok) {
          return resp.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(mapPublishError(resp.status, err && err.message));
          });
        }
        return resp.json();
      });
  }

  /* 提交后回读线上文件：Pages 有 CDN 延迟，逐次轮询直到读到新值 */
  function verifyRemote(expected, attempt) {
    attempt = attempt || 1;
    var msg = document.getElementById('cfgPubMsg');
    var url = './data/config.json?_t=' + Date.now() + '_' + attempt;
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var same = d &&
          pick(d, 'site.title') === pick(expected, 'site.title') &&
          pick(d, 'site.footer') === pick(expected, 'site.footer') &&
          pick(d, 'announcement.text') === pick(expected, 'announcement.text') &&
          pick(d, 'announcement.enabled') === pick(expected, 'announcement.enabled') &&
          pick(d, 'features.qa') === pick(expected, 'features.qa');
        if (!same) { throw new Error('not-ready'); }
        if (window.SiteCfg && window.SiteCfg.setRemote) { window.SiteCfg.setRemote(d); }
        if (msg) { msg.className = 'wcfg-msg ok'; msg.textContent = '✅ 已回读校验：线上文件已更新（第 ' + attempt + ' 次），访客可见。'; }
        syncOutBadge();
        toast('线上配置已生效', 'ok');
        return true;
      })
      .catch(function () {
        if (attempt >= 8) {
          if (msg) {
            msg.className = 'wcfg-msg';
            msg.textContent = '已提交成功，但线上还没刷到新文件（Pages 重建通常 1—3 分钟）。稍后刷新本页再看，无需重复发布。';
          }
          return false;
        }
        if (msg) { msg.className = 'wcfg-msg'; msg.textContent = '已提交，等待 Pages 重建…（' + attempt + '/8）'; }
        return new Promise(function (res) { window.setTimeout(res, 6000); })
          .then(function () { return verifyRemote(expected, attempt + 1); });
      });
  }

  function doPublish(next) {
    var msg = document.getElementById('cfgPubMsg');
    var patInput = document.getElementById('cfgPat');
    var token = (patInput && patInput.value.trim()) || sessionStorage.getItem(SS_TOKEN) || '';
    if (!token) {
      if (msg) { msg.className = 'wcfg-msg err'; msg.textContent = '请先粘贴令牌（本会话内保留）'; }
      return;
    }
    try { sessionStorage.setItem(SS_TOKEN, token); } catch (e) { /* 忽略 */ }
    if (msg) { msg.className = 'wcfg-msg'; msg.textContent = '正在提交…'; }
    var btn = document.getElementById('cfgPublish');
    if (btn) { btn.disabled = true; }
    putConfig(token, next, false)
      .then(function () {
        markDirty(false);
        /* 已提交即把线上基线切到新值，徽章不会再提示"未发布" */
        if (window.SiteCfg && window.SiteCfg.setRemote) { window.SiteCfg.setRemote(next); }
        syncOutBadge();
        if (msg) { msg.className = 'wcfg-msg'; msg.textContent = '已提交，正在回读线上文件校验…'; }
        toast('已提交，等待线上生效', 'ok');
        return verifyRemote(next, 1);
      })
      .catch(function (err) {
        if (msg) { msg.className = 'wcfg-msg err'; msg.textContent = '✗ ' + err.message; }
        toast('发布失败：' + err.message.slice(0, 40), 'err');
      })
      .then(function () {
        if (btn) { btn.disabled = false; }
        resetPublishConfirm();
      });
  }

  function changePwd() {
    var msg = document.getElementById('cfgPwdMsg');
    var oldPwd = (document.getElementById('cfgOldPwd') || {}).value || '';
    var newPwd = (document.getElementById('cfgNewPwd') || {}).value || '';
    var newPwd2 = (document.getElementById('cfgNewPwd2') || {}).value || '';
    var cur = (window.SiteCfg && window.SiteCfg.get()) || {};
    var sec = cur.security || {};
    function say(t) { if (msg) { msg.textContent = t; } }
    if (!oldPwd || !newPwd) { say('请填写当前密码与新密码'); return; }
    if (newPwd !== newPwd2) { say('两次输入的新密码不一致'); return; }
    if (newPwd.length < 8) { say('新密码至少 8 位'); return; }
    sha256Hex((sec.salt || '') + oldPwd).then(function (h) {
      if (h !== sec.passwordHash) { throw new Error('当前密码不正确'); }
      var arr = new Uint8Array(8);
      window.crypto.getRandomValues(arr);
      var newSalt = '';
      for (var i = 0; i < arr.length; i++) { newSalt += ('0' + arr[i].toString(16)).slice(-2); }
      return sha256Hex(newSalt + newPwd).then(function (nh) {
        var next = collectForm();
        next.security = { salt: newSalt, passwordHash: nh };
        next.updatedAt = new Date().toISOString();
        window.SiteCfg.savePreview(next);
        fillForm(next);
        say('✅ 密码已更新（本机预览生效）；发布后全站生效');
        toast('管理密码已更新', 'ok');
      });
    }).catch(function (err) { say('✗ ' + err.message); });
  }

  function bindLock() {
    var btn = document.getElementById('cfgLogin');
    var input = document.getElementById('cfgPwd');
    var msg = document.getElementById('cfgLoginMsg');
    if (!btn || !input) { return; }
    function tryLogin() {
      var cur = (window.SiteCfg && window.SiteCfg.get()) || {};
      var sec = cur.security || {};
      sha256Hex((sec.salt || '') + input.value).then(function (h) {
        if (!sec.passwordHash || h !== sec.passwordHash) {
          throw new Error('密码不正确');
        }
        sessionStorage.setItem(SS_AUTH, '1');
        render();
        toast('已进入管理', 'ok');
      }).catch(function (err) {
        if (msg) { msg.textContent = err.message; }
      });
    }
    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { tryLogin(); }
    });
  }

  function render() {
    var host = document.getElementById('cfgMgr');
    if (!host || !(window.SiteCfg && window.SiteCfg.get())) { return; }
    var cfg = window.SiteCfg.get();
    if (isAuthed()) {
      host.innerHTML = panelHtml(cfg);
      bindPanel();
      syncPreview();
      markDirty(false);
      syncOutBadge();
      if (!host.__cfgWatch) {
        host.__cfgWatch = true;
        var onEdit = function () {
          markDirty(true);
          syncPreview();
          if (_pubPending) { resetPublishConfirm(); }
        };
        host.addEventListener('input', onEdit);
        host.addEventListener('change', onEdit);
      }
    } else {
      host.innerHTML = lockHtml();
      bindLock();
    }
  }

  /* 顶栏齿轮按钮 → 跳到设置视图 */
  function bindGear() {
    var gear = document.getElementById('btnCfg');
    if (!gear || gear.__cfgBound) { return; }
    gear.__cfgBound = true;
    gear.addEventListener('click', function () {
      if (typeof window.switchView === 'function') { window.switchView('settings'); }
      /* 只读版只放行「网站配置」一张卡，页头面包屑需改成对应说明，
         否则仍写着「备份 / 示例数据 / 偏好」会让人以为有别的设置可改 */
      if (document.body && document.body.classList.contains('ro')) {
        window.setTimeout(function () {
          var c = document.getElementById('viewCrumb');
          if (c) { c.textContent = '站点名称 · 顶部公告 · 功能开关（仅管理员可改）'; }
        }, 60);
      }
    });
  }

  var tries = 0;
  var timer = window.setInterval(function () {
    tries = tries + 1;
    bindGear();
    if (document.getElementById('cfgMgr') && !document.getElementById('cfgMgr').__cfgRendered) {
      render();
      var host = document.getElementById('cfgMgr');
      if (host && host.childNodes.length) { host.__cfgRendered = true; }
    }
    if ((document.getElementById('cfgMgr') && document.getElementById('cfgMgr').__cfgRendered && gearBound()) || tries > 200) {
      window.clearInterval(timer);
    }
  }, 120);

  function gearBound() {
    var g = document.getElementById('btnCfg');
    return !!(g && g.__cfgBound);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindGear();
    if (window.SiteCfg && window.SiteCfg.ready) {
      window.SiteCfg.ready.then(function () { render(); });
    } else {
      render();
    }
  });
}());
