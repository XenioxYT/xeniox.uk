
document.addEventListener('DOMContentLoaded', () => {
    const cardGenerator = new CardGenerator();
    cardGenerator.loadBlogCards();
});

class CardGenerator {
    constructor() {
        this.grid = document.getElementById('blog-card-grid');
    }

    async loadBlogCards() {
        if (!this.grid) {
            console.error('Blog card grid not found');
            return;
        }

        try {
            const res = await fetch('/static/data/blogs_meta.json', { cache: 'no-store' });
            if (!res.ok) {
                this.grid.innerHTML = '<p>Error loading blog posts. Please try refreshing.</p>';
                return;
            }
            const data = await res.json();
            this.renderCards(data.blogs);
        } catch (error) {
            console.error('Failed to load or parse blogs metadata:', error);
            this.grid.innerHTML = '<p>Could not load blog posts.</p>';
        }
    }

    renderCards(blogs) {
        if (!blogs || blogs.length === 0) {
            this.grid.innerHTML = '<p>No blog posts available at the moment.</p>';
            return;
        }

        // Clear existing static cards
        this.grid.innerHTML = '';

        // Create and append new cards
        for (const blog of blogs) {
            const card = this.createCardElement(blog);
            this.grid.appendChild(card);
        }
        
        // We need to re-initialize the 3D card effects after dynamically adding them
        if (window.Card3D) {
            window.Card3D.init();
        }
    }

    createCardElement(blog) {
        const scene = document.createElement('div');
        scene.className = 'card-scene';
        scene.dataset.blogId = blog.id;

        const tagsHtml = blog.tags.map(tag => 
            `<span class="px-3 py-1 rounded-full border" style="border-color: var(--border-color); background-color: rgba(255,255,255,0.05);">${tag}</span>`
        ).join('');

        scene.innerHTML = `
            <div class="post-card card3d glass-card rounded-2xl p-6 flex flex-col">
                <div class="card-content">
                    <span class="font-mono text-sm" style="color: var(--subtle-text-color);">${blog.date}</span>
                    <h3 class="text-2xl font-bold mt-2 mb-3" style="transform: translateZ(16px);">${blog.title}</h3>
                    <p class="flex-grow mb-4" style="color: var(--subtle-text-color); transform: translateZ(8px);">${blog.excerpt}</p>
                    <div class="flex items-center space-x-2 font-mono text-xs" style="transform: translateZ(12px);">
                        ${tagsHtml}
                    </div>
                </div>
            </div>
        `;
        return scene;
    }
}
