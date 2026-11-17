import { AppState } from '../core/state.js';
import { DATA, CONFIG } from '../data/arrakis-lore.js';

export function initStars() {
    AppState.bgStars = [];
    for (let i = 0; i < 600; i++) {
        AppState.bgStars.push({
            x: Math.random() * 4000 - 2000,
            y: Math.random() * 4000 - 2000,
            size: Math.random() * 1.2 + 0.1,
            alpha: Math.random(),
            color: Math.random() > 0.8 ? '#fcd34d' : (Math.random() > 0.5 ? '#93c5fd' : '#ffffff')
        });
    }
}

export function drawStars(ctx, width, height) {
    if (!AppState.toggles.stars) return;
    const parallaxX = AppState.currentOffsetX * 0.03;
    const parallaxY = AppState.currentOffsetY * 0.03;
    const now = performance.now();

    ctx.save();
    ctx.translate(width / 2 + parallaxX, height / 2 + parallaxY);
    
    AppState.bgStars.forEach(star => {
        const twinkle = Math.sin(now * 0.001 + star.x) * 0.3;
        ctx.globalAlpha = Math.max(0, Math.min(1, star.alpha + twinkle));
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.restore();
}

export function drawCentralStar(ctx) {
    const timeOffset = performance.now() * 0.001;
    const pulse = Math.sin(timeOffset * 2) * 2;
    
    ctx.globalCompositeOperation = 'screen';
    const gradient = ctx.createRadialGradient(0, 0, DATA.star.size, 0, 0, DATA.star.size * 6);
    gradient.addColorStop(0, 'rgba(252, 211, 77, 0.8)');
    gradient.addColorStop(0.2, 'rgba(245, 158, 11, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(0, 0, DATA.star.size * 6 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = DATA.star.color;
    ctx.shadowColor = '#fcd34d';
    ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, DATA.star.size, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
}

export function drawAsteroidBelt(ctx) {
    if (DATA.asteroidBelt && AppState.zoomLevel === 'system') {
        const beltInner = DATA.asteroidBelt.innerRadius * CONFIG.orbitScale * 10;
        const beltOuter = DATA.asteroidBelt.outerRadius * CONFIG.orbitScale * 10;
        const beltCenter = (beltInner + beltOuter) / 2;
        const beltWidth = (beltOuter - beltInner) / 2;
        
        ctx.fillStyle = DATA.asteroidBelt.color;
        for (let i = 0; i < DATA.asteroidBelt.count; i++) {
            const baseAngle = i * 137.5 * (Math.PI / 180); 
            const currentAngle = baseAngle + (AppState.imperialYear * 0.02); 
            const distance = beltCenter + (Math.sin(i * 99) * beltWidth);
            const ax = Math.cos(currentAngle) * distance;
            const ay = Math.sin(currentAngle) * distance;
            const size = (Math.cos(i * 31) + 1.5) * 0.5;
            
            ctx.beginPath(); ctx.arc(ax, ay, size / AppState.currentScale, 0, Math.PI * 2); ctx.fill();
        }
    }
}
