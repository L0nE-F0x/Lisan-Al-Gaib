import { AppState } from '../core/state.js';

export function drawMentatHUD(ctx, name, baseSize, color = '#00e5ff') {
    const anim = AppState.scanAnim;
    const t = performance.now() * 0.002;
    const s = (baseSize + anim * baseSize * 5) / AppState.currentScale; 
    const alpha = anim > 0 ? Math.min(1, 0.5 + anim) : 0.6; 

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5 / AppState.currentScale;
    
    ctx.rotate(t);
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s, Math.PI, Math.PI * 1.5); ctx.stroke();
    
    ctx.rotate(-t * 2.5);
    ctx.setLineDash([5 / AppState.currentScale, 10 / AppState.currentScale]);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.rotate(t * 1.5);
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath(); ctx.moveTo(-s*2, 0); ctx.lineTo(s*2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s*2); ctx.lineTo(0, s*2); ctx.stroke();

    ctx.rotate(-t); 
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = color;
    ctx.font = `600 ${10 / AppState.currentScale}px 'JetBrains Mono'`;
    ctx.textAlign = 'left';
    
    const hash = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    ctx.fillText(`TRK_${name.substring(0,6).toUpperCase()}`, s * 0.9, -s * 0.9);
    ctx.fillText(`0x${hash}`, s * 0.9, -s * 0.9 + (12 / AppState.currentScale));

    ctx.restore();
}

export function drawScanlines(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 229, 255, 0.015)';
    for(let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
    }
}
