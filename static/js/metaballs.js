const canvas = document.getElementById('metaball-canvas');
const ctx = canvas.getContext('2d');

// --- INTERACTION STATE ---
let isMouseDown = false;
        
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const smoothMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        
window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

window.addEventListener('mousedown', () => { isMouseDown = true; });
window.addEventListener('mouseup', () => {
    isMouseDown = false;
    triggerPulse();
});

// --- MONOCHROMATIC COLOR THEME ---
const BASE_HUE = 195; // The hue of #00BFFF

// --- Configuration ---
const NUM_METABALLS = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 16 : 40;
const MIN_RADIUS = 25;
const MAX_RADIUS = 60;

// --- Physics properties ---
// Ambient (default) state physics
const AMBIENT_GRAVITY = 18.0; 
const AMBIENT_ORBIT = 3.375;
// Pulse (mouse down) state physics
const PULSE_GRAVITY = 150; 
const PULSE_REPEL_STRENGTH = 1200; 
const PULSE_DEAD_ZONE_RADIUS = 60; 
const PULSE_REPULSION_MULTIPLIER = 0.25; 

const FRICTION = 0.97;
const REPULSION_STRENGTH = 250; 
// Offscreen ball attraction: like gravity, pulls them back when outside visible area
const OFFSCREEN_MARGIN = 100;            // pixels beyond the screen edge where pull starts
const OFFSCREEN_GRAVITY_STRENGTH = 40;   // base gravity force (scales with distance and mass)
// Particle offscreen handling: gently push back toward cursor when not visible
const PARTICLE_OFFSCREEN_PUSH = 0.6;  // acceleration towards cursor when offscreen
        
let metaballs = [];
let particles = [];
let shockwave = { active: false, radius: 0, life: 1, x: 0, y: 0 };
let animationFrameId = null;

