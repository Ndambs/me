# Benson Ndambiri — Personal Portfolio

A premium, production-ready personal portfolio website built for a DevOps / Cloud / Cybersecurity professional. Designed for GitHub Pages hosting.

---

## 📁 Folder Structure

```
benson-ndambiri-portfolio/
│
├── index.html              ← Main HTML (entry point for GitHub Pages)
├── README.md               ← This file
│
├── css/
│   └── style.css           ← All styles, themes, responsive design
│
├── js/
│   └── main.js             ← Typewriter, canvas, scroll reveal, theme toggle
│
└── assets/
    └── Benson_Ndambiri_CV.pdf  ← Place your CV here (required for download button)
```

---

## 🚀 Deploying to GitHub Pages

### Step 1 — Create your GitHub repository

1. Go to [github.com](https://github.com) and log in.
2. Click **New repository**.
3. Name it exactly: `bensonndambiri.github.io`  
   *(Replace `bensonndambiri` with your actual GitHub username)*
4. Set it to **Public**.
5. Click **Create repository**.

### Step 2 — Upload the files

**Option A — GitHub web interface (no Git required):**
1. Open your new repository.
2. Click **Add file → Upload files**.
3. Drag and drop all files **maintaining the folder structure** (index.html at root, css/, js/, assets/).
4. Click **Commit changes**.

**Option B — Git command line:**
```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/YOUR_USERNAME.github.io
cd YOUR_USERNAME.github.io

# Copy all portfolio files into this folder
# Then:
git add .
git commit -m "🚀 Initial portfolio deployment"
git push origin main
```

### Step 3 — Enable GitHub Pages

1. In your repository, go to **Settings → Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Select branch: `main`, folder: `/ (root)`.
4. Click **Save**.

### Step 4 — Access your site

Your portfolio will be live in ~60 seconds at:
```
https://YOUR_USERNAME.github.io
```

---

## 🛠 Customization Guide

### Update your details

| What to update | Where |
|---|---|
| Email address | `index.html` → contact section |
| GitHub URL | `index.html` → contact link `href` |
| LinkedIn URL | `index.html` → contact link `href` |
| Profile photo | Replace `avatar-placeholder` div with `<img src="assets/photo.jpg" alt="Benson Ndambiri">` |
| CV / Resume | Replace `assets/Benson_Ndambiri_CV.pdf` |

### Add your profile photo

1. Save your photo as `assets/photo.jpg` (square crop recommended, min 400×400px).
2. In `index.html`, find the `avatar-placeholder` div:
   ```html
   <div class="avatar-placeholder" aria-label="Profile photo placeholder">BN</div>
   ```
3. Replace it with:
   ```html
   <img src="assets/photo.jpg" alt="Benson Ndambiri profile photo" class="avatar-photo" />
   ```
4. Add this CSS to `css/style.css`:
   ```css
   .avatar-photo {
     width: 220px;
     height: 220px;
     border-radius: var(--radius-xl);
     object-fit: cover;
   }
   ```

### Change accent color

In `css/style.css`, update the `--accent` variables:
```css
/* Current: electric blue */
--accent: #4f9eff;      /* dark theme */
--accent: #2563eb;      /* light theme */

/* Alternative: purple */
--accent: #7c3aed;
--accent-dim: rgba(124, 58, 237, 0.12);
```

### Add more projects

Copy a `<article class="project-card">` block in `index.html` and update the content.

---

## ⚡ Features

- ✅ **Dark / Light mode** with system preference detection and localStorage persistence
- ✅ **Animated particle network** (canvas — interactive, mouse-repulsive)
- ✅ **Typewriter effect** in hero section
- ✅ **Scroll reveal animations** (IntersectionObserver, GPU-composited)
- ✅ **Animated skill bars** (triggered on scroll)
- ✅ **Sticky navigation** with active link highlighting
- ✅ **Mobile-first responsive** (hamburger menu, fluid typography)
- ✅ **SEO meta tags** (title, description, OG, Twitter cards)
- ✅ **Accessible** (ARIA labels, semantic HTML, focus management)
- ✅ **Performance** (tab visibility pause, passive event listeners)
- ✅ **Zero dependencies** (pure HTML + CSS + vanilla JS)

---

## 🌐 Custom Domain (Optional)

To use `bensonndambiri.com` instead of `bensonndambiri.github.io`:

1. Buy a domain from Namecheap, GoDaddy, or Google Domains.
2. In GitHub Pages settings, enter your custom domain.
3. Add a `CNAME` file in the repo root containing: `bensonndambiri.com`
4. Update DNS records at your registrar to point to GitHub's IPs.

---

## 📜 License

Personal use. Feel free to adapt for your own portfolio.

---

*Built with precision. No frameworks. No bloat.*
