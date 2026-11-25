/* Blog editor: Word-style writing, autosave, thumbnail, one-click publish to GitHub Pages. */
(function () {
  'use strict';

  var CFG = window.BLOG_CONFIG;
  var T = window.BlogTemplate;
  var Quill = window.Quill;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = T.esc;

  var TOKEN_KEY = 'bn-blog-gh-token';
  var CUR_KEY = 'bn-blog-current-draft';
  var API = 'https://api.github.com';
  var REPO = '/repos/' + CFG.owner + '/' + CFG.repo;
  var IMG_ABS = CFG.siteUrl + '/blog/images/';

  /* =====================================================
     Storage: drafts live in IndexedDB (roomy enough for images)
     ===================================================== */
  var DB = (function () {
    var p;
    function open() {
      if (!p) {
        p = new Promise(function (res, rej) {
          var r = indexedDB.open('bn-blog', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('drafts', { keyPath: 'id' }); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
        });
      }
      return p;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction('drafts', mode);
          var req = fn(t.objectStore('drafts'));
          t.oncomplete = function () { res(req && req.result); };
          t.onerror = t.onabort = function () { rej(t.error); };
        });
      });
    }
    return {
      put: function (d) { return tx('readwrite', function (s) { return s.put(d); }); },
      get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
      del: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); },
      all: function () { return tx('readonly', function (s) { return s.getAll(); }); }
    };
  })();

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* =====================================================
     Editor
     ===================================================== */
  var titleEl = $('#title');

  var quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Tell your story…',
    modules: {
      toolbar: {
        container: '#toolbar',
        handlers: {
          image: function () { $('#fileImg').click(); },
          video: insertVideo,
          undo: function () { quill.history.undo(); },
          redo: function () { quill.history.redo(); }
        }
      },
      history: { delay: 800, maxStack: 300, userOnly: true },
      clipboard: { matchVisual: false }
    }
  });
  quill.root.classList.add('prose');
  quill.root.setAttribute('spellcheck', 'true');

  function autosizeTitle() {
    titleEl.style.height = 'auto';
    titleEl.style.height = titleEl.scrollHeight + 'px';
  }
  titleEl.addEventListener('input', function () { autosizeTitle(); scheduleSave(); });
  titleEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); quill.focus(); }
  });

  /* ---------- Video embeds ---------- */
  function toEmbed(u) {
    u = String(u || '').trim();
    var m;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i))) {
      return 'https://www.youtube-nocookie.com/embed/' + m[1];
    }
    if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i))) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }
  function insertVideo() {
    var u = window.prompt('Paste a YouTube or Vimeo link');
    if (!u) return;
    var embed = toEmbed(u);
    if (!embed) { toast('Only YouTube and Vimeo links are supported.'); return; }
    var r = quill.getSelection(true);
    quill.insertEmbed(r.index, 'video', embed, 'user');
    quill.setSelection(r.index + 1, 0, 'silent');
  }

  /* ---------- Images ---------- */
  function readAsDataURL(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(file);
    });
  }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      if (/^https?:/i.test(src)) im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('Image failed to load')); };
      im.src = src;
    });
  }
  async function toBitmapSource(source) {
    if (typeof source === 'string') return loadImg(source);
    if (window.createImageBitmap) {
      try { return await createImageBitmap(source); } catch (e) {}
    }
    var url = URL.createObjectURL(source);
    try { return await loadImg(url); } finally { URL.revokeObjectURL(url); }
  }
  function dims(b) { return { w: b.width || b.naturalWidth, h: b.height || b.naturalHeight }; }

  async function processImage(file) {
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      if (file.size > 3 * 1024 * 1024) throw new Error('GIF and SVG files must be under 3 MB.');
      return readAsDataURL(file);
    }
    var bmp = await toBitmapSource(file);
    var d = dims(bmp);
    var scale = Math.min(1, 1600 / Math.max(d.w, d.h));
    var w = Math.round(d.w * scale), h = Math.round(d.h * scale);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var png = file.type === 'image/png';
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bmp, 0, 0, w, h);
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
  }

  async function makeThumb(source) {
    var bmp = await toBitmapSource(source);
    var d = dims(bmp);
    var W = 1200, H = 630;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0e13';
    ctx.fillRect(0, 0, W, H);
    var r = Math.max(W / d.w, H / d.h);
    var dw = d.w * r, dh = d.h * r;
    ctx.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return c.toDataURL('image/jpeg', 0.86);
  }

  async function insertImageFile(file) {
    if (!/^image\//.test(file.type)) return;
    try {
      var url = await processImage(file);
      var r = quill.getSelection(true) || { index: quill.getLength() - 1 };
      quill.insertEmbed(r.index, 'image', url, 'user');
      quill.setSelection(r.index + 1, 0, 'silent');
    } catch (e) {
      toast(e && e.message ? e.message : 'Couldn’t add that image.');
    }
  }
  $('#fileImg').addEventListener('change', async function (e) {
    var files = Array.prototype.slice.call(e.target.files);
    e.target.value = '';
    for (var i = 0; i < files.length; i++) await insertImageFile(files[i]);
  });
  function imageFiles(list) {
    return Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type); });
  }
  quill.root.addEventListener('paste', function (e) {
    var cd = e.clipboardData;
    if (!cd) return;
    var files = imageFiles(cd.files);
    if (!files.length) return;
    var html = cd.getData('text/html') || '';
    var plain = (cd.getData('text/plain') || '').trim();
    var textInHtml = html.replace(/<[^>]*>/g, '').trim();
    if (plain || textInHtml) return; // real text (e.g. from Word): let the editor handle it
    e.preventDefault();
    e.stopPropagation();
    files.forEach(insertImageFile);
  }, true);
  quill.root.addEventListener('drop', function (e) {
    var files = imageFiles(e.dataTransfer && e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    files.forEach(insertImageFile);
  }, true);

  /* ---------- Floating image controls ---------- */
  var imgBar = $('#imgBar');
  var selImg = null;
  imgBar.addEventListener('mousedown', function (e) { e.preventDefault(); });

  function hideImgBar() {
    if (selImg) selImg.classList.remove('is-selected');
    selImg = null;
    imgBar.hidden = true;
  }
  function positionImgBar() {
    if (!selImg) return;
    var r = selImg.getBoundingClientRect();
    var bw = imgBar.offsetWidth || 340;
    var top = r.top - 52;
    if (top < 76) top = Math.min(76, window.innerHeight - 60);
    var left = r.left + r.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    imgBar.style.top = top + 'px';
    imgBar.style.left = left + 'px';
  }
  function selectImg(img) {
    if (selImg && selImg !== img) selImg.classList.remove('is-selected');
    selImg = img;
    img.classList.add('is-selected');
    imgBar.hidden = false;
    positionImgBar();
  }
  function imgIndex() {
    var blot = Quill.find(selImg);
    return blot ? quill.getIndex(blot) : -1;
  }
  quill.root.addEventListener('click', function (e) {
    if (e.target.tagName === 'IMG') selectImg(e.target);
    else hideImgBar();
  });
  quill.on('selection-change', function (range) {
    if (range && range.length === 0) hideImgBar();
  });
  window.addEventListener('scroll', positionImgBar, { passive: true });
  window.addEventListener('resize', positionImgBar);
  imgBar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !selImg) return;
    var idx = imgIndex();
    if (b.dataset.w) {
      selImg.setAttribute('width', b.dataset.w);
      selImg.removeAttribute('height');
      quill.update('user');
      positionImgBar();
    } else if (b.dataset.a) {
      if (idx > -1) quill.formatLine(idx, 1, 'align', b.dataset.a === 'left' ? false : b.dataset.a, 'user');
      setTimeout(positionImgBar, 30);
    } else if (b.dataset.act === 'alt') {
      var v = window.prompt('Describe this image for people using screen readers', selImg.getAttribute('alt') || '');
      if (v !== null) {
        selImg.setAttribute('alt', v);
        quill.update('user');
      }
    } else if (b.dataset.act === 'remove') {
      if (idx > -1) quill.deleteText(idx, 1, 'user');
      hideImgBar();
    }
  });

  /* =====================================================
     Drafts and autosave
     ===================================================== */
  var draft = null;
  var saveTimer = null;
  var dirty = false;
  var lastEditAt = Date.now();
  var editedSinceNudge = false;

  function blankDraft() {
    return {
      id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: '', delta: { ops: [] }, excerpt: '', tags: '', slug: '',
      thumb: null, thumbPath: null, trash: [],
      publishedSlug: null, publishedDate: null, updatedAt: Date.now(), words: 0
    };
  }
  function wordCount() {
    return quill.getText().trim().split(/\s+/).filter(Boolean).length;
  }
  function hasContent() {
    return wordCount() > 0 || !!quill.root.querySelector('img, iframe');
  }
  function syncDraft() {
    draft.title = titleEl.value;
    draft.delta = quill.getContents();
    draft.words = wordCount();
    draft.updatedAt = Date.now();
  }
  function hhmm() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function setStatus(state, text) {
    var box = $('#saveStatus');
    box.setAttribute('data-state', state);
    $('#saveText').textContent =
      text ||
      (state === 'saved' ? 'All changes saved · ' + hhmm() :
       state === 'saving' ? 'Saving…' : 'Ready');
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!draft) return;
    syncDraft();
    setStatus('saving');
    try {
      await DB.put(draft);
      lsSet(CUR_KEY, draft.id);
      dirty = false;
      setStatus('saved');
    } catch (e) {
      setStatus('error', 'Couldn’t save on this device');
    }
  }
  function scheduleSave() {
    if (!draft) return;
    dirty = true;
    editedSinceNudge = true;
    lastEditAt = Date.now();
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  }
  quill.on('text-change', function (delta, old, source) {
    if (source === 'silent') return;
    scheduleSave();
  });

  function isEmptyDraft(d) {
    if (!d) return true;
    if (d.title && d.title.trim()) return false;
    if (d.publishedSlug) return false;
    return (d.delta.ops || []).every(function (op) {
      return typeof op.insert === 'string' && !op.insert.trim();
    });
  }

  function loadDraft(d) {
    draft = d;
    hideImgBar();
    titleEl.value = d.title || '';
    autosizeTitle();
    if (d.importHtml) {
      quill.setContents([], 'silent');
      quill.clipboard.dangerouslyPasteHTML(0, d.importHtml, 'silent');
      d.delta = quill.getContents();
      delete d.importHtml;
    } else {
      quill.setContents(d.delta && d.delta.ops ? d.delta : { ops: [] }, 'silent');
    }
    quill.history.clear();
    lsSet(CUR_KEY, d.id);
    editedSinceNudge = false;
    dirty = false;
    setStatus(d.updatedAt && !isEmptyDraft(d) ? 'saved' : 'idle', d.updatedAt && !isEmptyDraft(d) ? 'Saved on this device' : 'Ready');
  }

  async function openDraft(d) {
    await saveNow();
    if (isEmptyDraft(draft)) { try { await DB.del(draft.id); } catch (e) {} }
    loadDraft(d);
  }
  async function newPost() {
    await saveNow();
    if (isEmptyDraft(draft)) { try { await DB.del(draft.id); } catch (e) {} }
    loadDraft(blankDraft());
    closeDrawer();
    titleEl.focus();
  }

  /* =====================================================
     Drawer: drafts and published posts
     ===================================================== */
  var drawer = $('#drawer');
  var scrim = $('#scrim');
  function closeDrawer() { drawer.hidden = true; scrim.hidden = true; }
  async function openDrawer() {
    drawer.hidden = false;
    scrim.hidden = false;
    renderDrafts();
    renderPublished();
  }
  function ago(ms) {
    var s = Math.max(1, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  }
  async function renderDrafts() {
    var ul = $('#draftList');
    var all = [];
    try { all = await DB.all(); } catch (e) {}
    all = all.filter(function (d) { return d.id === draft.id || !isEmptyDraft(d); })
             .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (!all.length) { ul.innerHTML = '<li class="empty-row">No drafts yet.</li>'; return; }
    ul.innerHTML = all.map(function (d) {
      var title = (d.id === draft.id ? titleEl.value : d.title) || 'Untitled';
      return '<li class="' + (d.id === draft.id ? 'current' : '') + '" data-id="' + esc(d.id) + '">' +
        '<div class="pt">' + esc(title) + '</div>' +
        '<div class="pm">' + (d.publishedSlug ? 'Published post, edited locally · ' : '') + ago(d.updatedAt) + ' · ' + (d.words || 0) + ' words</div>' +
        '<div class="pa"><button type="button" data-open>' + (d.id === draft.id ? 'Editing' : 'Open') + '</button>' +
        '<button type="button" class="danger" data-del>Delete draft</button></div></li>';
    }).join('');
  }
  async function renderPublished() {
    var ul = $('#pubList');
    ul.innerHTML = '<li class="empty-row">Loading…</li>';
    var posts = [];
    try {
      posts = lsGet(TOKEN_KEY) ? await getRemotePosts() : await getSitePosts();
    } catch (e) {
      try { posts = await getSitePosts(); } catch (e2) {
        ul.innerHTML = '<li class="empty-row">Couldn’t load published posts.</li>';
        return;
      }
    }
    if (!posts.length) { ul.innerHTML = '<li class="empty-row">Nothing published yet.</li>'; return; }
    ul.innerHTML = posts.map(function (p) {
      return '<li data-slug="' + esc(p.slug) + '"><div class="pt">' + esc(p.title) + '</div>' +
        '<div class="pm">' + esc(T.fmtDate(p.date, CFG)) + '</div>' +
        '<div class="pa"><button type="button" data-edit>Edit</button>' +
        '<a href="../posts/' + encodeURIComponent(p.slug) + '/" target="_blank" rel="noopener">View</a>' +
        '<button type="button" class="danger" data-delpub>Delete</button></div></li>';
    }).join('');
    ul._posts = posts;
  }
  $('#draftList').addEventListener('click', async function (e) {
    var li = e.target.closest('li[data-id]');
    if (!li) return;
    var id = li.dataset.id;
    if (e.target.closest('[data-open]')) {
      if (id === draft.id) { closeDrawer(); return; }
      var d = await DB.get(id);
      if (d) { await openDraft(d); closeDrawer(); }
    } else if (e.target.closest('[data-del]')) {
      if (!window.confirm('Delete this draft from this device? This cannot be undone.')) return;
      try { await DB.del(id); } catch (err) {}
      if (id === draft.id) loadDraft(blankDraft());
      renderDrafts();
    }
  });
  $('#pubList').addEventListener('click', async function (e) {
    var li = e.target.closest('li[data-slug]');
    if (!li) return;
    var post = ($('#pubList')._posts || []).filter(function (p) { return p.slug === li.dataset.slug; })[0];
    if (!post) return;
    if (e.target.closest('[data-edit]')) editPublished(post);
    else if (e.target.closest('[data-delpub]')) deletePublished(post);
  });
  $('#btnPosts').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  $('#btnNew').addEventListener('click', newPost);

  async function editPublished(post) {
    try {
      var all = await DB.all();
      var existing = all.filter(function (d) { return d.publishedSlug === post.slug; })[0];
      if (existing) {
        await openDraft(existing);
        closeDrawer();
        toast('Opened your local copy of this post.');
        return;
      }
      var r = await fetch('../posts/' + encodeURIComponent(post.slug) + '/?v=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('Could not load the post (' + r.status + ')');
      var doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      var content = doc.getElementById('content');
      if (!content) throw new Error('This post has an unexpected format.');
      content.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || '';
        var m = src.match(/images\/([^"'?#]+)$/);
        if (m) img.setAttribute('src', IMG_ABS + m[1]);
      });
      var d = blankDraft();
      d.title = post.title;
      d.excerpt = post.excerpt || '';
      d.tags = (post.tags || []).join(', ');
      d.slug = post.slug;
      d.thumbPath = post.thumbnail || null;
      d.publishedSlug = post.slug;
      d.publishedDate = post.date;
      d.importHtml = content.innerHTML;
      await saveNow();
      if (isEmptyDraft(draft)) { try { await DB.del(draft.id); } catch (e) {} }
      loadDraft(d);
      await saveNow();
      closeDrawer();
    } catch (err) {
      toast(err.message || 'Couldn’t open that post.');
    }
  }

  /* =====================================================
     Toast, nudge
     ===================================================== */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg, actionLabel, action, ms) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' +
      (actionLabel ? '<button type="button" data-a>' + esc(actionLabel) + '</button>' : '') +
      '<button type="button" class="x" data-x aria-label="Dismiss">&times;</button>';
    toastEl.hidden = false;
    toastEl.onclick = function (e) {
      if (e.target.closest('[data-a]') && action) { toastEl.hidden = true; action(); }
      else if (e.target.closest('[data-x]')) toastEl.hidden = true;
    };
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 6000);
  }
  function anyDialogOpen() {
    return Array.prototype.some.call(document.querySelectorAll('dialog'), function (d) { return d.open; });
  }
  setInterval(function () {
    if (!draft || !editedSinceNudge || anyDialogOpen()) return;
    if (Date.now() - lastEditAt < 120000 || wordCount() < 120 || !titleEl.value.trim()) return;
    editedSinceNudge = false;
    toast('Finished writing? Publish it whenever you’re ready.', 'Review & publish', openPublish, 20000);
  }, 15000);

  /* =====================================================
     GitHub
     ===================================================== */
  function getToken() { return lsGet(TOKEN_KEY) || ''; }
  async function gh(path, opts) {
    opts = opts || {};
    var res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        Authorization: 'Bearer ' + getToken(),
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 404 && opts.allow404) return null;
    if (!res.ok) {
      var msg = '';
      try { msg = (await res.json()).message || ''; } catch (e) {}
      var err = new Error(
        res.status === 401 ? 'GitHub rejected the token. Open settings and add a new one.' :
        res.status === 403 || res.status === 404
          ? 'The token can’t write to ' + CFG.owner + '/' + CFG.repo + '. Check that it has Contents: Read and write on that repository.' :
        'GitHub error ' + res.status + (msg ? ': ' + msg : '')
      );
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
    return new TextDecoder().decode(bytes);
  }
  async function getRemotePosts() {
    var r = await gh(REPO + '/contents/blog/posts.json?ref=' + encodeURIComponent(CFG.branch), { allow404: true });
    if (!r) return [];
    var json = JSON.parse(b64ToUtf8(r.content));
    return (json && json.posts) || [];
  }
  async function getSitePosts() {
    var r = await fetch('../posts.json?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('posts.json ' + r.status);
    return ((await r.json()).posts) || [];
  }

  /* One commit containing every changed file (atomic) */
  async function commitFiles(files, deletions, message) {
    var branch = encodeURIComponent(CFG.branch);
    var ref = await gh(REPO + '/git/ref/heads/' + branch);
    var headSha = ref.object.sha;
    var head = await gh(REPO + '/git/commits/' + headSha);
    var baseTree = head.tree.sha;

    var entries = await Promise.all(files.map(async function (f) {
      var blob = await gh(REPO + '/git/blobs', {
        method: 'POST', body: { content: f.content, encoding: f.encoding || 'utf-8' }
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    if (deletions && deletions.length) {
      var tree = await gh(REPO + '/git/trees/' + baseTree + '?recursive=1');
      var existing = {};
      (tree.tree || []).forEach(function (n) { existing[n.path] = true; });
      var written = {};
      files.forEach(function (f) { written[f.path] = true; });
      deletions.forEach(function (p) {
        if (written[p]) return;
        if (tree.truncated || existing[p]) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
      });
    }

    var newTree = await gh(REPO + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: entries } });
    var commit = await gh(REPO + '/git/commits', {
      method: 'POST', body: { message: message, tree: newTree.sha, parents: [headSha] }
    });
    await gh(REPO + '/git/refs/heads/' + branch, { method: 'PATCH', body: { sha: commit.sha } });
    return commit.sha;
  }

  function sortPosts(list) {
    return list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }
  function postsJson(list) {
    return JSON.stringify({ posts: list }, null, 2) + '\n';
  }

  async function deletePublished(post) {
    if (!getToken()) { openSettings('Add your token first, then delete the post.'); return; }
    if (!window.confirm('Delete “' + post.title + '” from your site? This removes it from the blog and cannot be undone.')) return;
    toast('Deleting…', null, null, 15000);
    try {
      var posts = await getRemotePosts();
      var pageFile = await gh(REPO + '/contents/blog/posts/' + encodeURIComponent(post.slug) + '/index.html?ref=' + encodeURIComponent(CFG.branch), { allow404: true });
      var imgs = {};
      if (pageFile) {
        var re = /images\/([A-Za-z0-9._-]+)/g, m, html = b64ToUtf8(pageFile.content);
        while ((m = re.exec(html))) imgs[m[1]] = true;
      }
      if (post.thumbnail) imgs[post.thumbnail.replace(/^images\//, '')] = true;
      delete imgs['blog-cover.jpg'];
      var dels = ['blog/posts/' + post.slug + '/index.html'];
      Object.keys(imgs).forEach(function (n) { dels.push('blog/images/' + n); });
      var list = sortPosts(posts.filter(function (p) { return p.slug !== post.slug; }));
      await commitFiles([
        { path: 'blog/posts.json', content: postsJson(list) },
        { path: 'blog/feed.xml', content: T.buildFeed(list, CFG) }
      ], dels, 'Delete post: ' + post.title);
      var all = await DB.all().catch(function () { return []; });
      for (var i = 0; i < all.length; i++) {
        if (all[i].publishedSlug === post.slug) {
          if (all[i].id === draft.id) { draft.publishedSlug = null; draft.publishedDate = null; draft.thumbPath = null; }
          else { all[i].publishedSlug = null; all[i].publishedDate = null; all[i].thumbPath = null; await DB.put(all[i]); }
        }
      }
      toast('Post deleted. The site will update in a minute or two.');
      renderPublished();
    } catch (err) {
      toast(err.message || 'Couldn’t delete the post.', null, null, 9000);
    }
  }

  /* =====================================================
     Settings (token)
     ===================================================== */
  var settingsDlg = $('#settingsDialog');
  var tokenMsg = $('#tokenMsg');
  var resumePublish = false;
  $('#repoName').textContent = CFG.owner + '/' + CFG.repo;
  function openSettings(note) {
    $('#tokenInput').value = '';
    tokenMsg.className = 'msg' + (getToken() ? ' ok' : '');
    tokenMsg.textContent = note || (getToken() ? 'A token is saved in this browser.' : '');
    settingsDlg.showModal();
  }
  $('#btnSettings').addEventListener('click', function () { openSettings(); });
  $('#tokenSave').addEventListener('click', async function () {
    var t = $('#tokenInput').value.trim();
    if (!t) { tokenMsg.className = 'msg bad'; tokenMsg.textContent = 'Paste your token first.'; return; }
    tokenMsg.className = 'msg'; tokenMsg.textContent = 'Checking…';
    var prev = getToken();
    lsSet(TOKEN_KEY, t);
    try {
      var repo = await gh(REPO);
      if (repo.permissions && repo.permissions.push === false) throw new Error('This token can read the repository but not write to it.');
      await gh(REPO + '/git/ref/heads/' + encodeURIComponent(CFG.branch));
      tokenMsg.className = 'msg ok';
      tokenMsg.textContent = 'Connected to ' + repo.full_name + '.';
      if (resumePublish) {
        resumePublish = false;
        setTimeout(function () { settingsDlg.close(); doPublish(); }, 600);
      }
    } catch (err) {
      if (prev) lsSet(TOKEN_KEY, prev); else lsDel(TOKEN_KEY);
      tokenMsg.className = 'msg bad';
      tokenMsg.textContent = err.message || 'That token didn’t work.';
    }
  });
  $('#tokenRemove').addEventListener('click', function () {
    lsDel(TOKEN_KEY);
    tokenMsg.className = 'msg';
    tokenMsg.textContent = 'Token removed from this browser.';
  });
  settingsDlg.addEventListener('close', function () { resumePublish = false; });

  /* =====================================================
     Cleaning the editor output
     ===================================================== */
  var hookInstalled = false;
  function installPurifyHook() {
    if (hookInstalled) return;
    hookInstalled = true;
    window.DOMPurify.addHook('uponSanitizeElement', function (node, data) {
      if (data.tagName === 'iframe') {
        var src = node.getAttribute('src') || '';
        if (!/^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com|player\.vimeo\.com)\//i.test(src) && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    });
  }
  function unwrap(el) {
    var p = el.parentNode;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
  }
  function cleanBody() {
    installPurifyHook();
    var rootEl = quill.root.cloneNode(true);
    rootEl.querySelectorAll('.ql-cursor, .ql-ui').forEach(function (n) { n.remove(); });
    rootEl.querySelectorAll('img').forEach(function (i) {
      i.classList.remove('is-selected');
      if (!i.getAttribute('class')) i.removeAttribute('class');
    });
    rootEl.querySelectorAll('[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
    rootEl.querySelectorAll('[spellcheck]').forEach(function (n) { n.removeAttribute('spellcheck'); });
    // Pure black or white text should follow the reader's theme, not be forced
    rootEl.querySelectorAll('[style]').forEach(function (n) {
      var c = (n.style.color || '').replace(/\s/g, '').toLowerCase();
      if (c && /^(rgb\(0,0,0\)|rgb\(255,255,255\)|#000|#000000|#fff|#ffffff|black|white)$/.test(c) && !n.style.backgroundColor) {
        n.style.removeProperty('color');
        if (!n.getAttribute('style')) n.removeAttribute('style');
        if (n.tagName === 'SPAN' && !n.attributes.length) unwrap(n);
      }
    });
    // Blank paragraphs are spacing in a word processor; the page styles already space paragraphs
    rootEl.querySelectorAll('p').forEach(function (p) {
      if (p.innerHTML.replace(/\s/g, '') === '<br>') p.remove();
    });
    var html = window.DOMPurify.sanitize(rootEl.innerHTML, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allowfullscreen', 'frameborder', 'target', 'loading', 'decoding']
    });
    return html.trim();
  }

  /* =====================================================
     Publish dialog
     ===================================================== */
  var pubDlg = $('#publishDialog');
  var pTitle = $('#pTitle'), pExcerpt = $('#pExcerpt'), pSlug = $('#pSlug'), pTags = $('#pTags');
  var pvImg = $('#pvImg');
  var slugTouched = false;

  function autoExcerpt() {
    var tmp = document.createElement('div');
    tmp.innerHTML = cleanBody();
    var first = Array.prototype.filter.call(tmp.querySelectorAll('p'), function (x) { return x.textContent.trim().length > 20; })[0];
    var t = T.textOf(first ? first.innerHTML : tmp.innerHTML);
    if (t.length <= 160) return t;
    var cut = t.slice(0, 160);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), 100)).replace(/[,;:\s-]+$/, '') + '…';
  }
  function thumbSrcForPreview() {
    if (draft.thumb) return draft.thumb;
    if (draft.thumbPath) return IMG_ABS + draft.thumbPath.replace(/^images\//, '');
    return '';
  }
  function refreshPreview() {
    $('#pvHost').textContent = CFG.siteUrl.replace(/^https?:\/\//, '').split('/')[0];
    $('#pvTitle').textContent = pTitle.value.trim() || 'Untitled';
    $('#pvDesc').textContent = pExcerpt.value.trim();
    var src = thumbSrcForPreview();
    if (src) { pvImg.src = src; pvImg.classList.add('has'); pvImg.style.display = ''; }
    else { pvImg.removeAttribute('src'); pvImg.classList.remove('has'); pvImg.style.display = 'none'; }
    $('#pvNote').textContent = src
      ? 'This image appears when the link is shared on LinkedIn, WhatsApp, X and more.'
      : 'No thumbnail yet. Add one so your link stands out when shared.';
    $('#pExcerptCount').textContent = pExcerpt.value.length + '/200';
  }
  [pTitle, pExcerpt].forEach(function (el) { el.addEventListener('input', refreshPreview); });
  pTitle.addEventListener('input', function () {
    if (!draft.publishedSlug && !slugTouched) pSlug.value = T.slugify(pTitle.value);
  });
  pSlug.addEventListener('input', function () { slugTouched = true; });
  pSlug.addEventListener('blur', function () { pSlug.value = T.slugify(pSlug.value); });

  async function setThumbFrom(source) {
    try {
      draft.thumb = await makeThumb(source);
      refreshPreview();
    } catch (e) {
      toast('Couldn’t use that image as a thumbnail.');
    }
  }
  $('#btnThumb').addEventListener('click', function () { $('#fileThumb').click(); });
  $('#dropThumb').addEventListener('click', function (e) { if (!e.target.closest('a')) $('#fileThumb').click(); });
  $('#dropThumb').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileThumb').click(); }
  });
  $('#fileThumb').addEventListener('change', function (e) {
    var f = e.target.files[0];
    e.target.value = '';
    if (f) setThumbFrom(f);
  });
  $('#btnThumbFirst').addEventListener('click', function () {
    var im = quill.root.querySelector('img');
    if (!im) { toast('There are no images in the post yet.'); return; }
    setThumbFrom(im.getAttribute('src'));
  });
  $('#btnThumbClear').addEventListener('click', function () {
    if (draft.thumbPath && draft.publishedSlug) { draft.trash = (draft.trash || []).concat('blog/' + draft.thumbPath); }
    draft.thumb = null;
    draft.thumbPath = null;
    refreshPreview();
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    $('#dropThumb').addEventListener(ev, function (e) { e.preventDefault(); $('#dropThumb').classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    $('#dropThumb').addEventListener(ev, function () { $('#dropThumb').classList.remove('drag'); });
  });
  $('#dropThumb').addEventListener('drop', function (e) {
    e.preventDefault();
    var f = imageFiles(e.dataTransfer.files)[0];
    if (f) setThumbFrom(f);
  });

  async function openPublish() {
    await saveNow();
    if (!titleEl.value.trim()) { toast('Give your post a title first.'); titleEl.focus(); return; }
    if (!hasContent()) { toast('Write something first, then publish.'); quill.focus(); return; }
    pTitle.value = titleEl.value.trim();
    pExcerpt.value = draft.excerpt || autoExcerpt();
    pTags.value = draft.tags || '';
    pSlug.value = draft.slug || T.slugify(titleEl.value);
    pSlug.disabled = !!draft.publishedSlug;
    slugTouched = !!draft.slug;
    $('#pGo').textContent = draft.publishedSlug ? 'Update post' : 'Publish post';
    $('#pubTarget').textContent = 'Publishes to ' + CFG.owner + '/' + CFG.repo + ' (' + CFG.branch + ')';
    $('#stageForm').hidden = false;
    $('#stageProgress').hidden = true;
    refreshPreview();
    if (!pubDlg.open) pubDlg.showModal();
  }
  $('#btnPublish').addEventListener('click', openPublish);
  $('#pCancel').addEventListener('click', function () { pubDlg.close(); quill.focus(); });
  $('#errBack').addEventListener('click', function () {
    $('#stageProgress').hidden = true;
    $('#stageForm').hidden = false;
  });

  $('#pGo').addEventListener('click', function () {
    var title = pTitle.value.trim();
    if (!title) { pTitle.focus(); return; }
    draft.title = title;
    titleEl.value = title;
    autosizeTitle();
    draft.excerpt = pExcerpt.value.trim();
    draft.tags = pTags.value;
    draft.slug = T.slugify(pSlug.value || title);
    saveNow();
    if (!getToken()) { resumePublish = true; openSettings('Connect your GitHub token to publish. It only takes a minute.'); return; }
    doPublish();
  });

  /* ---------- progress UI ---------- */
  var STEPS = ['Preparing your post', 'Uploading images', 'Publishing to GitHub', 'Waiting for your site to update'];
  var stepEls = [];
  function showProgress(title) {
    $('#stageForm').hidden = true;
    $('#stageProgress').hidden = false;
    $('#progTitle').textContent = title;
    $('#doneBox').hidden = true;
    $('#errBox').hidden = true;
    var old = $('#errMsg');
    if (old) old.remove();
    $('#steps').innerHTML = STEPS.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    stepEls = Array.prototype.slice.call($('#steps').children);
  }
  function step(i, state) { if (stepEls[i]) stepEls[i].className = state; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function waitForLive(url, buildId) {
    for (var i = 0; i < 45; i++) {
      try {
        var r = await fetch(url + '?b=' + Date.now(), { cache: 'no-store' });
        if (r.ok && (await r.text()).indexOf(buildId) !== -1) return true;
      } catch (e) {}
      await sleep(4000);
    }
    return false;
  }

  function uniqueSlug(slug, posts) {
    var taken = {};
    posts.forEach(function (p) { taken[p.slug] = true; });
    if (!taken[slug]) return slug;
    var n = 2;
    while (taken[slug + '-' + n]) n++;
    return slug + '-' + n;
  }
  function extFor(mime) {
    return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' }[mime] || 'jpg';
  }

  async function doPublish() {
    var editing = draft.publishedSlug;
    showProgress(editing ? 'Updating your post…' : 'Publishing your post…');
    var cur = 0;
    try {
      step(0, 'active');
      var posts = await getRemotePosts();
      var slug = editing || uniqueSlug(draft.slug || T.slugify(draft.title), posts);
      var stamp = Date.now().toString(36);

      var holder = document.createElement('div');
      holder.innerHTML = cleanBody();
      var files = [];
      var deletions = (draft.trash || []).slice();
      var n = 0;
      holder.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || '';
        var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(src);
        if (m) {
          var name = slug + '-' + stamp + '-' + (++n) + '.' + extFor(m[1].toLowerCase());
          files.push({ path: 'blog/images/' + name, content: m[2], encoding: 'base64' });
          img.setAttribute('src', '../../images/' + name);
        } else if (src.indexOf(IMG_ABS) === 0) {
          img.setAttribute('src', '../../images/' + src.slice(IMG_ABS.length));
        }
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
      });
      var body = holder.innerHTML;

      var thumbnail = draft.thumbPath || null;
      if (draft.thumb) {
        var tname = slug + '-cover-' + stamp + '.jpg';
        files.push({ path: 'blog/images/' + tname, content: draft.thumb.split(',')[1], encoding: 'base64' });
        if (draft.thumbPath) deletions.push('blog/' + draft.thumbPath);
        thumbnail = 'images/' + tname;
      }
      step(0, 'ok');

      cur = 1;
      step(1, 'active');
      var nowIso = new Date().toISOString();
      var prev = posts.filter(function (p) { return p.slug === slug; })[0];
      var tags = [];
      draft.tags.split(',').forEach(function (t) {
        t = t.trim();
        if (t && !tags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); })) tags.push(t);
      });
      var meta = {
        slug: slug,
        title: draft.title.trim(),
        excerpt: draft.excerpt || autoExcerpt(),
        date: (prev && prev.date) || nowIso,
        tags: tags.slice(0, 6),
        thumbnail: thumbnail,
        readingMinutes: T.readingMinutes(body)
      };
      if (prev) meta.updated = nowIso;
      var pageMeta = Object.assign({ buildId: stamp }, meta);
      var page = T.buildPostPage(pageMeta, body, CFG);

      var list = sortPosts(posts.filter(function (p) { return p.slug !== slug; }).concat([meta]));
      files.push({ path: 'blog/posts/' + slug + '/index.html', content: page });
      files.push({ path: 'blog/posts.json', content: postsJson(list) });
      files.push({ path: 'blog/feed.xml', content: T.buildFeed(list, CFG) });
      step(1, 'ok');

      cur = 2;
      step(2, 'active');
      await commitFiles(files, deletions, (prev ? 'Update post: ' : 'Publish post: ') + meta.title);
      step(2, 'ok');

      draft.publishedSlug = slug;
      draft.publishedDate = meta.date;
      draft.slug = slug;
      draft.thumbPath = thumbnail;
      draft.thumb = null;
      draft.trash = [];
      editedSinceNudge = false;
      await saveNow();

      cur = 3;
      step(3, 'active');
      var url = CFG.siteUrl + '/blog/posts/' + slug + '/';
      var live = await waitForLive(url, stamp);
      step(3, 'ok');
      $('#progTitle').textContent = prev ? 'Post updated' : 'Post published';
      $('#doneMsg').textContent = live
        ? 'Your post is live. Share the link and the thumbnail will appear in the preview.'
        : 'Saved to GitHub. GitHub Pages is still building, so the link may take another minute or two to work.';
      $('#doneOpen').href = url;
      $('#doneCopy').onclick = function () {
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
          function () { $('#doneCopy').textContent = 'Link copied'; },
          function () { window.prompt('Copy this link', url); }
        );
      };
      $('#doneCopy').textContent = 'Copy link';
      $('#doneBox').hidden = false;
    } catch (err) {
      step(cur, 'bad');
      $('#progTitle').textContent = 'That didn’t go through';
      var p = document.createElement('p');
      p.id = 'errMsg';
      p.className = 'msg bad';
      p.style.marginTop = '18px';
      p.textContent = (err && err.message) || 'Something went wrong. Your draft is safe on this device.';
      $('#steps').after(p);
      $('#errBox').hidden = false;
    }
  }

  /* =====================================================
     Preview
     ===================================================== */
  $('#btnPreview').addEventListener('click', async function () {
    await saveNow();
    if (!hasContent()) { toast('Nothing to preview yet.'); return; }
    var meta = {
      slug: 'preview',
      title: titleEl.value.trim() || 'Untitled',
      excerpt: draft.excerpt || autoExcerpt(),
      date: draft.publishedDate || new Date().toISOString(),
      tags: draft.tags ? draft.tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [],
      thumbnail: thumbSrcForPreview() || null,
      readingMinutes: T.readingMinutes(quill.root.innerHTML),
      buildId: 'preview'
    };
    var html = T.buildPostPage(meta, cleanBody(), CFG, {
      assetsBase: new URL('../assets/', location.href).href,
      siteRoot: new URL('../../', location.href).href,
      blogRoot: new URL('../', location.href).href
    });
    $('#previewFrame').srcdoc = html;
    $('#previewDialog').showModal();
  });

  /* =====================================================
     Misc
     ===================================================== */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.theme-toggle')) return;
    var root = document.documentElement;
    var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    lsSet('theme', next);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
  });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && dirty) saveNow();
  });

  /* ---------- boot ---------- */
  (async function init() {
    var d = null;
    try {
      var id = lsGet(CUR_KEY);
      if (id) d = await DB.get(id);
      if (!d) {
        var all = await DB.all();
        d = all.sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
      }
    } catch (e) {
      setStatus('error', 'Autosave unavailable in this browser');
    }
    loadDraft(d || blankDraft());
    if (!d) titleEl.focus();
  })();
})();
