(function() {
  const gravity = 0.8;
  let hueCounter = 0;

  function initEasterEgg() {
    // 1. Create the bullseye on the right border
    const bullseye = document.createElement('div');
    bullseye.id = 'easter-egg-bullseye';
    Object.assign(bullseye.style, {
      position: 'fixed',
      right: '0',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '15px',
      height: '120px',
      background: 'repeating-linear-gradient(to bottom, #ef4444, #ef4444 20px, #ffffff 20px, #ffffff 40px)',
      border: '2px solid #333',
      borderRight: 'none',
      borderTopLeftRadius: '15px',
      borderBottomLeftRadius: '15px',
      zIndex: '9999',
      boxShadow: '-4px 4px 10px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(bullseye);

    // 2. Make logos draggable
    const logos = document.querySelectorAll('.landing-nav__logo, .sidebar__logo-icon');
    
    logos.forEach(logo => {
      logo.style.cursor = 'grab';
      logo.draggable = false; // Prevent default HTML5 drag

      let activeKnife = null;
      let lastTime, lastX, lastY;

      logo.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        
        // Cycle hue for each new knife
        hueCounter = (hueCounter + 65) % 360;

        const rect = logo.getBoundingClientRect();
        activeKnife = document.createElement('img');
        activeKnife.src = logo.src;
        activeKnife.draggable = false;
        
        Object.assign(activeKnife.style, {
          position: 'fixed',
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          filter: `hue-rotate(${hueCounter}deg) drop-shadow(2px 4px 6px rgba(0,0,0,0.3))`,
          zIndex: '10000',
          cursor: 'grabbing',
          touchAction: 'none',
          transformOrigin: 'center center'
        });
        document.body.appendChild(activeKnife);

        activeKnife._state = {
          x: rect.left,
          y: rect.top,
          vx: 0,
          vy: 0,
          rotation: 0,
          isDragging: true
        };

        lastTime = performance.now();
        lastX = e.clientX;
        lastY = e.clientY;

        const onMove = (eMove) => {
          if (!activeKnife || !activeKnife._state.isDragging) return;
          const now = performance.now();
          const dt = Math.max(1, now - lastTime);
          
          const dx = eMove.clientX - lastX;
          const dy = eMove.clientY - lastY;
          
          // Calculate velocity (pixels per frame approx)
          activeKnife._state.vx = (dx / dt) * 16;
          activeKnife._state.vy = (dy / dt) * 16;

          activeKnife._state.x += dx;
          activeKnife._state.y += dy;
          activeKnife.style.left = activeKnife._state.x + 'px';
          activeKnife.style.top = activeKnife._state.y + 'px';

          lastX = eMove.clientX;
          lastY = eMove.clientY;
          lastTime = now;
        };

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          
          if (activeKnife) {
            activeKnife._state.isDragging = false;
            
            // If user stopped mouse for > 50ms before releasing, velocity is 0
            if (performance.now() - lastTime > 50) {
              activeKnife._state.vx = 0;
              activeKnife._state.vy = 0;
            }
            
            // Cap throw speeds so it doesn't clip through walls
            activeKnife._state.vx = Math.max(-60, Math.min(60, activeKnife._state.vx));
            activeKnife._state.vy = Math.max(-60, Math.min(60, activeKnife._state.vy));
            
            // Start physics loop
            const knifeToThrow = activeKnife;
            requestAnimationFrame(() => updatePhysics(knifeToThrow));
            activeKnife = null;
          }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    });

    function updatePhysics(knife) {
      if (!knife || !knife.parentElement) return;

      const state = knife._state;
      
      // Gravity
      state.vy += gravity;
      
      // Update pos
      state.x += state.vx;
      state.y += state.vy;
      
      // Spin depending on horizontal velocity
      const spinRate = state.vx > 0 ? 15 : (state.vx < 0 ? -15 : 10);
      state.rotation += spinRate;

      knife.style.left = state.x + 'px';
      knife.style.top = state.y + 'px';
      knife.style.transform = `rotate(${state.rotation}deg)`;

      // Collision Detection with Bullseye
      const kRect = knife.getBoundingClientRect();
      const bRect = bullseye.getBoundingClientRect();

      // Simple AABB overlap
      if (
        kRect.right > bRect.left &&
        kRect.left < bRect.right &&
        kRect.bottom > bRect.top &&
        kRect.top < bRect.bottom
      ) {
        // We hit the target!
        // Stop physics, stick into the target
        
        // Add a slight wobble animation for impact
        knife.style.transition = 'transform 0.1s ease-out';
        // Assume knife points to the right in the image. We stick it horizontally.
        knife.style.transform = `rotate(90deg) scale(1.1)`; 
        
        // Remove after 4 seconds
        setTimeout(() => {
          if (knife.parentElement) {
            knife.style.transition = 'opacity 0.3s, transform 0.3s';
            knife.style.opacity = '0';
            knife.style.transform = 'translateY(50px) rotate(90deg)';
            setTimeout(() => knife.remove(), 300);
          }
        }, 4000);
        
        // Create a small impact effect
        const bang = document.createElement('div');
        Object.assign(bang.style, {
          position: 'fixed',
          left: (kRect.right - 10) + 'px',
          top: (kRect.top + kRect.height/2) + 'px',
          width: '20px',
          height: '20px',
          background: 'white',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: '10001',
          pointerEvents: 'none',
          boxShadow: '0 0 10px #fff'
        });
        document.body.appendChild(bang);
        
        bang.animate([
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: 'translate(-50%, -50%) scale(3)', opacity: 0 }
        ], { duration: 300, easing: 'ease-out' });
        
        setTimeout(() => bang.remove(), 300);

        return; // End physics loop
      }

      // Check out of bounds
      if (state.y > window.innerHeight + 200 || state.x > window.innerWidth + 200 || state.x < -200) {
        knife.remove();
        return;
      }

      requestAnimationFrame(() => updatePhysics(knife));
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEasterEgg);
  } else {
    initEasterEgg();
  }
})();
