/*
 * Static page generator for blog posts and the RSS feed.
 * Used by the editor (in the browser) at publish time, so every post is a real
 * HTML file with its own title, description and thumbnail meta tags.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlogTemplate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var FONTS =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(s) {
    var out = String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70)
      .replace(/-+$/, '');
    return out || 'post';
  }

  function textOf(html) {
    return String(html || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readingMinutes(html) {
    var words = textOf(html).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function fmtDate(iso, cfg) {
    try {
      return new Date(iso).toLocaleDateString(cfg.locale || 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: cfg.timeZone || 'UTC'
      });
    } catch (e) {
      return '';
    }
  }

  function jsonLd(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c');
  }

  function isAbsolute(p) {
    return /^(data:|https?:|\/\/)/i.test(p);
  }

  /* Shared header used by the listing page and every post */
  function header(prefix) {
    return (
      '<header class="site-header">' +
      '<div class="wrap header-inner">' +
      '<a class="brand" href="' + prefix.home + '" aria-label="Back to portfolio"><span class="brand-mark">&lt;BN/&gt;</span></a>' +
      '<nav class="nav" aria-label="Primary">' +
      '<a href="' + prefix.home + '">Portfolio</a>' +
      '<a href="' + prefix.blog + '" class="is-active">Blog</a>' +
      '<a class="icon-btn" href="' + prefix.blog + 'feed.xml" aria-label="RSS feed" title="RSS feed">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>' +
      '</a>' +
      '<button class="icon-btn theme-toggle" type="button" aria-label="Toggle light and dark theme" title="Toggle theme"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg></button>' +
      '</nav></div></header>'
    );
  }

  function footer(cfg, prefix) {
    return (
      '<footer class="site-footer"><div class="wrap footer-inner">' +
      '<span>&copy; ' + new Date().getFullYear() + ' ' + esc(cfg.author) + '</span>' +
      '<span class="footer-links"><a href="' + prefix.home + '">Portfolio</a><a href="' + prefix.blog + '">Blog</a><a href="' + prefix.blog + 'feed.xml">RSS</a></span>' +
      '</div></footer>'
    );
  }

  /*
   * post: { slug, title, excerpt, date, updated, tags[], thumbnail, readingMinutes, buildId }
   * opts: { assetsBase, siteRoot, blogRoot }  (defaults suit /blog/posts/<slug>/index.html)
   */
  function buildPostPage(post, bodyHtml, cfg, opts) {
    opts = opts || {};
    var siteRoot = opts.siteRoot || '../../../';
    var blogRoot = opts.blogRoot || '../../';
    var assets = opts.assetsBase || '../../assets/';
    var prefix = { home: siteRoot, blog: blogRoot };

    var postUrl = cfg.siteUrl + '/blog/posts/' + post.slug + '/';
    var thumbRel = post.thumbnail || 'images/blog-cover.jpg';
    var thumbAbs = isAbsolute(thumbRel) ? thumbRel : cfg.siteUrl + '/blog/' + thumbRel;
    var thumbSrc = isAbsolute(thumbRel) ? thumbRel : blogRoot + thumbRel;
    var title = post.title || 'Untitled';
    var excerpt = post.excerpt || '';
    var tags = post.tags || [];
    var minutes = post.readingMinutes || readingMinutes(bodyHtml);
    var published = post.date || new Date().toISOString();
    var modified = post.updated || published;

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: excerpt,
      image: [thumbAbs],
      datePublished: published,
      dateModified: modified,
      mainEntityOfPage: postUrl,
      author: { '@type': 'Person', name: cfg.author, url: cfg.siteUrl + '/' },
      publisher: { '@type': 'Person', name: cfg.author },
      keywords: tags.join(', ')
    };

    var tagMeta = tags
      .map(function (t) {
        return '<meta property="article:tag" content="' + esc(t) + '">';
      })
      .join('\n');

    var tagLinks = tags.length
      ? '<div class="post-tags">' +
        tags
          .map(function (t) {
            return '<a class="tag" href="' + blogRoot + '?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
          })
          .join('') +
        '</div>'
      : '';

    var cover = post.thumbnail
      ? '<figure class="post-cover"><img src="' + esc(thumbSrc) + '" alt="" width="1200" height="630" fetchpriority="high"></figure>'
      : '';

    return (
      '<!doctype html>\n' +
      '<html lang="en" data-blog-root="' + blogRoot + '" data-slug="' + esc(post.slug) + '">\n<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(title) + ' | ' + esc(cfg.blogTitle) + '</title>\n' +
      '<meta name="description" content="' + esc(excerpt) + '">\n' +
      '<meta name="author" content="' + esc(cfg.author) + '">\n' +
      '<meta name="robots" content="index, follow, max-image-preview:large">\n' +
      '<meta name="build-id" content="' + esc(post.buildId || '') + '">\n' +
      '<link rel="canonical" href="' + esc(postUrl) + '">\n' +
      '<link rel="alternate" type="application/rss+xml" title="' + esc(cfg.blogTitle) + '" href="' + blogRoot + 'feed.xml">\n' +
      '<meta property="og:site_name" content="' + esc(cfg.blogTitle + ' | ' + cfg.author) + '">\n' +
      '<meta property="og:type" content="article">\n' +
      '<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(excerpt) + '">\n' +
      '<meta property="og:url" content="' + esc(postUrl) + '">\n' +
      '<meta property="og:image" content="' + esc(thumbAbs) + '">\n' +
      '<meta property="og:image:width" content="1200">\n' +
      '<meta property="og:image:height" content="630">\n' +
      '<meta property="og:image:alt" content="' + esc(title) + '">\n' +
      '<meta property="article:published_time" content="' + esc(published) + '">\n' +
      '<meta property="article:modified_time" content="' + esc(modified) + '">\n' +
      '<meta property="article:author" content="' + esc(cfg.author) + '">\n' +
      tagMeta + '\n' +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<meta name="twitter:title" content="' + esc(title) + '">\n' +
      '<meta name="twitter:description" content="' + esc(excerpt) + '">\n' +
      '<meta name="twitter:image" content="' + esc(thumbAbs) + '">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="' + FONTS + '">\n' +
      '<link rel="stylesheet" href="' + assets + 'blog.css">\n' +
      "<script>(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()</script>\n" +
      '<script type="application/ld+json">' + jsonLd(ld) + '</script>\n' +
      '</head>\n<body class="is-post">\n' +
      '<div class="progress" aria-hidden="true"><span></span></div>\n' +
      header(prefix) + '\n' +
      '<main id="main">\n<article class="post">\n' +
      '<header class="post-header">\n' +
      tagLinks + '\n' +
      '<h1 class="post-title">' + esc(title) + '</h1>\n' +
      (excerpt ? '<p class="post-lede">' + esc(excerpt) + '</p>\n' : '') +
      '<div class="byline">' +
      '<span class="avatar" aria-hidden="true">' + esc(cfg.authorInitials || 'BN') + '</span>' +
      '<div class="byline-text"><strong>' + esc(cfg.author) + '</strong>' +
      '<span class="meta"><time datetime="' + esc(published) + '">' + esc(fmtDate(published, cfg)) + '</time>' +
      '<span class="dot" aria-hidden="true">&middot;</span>' + minutes + ' min read</span></div>' +
      '</div>\n</header>\n' +
      cover + '\n' +
      '<div class="prose" id="content">\n' + bodyHtml + '\n</div>\n' +
      '<footer class="post-footer">\n' +
      '<div class="share" data-share aria-label="Share this post"></div>\n' +
      '<aside class="author-card">' +
      '<span class="avatar avatar-lg" aria-hidden="true">' + esc(cfg.authorInitials || 'BN') + '</span>' +
      '<div><p class="author-name">Written by ' + esc(cfg.author) + '</p>' +
      '<p class="author-bio">' + esc(cfg.authorBio || '') + '</p>' +
      '<a class="link-arrow" href="' + siteRoot + '#contact">Get in touch</a></div>' +
      '</aside>\n</footer>\n</article>\n' +
      '<nav class="wrap post-nav" id="post-nav" aria-label="More posts"></nav>\n' +
      '</main>\n' +
      footer(cfg, prefix) + '\n' +
      '<script src="' + assets + 'blog.js" defer></script>\n' +
      '</body>\n</html>\n'
    );
  }

  function rfcDate(iso) {
    return new Date(iso).toUTCString();
  }

  function buildFeed(posts, cfg) {
    var base = cfg.siteUrl + '/blog/';
    var items = posts
      .map(function (p) {
        var link = base + 'posts/' + p.slug + '/';
        var img = p.thumbnail ? (isAbsolute(p.thumbnail) ? p.thumbnail : base + p.thumbnail) : base + 'images/blog-cover.jpg';
        return (
          '<item>' +
          '<title>' + esc(p.title) + '</title>' +
          '<link>' + esc(link) + '</link>' +
          '<guid isPermaLink="true">' + esc(link) + '</guid>' +
          '<pubDate>' + rfcDate(p.date) + '</pubDate>' +
          '<description>' + esc(p.excerpt || '') + '</description>' +
          (p.tags || []).map(function (t) { return '<category>' + esc(t) + '</category>'; }).join('') +
          '<media:thumbnail url="' + esc(img) + '"/>' +
          '</item>'
        );
      })
      .join('\n');

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n<channel>\n' +
      '<title>' + esc(cfg.blogTitle + ' | ' + cfg.author) + '</title>\n' +
      '<link>' + esc(base) + '</link>\n' +
      '<description>' + esc(cfg.blogTagline) + '</description>\n' +
      '<language>en</language>\n' +
      '<atom:link href="' + esc(base + 'feed.xml') + '" rel="self" type="application/rss+xml"/>\n' +
      (posts[0] ? '<lastBuildDate>' + rfcDate(posts[0].updated || posts[0].date) + '</lastBuildDate>\n' : '') +
      items + '\n</channel>\n</rss>\n'
    );
  }

  return {
    esc: esc,
    slugify: slugify,
    textOf: textOf,
    readingMinutes: readingMinutes,
    fmtDate: fmtDate,
    buildPostPage: buildPostPage,
    buildFeed: buildFeed
  };
});
