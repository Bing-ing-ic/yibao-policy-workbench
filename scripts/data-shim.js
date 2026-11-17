/* 医保政策实时监测工作台 · GitHub Pages 只读部署垫片
   以同源静态 JSON 伪造 window.__SMART_PAGE__.database，
   让「只读分享版」页面的业务脚本零改动运行。
   本文件必须是同步 script（无 defer / async），且先于页面原有脚本加载。 */
(function () {
  'use strict';

  /* 全部面向用户的可读提示集中在这里，错误码与 site-spec.md 第 5.2 节一致。 */
  var __READONLY__ = {
    write: '只读部署版不可写入',
    noFile: '只读部署版不提供文件直链',
    unknownDb: '数据源标识无效',
    pageSize: '分页参数无效',
    cursor: '分页游标失效，请刷新',
    fetch: '数据文件读取失败，请检查网络后刷新',
    notFound: '未找到该记录',
    unsupportedAgg: '不支持的统计方式'
  };

  var MESSAGE_BY_CODE = {
    E_DB_UNKNOWN: __READONLY__.unknownDb,
    E_PAGE_SIZE: __READONLY__.pageSize,
    E_CURSOR: __READONLY__.cursor,
    E_FETCH: __READONLY__.fetch,
    E_READONLY: __READONLY__.write,
    E_READONLY_NO_FILE: __READONLY__.noFile,
    E_RECORD_NOT_FOUND: __READONLY__.notFound,
    E_UNSUPPORTED_AGG: __READONLY__.unsupportedAgg
  };

  var SOURCES = {
    'SyW9fBCPF4zBCd9EMdNlNm': { path: './data/policies.json', name: '政策监测台账' },
    'h6rLvnHD0OZ9wyiNwJVAAE': { path: './data/state.json', name: '工作台状态' },
    '6EUj03WV4rV3ItQHH4tcZt': { path: './data/kb.json', name: '医保政策知识库' }
  };

  var NativePromise = window.Promise || Promise;
  var loadCache = Object.create(null);

  function makeError(code) {
    var err = new Error(MESSAGE_BY_CODE[code] || __READONLY__.fetch);
    err.code = code;
    /* 内部标记：仅供状态栏过滤识别预期内的只读拒绝，对外文案保持不变。 */
    if (code === 'E_READONLY' || code === 'E_READONLY_NO_FILE') {
      err.__wbReadonly = true;
    }
    return err;
  }

  function rejectWith(code) {
    return NativePromise.reject(makeError(code));
  }

  /* 同一数据源只发一次请求；失败不缓存，下一次查询可以重试。 */
  function loadSource(databaseId) {
    if (!SOURCES[databaseId]) { return rejectWith('E_DB_UNKNOWN'); }
    if (loadCache[databaseId]) { return loadCache[databaseId]; }

    var task = fetch(SOURCES[databaseId].path, { cache: 'no-cache' })
      .then(function (resp) {
        if (!resp || !resp.ok) { throw makeError('E_FETCH'); }
        return resp.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.rows)) { throw makeError('E_FETCH'); }
        /* 状态表 freshness 行「内容」是 JSON 字符串，字段名为 lastCheckedAt/nextCheckAt，
           而页面读的是 lastRun/nextRun。这里补一对别名，避免改动数据文件。 */
        if (databaseId === 'h6rLvnHD0OZ9wyiNwJVAAE') {
          payload.rows.forEach(function (row) {
            if (!row || row['状态键'] !== 'freshness' || typeof row['内容'] !== 'string') { return; }
            var obj;
            try { obj = JSON.parse(row['内容']); } catch (e) { return; }
            if (!obj || typeof obj !== 'object') { return; }
            if (obj.lastRun === undefined && obj.lastCheckedAt !== undefined) { obj.lastRun = obj.lastCheckedAt; }
            if (obj.nextRun === undefined && obj.nextCheckAt !== undefined) { obj.nextRun = obj.nextCheckAt; }
            row['内容'] = JSON.stringify(obj);
          });
        }
        return payload;
      })
      .catch(function (err) {
        delete loadCache[databaseId];
        if (err && err.code) { throw err; }
        throw makeError('E_FETCH');
      });

    loadCache[databaseId] = task;
    return task;
  }

  /* 游标是十进制字符串偏移量；缺省等价于 "0"。非法格式一律拒绝。 */
  function parseCursor(startCursor) {
    if (startCursor === undefined || startCursor === null || startCursor === '') { return 0; }
    var text = String(startCursor);
    if (!/^(0|[1-9][0-9]*)$/.test(text)) { return -1; }
    var value = Number(text);
    if (!isFinite(value) || value < 0 || Math.floor(value) !== value) { return -1; }
    if (typeof Number.MAX_SAFE_INTEGER === 'number' && value > Number.MAX_SAFE_INTEGER) { return -1; }
    return value;
  }

  function compareValues(a, b) {
    if (a === b) { return 0; }
    if (a === undefined || a === null) { return -1; }
    if (b === undefined || b === null) { return 1; }
    if (typeof a === 'number' && typeof b === 'number') { return a < b ? -1 : (a > b ? 1 : 0); }
    var sa = String(a);
    var sb = String(b);
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  /* 对副本稳定排序：先按 sorts 逐项比较，完全相等时保持原始先后顺序。 */
  function sortRows(list, sorts) {
    if (!Array.isArray(sorts) || !sorts.length) { return list; }
    var wrapped = [];
    var i = 0;
    for (i = 0; i < list.length; i++) { wrapped.push({ v: list[i], i: i }); }

    wrapped.sort(function (a, b) {
      var j = 0;
      for (j = 0; j < sorts.length; j++) {
        var item = sorts[j] || {};
        if (!item.property) { continue; }
        var c = compareValues(a.v[item.property], b.v[item.property]);
        if (c !== 0) { return item.direction === 'ascending' ? c : -c; }
      }
      return a.i - b.i;
    });

    var out = [];
    for (i = 0; i < wrapped.length; i++) { out.push(wrapped[i].v); }
    return out;
  }

  function query(params) {
    params = params || {};
    var databaseId = params.databaseId;
    if (!SOURCES[databaseId]) { return rejectWith('E_DB_UNKNOWN'); }

    var pageSize = (params.pageSize === undefined || params.pageSize === null) ? 200 : params.pageSize;
    if (pageSize !== 200 && pageSize !== 50) { return rejectWith('E_PAGE_SIZE'); }

    var offset = parseCursor(params.startCursor);
    if (offset < 0) { return rejectWith('E_CURSOR'); }

    return loadSource(databaseId).then(function (payload) {
      var total = payload.rows.length;
      if (offset > total) { throw makeError('E_CURSOR'); }
      var ordered = sortRows(payload.rows.slice(), params.sorts);
      var hasMore = (offset + pageSize) < total;
      return {
        results: ordered.slice(offset, offset + pageSize),
        nextCursor: hasMore ? String(offset + pageSize) : null,
        hasMore: hasMore,
        total: total
      };
    });
  }

  function getRecord(params) {
    params = params || {};
    var databaseId = params.databaseId;
    if (!SOURCES[databaseId]) { return rejectWith('E_DB_UNKNOWN'); }
    var recordId = params.recordId;
    if (recordId === undefined || recordId === null || recordId === '') {
      return rejectWith('E_RECORD_NOT_FOUND');
    }
    return loadSource(databaseId).then(function (payload) {
      var i = 0;
      for (i = 0; i < payload.rows.length; i++) {
        if (String(payload.rows[i]._id) === String(recordId)) { return payload.rows[i]; }
      }
      throw makeError('E_RECORD_NOT_FOUND');
    });
  }

  function getSchema(params) {
    params = params || {};
    var databaseId = params.databaseId;
    if (!SOURCES[databaseId]) { return rejectWith('E_DB_UNKNOWN'); }
    return loadSource(databaseId).then(function (payload) {
      var properties = Object.create(null);
      payload.rows.forEach(function (row) {
        Object.keys(row).forEach(function (key) {
          if (properties[key]) { return; }
          var type = typeof row[key];
          if (type === 'string' || type === 'number' || type === 'boolean') {
            properties[key] = { type: type };
          }
        });
      });
      return { properties: properties, total: Object.keys(properties).length };
    });
  }

  function aggregate(params) {
    params = params || {};
    var databaseId = params.databaseId;
    if (!SOURCES[databaseId]) { return rejectWith('E_DB_UNKNOWN'); }
    var groupBy = params.groupBy;
    var count = params.count;
    /* 契约：groupBy 选填且必须是字符串，count 选填且必须是布尔值；
       任何不支持的聚合参数组合都按 E_UNSUPPORTED_AGG 拒绝。 */
    if (count !== undefined && typeof count !== 'boolean') { return rejectWith('E_UNSUPPORTED_AGG'); }

    if (groupBy === undefined || groupBy === null || groupBy === '') {
      if (count !== true) { return rejectWith('E_UNSUPPORTED_AGG'); }
      return loadSource(databaseId).then(function (payload) {
        return { groups: [{ key: '*', count: payload.rows.length }], total: payload.rows.length };
      });
    }
    if (typeof groupBy !== 'string') { return rejectWith('E_UNSUPPORTED_AGG'); }

    return loadSource(databaseId).then(function (payload) {
      var tally = Object.create(null);
      payload.rows.forEach(function (row) {
        var value = row[groupBy];
        var key = (value === undefined || value === null || value === '') ? '（空）' : String(value);
        tally[key] = (tally[key] || 0) + 1;
      });
      var groups = Object.keys(tally).map(function (key) {
        return { key: key, count: tally[key] };
      });
      return { groups: groups, total: payload.rows.length };
    });
  }

  var database = {
    query: query,
    getRecord: getRecord,
    getSchema: getSchema,
    aggregate: aggregate,
    onUpdated: function () { return false; }
  };

  /* 写类方法必须保持「reject」语义。源只读版的内联守卫会把写方法替换成
     resolve(null) 的 no-op；这里用不可写属性保住契约要求的可读错误提示，
     同时不触碰页面任何其他字段。 */
  function readonlyMethod(code) {
    return function () { return rejectWith(code); };
  }

  var LOCKED_METHODS = {
    addRecord: 'E_READONLY',
    updateRecord: 'E_READONLY',
    deleteRecord: 'E_READONLY',
    batchAdd: 'E_READONLY',
    batchUpdate: 'E_READONLY',
    batchDelete: 'E_READONLY',
    uploadImage: 'E_READONLY',
    uploadFile: 'E_READONLY',
    getDownloadUrl: 'E_READONLY_NO_FILE',
    getPreviewUrl: 'E_READONLY_NO_FILE'
  };

  Object.keys(LOCKED_METHODS).forEach(function (name) {
    Object.defineProperty(database, name, {
      value: readonlyMethod(LOCKED_METHODS[name]),
      enumerable: true,
      writable: false,
      configurable: false
    });
  });

  /* __realImpls__ 必须和 database 同时注入：源页面约 2.1 秒后的 RPC 兜底桥
     只认这个标记，缺失就会用 makeRpcDatabase() 覆盖 database 并导致查询超时。 */
  var sp = window.__SMART_PAGE__;
  if (!sp || typeof sp !== 'object') {
    sp = {};
    window.__SMART_PAGE__ = sp;
  }
  if (!sp.__realImpls__ || typeof sp.__realImpls__ !== 'object') {
    sp.__realImpls__ = {};
  }
  sp.__realImpls__.database = database;
  sp.database = database;

  /* 状态栏过滤：源页面把任何写拒绝都当成云端故障显示「云端失败」。
     只读快照的写拒绝是预期行为，这里只拦带内部标记的只读错误，
     改显中性「只读快照」；query / getRecord / getSchema 完全不经过此分支。
     页面脚本后于本文件加载，故用短轮询等待全局函数挂载，多时点尝试且只装一次。 */
  var statusFilterInstalled = false;
  function installStatusFilter() {
    if (statusFilterInstalled) { return true; }
    var realSetErr = window.setErr;
    var realSetSyncUI = window.setSyncUI;
    if (typeof realSetErr !== 'function' || typeof realSetSyncUI !== 'function') { return false; }
    window.setErr = function (err) {
      if (err && err.__wbReadonly === true) {
        try { realSetSyncUI('', '只读快照'); } catch (e) { /* 忽略 */ }
        return;
      }
      return realSetErr.apply(this, arguments);
    };
    statusFilterInstalled = true;
    return true;
  }

  installStatusFilter();
  var filterTries = 0;
  var filterTimer = window.setInterval(function () {
    filterTries = filterTries + 1;
    if (installStatusFilter() || filterTries > 600) { window.clearInterval(filterTimer); }
  }, 5);
  window.addEventListener('DOMContentLoaded', installStatusFilter);
  window.addEventListener('load', installStatusFilter);
}());
