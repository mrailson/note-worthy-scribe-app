import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActionItem {
  id?: string;
  description: string;
  owner?: string;
  deadline?: string;
  status?: string;
  priority?: string;
}

interface MeetingInfographicData {
  meetingTitle: string;
  meetingDate?: string;
  meetingTime?: string;
  location?: string;
  attendees: string[];
  notesContent: string;
  actionItems: ActionItem[];
  transcript?: string;
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface InfographicOptions {
  style: string;
  customStyle?: string;
  orientation?: 'portrait' | 'landscape';
}

// GP Practice-focused infographic style presets
const INFOGRAPHIC_STYLES: Record<string, { name: string; prompt: string }> = {
  'practice-professional': {
    name: 'Practice Professional',
    prompt: 'Clean GP practice meeting style with calming blue and green tones, stethoscope and primary care icons, professional medical typography (Calibri/Arial), structured sections for clinical governance, patient safety items, and practice management. Trust-inspiring and NHS-aligned.'
  },
  'clinical-governance': {
    name: 'Clinical Governance',
    prompt: 'Formal clinical governance style using NHS blue (#005EB8) with red/amber/green RAG rating indicators, checklist icons, compliance and audit focused layout, structured risk assessment sections, clear action tracking visual elements, and regulatory compliance theming.'
  },
  'patient-safety': {
    name: 'Patient Safety Focus',
    prompt: 'Patient safety themed design with protective healthcare imagery, amber and green accents on white, shield and safety icons, prominent incident tracking sections, clear escalation pathways visualised, and compassionate professional aesthetic.'
  },
  'team-engagement': {
    name: 'Team Engagement',
    prompt: 'Warm and engaging team-focused style with friendly people icons, collaborative imagery, soft purple and teal colours, celebration of achievements, staff wellbeing focus, and approachable modern design that feels supportive and team-oriented.'
  },
  'qof-targets': {
    name: 'QOF & Targets',
    prompt: 'Data-driven QOF and targets style with progress bars, pie charts, percentage indicators, green for achieved targets, performance dashboard aesthetic, KPI visualisation, and clear metric tracking focused on practice performance outcomes.'
  }
};

export const useMeetingInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  const sanitiseCustomStyleRequest = (rawStyle: string): string => {
    const trimmed = rawStyle.trim();
    const lower = trimmed.toLowerCase();

    // Avoid prompting with trademarked franchise names/characters/logos – these can cause the image model to refuse.
    // Map common requests to "vibe" descriptions that still achieve the look.
    const franchiseMappings: Record<string, string> = {
      // Sci-Fi & Space
      'star wars': 'cinematic space-opera sci-fi theme: deep starfield backgrounds, dramatic lighting, holographic UI motifs, glowing blue/amber accents, futuristic typography, sleek spacecraft silhouettes',
      'star trek': 'retro-futuristic space exploration theme: sleek starship bridge aesthetics, LCARS-inspired panel layouts, bold primary colours on dark backgrounds, clean geometric shapes, optimistic sci-fi feel',
      'matrix': 'digital cyberpunk theme: cascading green code rain on black, neon green accents, monospace typography, glitch effects, virtual reality aesthetics',
      'terminator': 'apocalyptic tech-noir theme: metallic chrome, red targeting displays, industrial textures, military stencil fonts, dystopian atmosphere',
      'alien': 'sci-fi horror theme: dark industrial corridors, green scanner displays, biomechanical textures, claustrophobic atmosphere, retrofuturistic tech',
      'aliens': 'military sci-fi theme: colonial marines aesthetic, motion tracker displays, industrial yellows and greys, combat-ready typography',
      'blade runner': 'neon-noir cyberpunk theme: rain-soaked streets, neon pink and blue, retrofuturistic cityscapes, Japanese typography influences, melancholic atmosphere',
      'tron': 'digital grid theme: glowing neon blue lines on black, geometric circuit patterns, sleek futuristic typography, light-cycle aesthetics',
      'back to the future': 'retro 80s sci-fi adventure theme: chrome and neon, digital clock displays, bold italicised typography, time-travel energy effects, optimistic futurism',
      'avatar': 'bioluminescent alien nature theme: glowing cyan and magenta, organic flowing shapes, alien flora patterns, ethereal atmosphere',
      'dune': 'epic desert sci-fi theme: golden sand tones, ornate Arabic-inspired patterns, ancient futurism, spice-orange accents, mystical typography',
      'interstellar': 'cosmic space exploration theme: vast starfields, wormhole visualisations, scientific diagrams, hopeful yet melancholic atmosphere',
      'gravity': 'realistic space thriller theme: Earth from orbit, stark white on black, minimal typography, isolation and vastness',
      'arrival': 'mysterious alien contact theme: soft grey atmospheres, circular linguistics, minimalist design, contemplative mood, fog and mist',
      'district 9': 'gritty documentary sci-fi theme: South African township aesthetics, alien refugee camp visuals, handheld camera feel, industrial decay',
      'edge of tomorrow': 'military time-loop sci-fi theme: combat exoskeleton aesthetics, battlefield greys, urgent countdown typography, rain-soaked warzone',
      'oblivion': 'sleek post-apocalyptic theme: clean white and grey minimalism, drone aesthetics, above-the-clouds serenity, Apple-like design',
      'elysium': 'dystopian class divide theme: slum earth tones vs pristine space station whites, industrial machinery, social inequality visuals',
      'pacific rim': 'giant mech vs monster theme: industrial robot aesthetics, neon displays, rain-soaked cityscapes, bold Japanese influences',
      'war of the worlds': 'alien invasion terror theme: ominous red skies, tripod silhouettes, suburban destruction, survival horror atmosphere',
      'independence day': 'epic alien invasion theme: patriotic Americana, massive mothership shadows, explosive action, 90s blockbuster energy',
      'fifth element': 'retro-futuristic maximalist theme: vibrant orange and blue, eccentric fashion, flying cars, opera and chaos combined',
      'total recall': 'mind-bending sci-fi noir theme: Mars red landscapes, memory manipulation visuals, 80s/90s action movie aesthetic',
      'robocop': 'satirical cyberpunk theme: chrome and black, corporate dystopia, news broadcast graphics, 80s action violence',
      'e.t.': 'heartwarming suburban sci-fi theme: warm golden lighting, bicycle silhouettes against moon, childhood wonder, Spielberg magic',
      'close encounters': 'mysterious UFO contact theme: dramatic light beams, night skies, musical tones visualised, 70s wonder',
      'ex machina': 'sleek AI thriller theme: minimalist Scandinavian design, glass and concrete, clinical whites, unsettling beauty',
      'her': 'soft futuristic romance theme: warm oranges and reds, gentle typography, intimate and melancholic, near-future LA',
      'minority report': 'sleek future-crime theme: translucent displays, gesture interfaces, pre-crime visuals, blue-tinted noir',
      'i robot': 'clean robot future theme: white and chrome, humanoid robot aesthetics, corporate futurism, action thriller energy',
      'moon': 'isolated space station theme: sterile white interiors, lonely lunar landscapes, retro computer displays, psychological unease',
      'sunshine': 'solar mission theme: blinding golden light, spaceship interiors, crew tension, cosmic scale and sacrifice',
      'the martian': 'survival on Mars theme: rusty red landscapes, NASA aesthetics, scientific problem-solving, optimistic determination',
      'passengers': 'luxury space travel theme: sleek starship interiors, cosmic isolation, romance in space, art-deco influences',
      'enders game': 'military space academy theme: zero-gravity training, holographic displays, young commander aesthetics, battle school',
      'ready player one': 'virtual reality adventure theme: retro gaming references, neon Oasis world, 80s pop culture overload',
      'alita battle angel': 'cyberpunk action theme: dystopian scrapyard cities, cyborg aesthetics, motorball arena, manga influences',
      'ghost in the shell': 'philosophical cyberpunk theme: Japanese cityscapes, cyborg bodies, digital consciousness, neon and rain',
      'akira': 'Japanese cyberpunk anime theme: neon-lit Neo-Tokyo, motorcycle gangs, psychic powers, explosive red energy',
      
      // Fantasy & Adventure
      'lord of the rings': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'lotr': 'epic high-fantasy medieval theme: aged parchment textures, ornate Celtic knotwork borders, earthy tones (forest green, gold, brown), elegant calligraphic typography, mystical glow effects',
      'hobbit': 'cosy fantasy adventure theme: warm rustic colours, rolling green hills, handwritten-style typography, whimsical illustrations, comfortable cottage aesthetics',
      'harry potter': 'magical wizarding school theme: gothic stone textures, candlelit warmth, burgundy/gold/navy palette, vintage parchment, ornate serif fonts, mystical floating elements',
      'narnia': 'classic British fantasy theme: snowy lamppost scenes, noble lion imagery, wardrobe portal magic, CS Lewis storybook feel',
      'princess bride': 'romantic fairy-tale adventure theme: storybook illustrations, whimsical typography, true love motifs, gentle humour',
      'labyrinth': 'surreal fantasy maze theme: impossible staircases, goblin aesthetics, 80s fantasy glamour, David Bowie sparkle',
      'dark crystal': 'dark puppet fantasy theme: organic alien landscapes, crystal mysticism, Gelfling and Skeksis aesthetics',
      'willow': 'classic 80s fantasy theme: medieval villages, magical creatures, heroic quest imagery, Lucasfilm adventure',
      'clash of the titans': 'Greek mythology epic theme: marble columns, mythological creatures, thunderbolt imagery, ancient grandeur',
      'percy jackson': 'modern Greek mythology theme: Camp Half-Blood aesthetics, teen demigod adventure, lightning and water powers',
      'eragon': 'dragon rider fantasy theme: medieval landscapes, dragon bond imagery, elvish typography, epic quest visuals',
      'golden compass': 'steampunk fantasy theme: Victorian alternate world, armoured bears, daemon companions, compass navigation',
      'stardust': 'romantic fantasy adventure theme: falling stars, magical kingdoms, witchcraft and wonder, Neil Gaiman whimsy',
      'pans labyrinth': 'dark Spanish fairy-tale theme: gothic fantasy creatures, war-torn 1944 Spain, haunting beauty, del Toro magic',
      'maleficent': 'dark fairy-tale reimagining theme: thorny forests, dark wings, green and black palette, powerful feminine energy',
      'snow white': 'classic fairy-tale theme: enchanted forest, magic mirror aesthetics, red apple imagery, Germanic folklore',
      'sleeping beauty': 'elegant fairy-tale theme: castle spires, rose and thorn motifs, aurora colours, medieval romance',
      'beauty and the beast': 'enchanted castle theme: candlelit ballrooms, rose under glass, French provincial charm, transformation magic',
      'cinderella': 'magical transformation theme: glass slipper elegance, midnight magic, pumpkin carriages, ball gown glamour',
      'aladdin': 'Arabian Nights fantasy theme: golden desert cities, magic carpet rides, genie magic, jewel tones',
      'mulan': 'ancient Chinese warrior theme: brush painting aesthetics, cherry blossoms, dragon guardians, honour and family',
      'tangled': 'sun-lit adventure theme: floating lanterns, long golden hair, medieval tower, warm optimistic colours',
      'brave': 'Scottish Highland fantasy theme: Celtic knots, wild red curls, ancient stone circles, will-o-wisps',
      'raya': 'Southeast Asian fantasy theme: dragon mythology, warrior princess, golden and jade tones, cultural richness',
      'luca': 'Italian summer adventure theme: Riviera seaside colours, sea monster transformation, gelato and Vespa vibes',
      'soul': 'jazz and afterlife theme: blue soul world, New York jazz clubs, musical notes, existential wonder',
      'inside out': 'emotional landscape theme: colourful personality islands, memory orbs, San Francisco and mind exploration',
      'up': 'adventure is out there theme: floating balloon house, Paradise Falls, explorer badges, heartwarming journey',
      'wall-e': 'post-apocalyptic robot love theme: lonely Earth landscapes, space cruise ship, environmental message, tender romance',
      'ratatouille': 'Parisian culinary theme: French bistro aesthetics, gourmet food, anyone can cook philosophy, warm kitchen tones',
      'monsters inc': 'monster workplace comedy theme: door factory aesthetics, scream energy, friendly monster designs, comedy horror',
      'incredibles': 'retro superhero family theme: mid-century modern design, spy-fi aesthetics, family teamwork, sleek supersuits',
      'bugs life': 'insect adventure theme: macro photography perspective, leaf and grass textures, colony cooperation, circus bugs',
      
      // Superheroes & Comics
      'marvel': 'dynamic superhero comic-book theme: bold primary colours, halftone dot patterns, dramatic action poses, comic panel layouts, punchy typography with outlines',
      'avengers': 'dynamic superhero team theme: bold metallic accents, dramatic lighting, sleek modern tech aesthetic, powerful colour contrasts (red, blue, gold)',
      'dc': 'dark heroic comic theme: dramatic shadows, bold silhouettes, strong contrasts, gothic undertones, powerful iconography',
      'batman': 'dark noir detective theme: shadowy blacks and greys, art-deco inspired geometry, gothic architecture silhouettes, dramatic spotlighting, mysterious atmosphere',
      'superman': 'bright heroic theme: bold primary colours (red, blue, yellow), clean strong typography, hopeful and powerful imagery, art-deco influences',
      'spider-man': 'dynamic web-slinger theme: red and blue action, web patterns, New York cityscape, youthful energy and responsibility',
      'iron man': 'high-tech superhero theme: red and gold armour, holographic displays, billionaire aesthetics, Arc Reactor glow',
      'thor': 'Norse mythology superhero theme: Asgardian gold and rainbow bridge, hammer imagery, cosmic realms, Viking grandeur',
      'black panther': 'Wakandan royal theme: vibranium purple glow, African futurism, tribal patterns, technological advancement',
      'captain america': 'patriotic soldier hero theme: red white and blue shield, World War II vintage, star-spangled iconography',
      'guardians of the galaxy': 'retro space adventure theme: 70s/80s mixtape aesthetic, cosmic colours, ragtag team energy, humour and heart',
      'wonder woman': 'Amazonian warrior theme: gold and red warrior armour, Greek island paradise, powerful feminine strength',
      'aquaman': 'underwater kingdom theme: Atlantean architecture, ocean blues and golds, underwater bioluminescence, trident imagery',
      'the flash': 'speed force theme: lightning bolt imagery, blur effects, red and yellow, time manipulation visuals',
      'x-men': 'mutant team theme: Xavier school aesthetics, genetic diversity, powerful abilities, outcasts united',
      'deadpool': 'irreverent anti-hero theme: red and black, fourth-wall breaking, crude humour, ultra-violence with comedy',
      'joker': 'psychological villain theme: graffiti and urban decay, clown makeup, Gotham darkness, society critique',
      'venom': 'symbiote anti-hero theme: black alien goo, sharp teeth and tendrils, dark and edgy, monster energy',
      'doctor strange': 'mystical arts theme: kaleidoscopic magic, astral projection, ancient grimoire aesthetics, mind-bending visuals',
      'ant-man': 'micro-macro adventure theme: subatomic worlds, size-changing visuals, heist comedy, science fun',
      'captain marvel': 'cosmic power theme: blue and gold uniform, Kree space technology, photon energy, powerful women',
      'shazam': 'magical champion theme: lightning bolt transformation, childlike wonder, bright primary colours, family fun',
      'watchmen': 'deconstructed superhero theme: gritty realism, smiley face blood splatter, alternate history, moral complexity',
      'the boys': 'dark superhero satire theme: corporate corruption, brutal violence, media criticism, anti-hero energy',
      'kick-ass': 'grounded vigilante theme: amateur hero aesthetics, comic book meets reality, ultraviolent, dark comedy',
      'hellboy': 'paranormal investigation theme: demonic red, occult symbols, gothic Americana, cigar-chomping attitude',
      'sin city': 'noir comic book theme: stark black and white with red accents, rain-soaked crime, femme fatales',
      'v for vendetta': 'revolutionary theme: Guy Fawkes mask, dystopian London, anarchy symbols, November 5th imagery',
      '300': 'Spartan warrior theme: stylised blood and bronze, dramatic slow-motion, THIS IS SPARTA energy, sepia and red',
      
      // Action & Thriller
      'james bond': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      '007': 'sleek spy-thriller theme: sophisticated black and gold palette, gun-barrel motifs, elegant typography, casino glamour, international intrigue',
      'indiana jones': 'vintage adventure archaeology theme: aged maps and parchment, sepia tones, expedition typography, exotic locations, 1930s pulp adventure aesthetic',
      'mission impossible': 'high-tech espionage theme: sleek modern interfaces, timer countdown displays, bold urgent typography, international locations, suspenseful atmosphere',
      'john wick': 'neo-noir assassin theme: dark atmospheric lighting, gold accents on black, elegant typography, nightclub neon, sophisticated violence aesthetic',
      'die hard': 'action thriller theme: Nakatomi Plaza, Christmas in LA, one-man-army, 80s action movie energy',
      'lethal weapon': 'buddy cop action theme: LA streets, mismatched partners, 80s action comedy, explosive friendship',
      'rambo': 'guerrilla warfare theme: jungle survival, military muscle, one-man army, Vietnam veteran grit',
      'expendables': 'retro action ensemble theme: muscle and explosions, 80s action star homage, team of mercenaries',
      'taken': 'revenge thriller theme: particular set of skills, European pursuit, gritty determination, parent protection',
      'bourne': 'modern spy thriller theme: shaky cam action, European locations, amnesiac assassin, realistic combat',
      'jason bourne': 'espionage thriller theme: identity mystery, CIA conspiracy, rooftop chases, global pursuit',
      'kingsman': 'gentleman spy comedy theme: British tailoring, umbrella weapons, outrageous action, posh meets punk',
      'atomic blonde': 'Cold War spy theme: neon-lit Berlin, 80s soundtrack, brutal fights, stylish espionage',
      'salt': 'double-agent thriller theme: identity twists, Russian spies, action heroine, government conspiracy',
      'jack ryan': 'CIA analyst thriller theme: intelligence operations, Tom Clancy realism, geopolitical tension',
      'jack reacher': 'investigator thriller theme: drifter justice, small-town corruption, methodical problem-solving',
      'equalizer': 'vigilante justice theme: everyday hero, precise violence, helping the helpless, noir atmosphere',
      'rush hour': 'buddy cop comedy theme: East meets West, Hong Kong action meets LA comedy, martial arts humour',
      'bad boys': 'Miami action comedy theme: neon and palm trees, buddy cop energy, Will Smith swagger, explosions',
      'speed': 'high-octane thriller theme: bus that cannot stop, countdown tension, 90s action, Keanu intensity',
      'point break': 'extreme sports heist theme: surfing and skydiving, undercover adrenaline, 90s cool',
      'heat': 'crime epic theme: LA noir, professional criminals, meticulous heists, De Niro vs Pacino',
      'collateral': 'night-time LA thriller theme: taxi cab, silver-haired assassin, urban nocturnal, jazz soundtrack',
      'sicario': 'border war thriller theme: cartel violence, moral ambiguity, desert landscapes, intense realism',
      'no country for old men': 'neo-Western thriller theme: Texas landscapes, coin-flip fate, relentless pursuit, Coen darkness',
      'prisoners': 'dark mystery thriller theme: rainy suburbia, desperate father, moral questions, grey atmospheres',
      'gone girl': 'domestic thriller theme: suburban darkness, media manipulation, twisted marriage, cool blue tones',
      'se7en': 'dark detective thriller theme: seven deadly sins, rainy noir, grimy city, disturbing discoveries',
      'zodiac': 'true crime investigation theme: 70s newspaper offices, coded messages, obsessive pursuit, unsolved mystery',
      'silence of the lambs': 'psychological thriller theme: FBI training, imprisoned genius, gothic horror, quid pro quo',
      'shutter island': 'asylum mystery theme: 1950s psychiatric institution, storm-swept island, twist revelations, noir paranoia',
      'black swan': 'psychological ballet theme: black and white contrast, obsessive perfection, body horror, artistic madness',
      'nightcrawler': 'nocturnal media thriller theme: LA night crawling, crime scene videography, sociopathic ambition',
      
      // Horror
      'halloween': 'slasher horror theme: autumn leaves, carved pumpkins, masked killer silhouette, suburban terror',
      'friday the 13th': 'camp slasher theme: Crystal Lake, hockey mask, summer camp horror, 80s teen terror',
      'nightmare on elm street': 'dream horror theme: red and green stripes, sleep terror, surreal nightmares, Freddy claws',
      'scream': 'meta-slasher theme: Ghostface mask, 90s teen horror, horror movie rules, phone call terror',
      'texas chainsaw': 'backwoods horror theme: rural decay, leather face, 70s grindhouse, oppressive heat',
      'saw': 'torture puzzle theme: dingy green tiles, puppet on tricycle, moral games, industrial horror',
      'conjuring': 'paranormal investigation theme: 70s home invasion, Warrens case files, religious horror, vintage fear',
      'insidious': 'astral horror theme: red-faced demon, Further dimension, creepy children, supernatural dread',
      'paranormal activity': 'found footage horror theme: bedroom surveillance, invisible presence, domestic terror, night vision',
      'it': 'childhood fear theme: Pennywise clown, red balloon, Derry Maine, coming-of-age horror',
      'ring': 'Japanese horror theme: VHS curse, well ghost, static television, long black hair terror',
      'grudge': 'J-horror theme: croaking ghost, Japanese house curse, death stare, creeping dread',
      'exorcist': 'religious horror theme: possession terror, Catholic imagery, Georgetown stairs, 70s dread',
      'omen': 'apocalyptic horror theme: Damien the antichrist, 666 symbolism, religious conspiracy, 70s paranoia',
      'poltergeist': 'suburban supernatural theme: TV static, swimming pool skulls, family haunting, 80s Spielberg horror',
      'shining': 'isolation horror theme: Overlook Hotel, hedge maze, typewriter madness, Kubrick symmetry, all work no play',
      'psycho': 'Hitchcock thriller theme: Bates Motel, shower scene, mother issues, black and white noir',
      'birds': 'nature attacks theme: swarming crows, coastal town, unexplained menace, Hitchcock suspense',
      'jaws': 'shark attack theme: beach terror, ominous fin, summer blockbuster, we need a bigger boat',
      'get out': 'social horror theme: sunken place, suburban racism, hypnosis spiral, Jordan Peele commentary',
      'us': 'doppelganger horror theme: tethered doubles, red jumpsuits, scissors, underground tunnels',
      'hereditary': 'family trauma horror theme: miniature dioramas, grief and cult, decapitation imagery, Ari Aster dread',
      'midsommar': 'folk horror theme: Swedish commune, flower crowns, bright daylight terror, pagan rituals',
      'quiet place': 'silent survival horror theme: sound-hunting monsters, sign language, post-apocalyptic family',
      'bird box': 'blindfolded survival theme: unseen threat, blindfold imagery, post-apocalyptic motherhood',
      'cabin in the woods': 'meta-horror theme: horror movie tropes, underground facility, monster menagerie, Whedon twist',
      'evil dead': 'cabin horror theme: Necronomicon, demonic possession, chainsaw hand, campy gore',
      'drag me to hell': 'curse horror theme: Lamia demon, gypsy curse, Sam Raimi madness, gross-out scares',
      'carrie': 'telekinetic revenge theme: prom night blood, outcast teen, religious abuse, 70s high school',
      'child\'s play': 'killer doll theme: Chucky, Good Guy doll, possession horror, 80s toy terror',
      'annabelle': 'haunted doll theme: creepy porcelain, demonic attachment, antique horror, Conjuring universe',
      'candyman': 'urban legend horror theme: Cabrini-Green, bee swarms, mirror reflection, say his name',
      
      // Crime & Drama
      'godfather': 'classic mafia crime theme: sepia and shadow, elegant script typography, Italian-American iconography, rose motifs, solemn atmosphere',
      'scarface': 'Miami crime drama theme: art-deco influences, palm trees and neon, bold aggressive typography, 80s excess aesthetic',
      'pulp fiction': 'retro crime noir theme: bold pop-art colours, vintage movie poster layouts, pulp magazine aesthetic, eclectic typography',
      'goodfellas': 'mobster rise and fall theme: wiseguy glamour, 70s and 80s soundtrack, freeze-frame narration, Italian-American crime',
      'casino': 'Las Vegas crime theme: neon excess, mob money, showgirl glamour, 70s Vegas opulence',
      'departed': 'undercover crime theme: Boston Irish mob, double agent tension, rat imagery, Scorsese intensity',
      'american gangster': 'Harlem drug empire theme: 70s street style, Blue Magic branding, rise and fall narrative',
      'training day': 'corrupt cop theme: LA streets, badge and gun, moral descent, urban intensity',
      'city of god': 'Brazilian favela theme: vibrant poverty, gang warfare, sun-baked colours, kinetic energy',
      'reservoir dogs': 'heist gone wrong theme: black suits and names, warehouse tension, ear scene, Tarantino cool',
      'snatch': 'British crime comedy theme: Guy Ritchie editing, diamond heist, boxing matches, cockney humour',
      'lock stock': 'East End crime comedy theme: card games gone wrong, British gangsters, stylish violence',
      'fight club': 'anti-consumerist rebellion theme: bare-knuckle fighting, soap making, Tyler Durden philosophy, visual destruction',
      'american psycho': 'yuppie horror theme: 80s Wall Street, business cards, serial killer aesthetic, Bateman perfection',
      'wolf of wall street': 'excess and corruption theme: money and drugs, yacht parties, sales floor chaos, Belfort swagger',
      'big short': 'financial crisis theme: documentary inserts, economic charts, housing bubble, smart outsiders',
      'social network': 'tech startup theme: Harvard dorms, Facebook blue, coding montages, Sorkin dialogue',
      'moneyball': 'data-driven sports theme: baseball statistics, Oakland As, sabermetrics revolution, underdog management',
      'million dollar baby': 'boxing drama theme: gym sweat, training montage, female fighter, heartbreaking tragedy',
      'creed': 'boxing legacy theme: Philadelphia training, Adonis rising, Apollo son, modern Rocky',
      'whiplash': 'musical perfectionism theme: jazz drumming, sweat and blood, conductor abuse, tempo obsession',
      'la la land': 'Hollywood musical romance theme: sunset colours, piano and tap dance, Los Angeles dreams, bittersweet ending',
      'greatest showman': 'circus musical theme: big top spectacle, song and dance, PT Barnum, inspirational anthem',
      'bohemian rhapsody': 'rock biopic theme: Queen iconography, Live Aid stage, Freddie Mercury flamboyance',
      'rocketman': 'fantasy musical biopic theme: Elton John costumes, psychedelic visuals, 70s excess, emotional journey',
      'straight outta compton': 'hip-hop biopic theme: NWA emergence, Compton streets, 90s rap, police tension',
      '8 mile': 'Detroit rap battle theme: Eminem origin, freestyle competition, trailer park poverty, hip-hop dreams',
      'hustle': 'basketball discovery theme: NBA dreams, Spanish talent, scouting journey, underdog narrative',
      
      // Comedy
      'office space': 'corporate satire theme: grey cubicle aesthetic, red stapler accents, mundane office supplies, TPS report formatting',
      'the office': 'mundane corporate comedy theme: beige office supplies, fluorescent lighting, deadpan typography, cubicle life',
      'friends': 'cosy 90s sitcom theme: Central Perk coffee colours, friendly handwritten fonts, New York apartment warmth, nostalgic comfort',
      'hangover': 'Vegas chaos comedy theme: bright desert sun, missing groom, tiger in bathroom, bachelor party madness',
      'superbad': 'teen comedy theme: high school party, fake IDs, coming-of-age awkwardness, McLovin energy',
      'bridesmaids': 'wedding comedy theme: bridesmaid dresses, bachelorette chaos, female friendship, gross-out humour',
      'mean girls': 'high school satire theme: pink Wednesdays, burn book, cafeteria cliques, 2000s teen aesthetic',
      'clueless': '90s teen comedy theme: yellow plaid, Beverly Hills, valley girl, fashion-forward',
      'legally blonde': 'pink empowerment theme: Elle Woods, Harvard Law, bend and snap, sorority power',
      'pitch perfect': 'a cappella competition theme: singing groups, college hijinks, musical battles, girl power',
      'ferris buellers': '80s teen rebellion theme: Chicago day off, fourth wall breaking, life moves fast, parade float',
      'breakfast club': '80s teen drama theme: Saturday detention, high school archetypes, library setting, John Hughes',
      'sixteen candles': '80s birthday comedy theme: forgotten birthday, romantic awkwardness, John Hughes, teen angst',
      'home alone': 'Christmas comedy theme: booby traps, family chaos, Kevin McCallister, holiday hijinks',
      'elf': 'Christmas comedy theme: North Pole to NYC, spreading Christmas cheer, yellow and green, Buddy enthusiasm',
      'groundhog day': 'time loop comedy theme: same day repeating, small town Pennsylvania, Bill Murray transformation',
      'truman show': 'reality TV satire theme: dome world, manufactured life, camera angles, escape to freedom',
      'big lebowski': 'slacker noir theme: bowling alleys, White Russian drinks, the Dude abides, surreal comedy',
      'napoleon dynamite': 'quirky indie comedy theme: Idaho small town, awkward teen, vote for Pedro, lo-fi aesthetic',
      'anchorman': '70s news satire theme: San Diego newsroom, moustaches and suits, jazz flute, stay classy',
      'zoolander': 'fashion satire theme: really really ridiculously good looking, blue steel, model stupidity',
      'step brothers': 'man-child comedy theme: bunk beds, drum set, Catalina Wine Mixer, Will Ferrell chaos',
      'talladega nights': 'NASCAR comedy theme: Ricky Bobby, shake and bake, racing sponsorships, Southern excess',
      'blades of glory': 'figure skating comedy theme: ice partners, spandex costumes, competition drama',
      'hot fuzz': 'action comedy theme: British village, buddy cops, greater good, Edgar Wright editing',
      'shaun of the dead': 'rom-zom-com theme: zombie apocalypse, Winchester pub, British humour, cricket bat',
      'scott pilgrim': 'video game romance theme: indie comic style, Toronto music scene, seven evil exes, level up graphics',
      'baby driver': 'heist musical theme: getaway driver, music-synchronized action, iPod aesthetic, Edgar Wright rhythm',
      'knives out': 'murder mystery theme: wealthy family, detective investigation, donut hole, whodunit elegance',
      'glass onion': 'modern mystery theme: tech billionaire, island party, layered puzzles, satirical comedy',
      
      // Animated Classics
      'disney': 'magical fairy-tale theme: enchanted castle silhouettes, sparkle effects, warm storybook colours, whimsical typography, happily-ever-after atmosphere',
      'pixar': 'vibrant animated adventure theme: bold cheerful colours, playful rounded typography, expressive character-driven layouts, heartwarming atmosphere',
      'frozen': 'icy Nordic fairy-tale theme: crystalline ice patterns, cool blue and purple palette, snowflake motifs, elegant flowing typography, magical winter atmosphere',
      'minions': 'playful yellow cartoon theme: bright yellow and blue palette, banana motifs, silly rounded typography, fun chaotic energy',
      'shrek': 'fairy-tale parody theme: swamp greens, storybook illustrations, playful medieval fonts, irreverent humour, ogre-friendly colours',
      'finding nemo': 'underwater ocean adventure theme: tropical coral colours, bubble effects, friendly aquatic motifs, warm family atmosphere',
      'lion king': 'African savanna theme: sunset oranges and purples, tribal patterns, majestic wildlife silhouettes, circle of life motifs',
      'toy story': 'playful childrens toy theme: primary colours, toy-box aesthetics, friendly rounded typography, nostalgic childhood warmth',
      'cars': 'retro Americana racing theme: Route 66 aesthetics, chrome and fins, desert landscapes, neon motel signs, vintage car culture',
      'moana': 'Polynesian ocean adventure theme: tropical turquoise waters, traditional tapa patterns, volcanic islands, wayfinding stars',
      'coco': 'Mexican Dia de los Muertos theme: marigold orange, papel picado patterns, calavera motifs, vibrant celebration colours',
      'encanto': 'magical Colombian family theme: tropical flowers, vibrant Latin colours, magical golden glow, family home warmth',
      'how to train your dragon': 'Viking dragon rider theme: Northern landscapes, dragon friendship, Celtic patterns, flying adventure',
      'kung fu panda': 'Chinese martial arts theme: bamboo and cherry blossoms, panda warrior, ancient scrolls, kung fu philosophy',
      'madagascar': 'African adventure comedy theme: zoo animals, jungle colours, lemur party, move it move it energy',
      'ice age': 'prehistoric comedy theme: glacial landscapes, woolly mammoths, acorn obsession, Ice Age creatures',
      'despicable me': 'villain-turned-dad theme: Gru aesthetics, minion yellow, gadget villain, heartwarming adoption',
      'megamind': 'supervillain comedy theme: blue alien, Metro City, villain as hero, clever subversion',
      'hotel transylvania': 'monster comedy theme: Dracula hotel, spooky fun, Halloween colours, monster family',
      'addams family': 'gothic family theme: black and white, creepy mansion, macabre humour, snap snap',
      'nightmare before christmas': 'Halloween Christmas hybrid theme: Tim Burton style, Jack Skellington, Gothic whimsy, stop-motion aesthetic',
      'corpse bride': 'Victorian gothic theme: blue ghost bride, piano keys, underworld wedding, Tim Burton romance',
      'coraline': 'dark fairy-tale theme: button eyes, other mother, parallel world, stop-motion creepiness',
      'paranorman': 'zombie comedy theme: small town Massachusetts, ghost-seeing boy, Halloween adventure',
      'kubo': 'Japanese mythology theme: origami magic, samurai adventure, lantern festival, Laika beauty',
      'spirited away': 'Studio Ghibli theme: Japanese bathhouse, magical spirits, food transformation, Miyazaki wonder',
      'my neighbor totoro': 'Ghibli countryside theme: giant forest spirit, soot sprites, rural Japan, childhood magic',
      'howls moving castle': 'steampunk Ghibli theme: walking castle, fire demon, wizard romance, anti-war themes',
      'princess mononoke': 'nature vs industry theme: forest gods, wolf princess, environmental mythology, epic Ghibli',
      'kiki': 'witch delivery theme: European seaside, flying broomstick, coming-of-age, Ghibli charm',
      
      // TV Shows
      'game of thrones': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'got': 'epic medieval fantasy theme: iron and stone textures, house sigil-inspired iconography, aged parchment, dark dramatic lighting, royal heraldry',
      'stranger things': 'retro 80s supernatural theme: neon red glow, flickering Christmas lights, VHS aesthetic, bold outlined typography, synth-wave colours',
      'doctor who': 'time-travelling British sci-fi theme: TARDIS blue, swirling vortex patterns, retrofuturistic controls, Gallifreyan circular writing',
      'breaking bad': 'desert crime drama theme: Albuquerque desert tones, periodic table elements, RV and laboratory motifs, meth-blue accents',
      'walking dead': 'zombie apocalypse survival theme: blood-red accents, distressed textures, abandoned infrastructure, survival gear motifs',
      'squid game': 'Korean survival game theme: pink guards and teal tracksuits, geometric shapes (circle, triangle, square), childhood game motifs, stark contrasts',
      'wednesday': 'gothic academia theme: black and purple, gothic architecture, ornate Victorian patterns, macabre elegance',
      'bridgerton': 'Regency romance theme: soft pastels, ornate floral patterns, elegant script typography, romantic ballroom aesthetics',
      'peaky blinders': 'gritty 1920s Birmingham theme: industrial smoke and shadows, flat cap silhouettes, vintage typography, gang aesthetic',
      'mandalorian': 'Star Wars Western theme: Tatooine deserts, beskar armour, bounty hunter aesthetics, this is the way',
      'witcher': 'dark Slavic fantasy theme: monster hunting, silver and steel, Polish folklore, Geralt brooding',
      'house of dragon': 'Targaryen dynasty theme: fire and blood, dragon scales, Old Valyria aesthetics, family conflict',
      'rings of power': 'Tolkien prequel theme: Second Age grandeur, elvish elegance, Numenor glory, epic scope',
      'last of us': 'post-apocalyptic journey theme: cordyceps infection, overgrown cities, father-daughter bond, survival',
      'succession': 'corporate dynasty theme: wealth and power, family warfare, boardroom battles, Roy family aesthetic',
      'white lotus': 'luxury resort satire theme: tropical paradise, social commentary, wealthy dysfunction, holiday horror',
      'euphoria': 'teen drama aesthetic theme: neon and glitter makeup, party scenes, high school darkness, stylised visuals',
      'ozark': 'crime drama theme: blue-tinted Missouri, money laundering, lake house, Byrde family descent',
      'yellowstone': 'modern Western theme: Montana ranch, cowboy culture, Dutton dynasty, American frontier',
      'ted lasso': 'optimistic sports comedy theme: AFC Richmond, believe poster, British football, American positivity',
      'schitts creek': 'sitcom warmth theme: small town, Rose family, motel aesthetic, growth and love',
      'fleabag': 'fourth-wall breaking theme: London life, dark comedy, hot priest, Phoebe Waller-Bridge wit',
      'killing eve': 'cat and mouse thriller theme: Villanelle fashion, MI6 intrigue, obsessive relationship, stylish kills',
      'handmaids tale': 'dystopian oppression theme: red cloaks, Gilead regime, resistance, under his eye',
      'black mirror': 'tech horror anthology theme: near-future dystopia, screen addiction, dark satire, episode variety',
      'chernobyl': 'nuclear disaster theme: Soviet Union, radiation hazard, 1986 period, harrowing documentary style',
      'band of brothers': 'WWII military theme: Easy Company, European theatre, brothers in arms, period accuracy',
      'crown': 'British royalty theme: Queen Elizabeth, palace interiors, royal protocol, historical drama',
      'downton abbey': 'Edwardian estate theme: upstairs downstairs, British aristocracy, period costume, elegant drama',
      'vikings': 'Norse warrior theme: Ragnar Lothbrok, longship raids, runic symbolism, brutal conquest',
      'last kingdom': 'Saxon England theme: Uhtred of Bebbanburg, Viking age, shield walls, historical fiction',
      'outlander': 'Scottish time travel theme: Highland romance, Jacobite rebellion, standing stones, kilts and castles',
      
      // Classic Films
      'casablanca': 'classic Hollywood noir theme: black and white glamour, 1940s Morocco, romantic sacrifice, play it again',
      'citizen kane': 'classic cinema theme: deep focus, rosebud mystery, newspaper empire, Orson Welles masterpiece',
      'gone with the wind': 'Civil War epic theme: Tara plantation, Southern belle, Old South, sweeping romance',
      'wizard of oz': 'technicolor fantasy theme: yellow brick road, Emerald City, ruby slippers, somewhere over the rainbow',
      'singin in the rain': 'Hollywood musical theme: golden age, song and dance, rainy street, movie magic',
      'breakfast at tiffanys': 'New York sophistication theme: little black dress, Holly Golightly, 1960s elegance, Tiffany blue',
      'some like it hot': 'screwball comedy theme: 1920s gangsters, cross-dressing hijinks, Marilyn Monroe, jazz age',
      'sunset boulevard': 'Hollywood noir theme: faded glamour, Norma Desmond, silent film era, dramatic descent',
      'rear window': 'Hitchcock suspense theme: voyeuristic photography, courtyard mystery, Jimmy Stewart, tension building',
      'vertigo': 'psychological thriller theme: San Francisco, spiralling obsession, Hitchcock green, identity mystery',
      'north by northwest': 'spy thriller theme: crop duster chase, Mount Rushmore, mistaken identity, Hitchcock adventure',
      '2001 space odyssey': 'philosophical sci-fi theme: Kubrick precision, HAL 9000, monolith mystery, classical music in space',
      'clockwork orange': 'dystopian satire theme: ultraviolence, Nadsat slang, droogs aesthetic, Kubrick surrealism',
      'dr strangelove': 'nuclear satire theme: cold war absurdity, war room, bomb riding, Kubrick dark comedy',
      'godfather classic': 'mafia epic theme: Corleone family, orange imagery, dimly lit offices, offer you cant refuse',
      'taxi driver': 'urban alienation theme: 1970s New York, mohawk vigilante, neon sleaze, you talkin to me',
      'raging bull': 'boxing drama theme: black and white brutality, Jake LaMotta, ring violence, Scorsese intensity',
      'apocalypse now': 'Vietnam War epic theme: river journey, heart of darkness, napalm sunsets, horror of war',
      'platoon': 'Vietnam soldier theme: jungle warfare, moral conflict, Oliver Stone, soldier perspective',
      'full metal jacket': 'military training theme: boot camp brutality, Vietnam duality, Kubrick war, born to kill',
      'saving private ryan': 'D-Day invasion theme: Normandy beach, desaturated war colours, band of brothers, sacrifice',
      'schindlers list': 'Holocaust drama theme: black and white, red coat, Oscar Schindler, profound tragedy',
      
      // Cartoon TV Shows & Animated Series
      'simpsons': 'classic American animated sitcom theme: bright yellow skin tones, suburban small-town satire, donut and beer motifs, chunky black cartoon outlines, four-finger hand animation style, warm yellow (#FED90F) as dominant colour, couch gag energy',
      'the simpsons': 'classic American animated sitcom theme: bright yellow skin tones, suburban small-town satire, donut and beer motifs, chunky black cartoon outlines, four-finger hand animation style, warm yellow (#FED90F) as dominant colour, couch gag energy',
      'family guy': 'irreverent animated sitcom theme: crude cutaway humour, bright primary colours, exaggerated cartoon physics, Rhode Island suburban setting, adult animation comedy',
      'south park': 'construction paper cut-out animation theme: deliberately crude simple shapes, Colorado mountain town, satirical social commentary, cardboard aesthetic, four boys silhouettes',
      'futurama': 'retro sci-fi cartoon theme: year 3000 metropolis, delivery company spaceship, robot and human buddy comedy, shiny metal aesthetic, Matt Groening-style animation',
      'bobs burgers': 'warm family restaurant cartoon theme: burger joint aesthetic, quirky wholesome family, handwritten chalkboard signage, Brooklyn neighbourhood vibes, simple line-art animation',
      'archer': 'spy cartoon theme: mid-century modern aesthetic, secret agent comedy, danger zone attitude, sleek 1960s styling, adult animated sophistication',
      'rick and morty': 'interdimensional sci-fi adventure theme: portal green (#00FF00), chaotic multiverse, mad scientist aesthetic, drool and burp humour, Adult Swim cartoon style',
      'gravity falls': 'mystery cartoon theme: Oregon woodland setting, monster-of-the-week format, sibling detective adventure, cipher codes and secrets, pine tree symbols',
      'adventure time': 'candy kingdom fantasy theme: pastel rainbow colours, stretchy limbs aesthetic, surreal post-apocalyptic landscapes, mathematical catchphrase energy',
      'regular show': 'slacker park worker cartoon theme: 80s pop culture references, mundane jobs gone wild, blue jay and raccoon silhouettes, Cartoon Network aesthetic',
      'steven universe': 'gem warrior theme: magical gem powers, pastel Beach City colours, inclusive themes, crystal and star motifs, magical girl influences',
      'avatar last airbender': 'elemental bending theme: four nations (water/earth/fire/air), Asian-inspired fantasy world, martial arts stances, arrow tattoo motifs, anime-influenced animation',
      'avatar the last airbender': 'elemental bending theme: four nations (water/earth/fire/air), Asian-inspired fantasy world, martial arts stances, arrow tattoo motifs, anime-influenced animation',
      'legend of korra': 'Republic City theme: 1920s Asian-inspired steampunk, pro-bending sports, industrial revolution meets bending, sequel series aesthetics',
      'spongebob': 'underwater cartoon theme: pineapple house, jellyfish fields, underwater fast food, nautical nonsense humour, absurdist sea life comedy',
      'spongebob squarepants': 'underwater cartoon theme: pineapple house, jellyfish fields, underwater fast food, nautical nonsense humour, absurdist sea life comedy',
      'fairly oddparents': 'fairy godparent theme: magical wish granting, bright Nickelodeon pink and green colours, goldfish bowl, floating crowns and wands',
      'jimmy neutron': 'boy genius theme: 1950s retrofuturist town, science experiments gone wrong, big brain swirl hairstyle, early 2000s CGI, rocket backpack',
      'dexters lab': 'secret laboratory theme: boy genius underground lab, annoying sister chaos, Hanna-Barbera style, science vs sibling rivalry',
      'powerpuff girls': 'Chemical X superhero theme: sugar spice and everything nice, Townsville skyline, girl power trio, bright punchy colours, bug-eyed cute characters',
      'samurai jack': 'epic samurai theme: minimal dialogue, cinematic wide-angle framing, feudal Japan meets dark future, stylised geometric action, thick line art',
      'courage the cowardly dog': 'rural horror comedy theme: isolated farmhouse in Nowhere, surreal scares, purple dog silhouette, nightmare fuel with heart',
      'fosters home': 'imaginary friends theme: colourful creature designs, Victorian mansion, creative character shapes, friendship and adoption themes',
      'codename kids next door': 'kid spy treehouse theme: 2x4 wooden technology, anti-adult missions, operation codenames, numeral designations',
      'teen titans': 'teenage superhero team theme: anime-influenced action, T-shaped tower, serious comic book adaptation, Jump City skyline',
      'teen titans go': 'wacky chibi superhero comedy theme: chibi art style, fourth wall breaking, pizza obsession, goofy parody humour',
      'phineas and ferb': 'summer vacation invention theme: backyard megaprojects, triangular and rectangular head shapes, secret agent platypus, catchy musical numbers',
      'bluey': 'Australian heeler dog family theme: Brisbane suburb setting, imaginative play, heartfelt parenting moments, gentle Aussie humour, bluey blue (#5B9BD5) dominant colour',
      'peppa pig': 'British preschool cartoon theme: muddy puddles, simple geometric pig shapes, cheerful British narration, pink dominant colour',
      'paw patrol': 'rescue pup team theme: Adventure Bay seaside town, helpful dog heroes, primary colour vehicles, preschool action adventure',
      'cocomelon': 'nursery rhyme educational theme: baby and toddler faces, bright primary educational colours, simple CGI animation, repetitive learning songs',
      'scooby doo': 'mystery solving team theme: groovy 1960s van, zoinks and jinkies catchphrases, masked villain reveals, dog and hippie detective duo',
      'looney tunes': 'classic cartoon slapstick theme: Thats All Folks iris wipe, Acme products and explosions, golden age animation, carrot-munching attitude',
      'tom and jerry': 'cat and mouse chase theme: slapstick violence, MGM golden age, wordless physical comedy, eternal pursuit and rivalry',
      'mickey mouse': 'classic animation mascot theme: red shorts and white gloves, cheerful optimism, pie-eyed vintage cartoon style, circular ear silhouettes',
      'donald duck': 'sailor cartoon theme: blue sailor suit, comic temper tantrums, quacking voice, Duckburg adventure setting',
      'winnie the pooh': 'Hundred Acre Wood theme: honey pots, gentle woodland friends, cosy comfort aesthetic, storybook illustration style, red shirt bear silhouette',
      'bambi': 'forest wildlife theme: woodland deer family, nature beauty, circle of life narrative, watercolour background style',
      'dumbo': 'circus elephant theme: oversized ears, pink elephant dream sequence, mother love story, vintage circus aesthetic',
      'jungle book': 'Indian jungle adventure theme: jungle animal friends, bare necessities philosophy, tiger danger, musical animal characters',
      'aristocats': 'Parisian cat family theme: sophisticated felines in bowties, jazz music, 1910s France setting, Duchess elegance',
      'robin hood': 'medieval fox outlaw theme: steal from the rich, forest outlaws, archery contests, animal kingdom England',
      '101 dalmatians': 'spotted puppy rescue theme: dalmatian dots pattern, London adventure, villain with two-tone hair, puppy chaos',
      'lady and the tramp': 'romantic dog tale theme: spaghetti dinner scene, 1909 Americana, class differences love story, cocker spaniel elegance',
      'little mermaid': 'underwater princess theme: mermaid tail fins, coral reef kingdom, crab conductor, sea shell bra, part of your world longing',
      'hercules': 'Greek mythology comedy theme: zero to hero journey, Mount Olympus gods, underworld sass, gospel choir interludes, ancient Greece setting',
      'hunchback': 'Gothic cathedral theme: Paris Notre Dame setting, bell tower sanctuary, gargoyle friends, dark mature storytelling',
      'pocahontas': 'Native American nature theme: 1607 Jamestown setting, colours of the wind, raccoon and hummingbird companions, river and forest',
      'tarzan': 'jungle vine-swinging theme: ape family, tree surfing action, two worlds collision, Phil Collins drum rhythms',
      'lilo and stitch': 'Hawaiian alien adoption theme: ohana means family, blue experiment creature, surfing and Elvis music, island warmth',
      'emperors new groove': 'Incan comedy theme: llama transformation, no touchy attitude, buddy comedy, Andean temple setting',
      'atlantis': 'lost underwater city theme: 1914 expedition aesthetic, ancient advanced civilization, submarine adventure, linguistic scholar hero',
      'treasure planet': 'space pirate sailing theme: cosmic ship sailing, cyborg pirates, steampunk solar sails, Jim Hawkins journey',
      'big hero 6': 'San Fransokyo superhero theme: healthcare robot balloon, tech genius team, Japanese-American city fusion, fist bump greeting',
      'zootopia': 'mammal metropolis theme: bunny police officer, predator and prey coexistence, city district diversity, try everything attitude',
      'wreck it ralph': 'video game world hopping theme: arcade cabinet universe, villain with heart of gold, candy racing world, retro 8-bit alongside modern 3D',
      'bolt': 'TV dog hero journey theme: Hollywood to heartland road trip, cat and hamster companions, real adventure discovery',
      'meet the robinsons': 'quirky inventor family theme: time travel adventure, keep moving forward philosophy, eccentric future family, retro-futuristic gadgets',
      
      // Australian Films
      'the castle': 'Aussie suburban battler theme: fibro house aesthetics, backyard BBQ, power lines and airport runway, warm family kitchen, daggy 90s Australian suburbia, jousting sticks and pool room vibes, dreamer optimism, working-class heart and home pride',
      'castle': 'Aussie suburban battler theme: fibro house aesthetics, backyard BBQ, power lines and airport runway, warm family kitchen, daggy 90s Australian suburbia, jousting sticks and pool room vibes, dreamer optimism, working-class heart and home pride',
      'crocodile dundee': 'Australian outback adventure theme: red desert landscapes, crocodile imagery, bush hat and knife, Kakadu wilderness, fish-out-of-water in New York, 80s adventure comedy',
      'mad max fury road': 'post-apocalyptic Australian wasteland theme: rust and chrome war rigs, desert orange and black, tribal war paint, V8 engines, witness me energy, practical stunts',
      'priscilla': 'outback drag queen road trip theme: fabulous costumes, pink bus, desert glamour, ABBA energy, queer joy across the red centre',
      'muriel\'s wedding': 'Australian coastal town escape theme: 90s suburban Australia, wedding dress dreams, ABBA obsession, Porpoise Spit vibes, transformation journey',
      'muriels wedding': 'Australian coastal town escape theme: 90s suburban Australia, wedding dress dreams, ABBA obsession, Porpoise Spit vibes, transformation journey',
      'gallipoli': 'WWI Australian digger theme: ANZAC spirit, Gallipoli beaches, running at dawn, sacrifice and mateship, Peter Weir beauty',
      'rabbit proof fence': 'Stolen Generation journey theme: Western Australian outback, Aboriginal resilience, fence-line escape, red earth and blue sky',
      'strictly ballroom': 'Australian ballroom dancing theme: sequins and spray tan, dance competition, bold colours, Baz Luhrmann flair, paso doble passion',
      'lion': 'Indian-Australian adoption story theme: Kolkata streets to Tasmania, Google Earth search, family reunion, emotional journey',
      'animal kingdom': 'Melbourne crime family theme: suburban Australian noir, family loyalty, tense domestic drama, gritty realism',
    };

    // Check for franchise matches
    for (const [franchise, vibe] of Object.entries(franchiseMappings)) {
      if (lower.includes(franchise)) {
        return `${vibe}. CRITICAL: Do NOT include any copyrighted characters, logos, trademarked names, or recognisable IP. Create an ORIGINAL design inspired by the visual style only.`;
      }
    }

    return trimmed;
  };

