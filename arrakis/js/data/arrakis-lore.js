// ==========================================
// CONFIGURATION & MULTI-SCALE DATA MODEL
// ==========================================

export const CONFIG = {
    orbitScale: 0.9,
    zoomLevels: {
        system: { min: 0.08, max: 0.4 },
        planet: { min: 0.5, max: 2.0 },
        // BUG FIX: Was 8.0 but 3D transition triggers at 7.5, creating a dead zone.
        // Aligned to match the transition threshold.
        region: { min: 2.5, max: 7.5 }
    },
    zoomThresholds: {
        systemToPlanet: 0.45,
        planetToRegion: 2.2
    }
};

export const DATA = {
    star: {
        // LORE FIX: Canopus is an A9 II bright giant, not an F-type supergiant.
        name: "Canopus", type: "A9 II Bright Giant", color: "#fcd34d", size: 45, luminosity: "14,800 × Sol",
        fact: "One of the brightest stars visible from Old Earth. Its intense radiation shapes Arrakis's brutal climate and marks the navigational heart of the Imperium."
    },
    
    bodies: [
        { name: "Canopus I", type: "rocky", color: "#b45309", orbitRadius: 55, speed: 2.5, size: 8, eccentricity: 0.02, fact: "Scorched inner planet. Surface temperature exceeds 800°C on the sun-facing hemisphere." },
        { name: "Canopus II", type: "rocky", color: "#92400e", orbitRadius: 100, speed: 1.8, size: 12, eccentricity: 0.05, fact: "Barren world with automated mining rigs extracting rare metals. No permanent human population." },
        {
            name: "Arrakis", type: "desert", color: "#d97706", orbitRadius: 180, speed: 0.8, size: 22, eccentricity: 0.04,
            fact: "Third planet of Canopus. The most important planet in the known universe — sole source of the spice melange.",
            atmosphere: { type: "Arid Atmosphere", composition: "N₂ 75%, O₂ 22%, CO₂ 2%, Trace melange particulate", pressure: "0.93 atm", avgTemp: "62°C surface avg", weather: "Coriolis storms (up to 700 kph), static discharges, sand tides" },
            moons: ["First Moon", "Second Moon"], hasSpice: true, hasWorms: true
        },
        {
            name: "Canopus IV", type: "gas_giant", color: "#fbbf24", orbitRadius: 300, speed: 0.4, size: 35, eccentricity: 0.01,
            fact: "Massive gas giant that shields Arrakis from much of the system's cometary debris.",
            atmosphere: { type: "Gas Giant", composition: "H₂ 89%, He 10%, CH₄ trace", pressure: "N/A", avgTemp: "-145°C cloud tops" }
        }
    ],
    
    moons: [
        // LORE NOTE: Herbert never gives the moons proper names. "Krelln" and "Arvon" are
        // common fan-encyclopedia names. The second moon bears the constellation the Fremen
        // call "Muad'Dib" — the desert mouse — from which Paul takes his name.
        { name: "Krelln", parent: "Arrakis", color: "#e2e8f0", orbitRadius: 32, speed: 12, size: 4.5, fact: "Arrakis's larger first moon. Its phases govern the Fremen calendar and are used to time desert crossings." },
        { name: "Arvon", parent: "Arrakis", color: "#cbd5e1", orbitRadius: 50, speed: 8, size: 3, fact: "The smaller second moon. The Fremen associate its shape with the constellation of Muad'Dib — the desert mouse. Paul Atreides takes his Fremen name from this moon." }
    ],
    
    asteroidBelt: { innerRadius: 230, outerRadius: 260, count: 120, color: "#78716c", fact: "A sparse belt of metallic debris between Arrakis and Canopus IV." },
    
    regions: [
        { id: "northern_desert", name: "The Great Flat", x: 0.5, y: 0.15, color: "#d97706", desc: "Vast open desert. Primary spice harvesting territory.", dangerLevel: "Extreme" },
        { id: "shield_wall", name: "Shield Wall", x: 0.5, y: 0.25, color: "#a16207", desc: "A massive circular mountain range that protects the northern sink.", dangerLevel: "Moderate" },
        { id: "imperial_basin", name: "Imperial Basin", x: 0.52, y: 0.22, color: "#ca8a04", desc: "The basin north of the Shield Wall containing Arrakeen and Carthag.", dangerLevel: "Low (urban)" },
        { id: "false_wall_south", name: "False Wall South", x: 0.45, y: 0.35, color: "#b45309", desc: "Secondary mountain range. Many hidden Fremen sietches.", dangerLevel: "Moderate" },
        { id: "deep_south", name: "The Palmaries of the South", x: 0.1, y: 0.85, color: "#92400e", desc: "The deep southern latitudes. Secret ecological transformation efforts.", dangerLevel: "Lethal" },
        { id: "polar_regions", name: "Polar Sink", x: 0.5, y: 0.05, color: "#78716c", desc: "Trace moisture collects here. Small ice cap hidden beneath sand.", dangerLevel: "Low" },
        { id: "funeral_plain", name: "Funeral Plain", x: 0.85, y: 0.6, color: "#a16207", desc: "Named for the many who have perished crossing it.", dangerLevel: "Extreme" },
        { id: "habbanya_ridge", name: "Habbanya Ridge", x: 0.65, y: 0.3, color: "#b45309", desc: "Rocky ridge formation. Site of key Fremen ambushes.", dangerLevel: "High" },
        { id: "minor_erg", name: "The Minor Erg", x: 0.3, y: 0.3, color: "#d97706", desc: "A smaller sea of sand dunes west of the Shield Wall.", dangerLevel: "High" },
        { id: "broken_land", name: "The Broken Land", x: 0.75, y: 0.5, color: "#78716c", desc: "A jagged, treacherous expanse of sharp rock outcroppings.", dangerLevel: "High" }
    ],
    
    locations: [
        {
            id: "arrakeen", name: "Arrakeen", region: "imperial_basin", x: 0.5, y: 0.25, type: "city", icon: "🏛️", color: "#f59e0b", faction: "Atreides",
            factionHistory: [ { year: -500, faction: "None" }, { year: 8800, faction: "Imperial" }, { year: 10110, faction: "Harkonnen" }, { year: 10191, faction: "Atreides" }, { year: 10191.5, faction: "Harkonnen" }, { year: 10196, faction: "Fremen" }, { year: 10220, faction: "God Emperor" }, { year: 15220, faction: "None" } ],
            population: "~200,000 (Corrino era)", desc: "Capital city of Arrakis. Built against the Shield Wall.",
            lore: "When Duke Leto Atreides arrived, he noted the city's defenses were deliberately weakened by the Harkonnens.",
            characters: ["Paul Atreides", "Duke Leto", "Lady Jessica", "Dr. Yueh", "Gurney Halleck", "Miles Teg"], events: ["Foundations of Arrakeen", "Fall of House Atreides", "Battle of Arrakeen", "Destruction of Rakis"],
            localMap: {
                cityRadius: 0.08, 
                buildings: [
                    { id: "arrakeen_residency", name: "The Arrakeen Residency", type: "headquarters", icon: "🏰", faction: "Atreides", desc: "The sprawling central fortress of Arrakeen.", population: "Staff & Guard: ~2,500", height: 1.4, color: "#1e293b", roofColor: "#334155", points: [{x: -0.3, y: -0.3}, {x: 0.3, y: -0.4}, {x: 0.5, y: 0.2}, {x: 0.0, y: 0.5}, {x: -0.5, y: 0.2}] },
                    { id: "spaceport_alpha", name: "Spaceport Alpha", type: "logistics", icon: "🚀", faction: "Imperial", desc: "The primary planetary spaceport.", population: "Transient", height: 0.15, color: "#27272a", roofColor: "#3f3f46", points: [{x: 0.8, y: -1.2}, {x: 1.8, y: -1.2}, {x: 1.8, y: -0.5}, {x: 0.8, y: -0.5}] },
                    { id: "landing_pad_1", name: "Landing Pad 1", type: "transport", icon: "🛸", faction: "Atreides", desc: "High-clearance landing pad.", height: 0.2, color: "#18181b", roofColor: "#27272a", points: [{x: 1.0, y: -1.0}, {x: 1.2, y: -1.0}, {x: 1.2, y: -0.7}, {x: 1.0, y: -0.7}] },
                    { id: "shield_wall_perimeter", name: "Shield Wall Perimeter", type: "defense", icon: "🧱", faction: "None", desc: "The immense, natural rock formation protecting Arrakeen.", height: 3.0, color: "#451a03", roofColor: "#78350f", points: [{x: -3.5, y: 1.8}, {x: 3.5, y: 1.8}, {x: 3.5, y: 2.8}, {x: -3.5, y: 2.8}] },
                    { id: "atreides_garrison", name: "Military Garrison", type: "military", icon: "⚔️", faction: "Atreides", desc: "Housing the Duke's elite fighting force.", population: "Troops: ~15,000", height: 0.7, color: "#1c1917", roofColor: "#292524", points: [{x: -1.2, y: -0.8}, {x: -0.6, y: -0.8}, {x: -0.6, y: -0.2}, {x: -1.2, y: -0.2}] },
                    { id: "spice_silos", name: "Spice Silo Array", type: "resource", icon: "🏭", faction: "Harkonnen", desc: "Massive storage towers holding metric tons of melange.", height: 1.1, color: "#713f12", roofColor: "#a16207", points: [{x: 0.8, y: 0.4}, {x: 1.3, y: 0.4}, {x: 1.3, y: 0.9}, {x: 0.8, y: 0.9}] }
                ]
            }
        },
        {
            id: "carthag", name: "Carthag", region: "imperial_basin", x: 0.55, y: 0.22, type: "city", icon: "🏭", color: "#dc2626", faction: "Harkonnen",
            factionHistory: [ { year: 8000, faction: "Imperial" }, { year: 10110, faction: "Harkonnen" }, { year: 10196, faction: "Fremen" } ],
            population: "~150,000", desc: "Harkonnen administrative capital. Deliberately ugly and brutalist.",
            characters: ["Glossu Rabban", "Baron Harkonnen"], events: ["Harkonnen Siridar-Fief", "Rabban's Ascendancy"],
            localMap: {
                cityRadius: 0.07,
                buildings: [
                    { id: "carthag_citadel", name: "Harkonnen Citadel", type: "headquarters", icon: "🏰", faction: "Harkonnen", desc: "A terrifying, blocky monolith dominating the city skyline.", population: "Elite Guard: ~5,000", height: 2.2, color: "#7f1d1d", roofColor: "#991b1b", points: [{x: -0.4, y: -0.4}, {x: 0.4, y: -0.4}, {x: 0.4, y: 0.4}, {x: -0.4, y: 0.4}] },
                    { id: "slave_pits", name: "The Slave Pits", type: "prison", icon: "⛓️", faction: "Harkonnen", desc: "Subterranean holding cells for indentured labor.", population: "Slaves: ~30,000", height: 0.05, color: "#1c1917", roofColor: "#292524", points: [{x: 0.6, y: -0.6}, {x: 1.5, y: -0.6}, {x: 1.5, y: 0.2}, {x: 0.6, y: 0.2}] },
                    { id: "gladiator_arena", name: "Gladiator Arena", type: "entertainment", icon: "⚔️", faction: "Harkonnen", desc: "Fighting arena for Harkonnen sport.", population: "Spectators", height: 0.6, color: "#3f3f46", roofColor: "#52525b", points: [{x: -0.5, y: 0.8}, {x: 0.5, y: 0.8}, {x: 0.3, y: 1.4}, {x: -0.3, y: 1.4}] }
                ]
            }
        },
        {
            id: "sietch_tabr", name: "Sietch Tabr", region: "false_wall_south", x: 0.42, y: 0.35, type: "sietch", icon: "⛰️", color: "#d97706", faction: "Fremen",
            // LORE FIX: Removed the { year: 1400, faction: "Bene Gesserit" } entry.
            // The Missionaria Protectiva planted myths but never controlled the sietch.
            factionHistory: [ { year: -500, faction: "Fremen" }, { year: 7193, faction: "Fremen" }, { year: 10220, faction: "God Emperor" }, { year: 15220, faction: "None" } ],
            population: "~10,000 (hidden)", desc: "The largest and most important Fremen sietch. Home to Naib Stilgar.", characters: ["Stilgar", "Paul Atreides", "Chani", "Lady Jessica", "Jamis"], events: ["Excavation of Sietch Tabr", "Paul Joins the Fremen", "Birth of the Twins"]
        },
        {
            id: "keep_of_leto", name: "The Citadel of Leto II", region: "imperial_basin", x: 0.51, y: 0.26, type: "installation", icon: "🏰", color: "#eab308", faction: "God Emperor",
            factionHistory: [ { year: 10220, faction: "God Emperor" }, { year: 15220, faction: "None" } ],
            population: "~50,000 Fish Speakers", desc: "The massive fortress built by the God Emperor over the ruins of Arrakeen.", characters: ["Leto II", "Moneo", "Siona", "Duncan Idaho"], events: ["The Durbok Rebellion"]
        },
        {
            id: "rakis_temple", name: "Rakis Priesthood Temple", region: "imperial_basin", x: 0.53, y: 0.23, type: "sacred", icon: "🏛️", color: "#eab308", faction: "God Emperor",
            factionHistory: [ { year: 10220, faction: "God Emperor" }, { year: 15220, faction: "Bene Gesserit" }, { year: 15290, faction: "None" } ],
            population: "~5,000 Priests", desc: "The seat of the Divided God's priesthood after Leto's death.", characters: ["Sheeana", "Darwi Odrade"], events: ["Discovery of Sheeana"]
        },
        {
            id: "jacurutu", name: "Jacurutu / Fondak", region: "funeral_plain", x: 0.85, y: 0.58, type: "sietch", icon: "☠️", color: "#dc2626", faction: "Smugglers",
            factionHistory: [ { year: -200, faction: "Fremen" }, { year: 8000, faction: "None" }, { year: 10215, faction: "Smugglers" } ],
            population: "Unknown", desc: "The mythical 'Sietch of the Castouts'. Condemned by Fremen law for water-stealing, it was supposedly destroyed — but secretly survived.", characters: ["Leto II", "Gurney Halleck"], events: ["Leto's Transformation"]
        },
        { id: "tueks_sietch", name: "Tuek's Sietch", region: "minor_erg", x: 0.3, y: 0.35, type: "sietch", icon: "🛡️", color: "#64748b", faction: "Smugglers", factionHistory: [ { year: 5500, faction: "Smugglers" }, { year: 10220, faction: "God Emperor" } ], population: "~2,000", desc: "A major smuggler stronghold run by Esmar Tuek and later his son Staban." },
        { id: "wind_trap_ridges", name: "Wind Trap Ridges", region: "shield_wall", x: 0.48, y: 0.28, type: "installation", icon: "💨", color: "#0ea5e9", faction: "Fremen", desc: "Networks of moisture-catching devices. The heart of the Fremen terraforming dream.", factionHistory: [ { year: -500, faction: "None" }, { year: 7000, faction: "Fremen" }, { year: 10220, faction: "God Emperor" } ] },
        { id: "observatory", name: "Imperial Ecological Testing Station", region: "shield_wall", x: 0.45, y: 0.25, type: "installation", icon: "🔭", color: "#94a3b8", faction: "Corrino", desc: "The official cover for the Planetary Ecologist's work. Pardot Kynes and later Liet-Kynes operated from here.", factionHistory: [ { year: 8800, faction: "Corrino" }, { year: 10140, faction: "Imperial" }, { year: 10191, faction: "Atreides" }, { year: 10196, faction: "Fremen" } ] },
        { id: "spice_fields", name: "The Great Spice Fields", region: "northern_desert", x: 0.55, y: 0.15, type: "resource", icon: "✨", color: "#f59e0b", faction: "None", desc: "The primary spice harvesting grounds. Crawler operations here are under constant threat from Shai-Hulud.", factionHistory: [ { year: 0, faction: "Imperial" }, { year: 10110, faction: "Harkonnen" }, { year: 10191, faction: "Atreides" }, { year: 10196, faction: "Fremen" } ] },
        { id: "cave_of_ridges", name: "Cave of Ridges", region: "false_wall_south", x: 0.48, y: 0.38, type: "sacred", icon: "🕯️", color: "#d946ef", faction: "Fremen", desc: "A sacred Fremen site used for the spice orgies and the Water of Life ceremonies.", factionHistory: [ { year: -500, faction: "Fremen" }, { year: 10196, faction: "Fremen" }, { year: 10220, faction: "God Emperor" } ] },
        { id: "dar_es_balat", name: "Dar-es-Balat", region: "imperial_basin", x: 0.51, y: 0.27, type: "sacred", icon: "📜", color: "#eab308", faction: "God Emperor", desc: "The hidden repository of Leto II's journals — his secret record of prescient visions spanning millennia.", factionHistory: [ { year: 10220, faction: "God Emperor" }, { year: 15220, faction: "None" } ] },
        
        // BUG FIX: These locations were referenced by events but didn't exist.
        // Cave of Birds — where Paul duels Jamis and earns his place among the Fremen.
        { id: "cave_of_birds", name: "Cave of Birds", region: "false_wall_south", x: 0.44, y: 0.33, type: "sacred", icon: "🦅", color: "#d97706", faction: "Fremen", desc: "A natural cavern in the False Wall South, named for the desert hawks that nest in its upper reaches. Paul Atreides fought his first Fremen death-duel here against Jamis.", factionHistory: [ { year: -500, faction: "Fremen" } ] },
        
        // Habbanya Erg — the great sand sea where Paul rides his first worm.
        { id: "habbanya_erg", name: "Habbanya Erg", region: "habbanya_ridge", x: 0.62, y: 0.32, type: "resource", icon: "🐛", color: "#f59e0b", faction: "Fremen", desc: "A vast sand sea east of the Habbanya Ridge. Here Paul Muad'Dib summoned and rode Shai-Hulud for the first time, completing his acceptance as a Fremen warrior.", factionHistory: [ { year: -500, faction: "Fremen" } ] }
    ],
    
    characters: [
        { 
            id: "paul", name: "Paul Atreides", aliases: "Muad'Dib, Usul, The Preacher", color: "#f59e0b", origin: "Caladan", house: "Atreides", locations: ["arrakeen", "sietch_tabr", "cave_of_ridges", "cave_of_birds", "habbanya_erg"], eraPresence: [{ era: "corrino", location: "arrakeen" }, { era: "desert_war", location: "sietch_tabr" }, { era: "muaddib", location: "arrakeen" }], fact: "The Kwisatz Haderach. Born Duke's son, became desert messiah, then blind prophet.", quote: "I must not fear. Fear is the mind-killer.",
            relationships: [{id: "leto", type: "family"}, {id: "jessica", type: "family"}, {id: "chani", type: "romance"}, {id: "stilgar", type: "allegiance"}, {id: "baron", type: "rivalry"}, {id: "alia", type: "family"}, {id: "gurney", type: "mentorship"}, {id: "jamis", type: "rivalry"}]
        },
        { 
            id: "leto", name: "Duke Leto Atreides", aliases: "The Red Duke", color: "#0284c7", origin: "Caladan", house: "Atreides", locations: ["arrakeen", "spice_fields"], eraPresence: [{ era: "corrino", location: "arrakeen" }], fact: "A beloved and just ruler who walked knowingly into the Harkonnen trap.", quote: "Here I am; here I remain.",
            relationships: [{id: "paul", type: "family"}, {id: "jessica", type: "romance"}, {id: "gurney", type: "mentorship"}, {id: "baron", type: "rivalry"}, {id: "yueh", type: "betrayal"}]
        },
        { 
            id: "jessica", name: "Lady Jessica", aliases: "Reverend Mother Jessica", color: "#d946ef", origin: "Wallach IX", house: "Bene Gesserit", locations: ["arrakeen", "sietch_tabr"], eraPresence: [{ era: "corrino", location: "arrakeen" }, { era: "desert_war", location: "sietch_tabr" }], fact: "Bene Gesserit who defied her order by bearing a son instead of a daughter for Duke Leto.", quote: "I must not fear. Fear is the mind-killer.",
            relationships: [{id: "paul", type: "family"}, {id: "leto", type: "romance"}, {id: "alia", type: "family"}, {id: "stilgar", type: "allegiance"}]
        },
        { 
            id: "chani", name: "Chani Kynes", aliases: "Sihaya", color: "#22c55e", origin: "Arrakis", house: "Fremen", locations: ["sietch_tabr", "cave_of_ridges"], eraPresence: [{ era: "desert_war", location: "sietch_tabr" }, { era: "muaddib", location: "sietch_tabr" }], fact: "Daughter of Liet-Kynes, beloved of Paul, mother of Leto II and Ghanima.", quote: "Tell me of your homeworld, Usul.",
            relationships: [{id: "paul", type: "romance"}, {id: "stilgar", type: "family"}, {id: "alia", type: "family"}]
        },
        { 
            id: "stilgar", name: "Stilgar", aliases: "Naib of Sietch Tabr", color: "#d97706", origin: "Arrakis", house: "Fremen", locations: ["sietch_tabr"], eraPresence: [{ era: "desert_war", location: "sietch_tabr" }, { era: "muaddib", location: "sietch_tabr" }, { era: "regency", location: "sietch_tabr" }], fact: "Proud Fremen Naib who became Paul's most trusted ally, though disturbed by his growing cult.", quote: "God created Arrakis to train the faithful.",
            relationships: [{id: "paul", type: "allegiance"}, {id: "chani", type: "family"}, {id: "jessica", type: "allegiance"}, {id: "jamis", type: "family"}]
        },
        { 
            id: "baron", name: "Baron Vladimir Harkonnen", aliases: "The Baron", color: "#dc2626", origin: "Giedi Prime", house: "Harkonnen", locations: ["carthag", "arrakeen"], eraPresence: [{ era: "harkonnen_rule", location: "carthag" }, { era: "corrino", location: "arrakeen" }], fact: "Grotesquely obese and cunning, he orchestrated the downfall of House Atreides through the Padishah Emperor's backing.", quote: "He who controls the spice controls the universe.",
            relationships: [{id: "paul", type: "rivalry"}, {id: "leto", type: "rivalry"}, {id: "rabban", type: "family"}, {id: "yueh", type: "manipulation"}, {id: "alia", type: "rivalry"}]
        },
        { 
            id: "rabban", name: "Glossu 'Beast' Rabban", aliases: "Beast Rabban", color: "#991b1b", origin: "Giedi Prime", house: "Harkonnen", locations: ["carthag"], eraPresence: [{ era: "harkonnen_rule", location: "carthag" }], fact: "The Baron's brutish nephew, placed in command of Arrakis to squeeze the population until they begged for a savior — Feyd-Rautha.", quote: "We'll squeeze them, uncle. We'll squeeze them.",
            relationships: [{id: "baron", type: "family"}]
        },
        { 
            id: "yueh", name: "Wellington Yueh", aliases: "The Traitor", color: "#ef4444", origin: "Unknown", house: "Atreides", locations: ["arrakeen"], eraPresence: [{ era: "corrino", location: "arrakeen" }], fact: "Suk doctor whose Imperial Conditioning was broken by the Baron's torture of his Bene Gesserit wife, Wanna.", quote: "Here is your tooth, Baron. Kiss it.",
            relationships: [{id: "leto", type: "betrayal"}, {id: "baron", type: "manipulation"}]
        },
        { 
            id: "gurney", name: "Gurney Halleck", aliases: "The Warrior Minstrel", color: "#0ea5e9", origin: "Giedi Prime", house: "Atreides", locations: ["arrakeen", "sietch_tabr", "habbanya_erg"], eraPresence: [{ era: "corrino", location: "arrakeen" }, { era: "desert_war", location: "tueks_sietch" }, { era: "muaddib", location: "arrakeen" }], fact: "Warrior-troubadour and weapons master. Survived the Atreides fall by hiding among smugglers.", quote: "My lungs are full and my blade is ready!",
            relationships: [{id: "paul", type: "mentorship"}, {id: "leto", type: "mentorship"}, {id: "jessica", type: "suspicion"}]
        },
        { 
            id: "jamis", name: "Jamis", aliases: "None", color: "#78716c", origin: "Arrakis", house: "Fremen", locations: ["cave_of_birds"], eraPresence: [{ era: "corrino", location: "cave_of_birds" }], fact: "A Fremen warrior who challenged Paul to a death-duel. Paul's first kill, and the moment that sealed his acceptance among the Fremen.", quote: "May thy knife chip and shatter.",
            relationships: [{id: "paul", type: "rivalry"}, {id: "stilgar", type: "family"}]
        },
        { 
            id: "alia", name: "Alia Atreides", aliases: "St. Alia of the Knife, The Abomination", color: "#a855f7", origin: "Arrakis", house: "Atreides", locations: ["arrakeen", "sietch_tabr"], eraPresence: [{ era: "muaddib", location: "arrakeen" }, { era: "regency", location: "arrakeen" }],
            // LORE FIX: Alia didn't flee Leto II — she chose death over total possession.
            fact: "Pre-born Reverend Mother. As Regent she was slowly consumed by the Baron Harkonnen's persona among her inner lives, becoming the Abomination.",
            quote: "I am a Reverend Mother. I was one before I was born.",
            relationships: [{id: "paul", type: "family"}, {id: "jessica", type: "family"}, {id: "baron", type: "rivalry"}, {id: "duncan", type: "romance"}]
        },
        { 
            id: "duncan", name: "Duncan Idaho", aliases: "The Eternal Swordmaster", color: "#06b6d4", origin: "Giedi Prime", house: "Atreides", locations: ["arrakeen", "keep_of_leto"], eraPresence: [{ era: "corrino", location: "arrakeen" }, { era: "god_emperor", location: "keep_of_leto" }, { era: "scattering", location: "arrakeen" }], fact: "Swordmaster of the Ginaz. Died defending Paul, then resurrected by the Tleilaxu as a ghola countless times across thousands of years.", quote: "There is no escape — we pay for the violence of our ancestors.",
            relationships: [{id: "paul", type: "allegiance"}, {id: "leto_ii", type: "allegiance"}, {id: "alia", type: "romance"}, {id: "siona", type: "romance"}]
        },
        { 
            id: "moneo", name: "Moneo Atreides", aliases: "Majordomo", color: "#6366f1", origin: "Arrakis", house: "Atreides", locations: ["keep_of_leto"], eraPresence: [{ era: "god_emperor", location: "keep_of_leto" }], fact: "Loyal majordomo to the God Emperor. Father of Siona. A man who understood the Tyrant's purpose but feared his methods.", quote: "Lord, I have always done your bidding.",
            relationships: [{id: "leto_ii", type: "allegiance"}, {id: "siona", type: "family"}]
        },
        { 
            id: "leto_ii", name: "Leto II Atreides", aliases: "The God Emperor, The Tyrant, The Worm Who Is God", color: "#eab308", origin: "Arrakis", house: "Atreides", locations: ["sietch_tabr", "jacurutu", "keep_of_leto"], eraPresence: [{ era: "regency", location: "jacurutu" }, { era: "god_emperor", location: "keep_of_leto" }], fact: "Paul's son who merged with sandtrout and ruled for 3,500 years as the God Emperor, enforcing his Golden Path to ensure humanity's survival.", quote: "I am the voice from the outer world. I am the Worm Who Is God.",
            relationships: [{id: "paul", type: "family"}, {id: "moneo", type: "allegiance"}, {id: "siona", type: "rivalry"}, {id: "duncan", type: "allegiance"}]
        },
        { 
            id: "siona", name: "Siona Atreides", aliases: "The Rebel", color: "#3b82f6", origin: "Arrakis", house: "Atreides", locations: ["keep_of_leto", "arrakeen"], eraPresence: [{ era: "god_emperor", location: "keep_of_leto" }], fact: "The first human invisible to prescient vision. She fulfilled Leto II's Golden Path by proving humanity could hide from oracles.", quote: "I am not your breeding stock, Worm!",
            relationships: [{id: "moneo", type: "family"}, {id: "leto_ii", type: "rivalry"}, {id: "duncan", type: "romance"}]
        },
        { 
            id: "odrade", name: "Darwi Odrade", aliases: "Taraza's Successor", color: "#d946ef", origin: "Chapterhouse", house: "Bene Gesserit", locations: ["arrakeen", "dar_es_balat", "rakis_temple"], eraPresence: [{ era: "scattering", location: "dar_es_balat" }], fact: "Mother Superior who guided the Sisterhood through the Honored Matre crisis. An Atreides descendant with the family's dangerous sense of justice.", quote: "We are the Bene Gesserit. We do not hope. We plan.",
            relationships: [{id: "teg", type: "family"}, {id: "sheeana", type: "mentorship"}]
        },
        { 
            // LORE FIX: Teg is Atreides by blood, not Bene Gesserit by house.
            id: "teg", name: "Miles Teg", aliases: "The Bashar", color: "#0284c7", origin: "Lernaeus", house: "Atreides", locations: ["arrakeen"], eraPresence: [{ era: "scattering", location: "arrakeen" }], fact: "Supreme Bashar of the Bene Gesserit military forces. An Atreides descendant and military genius who unlocked superhuman speed abilities after T-probe torture.", quote: "I know the shape of your mind.",
            relationships: [{id: "odrade", type: "family"}, {id: "duncan", type: "mentorship"}]
        },
        { 
            // LORE FIX: Improved Sheeana quote to be closer to Herbert's characterization.
            id: "sheeana", name: "Sheeana Brugh", aliases: "Worm Rider", color: "#f59e0b", origin: "Rakis", house: "None", locations: ["rakis_temple", "dar_es_balat"], eraPresence: [{ era: "scattering", location: "rakis_temple" }], fact: "A Rakian orphan who could command the great sandworms. The Bene Gesserit recognized her as a fulfillment of Leto II's oldest prophecy.", quote: "I was never afraid of them. They came to me.",
            relationships: [{id: "odrade", type: "allegiance"}]
        }
    ],
    
    eras: [
        { id: "pre_history", name: "Zensunni Migration", start: -500, end: 0, desc: "The Zensunni ancestors arrive on Arrakis, driven from planet to planet. They learn to survive the deep desert and become the Fremen." },
        { id: "imperial_fringe", name: "The Imperial Fringe", start: 0, end: 10110, desc: "Following the Guild monopoly, Arrakis becomes the most vital planet in the universe. Various factions attempt to extract spice, but true planetary control remains elusive." },
        { id: "harkonnen_rule", name: "Harkonnen Exploitation", start: 10110, end: 10191, desc: "House Harkonnen is officially granted the siridar-fief of Arrakis. Eight decades of brutal extraction and severe oppression follow." },
        { id: "corrino", name: "The Atreides Arrival", start: 10191, end: 10191.5, desc: "Duke Leto takes the fief. A brief hope crushed by betrayal and Imperial Sardaukar." },
        { id: "desert_war", name: "Desert War", start: 10191.5, end: 10193, desc: "Paul and Jessica survive in the desert. Paul earns his place among the Fremen, takes the name Muad'Dib, and begins the guerrilla campaign." },
        { id: "muaddib", name: "Rise of Muad'Dib", start: 10193, end: 10210, desc: "Paul seizes the Imperial throne. The Jihad sweeps outward across the Known Universe. Arrakis becomes the center of all power." },
        { id: "regency", name: "The Regency", start: 10210, end: 10219, desc: "Paul walks into the desert. Alia rules as Regent. The twins Leto II and Ghanima come of age. Alia falls to Abomination." },
        { id: "god_emperor", name: "God Emperor's Reign", start: 10219, end: 15220, desc: "Leto II transforms Arrakis and himself. The sandworms vanish. The desert blooms and then dies. The Golden Path is enforced for 3,500 years." },
        { id: "scattering", name: "After the Tyrant", start: 15220, end: 15300, desc: "Leto II dies. The sandworms slowly return. Arrakis becomes Rakis. The Honored Matres arrive from the Scattering." }
    ],
    
    events: [
        { year: -500, title: "Zensunni Arrival", location: "deep_south", color: "#d97706", desc: "The Zensunni wanderers arrive on Arrakis, the latest in a long chain of forced migrations. They will become the Fremen." },
        { year: 0, title: "The Guild Monopoly", location: "arrakeen", color: "#9333ea", desc: "The Spacing Guild establishes its monopoly on space travel. Melange becomes the single most important commodity in the universe." },
        { year: 1400, title: "Missionaria Protectiva", location: "sietch_tabr", color: "#d946ef", desc: "Bene Gesserit sisters seed the Panoplia Prophetica among the Fremen, planting the religious myths of the Lisan al Gaib to protect future stranded sisters." },
        { year: 5500, title: "The Smuggler Pacts", location: "tueks_sietch", color: "#64748b", desc: "Off-world smugglers establish hidden bases in the minor ergs, forging alliances with the Fremen and creating a lucrative black market for spice." },
        { year: 7193, title: "Excavation of Sietch Tabr", location: "sietch_tabr", color: "#d97706", desc: "The geological formations of the False Wall South are excavated, formally establishing the massive stronghold that will eventually house Naib Stilgar." },
        { year: 8800, title: "Foundations of Arrakeen", location: "arrakeen", color: "#94a3b8", desc: "The original foundations of Arrakeen are laid as a fortified trading post and planetary governance seat, sheltered by the Shield Wall." },
        { year: 10110, title: "Harkonnen Siridar-Fief", location: "carthag", color: "#dc2626", desc: "House Harkonnen is officially granted the full planetary fief of Arrakis by the Padishah Emperor. Carthag is rapidly expanded as their brutalist capital." },
        // BUG FIX: Changed from "botanical_testing_station" (doesn't exist) to "observatory" (the actual ID).
        { year: 10140, title: "Kynes Begins Terraforming", location: "observatory", color: "#22c55e", desc: "Pardot Kynes arrives as Imperial Planetologist and begins the secret ecological transformation of the deep desert." },
        { year: 10187, title: "Rabban's Ascendancy", location: "carthag", color: "#991b1b", desc: "Glossu 'Beast' Rabban is placed in direct command of the Arrakis spice operations by the Baron." },
        { year: 10191, title: "Atreides Arrive", location: "arrakeen", color: "#0284c7", desc: "House Atreides lands at Arrakeen. Duke Leto takes control of the spice operations." },
        { year: 10191.2, title: "Crawler Rescue Operation", location: "spice_fields", color: "#0ea5e9", desc: "Duke Leto sacrifices a spice crawler to save its crew from a sandworm, impressing Imperial Planetologist Liet-Kynes." },
        { year: 10191.5, title: "Fall of House Atreides", location: "arrakeen", color: "#ef4444", desc: "Harkonnen and Sardaukar assault Arrakeen. Yueh's betrayal. Duke Leto dies. Paul and Jessica flee into the desert.", battleType: "ground_desert" },
        // BUG FIX: Changed from non-existent "cave_of_birds" to the now-added location.
        { year: 10191.8, title: "The Duel with Jamis", location: "cave_of_birds", color: "#d97706", desc: "Paul defeats Jamis in a death duel in the Cave of Birds, earning his place among the Fremen and the secret name Usul." },
        { year: 10192, title: "Paul Joins the Fremen", location: "sietch_tabr", color: "#d97706", desc: "Paul and Jessica are accepted into Sietch Tabr. Paul takes the name Muad'Dib." },
        // BUG FIX: Changed from non-existent "habbanya_erg" to the now-added location.
        { year: 10193, title: "Paul Rides Shai-Hulud", location: "habbanya_erg", color: "#f59e0b", desc: "Paul summons and rides a sandworm in the Habbanya Erg, completing his acceptance as a Fremen warrior." },
        // LORE FIX: Water of Life trial happens during the events of Dune, not years later.
        { year: 10193.5, title: "Water of Life Trial", location: "cave_of_ridges", color: "#3b82f6", desc: "Paul drinks the Water of Life and survives. Full prescient vision unlocks. He is the Kwisatz Haderach." },
        { year: 10196, title: "Battle of Arrakeen", location: "arrakeen", color: "#f59e0b", desc: "Fremen forces riding sandworms break the Shield Wall and assault Arrakeen. The Emperor's Sardaukar are defeated. Paul takes the throne.", battleType: "ground_desert" },
        { year: 10208, title: "Paul's Blinding", location: "arrakeen", color: "#a3a3a3", desc: "A stone burner blinds Paul during the Conspiracy of the Naibs, but he continues to 'see' through prescient vision." },
        { year: 10210, title: "Birth of the Twins", location: "sietch_tabr", color: "#78716c", desc: "Chani dies giving birth to Leto II and Ghanima. Paul, now truly blind after losing his prescient sight, walks into the desert as Fremen law demands." },
        // LORE FIX: Improved accuracy of Alia's death description.
        { year: 10219, title: "Death of the Abomination", location: "arrakeen", color: "#ef4444", desc: "Possessed by the Baron Harkonnen's persona among many inner lives, Alia leaps from the walls of the Keep to escape the Abomination consuming her." },
        { year: 10220, title: "Leto's Transformation", location: "jacurutu", color: "#eab308", desc: "Young Leto II covers himself in sandtrout at Jacurutu, beginning his 3,500-year physical transformation into the God Emperor." },
        { year: 13724, title: "The Durbok Rebellion", location: "keep_of_leto", color: "#dc2626", desc: "A major uprising against the God Emperor is effortlessly crushed by his Fish Speaker army." },
        { year: 15220, title: "Death of the God Emperor", location: "arrakeen", color: "#fde047", desc: "Leto II is assassinated on the Idaho River bridge, plunging into the water. The sandtrout burst free, beginning the long process of returning the desert." },
        { year: 15225, title: "The Famine Times", location: "arrakeen", color: "#78716c", desc: "Following the Tyrant's death, the Famine Times begin. Billions starve. Humanity scatters outward into the unknown universe in the trillions." },
        { year: 15289, title: "Discovery of Sheeana", location: "rakis_temple", color: "#f59e0b", desc: "A young Rakian orphan is discovered who can command the great returning sandworms, fulfilling Leto II's oldest prophecy." },
        { year: 15295, title: "Destruction of Rakis", location: "arrakeen", color: "#ef4444", desc: "The Honored Matres obliterate the surface of Rakis with devastating orbital weapons, burning the planet to glass. One single worm is saved by the Sisterhood.", battleType: "orbital_bombardment" }
    ],
    
    factions: {
        "None": "#52525b",
        "Fremen": "#d97706",
        "Atreides": "#0284c7",
        "Harkonnen": "#dc2626",
        "Corrino": "#9333ea",
        "Bene Gesserit": "#d946ef",
        "God Emperor": "#eab308",
        "Smugglers": "#64748b",
        "Imperial": "#94a3b8",
        "Museum Fremen": "#a16207"
    }
};
