/* Blog front-end behaviour: theme, progress bar, listing, share, lightbox. No dependencies. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var blogRoot = root.getAttribute('data-blog-root') || './';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Theme ---------- */
  doc.addEventListener('click', function (e) {
    if (!e.target.closest('.theme-toggle')) return;
    var cur =
      root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (err) {}
  });

  /* ---------- Data ---------- */
  var postsPromise;
  function loadPosts() {
    if (!postsPromise) {
      var v = Math.floor(Date.now() / 60000);
      postsPromise = fetch(blogRoot + 'posts.json?v=' + v)
        .then(function (r) {
          if (!r.ok) throw new Error('posts.json ' + r.status);
          return r.json();
        })
        .then(function (d) {
          return (d && d.posts) || [];
        });
    }
    return postsPromise;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Nairobi'
      });
    } catch (e) {
      return '';
    }
  }
  function postUrl(p) {
    return blogRoot + 'posts/' + p.slug + '/';
  }
  function thumbUrl(p) {
    return blogRoot + (p.thumbnail || 'images/blog-cover.jpg');
  }
  function metaHtml(p) {
    return (
      '<div class="meta"><time datetime="' + esc(p.date) + '">' + esc(fmtDate(p.date)) + '</time>' +
      '<span class="dot" aria-hidden="true">&middot;</span><span>' + (p.readingMinutes || 1) + ' min read</span></div>'
    );
  }
  function tagsHtml(p, limit) {
    var t = (p.tags || []).slice(0, limit || 3);
    if (!t.length) return '';
    return '<div class="tags">' + t.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join('') + '</div>';
  }
  function cardHtml(p) {
    return (
      '<a class="card" href="' + postUrl(p) + '">' +
      '<div class="thumb"><img src="' + esc(thumbUrl(p)) + '" alt="" width="1200" height="630" loading="lazy" decoding="async"></div>' +
      '<div class="card-body">' + tagsHtml(p, 2) +
      '<h3>' + esc(p.title) + '</h3>' +
      (p.excerpt ? '<p class="excerpt">' + esc(p.excerpt) + '</p>' : '') +
      metaHtml(p) + '</div></a>'
    );
  }
  function featuredHtml(p) {
    return (
      '<a class="featured" href="' + postUrl(p) + '">' +
      '<div class="thumb"><img src="' + esc(thumbUrl(p)) + '" alt="" width="1200" height="630" fetchpriority="high"></div>' +
      '<div><span class="badge">Latest</span>' +
      '<h2>' + esc(p.title) + '</h2>' +
      (p.excerpt ? '<p class="excerpt">' + esc(p.excerpt) + '</p>' : '') +
      metaHtml(p) +
      '<p style="margin:18px 0 0"><span class="link-arrow">Read the post</span></p></div></a>'
    );
  }

  /* ---------- Listing page ---------- */
  function initListing(mount) {
    var state = { q: '', tag: new URLSearchParams(location.search).get('tag') || '' };
    var posts = [];

    mount.innerHTML =
      '<div class="grid" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';

    function render() {
      var tags = {};
      posts.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
      var tagNames = Object.keys(tags).sort();

      var q = state.q.trim().toLowerCase();
      var list = posts.filter(function (p) {
        if (state.tag && (p.tags || []).indexOf(state.tag) === -1) return false;
        if (!q) return true;
        return (p.title + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q) !== -1;
      });

      var showFeatured = !q && !state.tag && list.length > 0;
      var featured = showFeatured ? list[0] : null;
      var rest = showFeatured ? list.slice(1) : list;

      var html = '';
      if (posts.length) {
        html +=
          '<div class="toolbar-row">' +
          '<label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input type="search" id="q" placeholder="Search posts" aria-label="Search posts" value="' + esc(state.q) + '"></label>' +
          (tagNames.length
            ? '<div class="chips" role="group" aria-label="Filter by topic">' +
              '<button class="chip" type="button" data-tag="" aria-pressed="' + (!state.tag) + '">All</button>' +
              tagNames.map(function (t) {
                return '<button class="chip" type="button" data-tag="' + esc(t) + '" aria-pressed="' + (state.tag === t) + '">' + esc(t) + '</button>';
              }).join('') + '</div>'
            : '') +
          '</div>';
      }

      if (!posts.length) {
        html += '<div class="empty"><strong>No posts yet</strong>The first one is on its way.</div>';
      } else if (!list.length) {
        html += '<div class="empty"><strong>Nothing matches</strong>Try a different search or topic.</div>';
      } else {
        if (featured) html += featuredHtml(featured);
        if (rest.length) html += '<div class="grid">' + rest.map(cardHtml).join('') + '</div>';
        else html += '<div style="height:64px"></div>';
      }

      var hadFocus = doc.activeElement && doc.activeElement.id === 'q';
      var caret = hadFocus ? doc.activeElement.selectionStart : 0;
      mount.innerHTML = html;
      if (hadFocus) {
        var input = mount.querySelector('#q');
        input.focus();
        try { input.setSelectionRange(caret, caret); } catch (e) {}
      }
    }

    mount.addEventListener('input', function (e) {
      if (e.target.id === 'q') {
        state.q = e.target.value;
        render();
      }
    });
    mount.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.tag = chip.getAttribute('data-tag') || '';
      var url = new URL(location.href);
      if (state.tag) url.searchParams.set('tag', state.tag);
      else url.searchParams.delete('tag');
      history.replaceState(null, '', url);
      render();
    });

    loadPosts()
      .then(function (p) { posts = p; render(); })
      .catch(function () {
        mount.innerHTML = '<div class="empty"><strong>Couldn’t load posts</strong>Please refresh the page.</div>';
      });
  }

  /* ---------- Post page enhancements ---------- */
  function initPost() {
    var bar = doc.querySelector('.progress span');
    var content = doc.getElementById('content');

    if (bar && content) {
      var ticking = false;
      var update = function () {
        var rect = content.getBoundingClientRect();
        var total = rect.height - window.innerHeight * 0.6;
        var done = Math.min(Math.max(-rect.top + window.innerHeight * 0.2, 0), Math.max(total, 1));
        bar.parentNode.style.setProperty('--p', Math.min(1, done / Math.max(total, 1)).toFixed(4));
        bar.style.setProperty('--p', Math.min(1, done / Math.max(total, 1)).toFixed(4));
        ticking = false;
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      window.addEventListener('resize', update);
      update();
    }

    if (content) {
      // External links open in a new tab
      content.querySelectorAll('a[href]').forEach(function (a) {
        try {
          var u = new URL(a.href, location.href);
          if (u.origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        } catch (e) {}
      });

      // Copy buttons for code blocks
      content.querySelectorAll('pre').forEach(function (pre) {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', function () {
          var text = pre.innerText.replace(/\nCopy$/, '');
          (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
            function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); },
            function () { btn.textContent = 'Press Ctrl+C'; }
          );
        });
        pre.appendChild(btn);
      });

      // Image lightbox
      content.addEventListener('click', function (e) {
        var img = e.target.closest('img');
        if (!img) return;
        var box = doc.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Image preview');
        var big = doc.createElement('img');
        big.src = img.currentSrc || img.src;
        big.alt = img.alt || '';
        box.appendChild(big);
        var close = function () { box.remove(); doc.removeEventListener('keydown', onKey); };
        var onKey = function (ev) { if (ev.key === 'Escape') close(); };
        box.addEventListener('click', close);
        doc.addEventListener('keydown', onKey);
        doc.body.appendChild(box);
      });
    }

    // Share buttons
    var share = doc.querySelector('[data-share]');
    if (share) {
      var canon = (doc.querySelector('link[rel=canonical]') || {}).href || location.href;
      var title = doc.title.split(' | ')[0];
      var u = encodeURIComponent(canon);
      var t = encodeURIComponent(title);
      share.innerHTML =
        '<span class="label">Share</span>' +
        '<button type="button" data-copy>Copy link</button>' +
        '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + u + '" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
        '<a href="https://twitter.com/intent/tweet?text=' + t + '&url=' + u + '" target="_blank" rel="noopener noreferrer">X</a>' +
        '<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
      share.querySelector('[data-copy]').addEventListener('click', function (e) {
        var b = e.currentTarget;
        (navigator.clipboard ? navigator.clipboard.writeText(canon) : Promise.reject()).then(
          function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1800); },
          function () { window.prompt('Copy this link', canon); }
        );
      });
    }

    // More posts
    var nav = doc.getElementById('post-nav');
    var slug = root.getAttribute('data-slug');
    if (nav && slug) {
      loadPosts().then(function (posts) {
        var cur = posts.filter(function (p) { return p.slug === slug; })[0];
        var curTags = (cur && cur.tags) || [];
        var others = posts.filter(function (p) { return p.slug !== slug; });
        if (!others.length) return;
        others.sort(function (a, b) {
          var sa = (a.tags || []).filter(function (x) { return curTags.indexOf(x) > -1; }).length;
          var sb = (b.tags || []).filter(function (x) { return curTags.indexOf(x) > -1; }).length;
          return sb - sa || new Date(b.date) - new Date(a.date);
        });
        nav.innerHTML =
          '<h2>Keep reading</h2><div class="grid">' + others.slice(0, 3).map(cardHtml).join('') + '</div>' +
          '<p style="margin:28px 0 0"><a class="link-arrow" href="' + blogRoot + '">All posts</a></p>';
      }).catch(function () {});
    }
  }

  /* ---------- Boot ---------- */
  var listing = doc.getElementById('posts-root');
  if (listing) initListing(listing);
  if (doc.body.classList.contains('is-post')) initPost();
})();
