from flask import Flask, send_from_directory, jsonify

app = Flask(__name__)

# Page content data
PAGES = {
    'about': {
        'title': 'About Me',
        'subtitle': 'Computer engineering graduate passionate about building elegant solutions.',
        'content': '''
            <h2>Background</h2>
            <p>I'm a computer engineering graduate with a passion for software development, system architecture, and building things that make a difference. My journey into tech started with curiosity about how computers work at the hardware level, which naturally evolved into a deep interest in software and system design.</p>
            
            <p>I believe in writing clean, maintainable code and building systems that are both performant and elegant. Whether it's optimizing database queries, architecting microservices, or crafting intuitive user interfaces, I approach each challenge with attention to detail and a commitment to quality.</p>
            
            <h2>What I Do</h2>
            <p>I work across the full stack, from database design to frontend development, with a particular interest in:</p>
            <ul>
                <li><strong>System Architecture:</strong> Designing scalable, resilient systems that can grow with business needs</li>
                <li><strong>Performance Optimization:</strong> Making things fast and efficient, whether it's code, queries, or infrastructure</li>
                <li><strong>Developer Experience:</strong> Creating tools and workflows that make developers' lives easier</li>
                <li><strong>Web Technologies:</strong> Exploring new frameworks, languages, and approaches to web development</li>
            </ul>
            
            <h2>Technical Skills</h2>
            <div class="skills-grid">
                <div class="skill-category">
                    <h3>Languages</h3>
                    <ul>
                        <li>Python</li>
                        <li>JavaScript/TypeScript</li>
                        <li>Rust</li>
                        <li>Go</li>
                        <li>SQL</li>
                    </ul>
                </div>
                
                <div class="skill-category">
                    <h3>Frontend</h3>
                    <ul>
                        <li>React</li>
                        <li>Vue.js</li>
                        <li>CSS/SASS</li>
                        <li>WebGL</li>
                        <li>Canvas API</li>
                    </ul>
                </div>
                
                <div class="skill-category">
                    <h3>Backend</h3>
                    <ul>
                        <li>Flask/Django</li>
                        <li>Node.js</li>
                        <li>PostgreSQL</li>
                        <li>Redis</li>
                        <li>GraphQL</li>
                    </ul>
                </div>
                
                <div class="skill-category">
                    <h3>DevOps</h3>
                    <ul>
                        <li>Docker</li>
                        <li>Kubernetes</li>
                        <li>CI/CD</li>
                        <li>AWS</li>
                        <li>Linux</li>
                    </ul>
                </div>
            </div>
            
            <h2>Beyond Code</h2>
            <p>When I'm not coding, you'll find me tinkering with my home lab, exploring new technologies, or diving into hardware projects. I'm a big believer in continuous learning and staying current with the rapidly evolving tech landscape.</p>
            
            <p>I also enjoy contributing to open source projects, writing about technical topics, and helping others learn. There's something deeply satisfying about solving complex problems and sharing that knowledge with the community.</p>
        '''
    },
    'contact': {
        'title': 'Get In Touch',
        'subtitle': 'Feel free to reach out for collaborations or just a friendly chat.',
        'content': '''
            <p>I'm always open to discussing new projects, creative ideas, or opportunities to be part of your vision. Whether you have a question, want to collaborate, or just want to connect, I'd love to hear from you.</p>
            
            <div class="contact-methods">
                <div class="contact-item">
                    <div class="contact-icon">✉️</div>
                    <div class="contact-details">
                        <h3>Email</h3>
                        <p><a href="mailto:tom@xeniox.uk">tom@xeniox.uk</a></p>
                    </div>
                </div>
                
                <div class="contact-item">
                    <div class="contact-icon">💼</div>
                    <div class="contact-details">
                        <h3>LinkedIn</h3>
                        <p><a href="https://linkedin.com" target="_blank">linkedin.com/in/tomlockwood</a></p>
                    </div>
                </div>
                
                <div class="contact-item">
                    <div class="contact-icon">🐙</div>
                    <div class="contact-details">
                        <h3>GitHub</h3>
                        <p><a href="https://github.com" target="_blank">github.com/tomlockwood</a></p>
                    </div>
                </div>
                
                <div class="contact-item">
                    <div class="contact-icon">🐦</div>
                    <div class="contact-details">
                        <h3>Twitter</h3>
                        <p><a href="https://twitter.com" target="_blank">@tomlockwood</a></p>
                    </div>
                </div>
            </div>
            
            <h2>Availability</h2>
            <p>I'm currently open to freelance projects and consulting opportunities. If you're working on something exciting and think I could help, let's talk!</p>
            
            <p>Response time is typically within 24 hours during weekdays. For urgent matters, please mention it in your subject line.</p>
        '''
    }
}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/page/<page_name>')
def get_page(page_name):
    if page_name in PAGES:
        return jsonify(PAGES[page_name])
    return jsonify({'error': 'Page not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)
