import { AppState } from '../core/state.js';

export function initPolishUI() {
    createShortcutsModal();
    window.toggleShortcuts = toggleShortcuts;
    window.exportCartography = exportCartography;
}

function createShortcutsModal() {
    const modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm opacity-0 invisible transition-all flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-zinc-950 border border-amber-500/30 p-6 md:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative transform scale-95 transition-transform duration-300" id="shortcuts-box">
            <button onclick="window.toggleShortcuts()" class="absolute top-4 right-4 text-zinc-500 hover:text-amber-500 text-xl leading-none">&times;</button>
            <h2 class="title text-xl md:text-2xl text-amber-500 mb-6 tracking-widest uppercase border-b border-zinc-800 pb-4">Terminal Commands</h2>
            
            <div class="grid grid-cols-[1fr_2fr] gap-y-4 gap-x-6 mono text-[11px] md:text-sm text-zinc-300">
                <div class="text-right text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded">Cmd/Ctrl + K</div>
                <div class="flex items-center">Open Imperial Archives Search</div>
                
                <div class="text-right text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded">Spacebar</div>
                <div class="flex items-center">Play / Pause Timeline</div>
                
                <div class="text-right text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded">H</div>
                <div class="flex items-center">Toggle HUD (Zen Mode)</div>
                
                <div class="text-right text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded">P</div>
                <div class="flex items-center">Export Cartography (PNG)</div>
                
                <div class="text-right text-amber-600 font-bold bg-amber-500/10 px-2 py-1 rounded">Shift + ?</div>
                <div class="flex items-center">Toggle this menu</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function toggleShortcuts() {
    const modal = document.getElementById('shortcuts-modal');
    const box = document.getElementById('shortcuts-box');
    if (modal.classList.contains('opacity-0')) {
        modal.classList.remove('opacity-0', 'invisible');
        box.classList.remove('scale-95');
        box.classList.add('scale-100');
    } else {
        modal.classList.add('opacity-0', 'invisible');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
    }
}

function exportCartography() {
    const srcCanvas = document.getElementById('canvas');
    if (!srcCanvas) return;

    // Create an off-screen canvas to composite the watermark
    const destCanvas = document.createElement('canvas');
    destCanvas.width = srcCanvas.width;
    destCanvas.height = srcCanvas.height;
    const ctx = destCanvas.getContext('2d');

    // 1. Draw the current WebGL/2D map
    ctx.drawImage(srcCanvas, 0, 0);

    // 2. Overlay the UI Watermark
    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)'; // Amber
    ctx.font = 'bold 18px "JetBrains Mono"';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    
    const yearText = `DATE: ${Math.floor(AppState.imperialYear)} AG`;
    ctx.fillText('IMPERIAL CARTOGRAPHY ARCHIVE // ARRAKIS', destCanvas.width - 30, destCanvas.height - 50);
    ctx.fillStyle = 'rgba(212, 212, 216, 0.7)'; // Zinc
    ctx.font = '14px "JetBrains Mono"';
    ctx.fillText(yearText, destCanvas.width - 30, destCanvas.height - 30);

    // 3. Trigger Download
    const link = document.createElement('a');
    link.download = `Arrakis_Telemetry_${Math.floor(AppState.imperialYear)}AG.png`;
    link.href = destCanvas.toDataURL('image/png');
    link.click();
}