  const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
    const sections: string[] = [];

    // NEW: "What You Missed" header
    sections.push(`WHAT YOU MISSED`);
    sections.push(`─────────────────────────────────`);
    
    // PROMINENT DATE (hero element)
    if (data.meetingDate) {
      sections.push(`\n📅 ${data.meetingDate}`);
    }
    if (data.meetingTime) {
      sections.push(`⏰ ${data.meetingTime}`);
    }
    
    // Meeting Title
    sections.push(`\nMEETING: "${data.meetingTitle}"`);
    
    if (data.location) {
      sections.push(`📍 ${data.location}`);
    }

    // Executive summary as "THE MEETING IN BRIEF"
    const execMatch = data.notesContent.match(/(?:#|##)\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (execMatch) {
      sections.push('\n📝 THE MEETING IN BRIEF:');
      const summary = execMatch[1].trim();
      sections.push(summary.length > 400 ? summary.substring(0, 400) + '...' : summary);
    }

    // Extract Key Points from Discussion Summary
    const keyPointsMatch = data.notesContent.match(/(?:#|##)\s*(?:Key Points|KEY POINTS|DISCUSSION SUMMARY)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (keyPointsMatch) {
      sections.push('\n💡 KEY DISCUSSION POINTS:');
      const keyPoints = keyPointsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 5);
      sections.push(keyPoints.join('\n'));
    }

    // Key decisions
    const decisionsMatch = data.notesContent.match(/(?:#|##)\s*(?:KEY DECISIONS|DECISIONS)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (decisionsMatch) {
      sections.push('\n✅ DECISIONS MADE:');
      const decisions = decisionsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 4);
      sections.push(decisions.join('\n'));
    }

    // Action items - now SECONDARY (just a count)
    if (data.actionItems.length > 0) {
      sections.push(`\n📋 ${data.actionItems.length} action item${data.actionItems.length > 1 ? 's' : ''} assigned`);
    }

    return sections.join('\n');
  };

