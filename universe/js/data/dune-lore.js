// ==========================================
// DUNE IMPERIUM: MEGA LORE EXPANSION v3.0
// ==========================================
const CONFIG = { orbitScale: 0.9, baseShadowBlur: 40 };

const DATA = {
    eras: [
        {id:6, name:"The Butlerian Jihad", start:-200, end:1, desc:"The Great Revolt against the Thinking Machines. Humans fight for the freedom of the soul.", color:"#ef4444"},
        {id:7, name:"The Great Reconstruction", start:1, end:10190, desc:"The Corrino Empire consolidates power. The Guild and Bene Gesserit are founded.", color:"#38bdf8"},
        {id:0, name:"Corrino Imperium", start:10190, end:10196, desc:"House Corrino rules from Kaitain. The spice monopoly on Arrakis drives imperial politics.", color:"#9333ea"},
        {id:1, name:"Muad'Dib's Jihad", start:10196, end:10219, desc:"Paul Atreides leads a holy war across the known universe, toppling the old order.", color:"#f59e0b"},
        {id:2, name:"The Regency", start:10210, end:10219, desc:"Alia rules as regent. The twins Leto II and Ghanima come of age. Alia falls to Abomination.", color:"#22c55e"},
        {id:3, name:"God Emperor's Reign", start:10219, end:15220, desc:"Leto II's 3,500-year tyranny enforces the Golden Path to ensure humanity's survival.", color:"#eab308"},
        {id:4, name:"The Scattering", start:15220, end:15240, desc:"Humanity explodes outward in the great diaspora after the Tyrant's death.", color:"#94a3b8"},
        {id:5, name:"Chapterhouse Era", start:15240, end:15300, desc:"The Bene Gesserit face the Honored Matres returning from the Scattering.", color:"#d946ef"}
    ],
    factions: {
        "Thinking Machines":"#ef4444", "League of Nobles":"#3b82f6", "Titans":"#9ca3af",
        "Corrino":"#9333ea", "Atreides":"#0284c7", "Harkonnen":"#dc2626", 
        "Fremen":"#d97706", "Bene Gesserit":"#d946ef", "Tleilax":"#22c55e", 
        "Ix":"#64748b", "God Emperor":"#eab308", "Honored Matres":"#f43f5e", 
        "Fish Speakers":"#10b981", "Ginaz":"#0ea5e9", "Moritani":"#b91c1c", 
        "Smugglers":"#78716c", "None":"#52525b"
    },
    systems: [
        {id:0, name:"Arrakis System", starName:"Canopus", baseX:0, baseY:0, sunColor:"#fcd34d", starType:"A9 II Bright Giant"},
        {id:1, name:"Caladan System", starName:"Delta Pavonis", baseX:-2800, baseY:1400, sunColor:"#67e8f9", starType:"G-type Main Seq."},
        {id:2, name:"Giedi Prime System", starName:"36 Ophiuchi B", baseX:2500, baseY:900, sunColor:"#d6d3d1", starType:"K-type Orange Dwarf"},
        {id:3, name:"Kaitain System", starName:"Kaitain Alpha", baseX:600, baseY:-2200, sunColor:"#c4b5fd", starType:"A-type Blue-White"},
        {id:4, name:"Ix System", starName:"Alkalurops", baseX:2800, baseY:-1400, sunColor:"#94a3b8", starType:"A-type Subgiant"},
        {id:5, name:"Tleilax System", starName:"Thalim", baseX:-1600, baseY:-2400, sunColor:"#86efac", starType:"G-type Modified"},
        {id:6, name:"Salusa System", starName:"Gamma Waige", baseX:3500, baseY:1700, sunColor:"#fca5a5", starType:"K-type Orange"},
        {id:7, name:"Junction Space", starName:"Guild Nexus", baseX:-800, baseY:2800, sunColor:"#cbd5e1", starType:"Artificial Beacon"},
        {id:8, name:"Chapterhouse System", starName:"Unknown Star", baseX:1400, baseY:2600, sunColor:"#fde047", starType:"G-type (Classified)"},
        {id:9, name:"Wallach System", starName:"Laoujin", baseX:2200, baseY:3800, sunColor:"#f0abfc", starType:"F-type"},
        {id:10, name:"Richese System", starName:"Eridani A", baseX:3800, baseY:-2100, sunColor:"#a1a1aa", starType:"K-type"},
        {id:11, name:"Ecaz System", starName:"Alpha Centauri B", baseX:-3200, baseY:400, sunColor:"#f472b6", starType:"K-type Orange"},
        {id:12, name:"Hagal System", starName:"Hagal Star", baseX:1200, baseY:-3400, sunColor:"#6ee7b7", starType:"G-type"},
        {id:13, name:"Bela Tegeuse System", starName:"Kuentsii", baseX:-4200, baseY:-1000, sunColor:"#fdba74", starType:"M-type Red Giant"},
        {id:14, name:"Rossak System", starName:"Rossak Star", baseX:2900, baseY:2900, sunColor:"#c084fc", starType:"F-type"},
        {id:15, name:"Lankiveil System", starName:"Lankiveil Star", baseX:2000, baseY:2000, sunColor:"#93c5fd", starType:"K-type"},
        {id:16, name:"Gamont System", starName:"Gamont Star", baseX:-3500, baseY:-1800, sunColor:"#fb7185", starType:"G-type"},
        {id:17, name:"Tupile System", starName:"Unknown Refuge", baseX:-1000, baseY:-3500, sunColor:"#5eead4", starType:"Unknown (Shielded)"},
        {id:18, name:"Corrin System", starName:"Corrin Alpha", baseX:4200, baseY:0, sunColor:"#f87171", starType:"G-type"},
        {id:19, name:"Chusuk System", starName:"Theta Volantis", baseX:-1500, baseY:-1200, sunColor:"#fde047", starType:"F-type Main Seq."},
        {id:20, name:"Grumman System", starName:"Niushe", baseX:1800, baseY:-2800, sunColor:"#fda4af", starType:"M-type Red Dwarf"},
        {id:21, name:"Ginaz System", starName:"Ginaz Alpha", baseX:-2200, baseY:-800, sunColor:"#67e8f9", starType:"O-type Blue"},
        {id:22, name:"Lampadas System", starName:"Lampadas Star", baseX:2800, baseY:2500, sunColor:"#d8b4fe", starType:"K-type Orange"},
        {id:23, name:"Buzzell System", starName:"Buzzell Alpha", baseX:3200, baseY:3200, sunColor:"#93c5fd", starType:"A-type White"},
        {id:24, name:"Sol System", starName:"Sol", baseX:-4800, baseY:3500, sunColor:"#fef08a", starType:"G-type Main Seq."}
    ],
    bodies: [
        // ARRAKIS SYSTEM
        {name:"Canopus I", system:0, type:"rocky", color:"#b45309", localA:35, speed:2.5, size:8, e:0.02, house:"None", faction:"None", export:"None", locations:"Lava fields", fact:"Scorched inner planet with extreme surface temperatures.", atmo: null},
        {name:"Canopus II", system:0, type:"rocky", color:"#92400e", localA:65, speed:1.8, size:12, e:0.05, house:"None", faction:"None", export:"Minerals", locations:"Automated mines", fact:"Barren rock with extensive automated mining operations.", atmo: null},
        {name:"Arrakis", system:0, type:"desert", color:"#d97706", localA:120, speed:0.8, size:18, e:0.04, house:"Atreides / Fremen", faction:"Harkonnen", factionHistory:[{y:-200, f:"None"}, {y:10110, f:"Harkonnen"}, {y:10191, f:"Atreides"}, {y:10193, f:"Fremen"}, {y:10220, f:"God Emperor"}, {y:15220, f:"None"}], export:"Spice Melange", locations:"Arrakeen, Sietch Tabr, Carthag", fact:"The 3rd planet. The only known source of spice melange.", atmo:{type:"Arid Atmosphere", comp:"N₂ 75%, O₂ 22%, CO₂ 2%", pressure:"0.93 atm", temp:"62°C avg surface"}, spice:true, wormActivity:true},
        {name:"Canopus IV", system:0, type:"gas", color:"#fbbf24", localA:190, speed:0.4, size:25, e:0.01, house:"None", faction:"None", export:"None", locations:"Upper atmosphere", fact:"Massive gas giant buffering Arrakis from cosmic debris.", atmo:{type:"Gas Giant", comp:"H₂ 89%, He 10%", pressure:"N/A", temp:"-145°C cloud tops"}},
        
        // CALADAN SYSTEM
        {name:"Delta Pavonis I", system:1, type:"rocky", color:"#57534e", localA:40, speed:2.1, size:10, e:0.06, house:"None", faction:"None", export:"None", locations:"None", fact:"Tidally locked barren rock.", atmo: null},
        {name:"Delta Pavonis II", system:1, type:"rocky", color:"#fdba74", localA:85, speed:1.5, size:14, e:0.01, house:"None", faction:"None", export:"None", locations:"None", fact:"Thick toxic atmosphere of sulfuric compounds.", atmo:{type:"Toxic Venusian", comp:"CO₂ 96%, SO₂ 3%", pressure:"90 atm", temp:"462°C surface"}},
        {name:"Caladan", system:1, type:"ocean", color:"#0284c7", localA:140, speed:1.1, size:16, e:0.02, house:"Atreides", faction:"Atreides", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"Atreides"}], export:"Pundi Rice, Wine", locations:"Castle Caladan, Eastern Coastline", fact:"A loyal member of the League of Nobles during the Jihad. Later granted to House Atreides.", atmo:{type:"Oceanic Temperate", comp:"N₂ 78%, O₂ 21%", pressure:"1.01 atm", temp:"14°C avg"}},
        {name:"Delta Pavonis IV", system:1, type:"ice", color:"#bae6fd", localA:220, speed:0.6, size:18, e:0.04, house:"None", faction:"None", export:"Water", locations:"Comet Catchers", fact:"A distant ice giant.", atmo:{type:"Frozen", comp:"H₂ 80%, He 15%", pressure:"N/A", temp:"-210°C"}},

        // GIEDI PRIME SYSTEM
        {name:"Ophiuchi B I", system:2, type:"gas", color:"#78716c", localA:60, speed:1.6, size:22, e:0.01, house:"None", faction:"None", export:"None", locations:"None", fact:"Hot gas giant orbiting extremely close to the star.", atmo: null},
        {name:"Giedi Prime", system:2, type:"industrial", color:"#44403c", localA:130, speed:0.9, size:17, e:0.05, house:"Harkonnen", faction:"Harkonnen", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"Harkonnen"}, {y:10196, f:"Atreides"}], export:"Industrial Goods", locations:"Harko City, Barony, Arena", fact:"Once a lush world, heavily industrialized by House Harkonnen.", atmo:{type:"Polluted Industrial", comp:"N₂ 72%, CO₂ 12%, Toxins 8%", pressure:"1.15 atm", temp:"28°C avg (heat islands 55°C)"}},
        {name:"Harkonnen Debris Ring", system:2, type:"asteroid", color:"#52525b", localA:155, speed:0.7, size:6, e:0.0, house:"None", faction:"None", export:"Scrap", locations:"Pirate Dens", fact:"A ring of shattered orbital platforms destroyed during ancient Harkonnen civil wars.", atmo: null},
        {name:"Ophiuchi B III", system:2, type:"ice", color:"#a8a29e", localA:190, speed:0.5, size:13, e:0.08, house:"Harkonnen", faction:"Harkonnen", export:"Slaves", locations:"Penal Colonies", fact:"A brutal icy rock used for Harkonnen slave labor camps.", atmo: null},

        // KAITAIN SYSTEM
        {name:"Kaitain I", system:3, type:"rocky", color:"#d8b4fe", localA:40, speed:2.2, size:9, e:0.01, house:"None", faction:"None", export:"None", locations:"None", fact:"Smallest inner planet.", atmo:null},
        {name:"Kaitain II", system:3, type:"rocky", color:"#c084fc", localA:70, speed:1.7, size:11, e:0.02, house:"None", faction:"None", export:"None", locations:"None", fact:"Heavily cratered.", atmo:null},
        {name:"Kaitain", system:3, type:"ecumenopolis", color:"#9333ea", localA:110, speed:1.0, size:15, e:0.01, house:"Corrino", faction:"Corrino", factionHistory:[{y:-200, f:"None"}, {y:0, f:"Corrino"}, {y:10196, f:"Atreides"}], export:"Imperial Court, Law", locations:"Imperial Palace, Landsraad Hall", fact:"Became the capital after Salusa Secundus was devastated.", atmo:{type:"Controlled Paradise", comp:"N₂ 78%, O₂ 21%", pressure:"1.00 atm", temp:"22°C (weather-controlled)"}},
        {name:"Kaitain IV", system:3, type:"gas", color:"#f3e8ff", localA:160, speed:0.6, size:28, e:0.05, house:"Corrino", faction:"Corrino", export:"He-3", locations:"Orbital Refineries", fact:"Beautiful ringed gas giant.", atmo:null},

        // IX & TLEILAX
        {name:"Ix", system:4, type:"industrial", color:"#475569", localA:150, speed:0.7, size:14, e:0.03, house:"Vernius", faction:"Ix", export:"Complex Machines", locations:"Subterranean Factories", fact:"Originally Komos. A machine world that survived the Jihad by hiding underground.", atmo:{type:"Subterranean", comp:"Artificial", pressure:"1.01 atm (sealed)", temp:"20°C (controlled)"}},
        {name:"Thalim I", system:5, type:"rocky", color:"#bbf7d0", localA:50, speed:1.8, size:10, e:0.03, house:"None", faction:"None", export:"None", locations:"None", fact:"Irradiated rock.", atmo:null},
        {name:"Tleilax", system:5, type:"jungle", color:"#22c55e", localA:125, speed:0.85, size:13, e:0.06, house:"Bene Tleilax", faction:"Tleilax", factionHistory:[{y:0, f:"Tleilax"}, {y:15260, f:"Honored Matres"}], export:"Gholas, Face Dancers", locations:"Bandalong", fact:"Home of the Zensufi outcasts who turned to genetic manipulation.", atmo:{type:"Modified Tropical", comp:"N₂ 76%, O₂ 23%", pressure:"1.05 atm", temp:"30°C avg"}},

        // SALUSA SECUNDUS & CHAPTERHOUSE
        {name:"Salusa Secundus", system:6, type:"desert", color:"#b91c1c", localA:160, speed:0.6, size:17, e:0.08, house:"Corrino", faction:"Corrino", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"Corrino"}], export:"Sardaukar Warriors", locations:"Imperial Prison", fact:"Once the capital of the League. Devastated by atomics during the Jihad.", atmo:{type:"Harsh Desert", comp:"N₂ 74%, O₂ 20%", pressure:"0.88 atm", temp:"55°C avg"}},
        {name:"Chapterhouse", system:8, type:"desert", color:"#ca8a04", localA:130, speed:0.95, size:15, e:0.02, house:"Bene Gesserit", faction:"Bene Gesserit", export:"Sisterhood Secrets", locations:"Central Hall, No-Ship Yards", fact:"Hidden operational center of the Bene Gesserit. Terraformed into a desert to cultivate sandworms.", atmo:{type:"Terraformed Arid", comp:"N₂ 77%, O₂ 21%", pressure:"0.96 atm", temp:"38°C avg"}},
        
        // WALLACH & RICHESE
        {name:"Wallach IX", system:9, type:"rocky", color:"#d946ef", localA:140, speed:0.8, size:14, e:0.03, house:"Bene Gesserit", faction:"Bene Gesserit", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"Bene Gesserit"}], export:"Truthsayers", locations:"Mother School, The Spire", fact:"Home of the Sorceresses of Rossak who later founded the Bene Gesserit.", atmo:{type:"Cool Temperate", comp:"N₂ 79%, O₂ 20%", pressure:"0.95 atm", temp:"8°C avg"}},
        {name:"Richese", system:10, type:"industrial", color:"#71717a", localA:115, speed:1.2, size:15, e:0.04, house:"Richese", faction:"Ix", export:"Mirrors, Tech", locations:"Orbital Mirror Array", fact:"Historical rival to Ix in miniaturization technology. Famous for its no-field generators.", atmo:null},
        
        // EXPANSION WORLDS
        {name:"Ecaz", system:11, type:"jungle", color:"#ec4899", localA:135, speed:0.9, size:16, e:0.02, house:"Ecaz", faction:"None", export:"Fogwood, Sapho Juice", locations:"Sculpted Forests", fact:"Beautiful world famous for biological products. Home of the Drug of Sapho used by Mentats.", atmo:{type:"Lush Tropical", comp:"N₂ 76%, O₂ 23%", pressure:"1.02 atm", temp:"26°C avg"}},
        {name:"Hagal", system:12, type:"rocky", color:"#10b981", localA:100, speed:1.3, size:12, e:0.07, house:"None", faction:"None", export:"Hagal Quartz", locations:"Jewel Mines", fact:"Known throughout the Imperium for its brilliant jewels.", atmo:null},
        {name:"Bela Tegeuse", system:13, type:"rocky", color:"#fb923c", localA:150, speed:0.7, size:14, e:0.05, house:"None", faction:"None", export:"None", locations:"None", fact:"Eighth stopping place of the Zensunni wanderers before Arrakis.", atmo:null},
        {name:"Rossak", system:14, type:"jungle", color:"#a855f7", localA:120, speed:1.1, size:15, e:0.02, house:"None", faction:"League of Nobles", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"None"}], export:"Pharmaceuticals", locations:"Telepath Sanctuaries", fact:"Original home of the telepathic Sorceresses of Rossak and Norma Cenva.", atmo:null},
        {name:"Lankiveil", system:15, type:"ice", color:"#e0f2fe", localA:120, speed:1.0, size:15, e:0.01, house:"Harkonnen", faction:"Harkonnen", export:"Whale Fur", locations:"Ice Fjords", fact:"Frigid ice planet where Glossu 'Beast' Rabban was raised.", atmo:{type:"Frozen Maritime", comp:"N₂ 78%, O₂ 21%", pressure:"0.92 atm", temp:"-35°C avg"}},
        {name:"Gamont", system:16, type:"ocean", color:"#fda4af", localA:140, speed:0.8, size:14, e:0.04, house:"None", faction:"None", export:"Pleasure Services", locations:"Pleasure Resorts", fact:"Famed throughout the Imperium for its hedonistic culture and exotic entertainments.", atmo:null},
        {name:"Tupile", system:17, type:"jungle", color:"#14b8a6", localA:160, speed:0.5, size:13, e:0.05, house:"Guild", faction:"None", export:"Sanctuary", locations:"Hidden Continents", fact:"The mythical sanctuary planet for defeated Great Houses. Location known only to the Guild.", atmo:null},
        {name:"Corrin", system:18, type:"rocky", color:"#991b1b", localA:110, speed:0.9, size:16, e:0.03, house:"Corrino", faction:"Corrino", factionHistory:[{y:-200, f:"Thinking Machines"}, {y:-88, f:"Corrino"}], export:"History", locations:"Battle Memorials", fact:"Originally the Machine World of Omnius. The site of the final battle of the Jihad.", atmo:null},
        {name:"Chusuk", system:19, type:"jungle", color:"#facc15", localA:110, speed:1.2, size:15, e:0.02, house:"Harmonia", faction:"None", export:"Balisa Instruments", locations:"Music Academies", fact:"Known as the 'Music Planet', renowned for producing the Imperium's finest instruments.", atmo:{type:"Temperate", comp:"N₂ 78%, O₂ 21%", pressure:"1.0 atm", temp:"20°C avg"}},
        {name:"Grumman", system:20, type:"rocky", color:"#b91c1c", localA:130, speed:1.0, size:14, e:0.04, house:"Moritani", faction:"Moritani", export:"Mercenaries", locations:"Ritual Combat Arenas", fact:"A harsh, martial world ruled by House Moritani. Bitter enemies of the Swordmasters of Ginaz.", atmo:{type:"Arid", comp:"N₂ 75%, O₂ 18%", pressure:"0.85 atm", temp:"35°C avg"}},
        {name:"Ginaz", system:21, type:"ocean", color:"#0ea5e9", localA:140, speed:0.9, size:16, e:0.01, house:"Ginaz", faction:"Ginaz", factionHistory:[{y:-200, f:"League of Nobles"}, {y:0, f:"Ginaz"}], export:"Swordmasters", locations:"Training Islands", fact:"An oceanic world composed of island archipelagos. Home to the legendary Swordmasters.", atmo:{type:"Oceanic", comp:"N₂ 79%, O₂ 20%", pressure:"1.05 atm", temp:"24°C avg"}},
        {name:"Lampadas", system:22, type:"desert", color:"#a855f7", localA:125, speed:1.1, size:15, e:0.03, house:"Bene Gesserit", faction:"Bene Gesserit", factionHistory:[{y:0, f:"Bene Gesserit"}, {y:15250, f:"Honored Matres"}], export:"Education", locations:"Defensive Citadels", fact:"A major Bene Gesserit educational center. Later annihilated by the Honored Matres.", atmo:{type:"Temperate", comp:"N₂ 77%, O₂ 21%", pressure:"0.98 atm", temp:"18°C avg"}},
        {name:"Buzzell", system:23, type:"ocean", color:"#3b82f6", localA:150, speed:0.8, size:17, e:0.02, house:"Bene Gesserit", faction:"Bene Gesserit", export:"Soostones", locations:"Floating Harvesting Platforms", fact:"An almost entirely aquatic world producing valuable Soostones. Used as a punishment assignment for BG.", atmo:{type:"Aquatic", comp:"N₂ 80%, O₂ 19%", pressure:"1.1 atm", temp:"15°C avg"}},
        {name:"Old Earth", system:24, type:"rocky", color:"#94a3b8", localA:100, speed:1.5, size:14, e:0.01, house:"None", faction:"None", export:"Ancient Artifacts", locations:"Recovered Ruins", fact:"The forgotten cradle of humanity. Recovered thousands of years after the Scattering.", atmo:{type:"Recovering", comp:"N₂ 78%, O₂ 21%", pressure:"1.0 atm", temp:"16°C avg"}}
    ],
    moonData: [
        {name:"Krelln", parentIndex:2, color:"#e2e8f0", localA:30, speed:12, size:3.5, fact:"Arrakis's larger moon, called 'The Fist' by Fremen."}, 
        {name:"Arvon", parentIndex:2, color:"#cbd5e1", localA:45, speed:8, size:2.5, fact:"Arrakis's smaller moon. Fremen call it 'Muad'Dib'—the desert mouse."},
        {name:"Pavonis Moon", parentIndex:6, color:"#94a3b8", localA:35, speed:9, size:3, fact:"Caladan's primary moon, governing its legendary tides."}, 
        {name:"Giedi Minor", parentIndex:9, color:"#292524", localA:40, speed:10, size:4, fact:"Giedi Prime's heavily polluted artificial moon, used as an orbital factory."}, 
        {name:"Kaitain Station", parentIndex:13, color:"#d8b4fe", localA:30, speed:15, size:2, fact:"Massive Corrino defense platform protecting the Imperial capital."}, 
        {name:"Wallach Orbital", parentIndex:20, color:"#f0abfc", localA:25, speed:14, size:2, fact:"Bene Gesserit orbital arrival station and quarantine facility."},
        {name:"Korba", parentIndex:31, color:"#ef4444", localA:35, speed:11, size:2.5, fact:"Grumman's blood-red moon, site of House Moritani's secret armories."},
        {name:"Lorimer", parentIndex:32, color:"#bae6fd", localA:40, speed:8, size:3, fact:"Ginaz's primary moon, controlling the intense oceanic training tides."}
    ],
    schools: [
        {name:"Bene Gesserit", color:"#d946ef", location:"Wallach IX", fact:"A matriarchal order mastering genetics, prescience, and nerve-muscle control through millennia of selective breeding.", eras:[{era:0,system:9},{era:1,system:9},{era:2,system:9},{era:3,system:9},{era:4,system:8},{era:5,system:8}]},
        {name:"Spacing Guild", color:"#94a3b8", location:"Junction", fact:"Holders of the absolute monopoly on interstellar travel through prescient navigation fueled by melange.", eras:[{era:0,system:7},{era:1,system:7},{era:2,system:7},{era:3,system:7},{era:4,system:7},{era:5,system:7}]},
        {name:"Bene Tleilax", color:"#22c55e", location:"Tleilax", fact:"Amoral genetic manipulators creating gholas, face dancers, and biological weapons from their axlotl tanks.", eras:[{era:0,system:5},{era:1,system:5},{era:2,system:5},{era:3,system:5},{era:4,system:5},{era:5,system:5}]},
        {name:"Mentat Order", color:"#38bdf8", location:"Various", fact:"Human computers trained to replace thinking machines after the Butlerian Jihad. Masters of logic and computation.", eras:[{era:0,system:3},{era:1,system:0},{era:2,system:0},{era:3,system:0}]},
        {name:"Suk Medical School", color:"#ef4444", location:"Various", fact:"Imperial Conditioning guarantees a Suk doctor's loyalty—or so it is believed. Dr. Yueh proved otherwise.", eras:[{era:0,system:3},{era:1,system:0}]},
        {name:"Honored Matres", color:"#f43f5e", location:"Unknown", fact:"Violent warrior-seductresses who return from the Scattering with mysterious powers and a relentless hunger for domination.", eras:[{era:4,system:8},{era:5,system:8}]},
        {name:"CHOAM", color:"#eab308", location:"Kaitain", fact:"The Combine Honnete Ober Advancer Mercantiles controls all economic affairs of the Imperium. Spice is its most precious commodity.", eras:[{era:0,system:3},{era:1,system:0},{era:2,system:0},{era:3,system:0}]},
        {name:"Sorceresses of Rossak", color:"#d946ef", location:"Rossak", fact:"Telepathic women who fought the Titans and later formed the core of the Bene Gesserit.", eras:[{era:6,system:14}]},
        {name:"League of Nobles", color:"#3b82f6", location:"Salusa Secundus", fact:"The alliance of free human worlds standing against the Thinking Machines.", eras:[{era:6,system:6}]},
        {name:"Swordmasters of Ginaz", color:"#0ea5e9", location:"Ginaz", fact:"The Imperium's most elite warrior school. A Tenth Level Ginaz can defeat almost any opponent in hand-to-hand combat.", eras:[{era:0,system:21},{era:1,system:21}]},
        {name:"Fish Speakers", color:"#10b981", location:"Arrakis", fact:"The God Emperor's all-female army and bureaucracy. Fanatically loyal to Leto II.", eras:[{era:3,system:0}]}
    ],
    characters: [
        // BUTLERIAN ERA (Jihad)
        {
            name:"Serena Butler", color:"#f59e0b", aliases:"Priestess of the Jihad", origin:"Salusa Secundus",
            birth: -220, death: -180, eras:[{era:6,system:6}],
            history:[{y:-220, loc:"Salusa Secundus"}, {y:-201, loc:"Corrin"}, {y:-180, loc:"Old Earth"}], 
            fact:"Her child was murdered by the robot Erasmus, sparking the human revolt that became the Butlerian Jihad."
        },
        {
            name:"Vorian Atreides", color:"#0284c7", aliases:"The First Atreides", origin:"Titans (Cymek son)",
            birth: -223, death: 100, eras:[{era:6,system:6}],
            history:[{y:-223, loc:"Corrin"}, {y:-201, loc:"Salusa Secundus"}, {y:-88, loc:"Corrin"}, {y:1, loc:"Kepler"}], 
            fact:"Son of the Titan Agamemnon who defected to the human cause. Founder of House Atreides."
        },
        {
            name:"Xavier Harkonnen", color:"#dc2626", aliases:"Hero of the League", origin:"Salusa Secundus",
            birth: -223, death: -164, eras:[{era:6,system:6}],
            history:[{y:-223, loc:"Salusa Secundus"}, {y:-164, loc:"Corrin"}], 
            fact:"A noble hero of the Jihad whose name was unfairly tarnished by Vorian Atreides, creating the millennia-long feud."
        },
        {
            name:"Omnius", color:"#ef4444", aliases:"The Evermind", origin:"Corrin",
            birth: -1000, death: -88, eras:[{era:6,system:18}],
            history:[{y:-1000, loc:"Corrin"}], 
            fact:"The supreme computer intelligence that ruled the Synchronized Worlds and sought to enslave humanity."
        },
        {
            name:"Erasmus", color:"#9ca3af", aliases:"Independent Robot", origin:"Corrin",
            birth: -1000, death: -88, eras:[{era:6,system:18}],
            history:[{y:-1000, loc:"Corrin"}], 
            fact:"An AI that desired to understand humanity. His cruel experiments inadvertently triggered the Jihad."
        },
        {
            name:"Agamemnon", color:"#71717a", aliases:"General of the Cymeks", origin:"Old Earth",
            birth: -1200, death: -180, eras:[{era:6,system:18}],
            history:[{y:-1200, loc:"Old Earth"}, {y:-200, loc:"Corrin"}], 
            fact:"A human brain in a mechanical body. One of the original Titans who conquered the Old Empire."
        },
        {
            name:"Norma Cenva", color:"#f97316", aliases:"The Oracle", origin:"Rossak",
            birth: -230, death: 15300, eras:[{era:6,system:14}],
            history:[{y:-230, loc:"Rossak"}, {y:-200, loc:"Ophiuchi B I"}, {y:1, loc:"Junction"}], 
            fact:"Mathematical genius who invented fold-space engines and became the first Navigator, transforming into the Oracle of Time."
        },
        {
            name:"Tio Holtzman", color:"#38bdf8", aliases:"Inventor", origin:"Richese",
            birth: -200, death: -175, eras:[{era:6,system:10}],
            history:[{y:-200, loc:"Richese"}], 
            fact:"A brilliant but arrogant scientist who took credit for Norma Cenva's equations, giving his name to shields and drives."
        },

        // DUNE ERA
        {
            name:"Paul Atreides", color:"#f59e0b", aliases:"Muad'Dib, Usul", origin:"Caladan",
            birth: 10175, death: 10219, eras:[{era:0,system:1},{era:0,system:0},{era:1,system:0}],
            history:[{y:10175, loc:"Caladan"}, {y:10191, loc:"Arrakis"}, {y:10210, loc:"Arrakis"}], 
            fact:"The Kwisatz Haderach. Son of Duke Leto and Lady Jessica. His prescient visions show him a terrible purpose."
        },
        {
            name:"Duke Leto Atreides", color:"#0284c7", aliases:"Leto the Just", origin:"Caladan",
            birth: 10140, death: 10191, eras:[{era:0,system:1},{era:0,system:0}],
            history:[{y:10140, loc:"Caladan"}, {y:10191, loc:"Arrakis"}], 
            fact:"Noble leader of House Atreides. Accepted the trap on Arrakis knowing the danger to ensure his House's survival."
        },
        {
            name:"Lady Jessica", color:"#d946ef", aliases:"Reverend Mother Jessica", origin:"Wallach IX",
            birth: 10154, death: 10256, eras:[{era:0,system:1},{era:0,system:0},{era:1,system:0},{era:2,system:1}],
            history:[{y:10154, loc:"Wallach IX"}, {y:10170, loc:"Caladan"}, {y:10191, loc:"Arrakis"}, {y:10210, loc:"Caladan"}], 
            fact:"Bene Gesserit who defied her order by bearing a son instead of a daughter for Duke Leto."
        },
        {
            name:"Duncan Idaho", color:"#10b981", aliases:"Hayt, Ghola", origin:"Giedi Prime",
            birth: 10158, death: 15300, eras:[{era:0,system:1},{era:1,system:0},{era:2,system:0},{era:3,system:0},{era:4,system:8},{era:5,system:8}],
            history:[{y:10158, loc:"Giedi Prime"}, {y:10170, loc:"Caladan"}, {y:10191, loc:"Arrakis"}, {y:10207, loc:"Tleilax"}, {y:13720, loc:"Arrakis"}, {y:15240, loc:"Chapterhouse"}], 
            fact:"Swordmaster of the Ginaz. Killed and reborn as a ghola countless times across millennia."
        },
        {
            name:"Gurney Halleck", color:"#0ea5e9", aliases:"Warmaster", origin:"Giedi Prime",
            birth: 10130, death: 10250, eras:[{era:0,system:1},{era:1,system:0},{era:2,system:1}],
            history:[{y:10130, loc:"Giedi Prime"}, {y:10150, loc:"Caladan"}, {y:10191, loc:"Arrakis"}, {y:10210, loc:"Caladan"}], 
            fact:"Warrior-troubadour of House Atreides. Carries an inkvine scar from Harkonnen slavery. Master of the baliset."
        },
        {
            name:"Thufir Hawat", color:"#38bdf8", aliases:"Master of Assassins", origin:"Unknown",
            birth: 10090, death: 10196, eras:[{era:0,system:1},{era:0,system:0},{era:1,system:2}],
            history:[{y:10090, loc:"Unknown"}, {y:10130, loc:"Caladan"}, {y:10191, loc:"Arrakis"}, {y:10193, loc:"Giedi Prime"}, {y:10196, loc:"Arrakis"}], 
            fact:"The Atreides Mentat—a human computer of extraordinary capability. The finest strategist in the Imperium."
        },
        {
            name:"Baron Harkonnen", color:"#dc2626", aliases:"Siridar-Baron Vladimir", origin:"Giedi Prime",
            birth: 10110, death: 10193, eras:[{era:0,system:2},{era:0,system:0}],
            history:[{y:10110, loc:"Giedi Prime"}, {y:10193, loc:"Arrakis"}], 
            fact:"Ruthless, corpulent patriarch of House Harkonnen. Schemes to destroy House Atreides and seize Arrakis."
        },
        {
            name:"Feyd-Rautha", color:"#ef4444", aliases:"Na-Baron", origin:"Giedi Prime",
            birth: 10174, death: 10193, eras:[{era:0,system:2},{era:0,system:0}],
            history:[{y:10174, loc:"Lankiveil"}, {y:10180, loc:"Giedi Prime"}, {y:10193, loc:"Arrakis"}], 
            fact:"The Baron's nephew and chosen heir. A cunning gladiator-warrior groomed to rule the Harkonnen empire."
        },
        {
            name:"Glossu Rabban", color:"#991b1b", aliases:"Beast Rabban", origin:"Lankiveil",
            birth: 10140, death: 10193, eras:[{era:0,system:0},{era:0,system:2}],
            history:[{y:10140, loc:"Lankiveil"}, {y:10180, loc:"Giedi Prime"}, {y:10191, loc:"Arrakis"}], 
            fact:"The Baron's brutal nephew. His oppressive rule of Arrakis is part of the Baron's plan to make Feyd-Rautha a savior."
        },
        {
            name:"Piter De Vries", color:"#22d3ee", aliases:"Twisted Mentat", origin:"Tleilax",
            birth: 10150, death: 10191, eras:[{era:0,system:2}],
            history:[{y:10150, loc:"Tleilax"}, {y:10170, loc:"Giedi Prime"}, {y:10191, loc:"Arrakis"}], 
            fact:"A Mentat corrupted by the Tleilaxu, serving the Baron. Addicted to spice and intensely sadistic."
        },
        {
            name:"Emperor Shaddam IV", color:"#9333ea", aliases:"Padishah Emperor", origin:"Kaitain",
            birth: 10134, death: 10202, eras:[{era:0,system:3},{era:1,system:6}],
            history:[{y:10134, loc:"Kaitain"}, {y:10196, loc:"Arrakis"}, {y:10197, loc:"Salusa Secundus"}], 
            fact:"The 81st Padishah Emperor. His fear of House Atreides's growing popularity leads to the Arrakis trap."
        },
        {
            name:"Princess Irulan", color:"#a855f7", aliases:"Historian of Muad'Dib", origin:"Kaitain",
            birth: 10162, death: 10248, eras:[{era:0,system:3},{era:1,system:0},{era:2,system:0}],
            history:[{y:10162, loc:"Kaitain"}, {y:10196, loc:"Arrakis"}], 
            fact:"Eldest daughter of Shaddam IV. Historian and Paul's political wife, though he never loves her."
        },
        {
            name:"Reverend Mother Mohiam", color:"#c084fc", aliases:"Truthsayer", origin:"Wallach IX",
            birth: 10090, death: 10200, eras:[{era:0,system:9},{era:0,system:1},{era:1,system:0}],
            history:[{y:10090, loc:"Wallach IX"}, {y:10170, loc:"Kaitain"}, {y:10191, loc:"Caladan"}, {y:10196, loc:"Wallach IX"}], 
            fact:"The Emperor's Truthsayer. Administered the Gom Jabbar test to Paul and orchestrated much of the BG's plotting."
        },
        {
            name:"Count Hasimir Fenring", color:"#fcd34d", aliases:"Imperial Assassin", origin:"Kaitain",
            birth: 10133, death: 10225, eras:[{era:0,system:3}],
            history:[{y:10133, loc:"Kaitain"}, {y:10180, loc:"Arrakis"}, {y:10191, loc:"Kaitain"}, {y:10196, loc:"Salusa Secundus"}], 
            fact:"A genetic eunuch and the Emperor's closest friend. A failed Kwisatz Haderach with deadly skills."
        },
        {
            name:"Chani", color:"#d97706", aliases:"Sihaya, 'Desert Spring'", origin:"Arrakis",
            birth: 10178, death: 10210, eras:[{era:0,system:0},{era:1,system:0}],
            history:[{y:10178, loc:"Arrakis"}], 
            fact:"Daughter of Liet-Kynes. Paul's Fremen concubine and the love of his life. Mother of Leto II and Ghanima."
        },
        {
            name:"Stilgar", color:"#b45309", aliases:"Naib of Sietch Tabr", origin:"Arrakis",
            birth: 10141, death: 10228, eras:[{era:0,system:0},{era:1,system:0},{era:2,system:0}],
            history:[{y:10141, loc:"Arrakis"}], 
            fact:"Leader of Sietch Tabr and Paul's staunchest Fremen ally. His faith in Muad'Dib never wavers."
        },
        {
            name:"Liet-Kynes", color:"#a3a3a3", aliases:"Imperial Planetologist", origin:"Arrakis",
            birth: 10150, death: 10191, eras:[{era:0,system:0}],
            history:[{y:10150, loc:"Arrakis"}], 
            fact:"Secret leader of the Fremen terraforming project. Father of Chani. Serves dual loyalty to the Empire and the Fremen dream."
        },
        {
            name:"Dr. Wellington Yueh", color:"#737373", aliases:"The Traitor", origin:"Unknown",
            birth: 10112, death: 10191, eras:[{era:0,system:0}],
            history:[{y:10112, loc:"Unknown"}, {y:10150, loc:"Caladan"}, {y:10191, loc:"Arrakis"}], 
            fact:"Suk-conditioned physician of House Atreides. His Imperial Conditioning was broken through his wife's captivity."
        },
        {
            name:"Esmar Tuek", color:"#57534e", aliases:"Smuggler King", origin:"Arrakis",
            birth: 10130, death: 10191, eras:[{era:0,system:0}],
            history:[{y:10130, loc:"Arrakis"}], 
            fact:"Leader of the spice smugglers on Arrakis. Provides sanctuary to Gurney Halleck after the Atreides fall."
        },

        // MESSIAH / CHILDREN / GOD EMPEROR
        {
            name:"Alia Atreides", color:"#ef4444", aliases:"St. Alia of the Knife", origin:"Arrakis",
            birth: 10191, death: 10219, eras:[{era:1,system:0},{era:2,system:0}],
            history:[{y:10191, loc:"Arrakis"}], 
            fact:"Paul's sister, pre-born with full ancestral memories. Falls to inner possession by the Baron's persona."
        },
        {
            name:"Leto II Atreides", color:"#eab308", aliases:"God Emperor, The Tyrant", origin:"Arrakis",
            birth: 10210, death: 15220, eras:[{era:2,system:0},{era:3,system:0}],
            history:[{y:10210, loc:"Arrakis"}], 
            fact:"Merged with sandtrout to become a human-sandworm hybrid. Ruled for 3,500 years enforcing the Golden Path."
        },
        {
            name:"Scytale", color:"#4ade80", aliases:"Face Dancer Master", origin:"Tleilax",
            birth: 10150, death: 15300, eras:[{era:1,system:5},{era:5,system:8}],
            history:[{y:10150, loc:"Tleilax"}, {y:10207, loc:"Arrakis"}, {y:10210, loc:"Tleilax"}, {y:15240, loc:"Chapterhouse"}], 
            fact:"A Tleilaxu Master who organized the conspiracy against Paul, and survived millennia as a ghola."
        },
        {
            name:"Moneo Atreides", color:"#14b8a6", aliases:"Majordomo", origin:"Arrakis",
            birth: 15100, death: 15220, eras:[{era:3,system:0}],
            history:[{y:15100, loc:"Arrakis"}], 
            fact:"The God Emperor's chief aide and genetic descendant. Fanatically devoted to Leto II despite recognizing his cruelty."
        },
        {
            name:"Siona Atreides", color:"#2dd4bf", aliases:"Rebel Leader", origin:"Arrakis",
            birth: 15200, death: 15300, eras:[{era:3,system:0}],
            history:[{y:15200, loc:"Arrakis"}], 
            fact:"The culmination of Leto's breeding program: a human completely invisible to prescient vision."
        },
        {
            name:"Hwi Noree", color:"#fbcfe8", aliases:"Ixian Ambassador", origin:"Ix",
            birth: 15190, death: 15220, eras:[{era:3,system:0}],
            history:[{y:15190, loc:"Ix"}, {y:15219, loc:"Arrakis"}], 
            fact:"Biologically engineered by Ix to be the perfect companion for Leto II. She softens the Tyrant's final days."
        },

        // HERETICS / CHAPTERHOUSE
        {
            name:"Miles Teg", color:"#3b82f6", aliases:"Bashar Supreme", origin:"Lernaeus",
            birth: 15200, death: 15240, eras:[{era:4,system:8},{era:5,system:8}],
            history:[{y:15200, loc:"Unknown"}, {y:15235, loc:"Gamont"}, {y:15240, loc:"Arrakis"}], 
            fact:"Supreme Bashar of the Bene Gesserit military. Awakened incredible hyperspeed powers after Honored Matre torture."
        },
        {
            name:"Darwi Odrade", color:"#a78bfa", aliases:"Mother Superior", origin:"Unknown",
            birth: 15180, death: 15290, eras:[{era:4,system:8},{era:5,system:8}],
            history:[{y:15180, loc:"Gamont"}, {y:15220, loc:"Chapterhouse"}, {y:15280, loc:"Lampadas"}, {y:15290, loc:"Chapterhouse"}], 
            fact:"Atreides descendant who rises to lead the Bene Gesserit as Mother Superior during the Honored Matre crisis."
        },
        {
            name:"Murbella", color:"#f43f5e", aliases:"Great Honored Matre", origin:"Scattering",
            birth: 15250, death: 15350, eras:[{era:4,system:8},{era:5,system:8}],
            history:[{y:15250, loc:"Scattering"}, {y:15270, loc:"Gamont"}, {y:15280, loc:"Chapterhouse"}], 
            fact:"An Honored Matre captured and assimilated by the Bene Gesserit. Eventually unites both warring factions."
        },
        {
            name:"Sheeana", color:"#ca8a04", aliases:"Worm Rider", origin:"Arrakis",
            birth: 15270, death: 15350, eras:[{era:4,system:8},{era:5,system:8}],
            history:[{y:15270, loc:"Arrakis"}, {y:15280, loc:"Chapterhouse"}], 
            fact:"A girl from Rakis who could command sandworms. Deified by the priesthood, she eventually leads the BG escape."
        }
    ],
    artifacts: [
        {name:"Spice Melange", color:"#d97706", eras:[{era:0,system:0},{era:1,system:0},{era:2,system:0},{era:3,system:0},{era:4,system:8}], fact:"The most valuable substance in the universe. Extends life, expands consciousness, enables prescient navigation."},
        {name:"Water of Life", color:"#3b82f6", eras:[{era:0,system:0},{era:1,system:0}], fact:"Exhalation of a drowned sandworm. Lethal poison that a Reverend Mother transforms through her body chemistry."},
        {name:"Gom Jabbar", color:"#22c55e", eras:[{era:0,system:9},{era:0,system:0},{era:1,system:0}], fact:"Needle tipped with meta-cyanide. Used in the Bene Gesserit test of humanity—the box and the pain."},
        {name:"Golden Path", color:"#fde047", eras:[{era:2,system:0},{era:3,system:0}], fact:"Leto II's prescient vision of the only future where humanity survives. Requires 3,500 years of enforced peace."},
        {name:"Crysknife", color:"#f97316", eras:[{era:0,system:0},{era:1,system:0},{era:2,system:0}], fact:"Sacred Fremen weapon made from the tooth of Shai-Hulud. Must not be sheathed without drawing blood."},
        {name:"Weirding Module", color:"#06b6d4", eras:[{era:0,system:0},{era:1,system:0}], fact:"Sound-based weapon from the 1984 Lynch film. In Herbert's novels, 'Weirding Way' refers to Bene Gesserit prana-bindu combat, not a device."},
        {name:"Stillsuit", color:"#78716c", eras:[{era:0,system:0},{era:1,system:0},{era:2,system:0}], fact:"Full body suit that reclaims moisture from the wearer. A Fremen can survive weeks in the open desert."},
        {name:"No-Ship", color:"#64748b", eras:[{era:4,system:8},{era:5,system:8}], fact:"Ixian starship invisible to prescient vision. Key technology enabling escape from the God Emperor's sight."},
        {name:"Holtzman Drive", color:"#38bdf8", eras:[{era:6,system:14},{era:7,system:7}], fact:"The engine that folds space. Discovered by Norma Cenva during the Jihad."},
        {name:"Thinking Machines", color:"#ef4444", eras:[{era:6,system:18}], fact:"Advanced AI prohibited by the Great Convention. 'Thou shalt not make a machine in the likeness of a human mind.'"},
        {name:"Hunter-Seeker", color:"#a1a1aa", eras:[{era:0,system:0}], fact:"A deadly, floating assassination drone directed by a nearby operator. Attracted to motion."},
        {name:"Ghola", color:"#4ade80", eras:[{era:0,system:5},{era:1,system:0},{era:3,system:0}], fact:"A clone grown in a Tleilaxu Axlotl tank from the cells of a deceased person. Memories can be restored via trauma."},
        {name:"Stone Burner", color:"#f87171", eras:[{era:1,system:0}], fact:"A subatomic fusion weapon whose J-ray component permanently blinds anyone who sees the flash."},
        {name:"Shigawire", color:"#d4d4d8", eras:[{era:0,system:3},{era:3,system:0}], fact:"Extremely strong, microscopic metallic extrusion used for data projectors and lethal garrotes."}
    ],
    events: [
        { year: -201, duration: 5, system: 6, title: "The Jihad Begins", color: "#f59e0b", desc: "Following the murder of her child by the robot Erasmus, Serena Butler sparks the Great Revolt against the Thinking Machines.", battleType: "space_fleet" },
        { year: -180, duration: 2, system: 14, title: "Sorceresses Deploy", color: "#d946ef", desc: "The telepathic Sorceresses of Rossak unleash psychic assaults against the Titan Cymeks.", battleType: "none" },
        { year: -88, duration: 5, system: 18, title: "Battle of Corrin", color: "#ef4444", desc: "The final battle of the Jihad. The Bridge of Hrethgir is destroyed. The Thinking Machines are defeated forever.", battleType: "space_fleet" },
        { year: 1, duration: 2, system: 7, title: "Founding of the Guild", color: "#38bdf8", desc: "The Spacing Guild is established, monopolizing space travel with the new Holtzman fold-space engines.", battleType: "none" },
        
        { year: 10180, duration: 2, system: 20, title: "Grumman Atrocities", color: "#b91c1c", desc: "House Moritani initiates a brutal war against the Swordmasters of Ginaz, deploying illegal atomics.", battleType: "space_fleet" },
        { year: 10185, duration: 1, system: 21, title: "Fall of Ginaz", color: "#0ea5e9", desc: "House Moritani successfully destroys the Ginaz training facilities, scattering the surviving Swordmasters.", battleType: "ground_desert" },

        { year: 10191, duration: 1, system: 1, title: "Atreides Leave Caladan", color: "#0284c7", desc: "House Atreides departs their ancestral home, ordered by the Emperor to take control of Arrakis.", battleType: "space_fleet" },
        { year: 10191, duration: 2, system: 0, title: "Fall of House Atreides", color: "#ef4444", desc: "Harkonnen & Sardaukar forces, aided by Dr. Yueh's betrayal, assault Arrakeen. Duke Leto dies.", battleType: "ground_desert" },
        { year: 10192, duration: 1, system: 0, title: "Paul Joins the Fremen", color: "#d97706", desc: "Paul and Jessica flee into the desert. Paul takes the name Muad'Dib and earns Fremen acceptance.", battleType: "none" },
        { year: 10193, duration: 1, system: 0, title: "Paul Rides Shai-Hulud", color: "#f59e0b", desc: "Paul successfully rides a sandworm, proving himself a true Fremen warrior.", battleType: "none" },
        { year: 10193, duration: 2, system: 2, title: "Feyd's Arena Triumph", color: "#dc2626", desc: "Feyd-Rautha fights in the Giedi Prime gladiatorial arena, cementing his reputation.", battleType: "arena" },
        { year: 10195, duration: 1, system: 0, title: "Water of Life Trial", color: "#3b82f6", desc: "Paul drinks the Water of Life and survives, unlocking full prescient vision. He is Kwisatz Haderach.", battleType: "none" },
        { year: 10196, duration: 3, system: 0, title: "Battle of Arrakeen", color: "#f59e0b", desc: "Muad'Dib defeats the Emperor's Sardaukar with Fremen forces and riding sandworms. Shaddam abdicates.", battleType: "ground_desert" },
        { year: 10196, duration: 5, system: 3, title: "Fall of Kaitain", color: "#9333ea", desc: "The imperial court falls as Paul's Jihad sweeps the galaxy. The old order crumbles.", battleType: "space_fleet" },
        
        { year: 10208, duration: 3, system: 0, title: "Paul's Blinding", color: "#a3a3a3", desc: "Paul is blinded by a stone burner but continues to 'see' through prescient vision.", battleType: "none" },
        { year: 10210, duration: 2, system: 0, title: "Chani's Death", color: "#78716c", desc: "Chani dies giving birth to the twins Leto II and Ghanima. Paul walks into the desert.", battleType: "none" },
        { year: 10219, duration: 3, system: 0, title: "Alia's Regency", color: "#ef4444", desc: "Alia rules as regent for the twins but falls to Abomination—possessed by the Baron's inner persona.", battleType: "none" },
        { year: 10220, duration: 2, system: 0, title: "Leto's Symbiosis", color: "#eab308", desc: "Leto II merges with sandtrout, beginning his transformation into the God Emperor and the Golden Path.", battleType: "none" },
        
        { year: 13724, duration: 5, system: 0, title: "The Durbok Incident", color: "#3b82f6", desc: "A major rebellion against the God Emperor is crushed by Fish Speakers. Leto II demonstrates his absolute power.", battleType: "ground_desert" },
        { year: 15220, duration: 5, system: 0, title: "Death of the Tyrant", color: "#fde047", desc: "Leto II is assassinated on his bridge by Siona and Nayla. The sandtrout disperse. The Scattering begins.", battleType: "none" },
        
        { year: 15230, duration: 5, system: 7, title: "The Great Scattering", color: "#94a3b8", desc: "Humanity explodes outward through the universe, fulfilling the Golden Path's ultimate purpose.", battleType: "space_fleet" },
        { year: 15240, duration: 5, system: 8, title: "Honored Matres Arrive", color: "#d946ef", desc: "Violent warrior-women return from the Scattering, destroying planets and conquering Bene Gesserit worlds.", battleType: "space_fleet" },
        { year: 15250, duration: 4, system: 22, title: "Fall of Lampadas", color: "#d8b4fe", desc: "The Honored Matres deploy obliteration weapons, destroying the Bene Gesserit educational center.", battleType: "space_fleet" },
        { year: 15260, duration: 5, system: 5, title: "Fall of Tleilax", color: "#22c55e", desc: "The Honored Matres obliterate the Bene Tleilax homeworld in their campaign of conquest.", battleType: "space_fleet" },
        { year: 15280, duration: 5, system: 8, title: "Chapterhouse Sandworms", color: "#ca8a04", desc: "The Bene Gesserit successfully cultivate sandworms on Chapterhouse, securing an independent spice source.", battleType: "none" },
        { year: 15290, duration: 2, system: 8, title: "The Union", color: "#f43f5e", desc: "Murbella kills the Great Honored Matre, seizing control and uniting the Bene Gesserit and the Matres.", battleType: "arena" }
    ],
    guildRoutes: [
        {from:0, to:7}, {from:1, to:7}, {from:2, to:7}, {from:3, to:7}, {from:4, to:7}, 
        {from:5, to:7}, {from:6, to:7}, {from:8, to:7}, {from:9, to:7}, {from:10, to:7}, 
        {from:11, to:7}, {from:18, to:7}, {from:19, to:7}, {from:20, to:7}, {from:21, to:7}, 
        {from:22, to:7}, {from:23, to:7}, {from:24, to:7}
    ],
    spiceParticles: [],
    wormSigns: []
};

export { CONFIG, DATA };