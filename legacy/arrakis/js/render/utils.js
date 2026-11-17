import { DATA } from '../data/arrakis-lore.js';

export function pointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function getSphericalCoords(lon, lat, r, rotation) {
    const phi = (lon - 0.5) * Math.PI * 2 + rotation;
    const theta = (lat - 0.5) * Math.PI; 
    const tilt = 0.2; 
    
    const x3d = r * Math.cos(theta) * Math.sin(phi);
    const y3d = r * Math.sin(theta);
    const z3d = r * Math.cos(theta) * Math.cos(phi);
    
    const yRot = y3d * Math.cos(tilt) - z3d * Math.sin(tilt);
    const zRot = y3d * Math.sin(tilt) + z3d * Math.cos(tilt);
    
    return { x: x3d, y: yRot, z: zRot };
}

export function getCharacterLocation(char, year) {
    const currentEra = DATA.eras.find(e => year >= e.start && year < e.end);
    let presence = null;
    
    if (currentEra && char.eraPresence) {
        presence = char.eraPresence.find(ep => ep.era === currentEra.id);
    }
    
    if (!presence && char.eraPresence && char.eraPresence.length > 0) {
        presence = char.eraPresence[0];
    }

    if (presence) return DATA.locations.find(l => l.id === presence.location);
    else if (char.locations && char.locations.length > 0) return DATA.locations.find(l => l.id === char.locations[0]);
    
    return null;
}

// ==========================================
// NEW: CAMERA BLENDING HELPERS
// ==========================================
export function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

export function getFadeOpacity(scale, minScale, maxScale) {
    if (scale <= minScale) return 0;
    if (scale >= maxScale) return 1;
    return (scale - minScale) / (maxScale - minScale);
}

export function getFadeOutOpacity(scale, minScale, maxScale) {
    if (scale <= minScale) return 1;
    if (scale >= maxScale) return 0;
    return 1 - ((scale - minScale) / (maxScale - minScale));
}
