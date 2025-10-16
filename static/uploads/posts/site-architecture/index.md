# How this site works (Deep Dive)

This post explains how the portfolio is put together now: data flow, rendering pipeline, security, performance, and authoring. It’s intentionally detailed so you can treat it as documentation.

## Executive summary

- **Server-light**: Flask serves `index.html`, static assets, and a tiny JSON API for two text pages (About/Contact).
- **Client-driven**: The grid fetches `blogs_meta.json`; post content is Markdown loaded on demand and sanitized.
- **Overlays**: Page/Blog viewers are full-screen glass panes with smooth transitions and hash-driven navigation.
- **Safety + UX**: DOMPurify sanitization, link hardening, lazy images, syntax highlighting, optional math, and flicker-free transitions.
- **No framework**: Vanilla JS modules with careful event delegation and minimal globals.

---

## High-level flow

1) Home loads. The grid is empty.
2) `card-generator.js` fetches `/static/data/blogs_meta.json` and renders cards.
3) `cards.js` wires true-3D hover interactions.
4) `blog-viewer.js` and `page-viewer.js` listen for clicks and `hashchange`.
5) Opening a card fetches `/static/uploads/posts/<id>/index.md`, converts Markdown → HTML, sanitizes, enhances, and shows the overlay.
6) URL updates to `#blog-<id>` or `#page-<name>` so deep links and back/forward work.

```
Home → fetch blogs_meta.json → render cards → click
   → overlay open (blog/page) → render content → update hash
   → back/forward or internal links → switch or close overlay
```

See the welcome post here: [Welcome](#blog-welcome).

---

## Data model and content sources

- `static/data/blogs_meta.json`: small list used for the home grid (id, title, date, tags, excerpt).
- `static/uploads/posts/<id>/index.md`: post body in Markdown (images, code, math supported).
- Pages (`About`, `Contact`) are served by `/api/page/<name>` and rendered in a separate overlay.

Why this split?

- Home stays fast: load only metadata and thumbnails of content.
- Posts are streamed on demand the first time the user opens them.
- Markdown is a low-friction authoring format; no build step required.

---

## Rendering pipeline

When you click a card:

1. Fetch the Markdown file for the post.
2. Detect whether math is present; load KaTeX only if needed.
3. Ensure core libs are loaded once (Markdown-It, DOMPurify, Highlight.js + CSS).
4. Convert Markdown → raw HTML (Markdown-It).
5. Sanitize that HTML (DOMPurify) with a conservative allow-list and minimal additions (`iframe`, `target`, `loading`).
6. Insert into the blog overlay, add lazy loading to images, and render math if present.

```js
// Highlight callback is language-aware, else fallback
markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return '';
  }
});
```

```js
// DOMPurify with minimal additions
const clean = DOMPurify.sanitize(rawHtml, {
  ADD_ATTR: ['target', 'loading'],
  ADD_TAGS: ['iframe']
});
```

```js
// Link hardening and external links opening safely
container.querySelectorAll('a[target="_blank"]').forEach(a => {
  a.rel = 'noopener noreferrer';
});
container.querySelectorAll('a[href^="http"]').forEach(a => {
  if (!a.target) a.target = '_blank';
  if (!a.rel) a.rel = 'noopener noreferrer';
});
```

---

## Navigation: URLs, hashes, and switching in-place

The site uses URL hashes for in-app navigation:

- Blogs: `#blog-<id>`
- Pages: `#page-<name>`

Opening a view uses `history.pushState` to set the hash. Closing a view uses `history.replaceState` to clear the hash so we don’t spam the back stack.

Internal links between blog posts (e.g., within Markdown) can simply point to `#blog-welcome`. The blog viewer listens to `hashchange` while a post is open and switches content in place without flashing the home grid.

```js
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (hash.startsWith('blog-') && state === 'reading') {
    const id = hash.replace('blog-', '');
    switchBlog(id); // re-renders content in-place
  }
});
```

---

## Overlays, flicker-free transitions, and 3D cards

Both page and blog overlays are full-viewport panes with backdrop blur (`backdrop-filter`), sliding/fading content, and an independent scroll container. To avoid a flash of the home grid while navigating from one overlay to another, the viewers coordinate a `suppressGridReveal` option when closing one overlay and opening the other.

```js
// From blog → page (or vice versa)
await closeOtherOverlay({ suppressGridReveal: true });
await openDestinationOverlay();
```

The 3D card hover effect runs only on the home grid. The viewers call `Card3D.setEnabled(false/true)` to temporarily disable pointer-driven transforms during overlay transitions.

```js
window.Card3D = {
  init,
  setEnabled(enabled) {
    document.querySelectorAll('.card-scene').forEach(scene => {
      scene.style.pointerEvents = enabled ? 'auto' : 'none';
      const card = scene.querySelector('.card3d');
      if (!enabled && card) {
        card.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
        card.style.setProperty('--shine-o', '0');
        card.style.setProperty('--shadow-o', '0');
      }
    });
  }
};
```

---

## Background animation (metaballs)

The canvas background is a custom metaball simulation. It continues running while overlays are open for a cohesive aesthetic. It auto-pauses only when the tab is hidden to save resources, and resumes on visibility change. The canvas is layered below content with `z-index: -1`, `filter: blur(20px)`, and a high-contrast wrapper.

Key ideas:

- Spatial grid for cheap neighbor lookups.
- Soft orbit + gravity around cursor (ambient), stronger pulse on mouse up.
- Shockwave ring with transient energy boost for nearby balls.
- Particles for micro detail, decayed and steered gently when off-screen.

---

## Performance and accessibility

Performance:

- Compositor-friendly animations: translate/opacity, not layout-affecting props.
- Lazy images (`loading=lazy`, `decoding=async`) in both page and blog content.
- Conditional loading of optional libs (KaTeX only when math is detected).
- Minimal DOM churn: render once, then animate.

Accessibility & UX:

- Respect reduced motion where feasible.
- High contrast typography and consistent focus/hover affordances.
- External links hardened with `rel` to prevent `window.opener` vulnerabilities.
- Hash-based navigation is keyboard-friendly and predictable.

---

## Authoring posts

- Create a folder: `static/uploads/posts/<id>/index.md`.
- Add an entry in `static/data/blogs_meta.json` with the same `<id>`.
- Use Markdown. Code fences get syntax highlight automatically.
- Add math using KaTeX delimiters: inline `$E = mc^2$`, display blocks:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

- Link to another post with `#blog-<id>` (e.g., [Welcome](#blog-welcome)).
- External links are fine: just use `https://...` — they open in a new tab.

Images:

```md
![Alt text](/static/uploads/posts/<id>/some-image.jpg)
```

Tips:

- Keep paragraphs short. Use headings liberally.
- Prefer SVG or compressed images; the overlay is already blurred behind.
- No raw `<script>` tags — they’re stripped by sanitization for safety.

---

## Security posture (at a glance)

- Sanitization via DOMPurify with a minimal allow-list (attributes/tags).
- External links use `rel="noopener noreferrer"` to break `window.opener`.
- Optional future: SRI for CDNs and a CSP to pin allowed sources.

---

## Roadmap / ideas

- Optional local bundling of third-party libs for offline resilience.
- Pre-rendered excerpts and reading-time in metadata.
- Keyboard shortcuts for next/previous post while in the blog overlay.
- Image zoom for figures.

---

If you’re curious about implementation details, look at the other post: [Welcome](#blog-welcome). Or jump straight to the code blocks above and poke around the snippets.


