// Background spotlight will still follow these CSS variables
const body = document.body;

// Wait for Flubber to load
console.log('Flubber loaded:', typeof flubber !== 'undefined');

// Background spotlight will still follow these CSS variables
let pointerFrameRequested = false;
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
document.addEventListener('pointermove', (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    if (!pointerFrameRequested) {
        pointerFrameRequested = true;
        requestAnimationFrame(() => {
            body.style.setProperty('--mouse-x', lastPointer.x + 'px');
            body.style.setProperty('--mouse-y', lastPointer.y + 'px');
            pointerFrameRequested = false;
        });
    }
});
// True 3D card interactions with smooth perspective
const cardScenes = document.querySelectorAll('.card-scene');
let card3DEnabled = true;

(function() {
    "use strict";

    // Expose API to the global scope
    window.Card3D = {
        init: init,
        setEnabled(enabled) {
            card3DEnabled = !!enabled;
            const scenes = document.querySelectorAll('.card-scene');
            scenes.forEach(scene => {
                scene.style.pointerEvents = enabled ? 'auto' : 'none';
                const card = scene.querySelector('.card3d');
                if (!enabled && card) {
                    card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
                    card.style.setProperty('--shine-o', '0');
                    card.style.setProperty('--shadow-o', '0');
                }
            });
        }
    };

    function init() {
        const scenes = document.querySelectorAll('.card-scene');

        scenes.forEach(scene => {
            const card = scene.querySelector('.card3d');
            if (!card) return;

            const content = card.querySelector('.card-content');
            
            let rect = null;
            let hoverRAF = null;
            let hoverPointer = { x: 0, y: 0 };

            const onEnter = () => {
                rect = card.getBoundingClientRect();
            };
            const onMove = (e) => {
                if (!card3DEnabled || scene.style.pointerEvents === 'none') return;
                hoverPointer.x = e.clientX;
                hoverPointer.y = e.clientY;
                if (hoverRAF) return;
                hoverRAF = requestAnimationFrame(() => {
                    hoverRAF = null;
                    if (!rect) rect = card.getBoundingClientRect();
                    const cx = hoverPointer.x - rect.left;
                    const cy = hoverPointer.y - rect.top;
                    const nx = (cx / rect.width - 0.5) * 2; // normalize to -1 to 1
                    const ny = (cy / rect.height - 0.5) * 2; // normalize to -1 to 1
                    const rx = ny * -10; // invert for natural feel
                    const ry = nx * 10;

                    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(12px)`;
                    card.style.setProperty('--light-x', `${cx}px`);
                    card.style.setProperty('--light-y', `${cy}px`);
                    card.style.setProperty('--shine-o', '0.55');
                    card.style.setProperty('--shadow-o', '1');

                    if (content) {
                        content.style.transform = 'translateZ(18px)';
                    }
                });
            };
            const onLeave = () => {
                if (!card3DEnabled) return;
                card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
                card.style.setProperty('--shine-o', '0');
                card.style.setProperty('--shadow-o', '0');
                if (content) content.style.transform = 'translateZ(0)';
                rect = null;
            };

            scene.addEventListener('mouseenter', onEnter);
            scene.addEventListener('mousemove', onMove);
            scene.addEventListener('mouseleave', onLeave);

            scene.addEventListener('mouseleave', () => {
                if (!card3DEnabled) return;
                
                card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
                card.style.setProperty('--shine-o', '0');
                card.style.setProperty('--shadow-o', '0');
                if (content) content.style.transform = 'translateZ(0)';
            });
        });
    }

    // Initial call
    document.addEventListener('DOMContentLoaded', init);

})();

// Remove old global overrides; use Card3D.setEnabled instead
        

