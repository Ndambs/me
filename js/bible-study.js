/* ============================================================
   BIBLE STUDY — reader application
   Vanilla JS, no dependencies. Reads window.BIBLE_DATA (see
   js/bible-data.js). Persists reading progress + reflections
   to localStorage so progress survives visits.
   ============================================================ */
(function () {
  "use strict";

  var DATA = window.BIBLE_DATA || [];
  var LS_READ = "bibleStudy.read.v1";
  var LS_NOTES_V1 = "bibleStudy.notes.v1";   // legacy: { id: "single string" }
  var LS_NOTES = "bibleStudy.notes.v2";      // current: { id: [{text, ts}, ...] }
  var LS_THEME = "theme";
  var LS_LAST = "bibleStudy.last.v1";

  // ---------- theme ----------
  function initTheme() {
    var saved = localStorage.getItem(LS_THEME);
    var theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeIcon(theme);
  }
  function updateThemeIcon(theme) {
    var btn = document.getElementById("bs-theme-toggle");
    if (btn) btn.textContent = theme === "dark" ? "◐" : "◑";
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem(LS_THEME, cur);
    updateThemeIcon(cur);
  }

  // ---------- storage helpers ----------
  function getRead() {
    try { return JSON.parse(localStorage.getItem(LS_READ) || "{}"); } catch (e) { return {}; }
  }
  function setRead(map) { localStorage.setItem(LS_READ, JSON.stringify(map)); }

  // notes are stored as { dayId: [ {text, ts}, ... ] } — newest entries pushed to the end.
  // one-time migration from the old single-string-per-day format, if present.
  function getAllNotes() {
    var map;
    try { map = JSON.parse(localStorage.getItem(LS_NOTES) || "{}"); } catch (e) { map = {}; }
    var legacyRaw = localStorage.getItem(LS_NOTES_V1);
    if (legacyRaw) {
      try {
        var legacy = JSON.parse(legacyRaw);
        Object.keys(legacy).forEach(function (id) {
          if (legacy[id] && !map[id]) {
            map[id] = [{ text: legacy[id], ts: null }];
          }
        });
      } catch (e) { /* ignore malformed legacy data */ }
      localStorage.removeItem(LS_NOTES_V1);
      localStorage.setItem(LS_NOTES, JSON.stringify(map));
    }
    return map;
  }
  function setAllNotes(map) { localStorage.setItem(LS_NOTES, JSON.stringify(map)); }
  function getNotesFor(id) {
    var map = getAllNotes();
    return Array.isArray(map[id]) ? map[id] : [];
  }
  function addNoteFor(id, text) {
    var map = getAllNotes();
    if (!Array.isArray(map[id])) map[id] = [];
    map[id].push({ text: text, ts: Date.now() });
    setAllNotes(map);
  }
  function deleteNoteFor(id, ts) {
    var map = getAllNotes();
    if (!Array.isArray(map[id])) return;
    map[id] = map[id].filter(function (n) { return n.ts !== ts; });
    setAllNotes(map);
  }
  function formatTimestamp(ts) {
    if (!ts) return "saved previously";
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return new Date(ts).toDateString();
    }
  }

  // ---------- "voice from history" source links ----------
  // Three of the guide's most-quoted voices (Spurgeon, Guzik, Matthew Henry) have
  // complete, real, passage-indexed commentary archives online, so those get a
  // direct deep link to the exact chapter. Everyone else gets an honest web-search
  // fallback rather than a guessed/fabricated URL.
  var AUTHOR_BIBLEHUB = {
    "DAVID GUZIK": "guzik",
    "MATTHEW HENRY": "mhc"
  };
  var BOOK_SLUGS = {
    "Genesis": "genesis", "Exodus": "exodus", "Leviticus": "leviticus", "Numbers": "numbers",
    "Deuteronomy": "deuteronomy", "Joshua": "joshua", "Judges": "judges", "Ruth": "ruth",
    "1 Samuel": "1_samuel", "2 Samuel": "2_samuel", "1 Kings": "1_kings", "2 Kings": "2_kings",
    "1 Chronicles": "1_chronicles", "2 Chronicles": "2_chronicles", "Ezra": "ezra", "Nehemiah": "nehemiah",
    "Esther": "esther", "Job": "job", "Psalms": "psalms", "Proverbs": "proverbs",
    "Ecclesiastes": "ecclesiastes", "Song of Songs": "songs", "Isaiah": "isaiah", "Jeremiah": "jeremiah",
    "Lamentations": "lamentations", "Ezekiel": "ezekiel", "Daniel": "daniel", "Hosea": "hosea",
    "Joel": "joel", "Amos": "amos", "Obadiah": "obadiah", "Jonah": "jonah", "Micah": "micah",
    "Nahum": "nahum", "Habakkuk": "habakkuk", "Zephaniah": "zephaniah", "Haggai": "haggai",
    "Zechariah": "zechariah", "Malachi": "malachi", "Matthew": "matthew", "Mark": "mark",
    "Luke": "luke", "John": "john", "Acts": "acts", "Romans": "romans",
    "1 Corinthians": "1_corinthians", "2 Corinthians": "2_corinthians", "Galatians": "galatians",
    "Ephesians": "ephesians", "Philippians": "philippians", "Colossians": "colossians",
    "1 Thessalonians": "1_thessalonians", "2 Thessalonians": "2_thessalonians",
    "1 Timothy": "1_timothy", "2 Timothy": "2_timothy", "Titus": "titus", "Philemon": "philemon",
    "Hebrews": "hebrews", "James": "james", "1 Peter": "1_peter", "2 Peter": "2_peter",
    "1 John": "1_john", "2 John": "2_john", "3 John": "3_john", "Jude": "jude", "Revelation": "revelation"
  };
  function buildVoiceLink(d) {
    var nameKey = (d.voice_name || "").toUpperCase().trim();
    var chapterMatch = (d.ref || "").match(/(\d+)/);
    var chapter = chapterMatch ? chapterMatch[1] : null;
    var bookSlug = BOOK_SLUGS[d.book];

    // Spurgeon on BibleHub is specifically "The Treasury of David" — his Psalms-only
    // exposition — not a whole-Bible commentary, so it's only a real, correct link
    // when the day's passage is actually in Psalms.
    if (!d.is_review && chapter && bookSlug && nameKey === "CHARLES SPURGEON" && d.book === "Psalms") {
      return { kind: "direct", site: "BibleHub.com", url: "https://biblehub.com/commentaries/tod/psalms/" + chapter + ".htm" };
    }
    var biblehubSlug = AUTHOR_BIBLEHUB[nameKey];
    if (!d.is_review && chapter && bookSlug && biblehubSlug) {
      return {
        kind: "direct",
        site: "BibleHub.com",
        url: "https://biblehub.com/commentaries/" + biblehubSlug + "/" + bookSlug + "/" + chapter + ".htm"
      };
    }
    var q = (d.voice_name || "") + " " + (d.ref || "") + " commentary";
    return { kind: "search", site: "the web", url: "https://www.google.com/search?q=" + encodeURIComponent(q) };
  }

  // ---------- modal ----------
  var modalOverlay = document.getElementById("bs-modal-overlay");
  var modalBody = document.getElementById("bs-modal-body");
  var modalTitle = document.getElementById("bs-modal-title");
  var modalCancel = document.getElementById("bs-modal-cancel");
  var modalConfirm = document.getElementById("bs-modal-confirm");
  var pendingUrl = null;
  var lastFocused = null;

  function openVoiceModal(d) {
    var link = buildVoiceLink(d);
    pendingUrl = link.url;
    var niceName = titleCase(d.voice_name);
    modalTitle.textContent = "Read more from " + niceName + "?";
    if (link.kind === "direct") {
      modalBody.innerHTML = "This opens <b>" + escapeHtml(niceName) + "'s</b> own commentary on <b>" +
        escapeHtml(d.ref || "") + "</b> at " + escapeHtml(link.site) + ", in a new tab.";
    } else {
      modalBody.innerHTML = "This guide only paraphrases " + escapeHtml(niceName) + "'s insight, so we don't have a direct link to the original piece. " +
        "This opens a web search for more of their writing on <b>" + escapeHtml(d.ref || "") + "</b>, in a new tab.";
    }
    lastFocused = document.activeElement;
    modalOverlay.classList.add("show");
    modalOverlay.setAttribute("aria-hidden", "false");
    modalConfirm.focus();
  }
  function closeVoiceModal() {
    modalOverlay.classList.remove("show");
    modalOverlay.setAttribute("aria-hidden", "true");
    pendingUrl = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  modalCancel.addEventListener("click", closeVoiceModal);
  modalOverlay.addEventListener("click", function (e) { if (e.target === modalOverlay) closeVoiceModal(); });
  modalConfirm.addEventListener("click", function () {
    if (pendingUrl) window.open(pendingUrl, "_blank", "noopener,noreferrer");
    closeVoiceModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalOverlay.classList.contains("show")) closeVoiceModal();
  });


  var byId = {};
  var order = []; // flattened OT(1..183) then NT(1..91) in reading order
  DATA.forEach(function (d) { byId[d.id] = d; });
  DATA.filter(function (d) { return d.track === "OT"; }).sort(function (a, b) { return a.day - b.day; }).forEach(function (d) { order.push(d.id); });
  DATA.filter(function (d) { return d.track === "NT"; }).sort(function (a, b) { return a.day - b.day; }).forEach(function (d) { order.push(d.id); });

  function bookGroups(track) {
    var groups = [];
    var map = {};
    DATA.filter(function (d) { return d.track === track; })
      .sort(function (a, b) { return a.day - b.day; })
      .forEach(function (d) {
        if (!map[d.book]) { map[d.book] = []; groups.push(d.book); }
        map[d.book].push(d);
      });
    return groups.map(function (b) { return { book: b, days: map[b] }; });
  }

  var state = {
    track: "OT",
    query: "",
    currentId: null
  };

  // ---------- rendering: sidebar ----------
  var listEl = document.getElementById("bs-daylist");
  var searchEl = document.getElementById("bs-search-input");
  var trackBtns = document.querySelectorAll(".bs-track-btn");

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderSidebar() {
    var q = state.query.trim().toLowerCase();
    var readMap = getRead();
    listEl.innerHTML = "";

    var tracksToShow = state.track === "ALL" ? ["OT", "NT"] : [state.track];
    var anyMatch = false;

    tracksToShow.forEach(function (track) {
      bookGroups(track).forEach(function (group) {
        var filteredDays = group.days.filter(function (d) {
          if (!q) return true;
          var hay = (d.book + " " + d.title + " " + d.ref + " " + d.day).toLowerCase();
          return hay.indexOf(q) !== -1;
        });
        if (!filteredDays.length) return;
        anyMatch = true;

        var groupEl = document.createElement("div");
        groupEl.className = "bs-book-group";
        var isCollapsed = !!q ? false : (group.book !== byId[state.currentId || ""] || false);

        var headerBtn = document.createElement("button");
        headerBtn.className = "bs-book-header";
        headerBtn.innerHTML =
          '<span>' + escapeHtml(group.book) + "</span>" +
          '<span class="count">' + filteredDays.length + "</span>" +
          '<span class="chev">▾</span>';
        headerBtn.addEventListener("click", function () {
          groupEl.classList.toggle("collapsed");
        });

        var daysWrap = document.createElement("div");
        daysWrap.className = "bs-book-days";

        filteredDays.forEach(function (d) {
          var row = document.createElement("button");
          row.className = "bs-day-row" + (d.id === state.currentId ? " active" : "") + (readMap[d.id] ? " read" : "");
          row.setAttribute("data-id", d.id);
          row.innerHTML =
            '<span class="chk">' + (readMap[d.id] ? "✓" : "") + "</span>" +
            '<span class="rowtitle">' + escapeHtml(d.title || d.ref) + "</span>" +
            '<span class="rownum">' + d.track + " " + d.day + "</span>";
          row.addEventListener("click", function () { navigateTo(d.id); closeSidebarMobile(); });
          daysWrap.appendChild(row);
        });

        groupEl.appendChild(headerBtn);
        groupEl.appendChild(daysWrap);
        // collapse groups that aren't the active one, when not searching, to keep list scannable
        if (!q && group.days.every(function (d) { return d.id !== state.currentId; }) && group.book !== "__forceopen__") {
          // leave open by default the first time; user can collapse manually.
        }
        listEl.appendChild(groupEl);
      });
    });

    if (!anyMatch) {
      var empty = document.createElement("div");
      empty.className = "bs-empty-search";
      empty.textContent = "No days match “" + state.query + "”.";
      listEl.appendChild(empty);
    }
  }

  function updateProgressUI() {
    var readMap = getRead();
    var total = DATA.length;
    var readCount = Object.keys(readMap).filter(function (k) { return byId[k] && readMap[k]; }).length;
    var pct = total ? Math.round((readCount / total) * 100) : 0;

    var fill = document.getElementById("bs-progress-fill");
    if (fill) fill.style.width = pct + "%";

    var ptxt = document.getElementById("bs-progress-text");
    if (ptxt) ptxt.innerHTML = "<b>" + readCount + " / " + total + "</b><br>days completed";

    var ring = document.getElementById("bs-ring-fg");
    if (ring) {
      var circumference = 2 * Math.PI * 16;
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = circumference - (circumference * pct) / 100;
    }
  }

  // ---------- rendering: reader ----------
  var readerEl = document.getElementById("bs-reader");

  function splitCentralTruth(txt) {
    if (!txt) return { main: "", extra: "" };
    var idx = txt.indexOf("✦");
    if (idx === -1) return { main: txt, extra: "" };
    return { main: txt.slice(0, idx).trim(), extra: txt.slice(idx + 1).trim() };
  }

  function renderWelcome() {
    readerEl.innerHTML =
      '<div class="bs-welcome">' +
        '<div class="bs-ref-badge">299 pages · 274 days · Genesis to Revelation</div>' +
        '<h1>The Whole Bible, one sermonette at a time.</h1>' +
        '<p>Every day stands complete on its own: the passage in context, a woven exposition, the ' +
        "central truth named plainly, a voice from church history, honest application, and a closing " +
        "prayer. Pick up where you left off, or start at Genesis&nbsp;1.</p>" +
        '<div class="bs-welcome-actions">' +
          '<button class="bs-icon-btn" style="width:auto;border-radius:10px;padding:12px 22px;color:var(--bs-text)" id="bs-start-ot">Start the Old Testament</button>' +
          '<button class="bs-icon-btn" style="width:auto;border-radius:10px;padding:12px 22px;color:var(--bs-text)" id="bs-start-nt">Start the New Testament</button>' +
        "</div>" +
      "</div>";
    var last = localStorage.getItem(LS_LAST);
    if (last && byId[last]) {
      var cont = document.createElement("div");
      cont.style.textAlign = "center";
      cont.style.marginTop = "18px";
      cont.innerHTML = '<button class="bs-icon-btn" style="width:auto;border-radius:10px;padding:10px 20px;color:var(--bs-accent);border-color:var(--bs-accent)" id="bs-continue-2">Continue from ' + escapeHtml(byId[last].title || byId[last].ref) + " →</button>";
      readerEl.appendChild(cont);
      document.getElementById("bs-continue-2").addEventListener("click", function () { navigateTo(last); });
    }
    document.getElementById("bs-start-ot").addEventListener("click", function () { navigateTo("ot-1"); });
    document.getElementById("bs-start-nt").addEventListener("click", function () { navigateTo("nt-1"); });
  }

  function renderDay(id) {
    var d = byId[id];
    if (!d) { renderWelcome(); return; }
    state.currentId = id;
    localStorage.setItem(LS_LAST, id);

    var idx = order.indexOf(id);
    var prevId = idx > 0 ? order[idx - 1] : null;
    var nextId = idx < order.length - 1 ? order[idx + 1] : null;
    var trackLabel = d.track === "OT" ? "Old Testament" : "New Testament";
    var trackTotal = d.track === "OT" ? 183 : 91;

    var truth = splitCentralTruth(d.central_truth);
    var readMap = getRead();
    var isRead = !!readMap[id];

    var passageHtml = (d.passage || []).map(function (p) {
      var parts = [];
      parts.push('<div class="bs-passage-item">');
      parts.push('<div class="pref">' + escapeHtml(p.ref || "") + "</div>");
      parts.push("<p>" + escapeHtml(p.text || "") + "</p>");
      parts.push("</div>");
      return parts.join("");
    }).join("");

    var openerHtml = "";
    if (d.lead) {
      openerHtml = '<p class="bs-lead">' + escapeHtml(capitalize(d.lead)) + ".</p>";
    } else if (d.opener) {
      openerHtml = '<p class="bs-lead">' + escapeHtml(d.opener) + "</p>";
    }

    var truthHtml = "";
    if (truth.main) {
      truthHtml = '<div class="bs-truth-card"><p>' + escapeHtml(truth.main) + ".</p>";
      if (truth.extra) truthHtml += '<p class="extra">' + escapeHtml(truth.extra) + "</p>";
      truthHtml += "</div>";
    }

    var voiceHtml = "";
    if (d.voice_text) {
      voiceHtml = '<div class="bs-voice-card" id="bs-voice-card" role="button" tabindex="0" aria-label="Open a link to read more from this voice from church history">' +
        '<span class="quote-mark">&ldquo;</span><p>' +
        escapeHtml(d.voice_text) + '</p><div class="attrib">' + "\u2014 " + escapeHtml(titleCase(d.voice_name)) + "</div>" +
        '<div class="ve-hint">Read more \u2197</div></div>';
    }

    var livingHtml = "";
    if (d.living_it_out) {
      livingHtml = '<div class="bs-living-card"><p>' + escapeHtml(d.living_it_out) + "</p>" +
        '<textarea class="bs-reflect-textarea" id="bs-reflect" placeholder="Write your own answer here\u2026"></textarea>' +
        '<div class="bs-reflect-row">' +
        '<span class="bs-reflect-note">Saved on this device only \u2014 write a new answer any time you revisit this day.</span>' +
        '<button class="bs-save-note-btn" id="bs-save-note" disabled>Save this answer</button>' +
        "</div>" +
        '<div class="bs-note-history" id="bs-note-history"></div>' +
        "</div>";
    }

    var prayerHtml = d.prayer ? ('<div class="bs-prayer-card"><p>' + escapeHtml(d.prayer) + "</p></div>") : "";

    var prevHtml = prevId
      ? ('<a href="#' + prevId + '" class="prev" data-nav="' + prevId + '"><span class="pn-label">\u2190 Previous</span><span class="pn-title">' + escapeHtml(byId[prevId].title || byId[prevId].ref) + "</span></a>")
      : '<span class="disabled" style="flex:1"></span>';
    var nextHtml = nextId
      ? ('<a href="#' + nextId + '" class="next" data-nav="' + nextId + '"><span class="pn-label">Next \u2192</span><span class="pn-title">' + escapeHtml(byId[nextId].title || byId[nextId].ref) + "</span></a>")
      : '<span class="disabled" style="flex:1"></span>';

    var html = [];
    html.push('<div class="bs-crumb"><span>' + trackLabel + '</span> <span>\u203a</span> <b>' + escapeHtml(d.book) + '</b> <span>\u203a</span> <span>Day ' + d.day + " of " + trackTotal + "</span></div>");
    html.push('<div class="bs-reader-head">');
    html.push('<div class="bs-ref-badge">' + escapeHtml(d.ref || "") + "</div>");
    html.push("<h1>" + escapeHtml(d.title || "") + "</h1>");
    html.push(openerHtml);
    html.push("</div>");
    if (d.setting_scene) html.push(sectionHtml("Setting the scene", "scene", '<div class="bs-scene-block"><p>' + escapeHtml(d.setting_scene) + "</p></div>"));
    if (passageHtml) html.push(sectionHtml("The passage, opened up", "passage", '<div class="bs-passage-list">' + passageHtml + "</div>"));
    if (truthHtml) html.push(sectionHtml("The central truth", "truth", truthHtml));
    if (voiceHtml) html.push(sectionHtml("A voice from church history", "voice", voiceHtml));
    if (livingHtml) html.push(sectionHtml("Living it out", "living", livingHtml));
    if (prayerHtml) html.push(sectionHtml("A prayer for today", "prayer", prayerHtml));
    html.push('<button class="bs-mark-done' + (isRead ? " done" : "") + '" id="bs-mark-done">' + (isRead ? "\u2713 Marked as read" : "Mark today\u2019s study as read") + "</button>");
    html.push('<div class="bs-pagenav">' + prevHtml + nextHtml + "</div>");
    html.push('<div class="bs-kbd-hint"><span><kbd>\u2190</kbd> <kbd>\u2192</kbd> navigate</span><span><kbd>/</kbd> search</span><span><kbd>M</kbd> mark read</span></div>');

    readerEl.innerHTML = html.join("");

    readerEl.querySelectorAll("[data-nav]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); navigateTo(a.getAttribute("data-nav")); });
    });

    var voiceCardEl = document.getElementById("bs-voice-card");
    if (voiceCardEl) {
      voiceCardEl.addEventListener("click", function () { openVoiceModal(d); });
      voiceCardEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVoiceModal(d); }
      });
    }

    var markBtn = document.getElementById("bs-mark-done");
    markBtn.addEventListener("click", function () {
      var map = getRead();
      if (map[id]) { delete map[id]; } else { map[id] = true; }
      setRead(map);
      updateProgressUI();
      renderSidebar();
      var stillRead = !!getRead()[id];
      markBtn.classList.toggle("done", stillRead);
      markBtn.textContent = stillRead ? "✓ Marked as read" : "Mark today's study as read";
    });
    var reflectEl = document.getElementById("bs-reflect");
    var saveBtn = document.getElementById("bs-save-note");
    var historyEl = document.getElementById("bs-note-history");

    function renderHistory() {
      if (!historyEl) return;
      var entries = getNotesFor(id).slice().reverse(); // newest first
      if (!entries.length) {
        historyEl.innerHTML = '<div class="bs-note-empty">No saved answers yet for this day.</div>';
        return;
      }
      historyEl.innerHTML = entries.map(function (n) {
        return '<div class="bs-note-entry" data-ts="' + n.ts + '">' +
          '<div class="ne-head"><span class="ne-ts">' + escapeHtml(formatTimestamp(n.ts)) + '</span>' +
          '<button class="ne-del" data-del-ts="' + n.ts + '">Delete</button></div>' +
          '<p class="ne-text">' + escapeHtml(n.text) + "</p>" +
          "</div>";
      }).join("");
      historyEl.querySelectorAll("[data-del-ts]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          deleteNoteFor(id, Number(btn.getAttribute("data-del-ts")));
          renderHistory();
        });
      });
    }

    if (reflectEl && saveBtn) {
      renderHistory();
      reflectEl.addEventListener("input", function () {
        saveBtn.disabled = reflectEl.value.trim().length === 0;
      });
      saveBtn.addEventListener("click", function () {
        var val = reflectEl.value.trim();
        if (!val) return;
        addNoteFor(id, val);
        reflectEl.value = "";
        saveBtn.disabled = true;
        saveBtn.classList.add("saved");
        saveBtn.textContent = "Saved \u2713";
        setTimeout(function () {
          saveBtn.classList.remove("saved");
          saveBtn.textContent = "Save this answer";
        }, 1400);
        renderHistory();
      });
    }

    highlightSidebarRow(id);
    readerEl.scrollTop = 0;
    var scrollParent = document.getElementById("bs-reader-scroll");
    if (scrollParent) scrollParent.scrollTop = 0;
  }

  function sectionHtml(label, kind, inner) {
    return '<div class="bs-section" data-kind="' + kind + '"><div class="bs-section-label"><span class="dot"></span>' + escapeHtml(label) + "</div>" + inner + "</div>";
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function titleCase(s) {
    if (!s) return "";
    return s.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function highlightSidebarRow(id) {
    document.querySelectorAll(".bs-day-row").forEach(function (r) {
      r.classList.toggle("active", r.getAttribute("data-id") === id);
    });
  }

  function navigateTo(id) {
    if (!byId[id]) return;
    history.replaceState(null, "", "#" + id);
    renderDay(id);
  }

  // ---------- sidebar drawer (mobile) ----------
  var sidebarEl = document.getElementById("bs-sidebar");
  var scrimEl = document.getElementById("bs-scrim");
  function openSidebarMobile() { sidebarEl.classList.add("open"); scrimEl.classList.add("show"); }
  function closeSidebarMobile() { sidebarEl.classList.remove("open"); scrimEl.classList.remove("show"); }

  var drawerToggle = document.getElementById("bs-drawer-toggle");
  if (drawerToggle) drawerToggle.addEventListener("click", openSidebarMobile);
  if (scrimEl) scrimEl.addEventListener("click", closeSidebarMobile);

  // ---------- wire up controls ----------
  trackBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      trackBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.track = btn.getAttribute("data-track");
      renderSidebar();
    });
  });
  if (searchEl) {
    searchEl.addEventListener("input", function () {
      state.query = searchEl.value;
      renderSidebar();
    });
  }
  var themeBtn = document.getElementById("bs-theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  var continueBtn = document.getElementById("bs-continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", function () {
      var last = localStorage.getItem(LS_LAST);
      if (last && byId[last]) navigateTo(last);
    });
  }

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (e.key === "/") { e.preventDefault(); if (searchEl) searchEl.focus(); if (window.innerWidth <= 920) openSidebarMobile(); }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      var idx = order.indexOf(state.currentId);
      if (idx === -1) return;
      if (e.key === "ArrowRight" && idx < order.length - 1) navigateTo(order[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) navigateTo(order[idx - 1]);
    }
    if (e.key === "m" || e.key === "M") {
      var mb = document.getElementById("bs-mark-done");
      if (mb) mb.click();
    }
    if (e.key === "Escape") closeSidebarMobile();
  });

  // ---------- Resources Library (66-book catalogue) ----------
  var BOOKS = window.BIBLE_BOOKS || [];
  function renderResourcesLibrary() {
    var otList = document.querySelector('.bs-res-book-list[data-testament="OT"]');
    var ntList = document.querySelector('.bs-res-book-list[data-testament="NT"]');
    if (!otList || !ntList) return;

    function bookRowHtml(b) {
      var chapters = [];
      for (var c = 1; c <= b.chapters; c++) {
        chapters.push('<a class="bs-res-chap-link" href="https://biblehub.com/' + b.slug + '/' + c + '.htm" target="_blank" rel="noopener noreferrer">' + c + '</a>');
      }
      var readUrl = "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(b.name + " 1") + "&version=NLT";
      var overviewUrl = "https://www.gotquestions.org/" + b.gq + ".html";
      return (
        '<div class="bs-res-book">' +
          '<button class="bs-res-book-head" data-toggle="1">' +
            '<span class="bname">' + escapeHtml(b.name) + '</span>' +
            '<span class="bcount">' + b.chapters + (b.chapters === 1 ? " chapter" : " chapters") + '</span>' +
            '<a class="boverview" href="' + readUrl + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Read ↗</a>' +
            '<a class="boverview" href="' + overviewUrl + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Overview ↗</a>' +
            '<span class="bchev">▾</span>' +
          '</button>' +
          '<div class="bs-res-chapters">' + chapters.join("") + '</div>' +
        '</div>'
      );
    }

    otList.innerHTML = BOOKS.filter(function (b) { return b.testament === "OT"; }).map(bookRowHtml).join("");
    ntList.innerHTML = BOOKS.filter(function (b) { return b.testament === "NT"; }).map(bookRowHtml).join("");

    document.querySelectorAll(".bs-res-book-head").forEach(function (head) {
      head.addEventListener("click", function () {
        head.closest(".bs-res-book").classList.toggle("open");
      });
    });

    var searchEl = document.getElementById("bs-res-search");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        var q = searchEl.value.trim().toLowerCase();
        var anyOt = false, anyNt = false;
        document.querySelectorAll(".bs-res-book").forEach(function (row) {
          var name = row.querySelector(".bname").textContent.toLowerCase();
          var match = !q || name.indexOf(q) !== -1;
          row.style.display = match ? "" : "none";
          if (match) row.classList.toggle("open", !!q);
          var list = row.closest(".bs-res-book-list");
          if (match && list) { if (list.getAttribute("data-testament") === "OT") anyOt = true; else anyNt = true; }
        });
        document.getElementById("bs-res-ot").style.display = anyOt || !q ? "" : "none";
        document.getElementById("bs-res-nt").style.display = anyNt || !q ? "" : "none";
      });
    }
  }


  initTheme();
  renderSidebar();
  updateProgressUI();
  renderResourcesLibrary();

  var initialId = (location.hash || "").replace("#", "");
  if (initialId && byId[initialId]) {
    renderDay(initialId);
  } else {
    var last = localStorage.getItem(LS_LAST);
    renderWelcome();
  }

  window.addEventListener("hashchange", function () {
    var id = (location.hash || "").replace("#", "");
    if (id && byId[id]) renderDay(id);
  });
})();