  const generateInfographic = async (
    data: MeetingInfographicData,
    options?: InfographicOptions
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content for infographic
      const documentContent = formatMeetingForInfographic(data);
      
      // Log options received - CRITICAL for debugging custom styles
      console.log('[useMeetingInfographic] Options received:', JSON.stringify(options));
      console.log('[useMeetingInfographic] customStyle value:', options?.customStyle);
      console.log('[useMeetingInfographic] style value:', options?.style);
      
      // Build style instruction based on preset or custom style
      // Determine if using custom style
      const isCustomStyle = !!options?.customStyle?.trim();
      console.log('[useMeetingInfographic] isCustomStyle:', isCustomStyle);
      let styleInstruction: string;
      
      if (isCustomStyle) {
        // For custom styles, give full creative freedom to the user's request
        const safeStyle = sanitiseCustomStyleRequest(options.customStyle);
        styleInstruction = `CUSTOM STYLE REQUEST: "${safeStyle}"
        
IMPORTANT: Apply this custom visual style as the PRIMARY design direction. 
Be creative and interpret the style request fully. The style should be clearly visible throughout the design.
Examples:
- For a "space‑opera sci‑fi" theme: starfield background, glowing accents, futuristic typography, cinematic contrast.
- For a "retro 80s" theme: neon colours, grid patterns, synthwave aesthetics.
Maintain readability but prioritise the requested visual style.`;
        console.log('[useMeetingInfographic] Using custom style:', options.customStyle);
      } else {
        const styleData = INFOGRAPHIC_STYLES[options?.style || 'clean-professional'];
        styleInstruction = styleData?.prompt || INFOGRAPHIC_STYLES['clean-professional'].prompt;
        console.log('[useMeetingInfographic] Using preset style:', options?.style || 'clean-professional');
      }
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Use Promise.race for timeout since Supabase client doesn't support AbortController
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      // Determine orientation - default to landscape
      const orientation = options?.orientation || 'landscape';
      const orientationInstruction = orientation === 'landscape' 
        ? 'Landscape orientation (16:9 aspect ratio), suitable for presentations and widescreen displays'
        : 'Portrait orientation (9:16 or A4 aspect ratio), suitable for printing and mobile viewing';

      // Build design requirements - conditionally include NHS styling only for preset styles
      const designRequirements = isCustomStyle 
        ? `- "WHAT YOU MISSED" banner/badge styling at the top
- ${orientationInstruction}
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Apply the custom style throughout ALL visual elements
- British English spelling throughout
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make the custom style the dominant visual theme`
        : `- "WHAT YOU MISSED" banner/badge styling at the top
- ${orientationInstruction}
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Professional GP practice/NHS styling
- British English spelling throughout
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make it feel like catching up with a colleague, not a task list`;

      const customPrompt = `Create a HIGH QUALITY "WHAT YOU MISSED" meeting overview infographic.

MEETING: "${data.meetingTitle}"

CONCEPT: This is a visual catch-up for people who missed the meeting. 
Focus on WHAT HAPPENED, not just tasks.

VISUAL STYLE INSTRUCTIONS:
${styleInstruction}

CRITICAL CONTENT HIERARCHY (in order of visual prominence):

1. "WHAT YOU MISSED" - Bold header at top
2. DATE AND TIME - Display VERY PROMINENTLY as a HERO ELEMENT (large, styled)
   ${data.meetingDate ? `Date: ${data.meetingDate}` : ''}
   ${data.meetingTime ? `Time: ${data.meetingTime}` : ''}
3. MEETING TITLE - Clear and readable
4. THE MEETING IN BRIEF - Key summary paragraph (what this meeting was about)
5. KEY DISCUSSION POINTS - The main topics and conversations that took place
6. DECISIONS MADE - Important outcomes that were agreed
7. ACTION ITEMS - Small/optional section with just a count or brief mention

DESIGN REQUIREMENTS:
${designRequirements}`;

      const invokePromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: customPrompt,
          conversationContext: '',
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          practiceContext: {
            brandingLevel: 'none'
          }
        },
      });

      const { data: response, error: fnError } = await Promise.race([invokePromise, timeoutPromise]);

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate infographic');
      }

      // The edge function returns { success, image: { url }, textResponse }
      const imageUrl = response?.image?.url;
      if (!imageUrl) {
        throw new Error(response?.error || response?.textResponse || 'No image generated');
      }

      setCurrentPhase('downloading');

      // Download the image
      
      // Handle both base64 and URL responses
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        // Base64 image
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        // URL - fetch and convert to blob
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to download infographic image');
        }
        blob = await imageResponse.blob();
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      const safeTitle = data.meetingTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      link.download = `${safeTitle}_Summary_Infographic.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCurrentPhase('complete');
      
      return {
        success: true,
        imageUrl: imageUrl,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[MeetingInfographic] Generation error:', err);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateInfographic,
    isGenerating,
    currentPhase,
    error,
  };
};