class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = new Map();
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
    }
    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }
    clear() {
        this.grid.clear();
    }
    insert(ball) {
        const key = this.getKey(ball.x, ball.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(ball);
    }
    getNearby(ball) {
        const nearby = [];
        const x = Math.floor(ball.x / this.cellSize);
        const y = Math.floor(ball.y / this.cellSize);
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${x + i},${y + j}`;
                if (this.grid.has(key)) {
                    nearby.push(...this.grid.get(key));
                }
            }
        }
        return nearby;
    }
}
let spatialGrid;

class Particle {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = Math.random() * 3 + 1;
        this.lifespan = 100;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.96;
        this.vy *= 0.96;
        
        // If offscreen (not visible), nudge towards cursor and lightly damp
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            const dx = smoothMouse.x - this.x;
            const dy = smoothMouse.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            this.vx += nx * PARTICLE_OFFSCREEN_PUSH;
            this.vy += ny * PARTICLE_OFFSCREEN_PUSH;
            this.vx *= 0.9;
            this.vy *= 0.9;
        }
        this.lifespan--;
    }

    draw() {
        ctx.globalAlpha = Math.max(0, this.lifespan / 100);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
        
class Metaball {
    constructor() {
        this.radius = Math.random() * (MAX_RADIUS - MIN_RADIUS) + MIN_RADIUS;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.mass = Math.pow(this.radius, 1.5); 
        this.vx = 0;
        this.vy = 0;
        this.pulseEnergy = 0; // NEW: Tracks the color effect from the pulse
    }

    update(nearbyMetaballs) {
        // --- 1. Forces from the cursor (Gravity Pulse or Ambient) ---
        let ax_mouse = 0;
        let ay_mouse = 0;
        const dx_mouse = smoothMouse.x - this.x;
        const dy_mouse = smoothMouse.y - this.y;
        const dist_mouse = Math.sqrt(dx_mouse * dx_mouse + dy_mouse * dy_mouse);

        if (dist_mouse > 1) {
            const nx = dx_mouse / dist_mouse;
            const ny = dy_mouse / dist_mouse;
            
            // Check if ball is offscreen (beyond visible canvas + margin based on size)
            const margin = OFFSCREEN_MARGIN + this.radius;
            const isOffscreen = (
                this.x < -margin ||
                this.x > canvas.width + margin ||
                this.y < -margin ||
                this.y > canvas.height + margin
            );
            
            if (isOffscreen) {
                // Apply gravitational pull toward cursor, scaled by distance and mass
                // Larger/heavier balls get proportionally stronger pull (F = G * m / r²)
                const gravityForce = OFFSCREEN_GRAVITY_STRENGTH * Math.sqrt(this.mass) / Math.sqrt(dist_mouse);
                ax_mouse += nx * gravityForce;
                ay_mouse += ny * gravityForce;
            }
            
            if (isMouseDown) {
                if (dist_mouse < PULSE_DEAD_ZONE_RADIUS) {
                    this.vx *= 0.9; 
                    this.vy *= 0.9;
                    ax_mouse += dx_mouse * 0.01;
                    ay_mouse += dy_mouse * 0.01;
                } else {
                    const gravity = PULSE_GRAVITY / Math.sqrt(dist_mouse);
                    ax_mouse += nx * gravity;
                    ay_mouse += ny * gravity;
                }
            } else {
                const gravity = AMBIENT_GRAVITY / dist_mouse;
                ax_mouse += nx * gravity;
                ay_mouse += ny * gravity;
                ax_mouse += -ny * AMBIENT_ORBIT;
                ay_mouse += nx * AMBIENT_ORBIT;
            }
        }

        // --- 2. Repulsion forces from other balls ---
        let ax_repulsion = 0;
        let ay_repulsion = 0;
        let currentRepulsion = REPULSION_STRENGTH;
        if (isMouseDown) {
            currentRepulsion *= PULSE_REPULSION_MULTIPLIER;
        }

        for (const otherBall of nearbyMetaballs) {
            if (this === otherBall) continue;

            const dx_ball = this.x - otherBall.x;
            const dy_ball = this.y - otherBall.y;
            const dist2 = dx_ball * dx_ball + dy_ball * dy_ball;
            const min_dist = this.radius + otherBall.radius;
            const min_dist2 = min_dist * min_dist;
            if (dist2 < min_dist2 && dist2 > 1e-6) {
                const dist = Math.sqrt(dist2);
                const invDist = 1 / dist;
                const normal_x = dx_ball * invDist;
                const normal_y = dy_ball * invDist;
                const force = currentRepulsion * (min_dist - dist) / dist2;
                ax_repulsion += normal_x * force;
                ay_repulsion += normal_y * force;
            }
        }
                
        // --- 3. Soft Boundary (Leash) to pull balls back ---
        let ax_boundary = 0;
        let ay_boundary = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const distFromCenter = Math.sqrt(Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2));
        const maxDist = Math.max(centerX, centerY) * 1.2; 

        if (distFromCenter > maxDist) {
            const pull_strength = 0.001 * (distFromCenter - maxDist);
            ax_boundary = (centerX - this.x) * pull_strength;
            ay_boundary = (centerY - this.y) * pull_strength;
        }
                
        // --- 4. NEW: Check for shockwave interaction ---
        if (shockwave.active) {
            const distFromPulse = Math.sqrt(Math.pow(this.x - shockwave.x, 2) + Math.pow(this.y - shockwave.y, 2));
            if (Math.abs(distFromPulse - shockwave.radius) < this.radius * 2) {
                this.pulseEnergy = 1.0; // Excite the ball as the wave passes over
            }
        }
        // Decay the pulse energy
        this.pulseEnergy = Math.max(0, this.pulseEnergy - 0.05);

        // --- 5. Apply all forces, adjusted for mass ---
        this.vx += (ax_mouse + ax_repulsion + ax_boundary) / this.mass;
        this.vy += (ay_mouse + ay_repulsion + ay_boundary) / this.mass;

        this.vx *= FRICTION;
        this.vy *= FRICTION;

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const brightness = Math.min(100, 70 + speed * 15); 
                
        // --- AURA AND CORE RENDERING ---
        // 1. Draw a smaller, darker "Aura" for subtle color fringes
        ctx.fillStyle = `hsl(${BASE_HUE}, 80%, 20%)`; // Darker aura
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.1, 0, 2 * Math.PI); // Smaller aura
        ctx.fill();

        // 2. Draw the Core. Its color shifts from white to blue based on pulseEnergy.
        const coreSaturation = this.pulseEnergy * 100;
        const coreHue = this.pulseEnergy > 0 ? BASE_HUE : 0; // Use blue hue only when colored
        ctx.fillStyle = `hsl(${coreHue}, ${coreSaturation}%, ${brightness}%)`; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function triggerPulse() {
    // Activate visual shockwave at the cursor's current position
    shockwave.active = true;
    shockwave.radius = 0;
    shockwave.life = 1.0;
    shockwave.x = smoothMouse.x;
    shockwave.y = smoothMouse.y;


    // Apply explosive force to all balls
    for (const ball of metaballs) {
        const dx = ball.x - shockwave.x;
        const dy = ball.y - shockwave.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
            const nx = dx / dist;
            const ny = dy / dist;
            const force = PULSE_REPEL_STRENGTH / dist;
            ball.vx += nx * force;
            ball.vy += ny * force;
        }
    }
}

function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, MAX_RADIUS * 2);
            
    mouse.x = window.innerWidth / 2;
    mouse.y = window.innerHeight / 2;
    smoothMouse.x = window.innerWidth / 2;
    smoothMouse.y = window.innerHeight / 2;

    metaballs = [];
    for (let i = 0; i < NUM_METABALLS; i++) {
        metaballs.push(new Metaball());
    }
    particles = [];
}

function animate() {
    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.12; 
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.12; 

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.lifespan <= 0) {
            particles.splice(i, 1);
        }
    }

    if (spatialGrid) {
        spatialGrid.clear();
        for (const ball of metaballs) {
            spatialGrid.insert(ball);
        }
        for (const ball of metaballs) {
            ball.update(spatialGrid.getNearby(ball));
            ball.draw();
        }
    } else {
        for (const ball of metaballs) {
            ball.update(metaballs);
            ball.draw();
        }
    }
            
    if (shockwave.active) {
        shockwave.radius += 45; 
        shockwave.life -= 0.04; 
                
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, shockwave.life)})`; 
        ctx.lineWidth = 25; 
        ctx.beginPath();
        ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, 2 * Math.PI);
        ctx.stroke();

        if (shockwave.life <= 0) {
            shockwave.active = false;
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}
        
setup();
function startAnimation() {
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

startAnimation();
    window.addEventListener('resize', setup);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAnimation();
            shockwave.active = false;
        } else {
            startAnimation();
        }
    });


