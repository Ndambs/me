/* Blog configuration — the only file you normally need to edit. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLOG_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // Where the site is served from (no trailing slash)
    siteUrl: 'https://ndambs.github.io/me',

    // GitHub repository the editor publishes to
    owner: 'Ndambs',
    repo: 'me',
    branch: 'main',

    // Identity shown on posts and in the feed
    author: 'Benson Ndambiri',
    authorInitials: 'BN',
    authorBio: 'DevOps, cloud and cybersecurity engineer based in Nairobi.',
    siteTitle: 'Benson Ndambiri',

    // Blog identity
    blogTitle: 'Build Log',
    blogTagline: 'Notes on DevOps, cloud and cybersecurity: what I build, break and fix along the way.',

    // Used when formatting dates in generated pages
    timeZone: 'Africa/Nairobi',
    locale: 'en-GB'
  };
});
