/* ================================================================
   BENSON NDAMBIRI — PORTFOLIO
   main.js — Interactions, animations, canvas, typewriter, theme
================================================================ */

"use strict";

/* ── DOM READY ─────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNav();
  initTypewriter();
  initCanvas();
  initScrollReveal();
  initSkillBars();
  initFooterYear();
});

/* ─────────────────────────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────────────────────────── */
function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const html   = document.documentElement;
  const KEY    = "portfolio-theme";

  // Load saved preference or detect OS
  const saved = localStorage.getItem(KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");

  html.setAttribute("data-theme", theme);
  updateToggleIcon(theme);

  toggle.addEventListener("click", () => {
    const current = html.getAttribute("data-theme");
    const next    = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
    updateToggleIcon(next);
  });

  function updateToggleIcon(t) {
    toggle.querySelector(".theme-icon").textContent = t === "dark" ? "☀" : "◐";
    toggle.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

/* ─────────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────────── */
function initNav() {
  const navbar   = document.getElementById("navbar");
  const hamburger= document.getElementById("nav-hamburger");
  const mobileMenu = document.getElementById("nav-mobile");
  const mobileLinks = document.querySelectorAll(".mobile-link");
  const navLinks  = document.querySelectorAll(".nav-links a");
  const sections  = document.querySelectorAll("section[id]");

  // Scrolled state
  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
    highlightActiveLink();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Hamburger
  hamburger.addEventListener("click", () => {
    const isOpen = hamburger.classList.toggle("open");
    mobileMenu.classList.toggle("open", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  });

  // Close mobile menu on link click
  mobileLinks.forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("open");
      mobileMenu.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  // Active link on scroll
  function highlightActiveLink() {
    const scrollPos = window.scrollY + window.innerHeight * 0.3;
    sections.forEach(section => {
      const top    = section.offsetTop;
      const height = section.offsetHeight;
      const id     = section.getAttribute("id");
      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(a => {
          a.classList.toggle("active", a.getAttribute("href") === `#${id}`);
        });
      }
    });
  }

  // Smooth-scroll for all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", e => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────────
   TYPEWRITER EFFECT
───────────────────────────────────────────────────────────────── */
function initTypewriter() {
  const el = document.getElementById("rotating-text");
  if (!el) return;

  const phrases = [
    "resilient pipelines.",
    "secure cloud systems.",
    "scalable infrastructure.",
    "AI-driven solutions.",
    "DevOps workflows.",
    "impactful software.",
  ];

  let phraseIndex = 0;
  let charIndex   = 0;
  let isDeleting  = false;
  let isPaused    = false;

  const TYPING_SPEED   = 68;
  const DELETING_SPEED = 36;
  const PAUSE_AFTER    = 2200;
  const PAUSE_BEFORE   = 480;

  function type() {
    if (isPaused) return;

    const current = phrases[phraseIndex];

    if (!isDeleting) {
      el.textContent = current.slice(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) {
        isPaused = true;
        setTimeout(() => { isDeleting = true; isPaused = false; }, PAUSE_AFTER);
        return;
      }
      setTimeout(type, TYPING_SPEED);
    } else {
      el.textContent = current.slice(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(type, PAUSE_BEFORE);
        return;
      }
      setTimeout(type, DELETING_SPEED);
    }
  }

  setTimeout(type, 900);
}

/* ─────────────────────────────────────────────────────────────────
   CANVAS — NETWORK / PARTICLE BACKGROUND
───────────────────────────────────────────────────────────────── */
function initCanvas() {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W, H, particles, animFrame;

  const MAX_PARTICLES = 60;
  const CONNECT_DIST  = 140;
  const MOUSE_RADIUS  = 180;

  let mouse = { x: -9999, y: -9999 };

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function getAccent() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    return isDark ? "79, 158, 255" : "37, 99, 235";
  }

  class Particle {
    constructor() { this.reset(true); }

    reset(init = false) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : -10;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = Math.random() * 0.4 + 0.1;
      this.r  = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.5 + 0.3;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
        this.x += dx / dist * force * 1.8;
        this.y += dy / dist * force * 1.8;
      }

      if (this.y > H + 10 || this.x < -20 || this.x > W + 20) {
        this.reset(false);
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${getAccent()}, ${this.opacity})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = Array.from({ length: MAX_PARTICLES }, () => new Particle());
  }

  function drawConnections() {
    const accent = getAccent();
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.22;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${accent}, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    animFrame = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", () => {
    cancelAnimationFrame(animFrame);
    init();
    animate();
  });

  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Handle touch
  canvas.addEventListener("touchmove", e => {
    const rect  = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouse.x = touch.clientX - rect.left;
    mouse.y = touch.clientY - rect.top;
  }, { passive: true });

  // Pause animation when tab is hidden (performance)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      animate();
    }
  });

  init();
  animate();
}

/* ─────────────────────────────────────────────────────────────────
   SCROLL REVEAL
───────────────────────────────────────────────────────────────── */
function initScrollReveal() {
  // Apply classes to elements that should animate in
  const targets = [
    ".section-label",
    ".section-heading",
    ".section-sub",
    ".about-para",
    ".about-langs",
    ".skill-card",
    ".timeline-item",
    ".project-card",
    ".cert-card",
    ".vol-card",
    ".contact-link",
    ".contact-cta",
    ".pipeline-strip",
    ".about-terminal",
  ];

  targets.forEach((sel, sIdx) => {
    document.querySelectorAll(sel).forEach((el, elIdx) => {
      el.classList.add("js-reveal");
      const delayClass = `js-reveal-delay-${(elIdx % 3) + 1}`;
      if (elIdx > 0) el.classList.add(delayClass);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".js-reveal").forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────────────────────────────
   ANIMATED SKILL BARS
───────────────────────────────────────────────────────────────── */
function initSkillBars() {
  const bars = document.querySelectorAll(".skill-fill");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar   = entry.target;
          const width = bar.getAttribute("data-width");
          // Small delay for stagger effect
          setTimeout(() => {
            bar.style.width = width + "%";
          }, 200);
          observer.unobserve(bar);
        }
      });
    },
    { threshold: 0.3 }
  );

  bars.forEach(bar => observer.observe(bar));
}

/* ─────────────────────────────────────────────────────────────────
   FOOTER YEAR
───────────────────────────────────────────────────────────────── */
function initFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

/* ─────────────────────────────────────────────────────────────────
   COUNTER ANIMATION (optional — for stat numbers)
───────────────────────────────────────────────────────────────── */
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const from  = 0;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
