// Page Viewer - Dynamic page content loading with smooth animations

class PageViewer {
    constructor() {
        this.state = 'home'; // 'home' | 'viewing'
        this.currentPage = null;
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
            // Setup event listeners
            this.setupNavListeners();
            this.setupHomeLink();
            this.setupCloseButton();
            this.setupHashNavigation();
            
            // Check for initial hash
            this.checkInitialHash();
            
            console.log('✅ Page viewer ready!');
        } catch (error) {
            console.error('❌ Page viewer setup failed:', error);
        }
    }

    setupHomeLink() {
        const homeLink = document.getElementById('home-link');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close any open pages
                if (this.state === 'viewing' && !this.isAnimating) {
                    this.closePage();
                }
                
                // Close any open blogs
                if (window.blogViewer && window.blogViewer.state === 'reading' && !window.blogViewer.isAnimating) {
                    window.blogViewer.closeBlog();
                }
                
                // Clear hash and return to home
                window.history.pushState({}, '', window.location.pathname);
            });
        }
    }

    setupNavListeners() {
        const navLinks = document.querySelectorAll('nav a[data-page]');
        
        navLinks.forEach((link) => {
            const pageName = link.dataset.page;
            
            if (!pageName) return;
            
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.isAnimating) return;
                
                // If a blog is open, close it first
                if (window.blogViewer && window.blogViewer.state === 'reading') {
                    await window.blogViewer.closeBlog({ suppressGridReveal: true });
                }
                
                // If we're viewing a different page, transition directly
                if (this.state === 'viewing' && this.currentPage !== pageName) {
                    await this.transitionToPage(pageName);
                } else if (this.state === 'home') {
                    this.openPage(pageName);
                }
            });
        });
    }

    setupCloseButton() {
        const closeBtn = document.getElementById('page-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.state === 'viewing' && !this.isAnimating) {
                    this.closePage();
                }
            });
        }
    }

    setupHashNavigation() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            if (hash && hash.startsWith('page-')) {
                const pageName = hash.replace('page-', '');
                if (this.state === 'home') {
                    this.openPage(pageName);
                }
            } else if (this.state === 'viewing' && !hash.startsWith('blog-')) {
                this.closePage();
            }
        });

        // Handle back button
        window.addEventListener('popstate', () => {
            if (this.state === 'viewing' && !window.location.hash) {
                this.closePage();
            }
        });
    }

    checkInitialHash() {
        const hash = window.location.hash.slice(1);
        if (hash && hash.startsWith('page-')) {
            const pageName = hash.replace('page-', '');
            setTimeout(() => this.openPage(pageName), 100);
        }
    }

    async getPageContent(pageName) {
        try {
            const response = await fetch(`/api/page/${pageName}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error(`Failed to load page ${pageName}:`, error);
        }
        return null;
    }

    async openPage(pageName) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;

        // Fetch page content
        const pageData = await this.getPageContent(pageName);
        if (!pageData) {
            console.error(`Page ${pageName} not found`);
            this.isAnimating = false;
            return;
        }

        this.currentPage = pageName;
        this.state = 'viewing';

        // Update URL hash
        window.history.pushState({}, '', `#page-${pageName}`);

        // Animation sequence
        await this.animatePageOpen(pageData);

        this.isAnimating = false;
    }

    async transitionToPage(pageName) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;

        // Fetch new page content
        const pageData = await this.getPageContent(pageName);
        if (!pageData) {
            console.error(`Page ${pageName} not found`);
            this.isAnimating = false;
            return;
        }

        const pageContent = document.getElementById('page-content');
        const pagePane = document.querySelector('.page-glass-pane');
        
        if (!pageContent || !pagePane) {
            console.error('Page DOM elements not found!');
            this.isAnimating = false;
            return;
        }

        // Update state and URL
        this.currentPage = pageName;
        window.history.pushState({}, '', `#page-${pageName}`);

        // Scroll to top
        pagePane.scrollTop = 0;

        // Render new content and animate it in (no blank stage)
        this.renderPageContent(pageData, pageContent);
        pageContent.animate([
            { opacity: 0, transform: 'translateY(-10px)', filter: 'blur(8px)' },
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
        ], { duration: 300, easing: 'ease' });

        this.isAnimating = false;
    }

    async animatePageOpen(pageData) {
        const allCards = document.querySelectorAll('.card-scene');
        const hero = document.querySelector('section.min-h-\\[40vh\\]');
        
        // Step 1: Disable card effects
        window.Card3D?.setEnabled?.(false);
        
        // Step 2: Fade out all cards and hero (300ms)
        allCards.forEach(scene => {
            scene.classList.add('card-hidden');
        });
        if (hero) {
            hero.classList.add('hero-hidden');
        }

        await this.wait(300);

        // Step 3: Render page content
        const pageContainer = document.getElementById('page-container');
        const pageContent = document.getElementById('page-content');
        const closeBtn = document.getElementById('page-close-btn');
        
        if (!pageContainer || !pageContent || !closeBtn) {
            console.error('Page DOM elements not found!');
            return;
        }
        
        this.renderPageContent(pageData, pageContent);
        
        // Step 4: Show page container (fade in smoothly)
        window.scrollTo(0, 0);
        const pagePane = pageContainer.querySelector('.page-glass-pane');
        if (pagePane) {
            pagePane.scrollTop = 0;
        }
        
        pageContainer.classList.add('active');
        closeBtn.classList.add('active');

        await this.wait(50);
    }

    renderPageContent(pageData, contentElement) {
        const content = `
            <div class="page-header">
                <h1>${pageData.title}</h1>
                ${pageData.subtitle ? `<p class="page-subtitle">${pageData.subtitle}</p>` : ''}
            </div>
            <div class="page-body">
                ${pageData.content}
            </div>
        `;

        contentElement.innerHTML = content;

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
    }

    async closePage() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;

        const pageContainer = document.getElementById('page-container');
        const pageContent = document.getElementById('page-content');
        const closeBtn = document.getElementById('page-close-btn');
        const allCards = document.querySelectorAll('.card-scene');
        const hero = document.querySelector('section.min-h-\\[40vh\\]');

        // Step 1: Fade out page content (400ms)
        pageContainer.classList.remove('active');
        closeBtn.classList.remove('active');

        await this.wait(400);

        // Clear content
        if (pageContent) {
            pageContent.innerHTML = '';
        }

        // Step 2: Reveal grid again (unless suppressed by caller)
        if (!arguments[0] || !arguments[0].suppressGridReveal) {
            allCards.forEach(scene => {
                scene.classList.remove('card-hidden');
            });
            if (hero) {
                hero.classList.remove('hero-hidden');
            }
        }

        await this.wait(300);

        // Step 3: Re-enable card effects
        window.Card3D?.setEnabled?.(true);

        // Clear state
        this.state = 'home';
        this.currentPage = null;

        // Clear URL hash without adding history entries
        window.history.replaceState({}, '', window.location.pathname);

        this.isAnimating = false;
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize page viewer when script loads
window.pageViewer = new PageViewer();

