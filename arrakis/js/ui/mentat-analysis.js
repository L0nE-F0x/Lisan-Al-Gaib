import { DATA } from '../data/arrakis-lore.js';
import { playUI } from '../core/audio.js';

let isActive = false;
let canvas, ctx;
let width, height;
let nodes = [], links = [];
let animationFrameId;
let draggedNode = null;
let hoveredNode = null;
let mouse = { x: 0, y: 0 };

export function initMentatUI() {
    // Prevent duplicate overlays if initialized multiple times
    if (document.getElementById('mentat-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mentat-overlay';
    overlay.className = 'fixed inset-0 z-[150] bg-cyan-950/95 backdrop-blur-2xl hidden flex-col opacity-0 transition-opacity duration-500 pointer-events-none';
    
    overlay.innerHTML = `
        <div class="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 border-b border-cyan-500/30 bg-black/50 pointer-events-auto">
            <div class="flex items-center gap-4">
                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                <div>
                    <div class="text-cyan-400 font-bold tracking-[0.3em] text-sm md:text-base">MENTAT COMPUTATION MATRIX</div>
                    <div class="text-cyan-600/60 mono text-[8px] md:text-[10px] uppercase tracking-widest">Cognitive Relationship Mapping Active</div>
                </div>
            </div>
            <button onclick="window.closeMentatWeb()" class="text-cyan-500 hover:text-white px-4 py-2 text-xs mono tracking-widest bg-cyan-900/30 border border-cyan-800 rounded-sm transition-colors hover:bg-cyan-800/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                TERMINATE
            </button>
        </div>
        <div class="flex-1 relative pointer-events-auto overflow-hidden w-full h-full" id="mentat-canvas-container">
            <canvas id="mentat-canvas" class="absolute inset-0 cursor-crosshair block"></canvas>
            
            <div id="mentat-tooltip" class="absolute pointer-events-none opacity-0 transition-opacity bg-black/90 border border-cyan-500/50 p-3 rounded-sm shadow-lg max-w-xs z-10 transform -translate-x-1/2 mt-4">
                <div id="mt-title" class="text-cyan-400 font-bold text-sm tracking-wide"></div>
                <div id="mt-sub" class="text-cyan-600/80 mono text-[9px] uppercase tracking-widest mb-2 border-b border-cyan-900 pb-1"></div>
                <div id="mt-desc" class="text-zinc-300 text-xs leading-relaxed"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    window.openMentatWeb = openMentatWeb;
    window.closeMentatWeb = closeMentatWeb;
}

function buildGraphData() {
    nodes = [];
    links = [];
    const nodeMap = new Map();

    const addNode = (id, label, type, color, desc) => {
        if (!id || nodeMap.has(id)) return; 
        
        // Guarantee safe starting coordinates
        const startX = (width / 2) + (Math.random() - 0.5) * 300;
        const startY = (height / 2) + (Math.random() - 0.5) * 300;

        const node = { 
            id: String(id), 
            label: String(label || 'UNKNOWN'), 
            type: String(type || 'entity'), 
            color: String(color || '#22d3ee'), 
            desc: String(desc || 'Classified Record'),
            x: startX || 500, 
            y: startY || 500,
            vx: 0, 
            vy: 0,
            radius: type === 'faction' ? 25 : type === 'character' ? 15 : 10
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
    };

    if (DATA.factions) {
        Object.keys(DATA.factions).forEach(faction => {
            if (faction && faction !== 'None') {
                addNode(faction, faction, 'faction', DATA.factions[faction], `Major Political Entity`);
            }
        });
    }

    if (DATA.characters && Array.isArray(DATA.characters)) {
        DATA.characters.forEach(c => {
            if (!c.id) return;
            addNode(c.id, c.name, 'character', c.color, c.fact);
            
            if (c.house && c.house !== 'None') {
                addNode(c.house, c.house, 'faction', DATA.factions[c.house] || '#ffffff', 'Major Political Entity');
                links.push({ source: String(c.id), target: String(c.house), type: 'allegiance' });
            }

            if (c.relationships && Array.isArray(c.relationships)) {
                c.relationships.forEach(rel => {
                    const targetChar = DATA.characters.find(char => String(char.id) === String(rel.id));
                    if (targetChar) {
                        addNode(targetChar.id, targetChar.name, 'character', targetChar.color, targetChar.fact);
                        const exists = links.some(l => (l.source === String(c.id) && l.target === String(rel.id)) || (l.source === String(rel.id) && l.target === String(c.id)));
                        if (!exists) links.push({ source: String(c.id), target: String(rel.id), type: String(rel.type) });
                    }
                });
            }
        });
    }

    links.forEach(link => {
        link.sourceNode = nodeMap.get(link.source);
        link.targetNode = nodeMap.get(link.target);
    });

    links = links.filter(l => l.sourceNode && l.targetNode);
}

function openMentatWeb() {
    if (isActive) return;
    playUI('whir');
    isActive = true;
    
    const overlay = document.getElementById('mentat-overlay');
    overlay.classList.remove('hidden');
    void overlay.offsetWidth; // Force CSS flush
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    
    canvas = document.getElementById('mentat-canvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupInteraction();
    buildGraphData();

    // Ensure no overlapping loops
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    startSimulation();
}

function closeMentatWeb() {
    if (!isActive) return;
    playUI('minimize');
    isActive = false;
    
    const overlay = document.getElementById('mentat-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', resizeCanvas);
    
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 500);
}

function resizeCanvas() {
    // IRONCLAD DIMENSIONS: Force a fallback if browser reports 0
    const container = document.getElementById('mentat-canvas-container');
    width = container?.clientWidth || window.innerWidth || 1024;
    height = container?.clientHeight || window.innerHeight || 768;
    
    if (canvas) {
        canvas.width = width;
        canvas.height = height;
    }
}

function setupInteraction() {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;

        if (draggedNode) {
            draggedNode.x = mouse.x;
            draggedNode.y = mouse.y;
            draggedNode.vx = 0;
            draggedNode.vy = 0;
        } else {
            hoveredNode = null;
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                const dist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
                if (dist < n.radius + 15) { 
                    hoveredNode = n;
                    break;
                }
            }
            updateTooltip();
        }
    });

    canvas.addEventListener('mousedown', () => {
        if (hoveredNode) draggedNode = hoveredNode;
    });

    canvas.addEventListener('mouseup', () => { draggedNode = null; });
    canvas.addEventListener('mouseleave', () => { draggedNode = null; hoveredNode = null; updateTooltip(); });
}

function updateTooltip() {
    const tt = document.getElementById('mentat-tooltip');
    if (hoveredNode) {
        document.getElementById('mt-title').innerText = String(hoveredNode.label).toUpperCase();
        document.getElementById('mt-sub').innerText = String(hoveredNode.type).toUpperCase();
        document.getElementById('mt-desc').innerText = String(hoveredNode.desc);
        tt.style.left = `${hoveredNode.x}px`;
        tt.style.top = `${hoveredNode.y + hoveredNode.radius}px`;
        tt.classList.remove('opacity-0');
    } else {
        tt.classList.add('opacity-0');
    }
}

function applyPhysics() {
    if (nodes.length === 0) return;

    const k = 0.03; 
    const repulsion = 6000; 
    const damping = 0.85; 
    const MAX_VELOCITY = 15; 

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            let dx = n1.x - n2.x;
            let dy = n1.y - n2.y;
            
            let distSq = dx * dx + dy * dy;
            
            // NaN Blocker
            if (distSq < 10) { 
                distSq = 10;
                dx = (Math.random() - 0.5) * 5;
                dy = (Math.random() - 0.5) * 5;
            }
            
            const force = repulsion / distSq;
            const dist = Math.sqrt(distSq);
            
            let fx = (dx / dist) * force;
            let fy = (dy / dist) * force;

            n1.vx += isNaN(fx) ? 0 : fx; 
            n1.vy += isNaN(fy) ? 0 : fy;
            n2.vx -= isNaN(fx) ? 0 : fx; 
            n2.vy -= isNaN(fy) ? 0 : fy;
        }
    }

    // Attraction
    links.forEach(link => {
        let dx = link.targetNode.x - link.sourceNode.x;
        let dy = link.targetNode.y - link.sourceNode.y;
        
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) distSq = 1;

        const dist = Math.sqrt(distSq);
        const targetDist = link.type === 'allegiance' ? 120 : 180;
        const force = (dist - targetDist) * k;

        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;

        link.sourceNode.vx += isNaN(fx) ? 0 : fx; 
        link.sourceNode.vy += isNaN(fy) ? 0 : fy;
        link.targetNode.vx -= isNaN(fx) ? 0 : fx; 
        link.targetNode.vy -= isNaN(fy) ? 0 : fy;
    });

    // Center Gravity & Clamping
    nodes.forEach(n => {
        const dx = (width / 2) - n.x;
        const dy = (height / 2) - n.y;
        n.vx += dx * 0.004;
        n.vy += dy * 0.004;

        if (n !== draggedNode) {
            n.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, isNaN(n.vx) ? 0 : n.vx));
            n.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, isNaN(n.vy) ? 0 : n.vy));

            n.vx *= damping;
            n.vy *= damping;
            n.x += n.vx;
            n.y += n.vy;

            // Failsafe reset
            if (isNaN(n.x) || isNaN(n.y)) {
                n.x = width / 2;
                n.y = height / 2;
            }

            const padding = n.radius + 15;
            if (n.x < padding) { n.x = padding; n.vx *= -1; }
            if (n.x > width - padding) { n.x = width - padding; n.vx *= -1; }
            if (n.y < padding) { n.y = padding; n.vy *= -1; }
            if (n.y > height - padding) { n.y = height - padding; n.vy *= -1; }
        }
    });
}

function startSimulation() {
    if (!isActive) return;
    
    // Canvas safety check
    if (!ctx || !width || !height) {
        animationFrameId = requestAnimationFrame(startSimulation);
        return;
    }

    applyPhysics();

    // Clear background
    ctx.fillStyle = 'rgba(8, 51, 68, 0.5)'; 
    ctx.fillRect(0, 0, width, height);

    // ==========================================
    // DIAGNOSTIC RADAR (PROVES CANVAS IS ALIVE)
    // ==========================================
    const pulse = Math.abs(Math.sin(Date.now() / 600));
    ctx.strokeStyle = `rgba(34, 211, 238, ${pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width/2, height/2, 100 + (pulse * 20), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SYSTEM DIAGNOSTICS: RUNNING`, 20, 30);
    ctx.fillText(`NODES DETECTED: ${nodes.length}`, 20, 50);
    ctx.fillText(`LINKS DETECTED: ${links.length}`, 20, 70);

    if (nodes.length === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRITICAL WARNING: LORE DATA ARRAY IS EMPTY', width/2, height/2);
    }
    // ==========================================

    links.forEach(link => {
        const isHovered = hoveredNode && (hoveredNode === link.sourceNode || hoveredNode === link.targetNode);
        
        ctx.beginPath();
        ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
        ctx.lineTo(link.targetNode.x, link.targetNode.y);
        
        if (isHovered) {
            ctx.strokeStyle = link.type === 'rivalry' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 211, 238, 0.9)';
            ctx.lineWidth = 2.5;
        } else {
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();
    });

    nodes.forEach(n => {
        const isHovered = n === hoveredNode;
        const isLinkedToHover = hoveredNode && links.some(l => 
            (l.sourceNode === hoveredNode && l.targetNode === n) || 
            (l.targetNode === hoveredNode && l.sourceNode === n)
        );

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        
        if (isHovered || isLinkedToHover) {
            ctx.shadowColor = n.color || '#fff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
        } else {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = n.color || '#fff';
            ctx.lineWidth = 1.5;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fill();
        ctx.stroke();

        if (n.type === 'faction' || isHovered || isLinkedToHover) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = isHovered ? '#fff' : (n.color || '#fff');
            ctx.font = isHovered ? 'bold 12px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(n.label).toUpperCase(), n.x, n.y + n.radius + 14);
        }
    });

    animationFrameId = requestAnimationFrame(startSimulation);
}
