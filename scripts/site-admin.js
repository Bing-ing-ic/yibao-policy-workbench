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

  function lockHtml() {
    return '' +
      '<div style="max-width:340px">' +
      '<p class="small muted" style="margin:0 0 10px">请输入管理密码。初始密码为部署时设定，首次登录后请立即在下方修改。静态站点的密码门槛用于防止误操作，不能替代服务器级鉴权。</p>' +
      '<input id="cfgPwd" type="password" autocomplete="current-password" placeholder="管理密码" style="width:100%;padding:8px 11px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt);font-size:14px">' +
      '<div style="display:flex;gap:8px;margin-top:10px;align-items:center">' +
      '<button class="btn primary sm" id="cfgLogin" type="button">登录管理</button>' +
      '<span class="small muted" id="cfgLoginMsg"></span>' +
      '</div></div>';
  }

  function panelHtml(cfg) {
    var ann = cfg.announcement || {};
    var feat = cfg.features || {};
    return '' +
      '<div class="grid2" style="gap:14px">' +
      '  <div class="card card-pad">' +
      '    <h3 style="margin:0 0 10px;font-size:14px">站点名称与署名</h3>' +
      '    <label class="small muted">浏览器标签页标题</label>' +
      '    <input id="cfgTitle" type="text" style="width:100%;margin:3px 0 9px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '    <label class="small muted">侧栏站名</label>' +
      '    <input id="cfgBrand" type="text" style="width:100%;margin:3px 0 9px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '    <label class="small muted">副标题（顶栏徽章 + 侧栏小字）</label>' +
      '    <input id="cfgSubtitle" type="text" style="width:100%;margin:3px 0 9px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '    <label class="small muted">页脚署名</label>' +
      '    <input id="cfgFooter" type="text" style="width:100%;margin:3px 0 0;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '  </div>' +
      '  <div class="card card-pad">' +
      '    <h3 style="margin:0 0 10px;font-size:14px">公告横幅</h3>' +
      '    <label style="display:flex;align-items:center;gap:7px;margin-bottom:8px"><input id="cfgAnnOn" type="checkbox"' + (ann.enabled ? ' checked' : '') + '> 启用顶部公告</label>' +
      '    <label class="small muted">样式</label>' +
      '    <select id="cfgAnnStyle" style="width:100%;margin:3px 0 9px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '      <option value="info"' + ((ann.style || 'info') === 'info' ? ' selected' : '') + '>信息（蓝）</option>' +
      '      <option value="warn"' + (ann.style === 'warn' ? ' selected' : '') + '>提醒（橙）</option>' +
      '      <option value="alert"' + (ann.style === 'alert' ? ' selected' : '') + '>紧急（红）</option>' +
      '    </select>' +
      '    <label class="small muted">公告文本</label>' +
      '    <textarea id="cfgAnnText" rows="3" style="width:100%;margin:3px 0 0;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt);resize:vertical">' + esc(ann.text || '') + '</textarea>' +
      '    <h3 style="margin:14px 0 8px;font-size:14px">功能开关</h3>' +
      '    <label style="display:flex;align-items:center;gap:7px;margin-bottom:6px"><input id="cfgFeatQa" type="checkbox"' + (feat.qa !== false ? ' checked' : '') + '> 智能问答入口（侧边导航 + 悬浮按钮）</label>' +
      '    <label style="display:flex;align-items:center;gap:7px"><input id="cfgFeatExp" type="checkbox"' + (feat.exposure !== false ? ' checked' : '') + '> 曝光台并入「今天要处理」清单</label>' +
      '  </div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center">' +
      '  <button class="btn primary sm" id="cfgSavePreview" type="button">保存预览（仅本机生效）</button>' +
      '  <button class="btn sm" id="cfgDownload" type="button">下载 config.json</button>' +
      '  <button class="btn sm" id="cfgClearPreview" type="button">清除本机预览</button>' +
      '  <button class="btn sm" id="cfgLogout" type="button">退出管理</button>' +
      '  <span class="small muted">预览保存后刷新页面即可看到效果；线上生效需「发布到线上」。</span>' +
      '</div>' +
      '<div class="card card-pad" style="margin-top:14px;border-style:dashed">' +
      '  <h3 style="margin:0 0 8px;font-size:14px">发布到线上</h3>' +
      '  <p class="small muted" style="margin:0 0 10px">把当前表单内容写入仓库 ' + esc(REPO) + ' 的 ' + esc(CFG_PATH) + '，GitHub Pages 将自动重建（约 1—3 分钟）。令牌只保存在本会话，不写入任何代码或数据文件；需要 repo Contents 读写权限。</p>' +
      '  <input id="cfgPat" type="password" autocomplete="off" placeholder="GitHub 个人访问令牌（PAT）" style="width:100%;max-width:420px;padding:8px 11px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)">' +
      '  <div style="display:flex;gap:8px;margin-top:10px;align-items:center">' +
      '    <button class="btn primary sm" id="cfgPublish" type="button">发布到线上</button>' +
      '    <span class="small muted" id="cfgPubMsg"></span>' +
      '  </div>' +
      '</div>' +
      '<div class="card card-pad" style="margin-top:14px">' +
      '  <h3 style="margin:0 0 8px;font-size:14px">修改管理密码</h3>' +
      '  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
      '    <div><label class="small muted">当前密码</label><br><input id="cfgOldPwd" type="password" autocomplete="off" style="padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)"></div>' +
      '    <div><label class="small muted">新密码</label><br><input id="cfgNewPwd" type="password" autocomplete="new-password" style="padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)"></div>' +
      '    <div><label class="small muted">确认新密码</label><br><input id="cfgNewPwd2" type="password" autocomplete="new-password" style="padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--txt)"></div>' +
      '    <button class="btn sm" id="cfgChgPwd" type="button">更新密码</button>' +
      '    <span class="small muted" id="cfgPwdMsg"></span>' +
      '  </div>' +
      '  <p class="small muted" style="margin:8px 0 0">改密先在本机预览生效；要让所有访客的门槛同步更新，请点击「发布到线上」。</p>' +
      '</div>';
  }

  function bindPanel() {
    var btn;
    btn = document.getElementById('cfgSavePreview');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = collectForm();
        window.SiteCfg.savePreview(next);
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
        toast('已清除本机预览，刷新后回到线上配置', 'ok');
      });
    }
    btn = document.getElementById('cfgLogout');
    if (btn) {
      btn.addEventListener('click', function () {
        sessionStorage.removeItem(SS_AUTH);
        sessionStorage.removeItem(SS_TOKEN);
        render();
        toast('已退出管理', 'ok');
      });
    }
    btn = document.getElementById('cfgPublish');
    if (btn) {
      btn.addEventListener('click', publish);
    }
    btn = document.getElementById('cfgChgPwd');
    if (btn) {
      btn.addEventListener('click', changePwd);
    }
  }

  function b64Unicode(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function publish() {
    var msg = document.getElementById('cfgPubMsg');
    var patInput = document.getElementById('cfgPat');
    var token = (patInput && patInput.value.trim()) || sessionStorage.getItem(SS_TOKEN) || '';
    if (!token) {
      if (msg) { msg.textContent = '请先粘贴令牌（本会话内保留）'; }
      return;
    }
    try { sessionStorage.setItem(SS_TOKEN, token); } catch (e) { /* 忽略 */ }
    if (msg) { msg.textContent = '发布中…'; }
    var text = JSON.stringify(collectForm(), null, 2) + '\n';
    var apiBase = 'https://api.github.com/repos/' + REPO + '/contents/' + CFG_PATH;
    fetch(apiBase + '?ref=' + BRANCH + '&_t=' + Date.now(), { cache: 'no-store' })
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
        if (!resp.ok) {
          return resp.json().catch(function () { return {}; }).then(function (err) {
            throw new Error('HTTP ' + resp.status + (err && err.message ? '：' + err.message : ''));
          });
        }
        return resp.json();
      })
      .then(function () {
        if (msg) { msg.textContent = '✅ 已提交，Pages 自动重建约 1—3 分钟后线上生效'; }
        toast('站点配置已提交发布', 'ok');
      })
      .catch(function (err) {
        if (msg) { msg.textContent = '✗ 发布失败：' + err.message; }
        toast('发布失败：' + err.message, 'err');
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
