/* 医保政策监测台 · 站点配置加载与生效垫片
   读取 ./data/config.json（只读站点配置，非数据表），
   应用站点名称/公告横幅/功能开关；管理员在本机保存的预览配置
   （localStorage.wbcfg_preview）优先于线上配置。
   本文件必须为同步 script，先于页面业务脚本之外的功能块加载，
   生效动作允许晚于业务脚本（轮询等待 DOM 节点出现）。 */
(function () {
  'use strict';

  var DEFAULTS = {
    version: 1,
    site: {
      title: '医保政策监测台 · 服务于澄江市乡镇卫生院（只读分享版）',
      brand: '医保政策工作台',
      subtitle: '服务于澄江市乡镇卫生院',
      footer: '澄江市乡镇卫生院医保经办参考'
    },
    announcement: { enabled: false, style: 'info', text: '' },
    features: { qa: true, exposure: true },
    security: { salt: '', passwordHash: '' }
  };

  var LS_PREVIEW = 'wbcfg_preview';

  function deepMerge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!over || typeof over !== 'object') { return out; }
    Object.keys(over).forEach(function (k) {
      var b = base[k];
      var o = over[k];
      if (b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b)) {
        out[k] = deepMerge(b, o);
      } else if (o !== undefined && o !== null) {
        out[k] = o;
      }
    });
    return out;
  }

  function loadPreview() {
    try {
      var raw = localStorage.getItem(LS_PREVIEW);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  var cfg = deepMerge(DEFAULTS, null);
  var preview = loadPreview();

  var ready = fetch('./data/config.json', { cache: 'no-cache' })
    .then(function (resp) {
      if (!resp || !resp.ok) { throw new Error('config http ' + resp.status); }
      return resp.json();
    })
    .then(function (data) {
      if (data && typeof data === 'object') {
        window.__wbCfgRemote = data;
        cfg = deepMerge(DEFAULTS, data);
      }
    })
    .catch(function () { /* 线上无 config.json 时静默用默认值 */ })
    .then(function () {
      if (preview && typeof preview === 'object') { cfg = deepMerge(cfg, preview); }
      applyAll();
      startWatchers();
    });

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function applyText() {
    var site = cfg.site || {};
    if (site.title) {
      document.title = site.title;
      var brandB = document.querySelector('.brand-txt b');
      if (brandB) { brandB.textContent = site.brand || site.title; }
      var brandS = document.querySelector('.brand-txt span');
      if (brandS && site.subtitle) { brandS.textContent = site.subtitle; }
    }
    var ftMuted = document.querySelector('.site-footer .ft-muted');
    if (ftMuted && site.footer) { ftMuted.textContent = site.footer; }
    var badge = document.querySelector('.wb-serve-badge');
    if (badge && site.subtitle) { badge.textContent = site.subtitle; }
  }

  var ANN_STYLES = {
    info:   { bg: 'var(--blue-50)',    bd: 'var(--blue-100)',    fg: 'var(--blue-2)' },
    warn:   { bg: 'rgba(184,119,10,0.10)', bd: 'rgba(184,119,10,0.35)', fg: 'var(--amber)' },
    alert:  { bg: 'var(--red-dim)',    bd: 'rgba(212,42,79,0.35)', fg: 'var(--err)' }
  };

  function ensureAnnouncement() {
    var ann = cfg.announcement || {};
    var old = document.getElementById('wbAnnounce');
    if (!ann.enabled || !String(ann.text || '').trim()) {
      if (old) { old.parentNode.removeChild(old); }
      return;
    }
    var st = ANN_STYLES[ann.style] || ANN_STYLES.info;
    if (!old) {
      old = document.createElement('div');
      old.id = 'wbAnnounce';
      var main = document.querySelector('.app-main');
      var topbar = main ? main.querySelector('.topbar') : null;
      if (!main) { return false; }
      if (topbar && topbar.nextSibling) { main.insertBefore(old, topbar.nextSibling); }
      else if (topbar) { topbar.parentNode.insertBefore(old, topbar.nextSibling); }
      else { main.insertBefore(old, main.firstChild); }
    }
    old.setAttribute('style',
      'display:flex;align-items:center;gap:9px;margin:10px 17px 0;padding:9px 14px;border-radius:10px;' +
      'font-size:13px;line-height:1.6;background:' + st.bg + ';border:1px solid ' + st.bd + ';color:' + st.fg);
    old.innerHTML = '<b style="flex:0 0 auto;letter-spacing:.5px">公告</b><span style="flex:1">' + esc(ann.text) + '</span>';
    return true;
  }

  function applyFeatureQa() {
    var want = !(cfg.features && cfg.features.qa === false);
    var nodes = [];
    var fab = document.getElementById('fab');
    if (fab) { nodes.push(fab); }
    var view = document.getElementById('view-qa');
    if (view) { nodes.push(view); }
    var navBtns = document.querySelectorAll('.nav-item[data-view="qa"], #tabbar [data-view="qa"]');
    for (var i = 0; i < navBtns.length; i++) { nodes.push(navBtns[i]); }
    if (!nodes.length) { return false; }
    nodes.forEach(function (el) { el.style.display = want ? '' : 'none'; });
    return true;
  }

  function applyFeatureExposure() {
    var want = !(cfg.features && cfg.features.exposure === false);
    if (want) { return true; }
    if (typeof window.wbExposureList !== 'function') { return false; }
    if (!window.__wbCfgExpPatched) {
      window.__wbCfgExpPatched = true;
      window.wbExposureList = function () { return []; };
    }
    return true;
  }

  function startWatchers() {
    var tries = 0;
    var timer = window.setInterval(function () {
      tries = tries + 1;
      var done = applyFeatureQa();
      var doneExp = applyFeatureExposure();
      ensureAnnouncement();
      if ((done && doneExp) || tries > 200) { window.clearInterval(timer); }
    }, 100);
  }

  function applyAll() {
    applyText();
    ensureAnnouncement();
    applyFeatureQa();
    applyFeatureExposure();
  }

  window.SiteCfg = {
    get: function () { return cfg; },
    ready: ready,
    apply: applyAll,
    savePreview: function (next) {
      if (next && typeof next === 'object') {
        try { localStorage.setItem(LS_PREVIEW, JSON.stringify(next)); } catch (e) { /* 容量满忽略 */ }
        cfg = deepMerge(DEFAULTS, window.__wbCfgRemote || {});
        cfg = deepMerge(cfg, next);
        applyAll();
      }
    },
    clearPreview: function () {
      try { localStorage.removeItem(LS_PREVIEW); } catch (e) { /* 忽略 */ }
    },
    setRemote: function (data) {
      window.__wbCfgRemote = data && typeof data === 'object' ? data : null;
    }
  };
}());
