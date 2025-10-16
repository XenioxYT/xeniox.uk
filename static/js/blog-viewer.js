// Blog Viewer - Dynamic blog content loading with smooth animations

class BlogViewer {
    constructor() {
        this.state = 'grid'; // 'grid' | 'reading'
        this.blogs = [];
        this.currentBlog = null;
        this.currentCard = null;
        this.markdownParser = null;
        this.libs = {
            loaded: false,
            katexLoaded: false,
            katexCssLoaded: false,
            highlightCssLoaded: false,
        };
        this.isAnimating = false;
        
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    async setup() {
        try {
            // Fetch blog data
            await this.loadBlogs();
            
            // Setup event listeners
            this.setupDelegatedCardListener();
            this.setupCloseButton();
            this.setupHashNavigation();
            
            // Check for initial hash
            this.checkInitialHash();
            
            console.log('✅ Blog viewer ready!');
        } catch (error) {
            console.error('❌ Blog viewer setup failed:', error);
        }
    }

    // --- Dynamic loader helpers ---
    loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (id && document.getElementById(id)) { resolve(); return; }
            const s = document.createElement('script');
            if (id) s.id = id;
            s.src = src;
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    loadCss(href, id) {
        return new Promise((resolve, reject) => {
            if (id && document.getElementById(id)) { resolve(); return; }
            const l = document.createElement('link');
            if (id) l.id = id;
            l.rel = 'stylesheet';
            l.href = href;
            l.onload = resolve;
            l.onerror = () => reject(new Error('Failed to load ' + href));
            document.head.appendChild(l);
        });
    }

    async ensureBlogLibsLoaded({ needsMath }) {
        // Core: markdown-it, highlight.js, DOMPurify, highlight.css
        if (!this.libs.loaded) {
            await Promise.all([
                this.loadScript('https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js', 'md-it'),
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js', 'hljs-js'),
                this.loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js', 'dompurify-js'),
                (async () => {
                    if (!this.libs.highlightCssLoaded) {
                        await this.loadCss('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css', 'hljs-css');
                        this.libs.highlightCssLoaded = true;
                    }
                })(),
            ]);

            // Initialize markdown-it after libs are present
            if (typeof markdownit !== 'undefined' && typeof hljs !== 'undefined') {
                this.markdownParser = markdownit({
                    html: true,
                    linkify: true,
                    typographer: true,
                    highlight: function (str, lang) {
                        if (lang && hljs.getLanguage(lang)) {
                            try { return hljs.highlight(str, { language: lang }).value; } catch (_) {}
                        }
                        return '';
                    }
                });
            }

            this.libs.loaded = true;
        }

        // KaTeX only if needed
        if (needsMath && !this.libs.katexLoaded) {
            if (!this.libs.katexCssLoaded) {
                await this.loadCss('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css', 'katex-css');
                this.libs.katexCssLoaded = true;
            }
            await this.loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js', 'katex-js');
            await this.loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js', 'katex-auto-js');
            this.libs.katexLoaded = true;
        }
    }

    async loadBlogs() {
        try {
            const response = await fetch('/static/data/blogs_meta.json');
            const data = await response.json();
            this.blogs = data.blogs;
        } catch (error) {
            console.error('Failed to load blogs:', error);
        }
    }

    async getBlogContent(blog) {
        // Try to fetch per-post markdown; fallback to embedded content
        const candidatePaths = [
            `/static/uploads/posts/${blog.id}/index.md`,
        ];
        // Heuristic alternative: kebab-case title
        if (blog.title) {
            const alt = blog.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            candidatePaths.push(`/static/uploads/posts/${alt}/index.md`);
        }

        for (const path of candidatePaths) {
            try {
                const res = await fetch(path, { cache: 'no-store' });
                if (res.ok) {
                    return await res.text();
                }
            } catch (_) { /* ignore and try next */ }
        }
        return blog.content || '';
    }

    setupDelegatedCardListener() {
        const grid = document.getElementById('blog-card-grid');
        if (!grid) return;
        grid.addEventListener('click', async (e) => {
            const scene = e.target.closest('.card-scene');
            if (!scene || !grid.contains(scene)) return;
            const blogId = scene.dataset.blogId;
            if (!blogId) return;
            e.stopPropagation();
            if (this.state === 'grid' && !this.isAnimating) {
                if (window.pageViewer && window.pageViewer.state === 'viewing') {
                    await window.pageViewer.closePage({ suppressGridReveal: true });
                }
                this.openBlog(blogId, scene);
            }
        });
    }

    setupCloseButton() {
        const closeBtn = document.getElementById('blog-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.state === 'reading' && !this.isAnimating) {
                    this.closeBlog();
                }
            });
        }
    }

    setupHashNavigation() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            if (hash && hash.startsWith('blog-')) {
                const blogId = hash.replace('blog-', '');
                if (this.state === 'grid') {
                    const card = document.querySelector(`[data-blog-id="${blogId}"]`);
                    if (card) {
                        this.openBlog(blogId, card);
                    }
                } else if (this.state === 'reading' && !this.isAnimating) {
                    this.switchBlog(blogId);
                }
            } else if (this.state === 'reading') {
                this.closeBlog();
            }
        });

        // Handle back button
        window.addEventListener('popstate', () => {
            if (this.state === 'reading' && !window.location.hash) {
                this.closeBlog();
            }
        });
    }

    async switchBlog(blogId) {
        if (this.isAnimating) return;
        const blog = this.blogs.find(b => b.id === blogId);
        if (!blog) return;
        const markdownContent = await this.getBlogContent(blog);
        const needsMath = /\$\$([\s\S]*?)\$\$|\$[^$\n]+\$|\\\[|\\\(|\\\]|\\\)/.test(markdownContent);
        await this.ensureBlogLibsLoaded({ needsMath });
        const blogContent = document.getElementById('blog-content');
        if (!blogContent || !this.markdownParser) return;
        this.currentBlog = blog;
        this.renderBlogContent(blog, markdownContent, blogContent);
    }

    checkInitialHash() {
        const hash = window.location.hash.slice(1);
        if (hash && hash.startsWith('blog-')) {
            const blogId = hash.replace('blog-', '');
            const card = document.querySelector(`[data-blog-id="${blogId}"]`);
            if (card) {
                // Small delay to ensure everything is loaded
                setTimeout(() => this.openBlog(blogId, card), 100);
            }
        }
    }

    async openBlog(blogId, cardElement) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;

        const blog = this.blogs.find(b => b.id === blogId);
        if (!blog) {
            console.error(`Blog ${blogId} not found`);
            this.isAnimating = false;
            return;
        }

        // Fetch content first to decide which libs are needed
        performance.mark('blog-open-start');
        const markdownContent = await this.getBlogContent(blog);
        const needsMath = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\[|\\\(|\\\]|\\\)/.test(markdownContent);
        await this.ensureBlogLibsLoaded({ needsMath });
        if (!this.markdownParser) {
            console.error('Markdown parser not initialized!');
            this.isAnimating = false;
            return;
        }

        this.currentBlog = blog;
        this.currentCard = cardElement;
        this.state = 'reading';

        // Update URL hash
        window.history.pushState({}, '', `#blog-${blogId}`);

        // Animation sequence
        await this.animateCardExpansion(cardElement, blog, markdownContent);
        performance.mark('blog-open-end');
        performance.measure(`blog-open-${blogId}`,'blog-open-start','blog-open-end');

        this.isAnimating = false;
    }

    async animateCardExpansion(cardElement, blog, markdownContent) {
        const card = cardElement.querySelector('.card3d');
        const allCards = document.querySelectorAll('.card-scene');
        const hero = document.querySelector('section.min-h-\\[40vh\\]');
        
        // Step 1: Disable 3D effects
        window.Card3D?.setEnabled?.(false);
        
        // Step 2: Reset card tilt
        card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
        card.style.setProperty('--shine-o', '0');
        card.style.setProperty('--shadow-o', '0');

        // Step 3: Fade out all cards and hero at the same time (300ms)
        allCards.forEach(scene => {
            scene.classList.add('card-hidden');
        });
        if (hero) {
            hero.classList.add('hero-hidden');
        }

        await this.wait(300);

        // Step 4: Render blog content
        const blogContainer = document.getElementById('blog-container');
        const blogContent = document.getElementById('blog-content');
        const closeBtn = document.getElementById('blog-close-btn');
        
        if (!blogContainer || !blogContent || !closeBtn) {
            console.error('Blog DOM elements not found!');
            return;
        }
        
        this.renderBlogContent(blog, markdownContent, blogContent);
        
        // Step 5: Show blog container and content (fade in smoothly)
        // Reset scroll positions
        window.scrollTo(0, 0);
        const blogPane = blogContainer.querySelector('.blog-glass-pane');
        if (blogPane) {
            blogPane.scrollTop = 0;
        }
        
        blogContainer.classList.add('active');
        closeBtn.classList.add('active');

        await this.wait(50);
    }

    renderBlogContent(blog, markdownText, contentElement) {
        // Parse markdown to HTML
        const rawHtml = this.markdownParser.render(markdownText);
        
        // Sanitize HTML
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
            ADD_ATTR: ['target', 'loading'],
            ADD_TAGS: ['iframe']
        });

        // Build blog header
        const header = `
            <div class="blog-header">
                <h1>${blog.title}</h1>
                <div class="blog-meta">
                    <span>${blog.date}</span>
                </div>
                <div class="blog-tags">
                    ${blog.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;

        // Set content
        contentElement.innerHTML = header + `<div class="blog-content">${cleanHtml}</div>`;

        // Harden external links and ensure http(s) links open in new tab
        contentElement.querySelectorAll('a[target="_blank"]').forEach(a => {
            a.rel = 'noopener noreferrer';
        });
        contentElement.querySelectorAll('a[href^="http"]').forEach(a => {
            if (!a.target) a.target = '_blank';
            if (!a.rel) a.rel = 'noopener noreferrer';
        });

        // Add lazy loading to images
        const images = contentElement.querySelectorAll('img');
        images.forEach(img => {
            img.loading = 'lazy';
            img.decoding = 'async';
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s ease';
            img.onload = () => {
                img.style.opacity = '1';
            };
        });

        // Render math equations with KaTeX if available and needed
        const hasMath = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\[|\\\(|\\\]|\\\)/.test(markdownText);
        if (hasMath && typeof renderMathInElement !== 'undefined') {
            try {
                renderMathInElement(contentElement, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\[', right: '\\]', display: true},
                        {left: '\\(', right: '\\)', display: false}
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.error('KaTeX rendering error:', e);
            }
        }
    }

    async closeBlog(options = {}) {
        if (this.isAnimating) return;
        performance.mark('blog-close-start');
        this.isAnimating = true;

        const blogContainer = document.getElementById('blog-container');
        const blogContent = document.getElementById('blog-content');
        const closeBtn = document.getElementById('blog-close-btn');
        const allCards = document.querySelectorAll('.card-scene');
        const hero = document.querySelector('section.min-h-\\[40vh\\]');

        // Step 1: Fade out blog content (400ms)
        blogContainer.classList.remove('active');
        closeBtn.classList.remove('active');

        await this.wait(400);

        // Clear content to free memory
        if (blogContent) {
            blogContent.innerHTML = '';
        }

        // Step 2: Fade in all cards (300ms) unless suppressed by caller
        if (!options.suppressGridReveal) {
            allCards.forEach(scene => {
                scene.classList.remove('card-hidden');
            });
            if (hero) {
                hero.classList.remove('hero-hidden');
            }
        }

        await this.wait(300);

        // Step 3: Re-enable 3D effects
        window.Card3D?.setEnabled?.(true);

        // Resume background animation
        window.startAnimation?.();

        // Clear state
        this.state = 'grid';
        this.currentBlog = null;
        this.currentCard = null;

        // Clear URL hash without adding history entries
        window.history.replaceState({}, '', window.location.pathname);

        performance.mark('blog-close-end');
        performance.measure('blog-close','blog-close-start','blog-close-end');
        this.isAnimating = false;
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global functions for card.js integration
// Deprecated global toggles are intentionally removed; use Card3D.setEnabled instead.

// Initialize blog viewer when script loads
window.blogViewer = new BlogViewer();

