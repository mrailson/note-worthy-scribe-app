import { useEffect } from 'react';

const NHSQuest = () => {
  useEffect(() => {
    // Initialize the Resistance battle on mount
    initBattle();
  }, []);

  // --- LEVEL 1: HOLOGRAM DATA ---
  const openHologram = (key: string) => {
    const holoData: Record<string, { title: string; content: string }> = {
      dtac: {
        title: "DTAC: The Trials of Mandalore",
        content: `
          <p><strong>Digital Technology Assessment Criteria.</strong> This is the way. You cannot sell to the NHS without passing these trials. It brings together 4 key pillars:</p>
          <ul>
            <li><strong>Clinical Safety:</strong> Proving you won't hurt anyone (DCB0129).</li>
            <li><strong>Data Protection:</strong> GDPR compliance (DPIA).</li>
            <li><strong>Technical Security:</strong> Pen testing and Cyber Essentials.</li>
            <li><strong>Interoperability:</strong> Can you talk to other droids (HL7/FHIR)?</li>
          </ul>
          <p class="sw-quote">"This is not just a form. It is a creed. Pass or fail, there is no try."</p>
        `
      },
      dcb0129: {
        title: "DCB0129: Weapon Safety Protocol",
        content: `
          <p><strong>Clinical Safety for Manufacturers.</strong> You are building a lightsaber. You must prove the crystal is stable.</p>
          <ul>
            <li><strong>Clinical Safety Officer (CSO):</strong> You need to hire a registered clinician (The Master) to oversee safety.</li>
            <li><strong>Hazard Log:</strong> A list of every way your tool could kill someone (e.g., "AI hallucinates wrong dose").</li>
            <li><strong>Safety Case Report:</strong> The document proving you mitigated those risks.</li>
          </ul>
          <p class="sw-quote">"Great kid, don't get cocky. One bug in the code could blow up the whole station."</p>
        `
      },
      dpia: {
        title: "DPIA: The Holocron Shield",
        content: `
          <p><strong>Data Protection Impact Assessment.</strong> Essential for GDPR.</p>
          <ul>
            <li><strong>Data Mapping:</strong> Where does the patient data go? US Servers? (Big no-no). Keep it in the UK/EEA.</li>
            <li><strong>Lawful Basis:</strong> Why are you processing this? (e.g., Direct Care).</li>
            <li><strong>Risk Mitigation:</strong> Encryption at rest and in transit.</li>
          </ul>
          <p class="sw-quote">"Many Bothans died to bring us this information. Don't let it leak."</p>
        `
      },
      cyber: {
        title: "Cyber Essentials: Deflector Shields",
        content: `
          <p>The basic hygiene required by the UK Government.</p>
          <ul>
            <li><strong>Firewalls:</strong> Keep the Empire out.</li>
            <li><strong>Secure Configuration:</strong> No default passwords (admin/admin).</li>
            <li><strong>Patch Management:</strong> Fix the holes in the Millennium Falcon's hull.</li>
            <li><strong>MFA:</strong> Multi-Factor Auth is mandatory. No exceptions.</li>
          </ul>
          <p class="sw-quote">"Shields up! Red alert! If you don't have this, you are sitting duck for ransomware."</p>
        `
      },
      mhra: {
        title: "MHRA: The High Senate",
        content: `
          <p><strong>Medicines and Healthcare products Regulatory Agency.</strong></p>
          <ul>
            <li><strong>Class I:</strong> Low risk. You self-certify. (e.g., a digital diary).</li>
            <li><strong>Class IIa+:</strong> You actively diagnose or calculate treatment. You need a "Notified Body" (External Auditors) to approve you.</li>
            <li><strong>Post Market Surveillance:</strong> You must watch your tool forever for bugs.</li>
          </ul>
          <p class="sw-quote">"I am the Senate. - MHRA Auditors when you argue with them."</p>
        `
      }
    };

    const modal = document.getElementById('holoModal');
    const title = document.getElementById('holoTitle');
    const content = document.getElementById('holoContent');
    
    if (modal && title && content) {
      title.innerText = holoData[key].title;
      content.innerHTML = holoData[key].content;
      modal.classList.add('active');
    }
  };

  const closeHologram = (e: any) => {
    if (e === null || e.target.id === 'holoModal' || e.target.classList.contains('holo-close')) {
      const modal = document.getElementById('holoModal');
      if (modal) modal.classList.remove('active');
    }
  };

  // --- QUIZ LOGIC ---
  const nextQ = (id: string) => {
    document.querySelectorAll('.quiz-container > div').forEach(el => el.classList.add('hidden'));
    const element = document.getElementById(id);
    if (element) element.classList.remove('hidden');
  };

  const showResult = (type: string) => {
    document.querySelectorAll('.quiz-container > div').forEach(el => el.classList.add('hidden'));
    const result = document.getElementById('result');
    if (result) result.classList.remove('hidden');
    
    const t = document.getElementById('result-title');
    const d = document.getElementById('result-desc');
    
    if (t && d) {
      if (type === 'non-device') { 
        t.innerText = "IT SYSTEM"; 
        d.innerText = "Likely just IT. Focus on DTAC."; 
      } else if (type === 'class1') { 
        t.innerText = "CLASS I"; 
        d.innerText = "Low risk. Self-certify + ISO 13485."; 
      } else if (type === 'class2a') { 
        t.innerText = "CLASS IIa"; 
        d.innerText = "Moderate Risk. Needs Notified Body Audit."; 
      } else { 
        t.innerText = "CLASS IIb"; 
        d.innerText = "High Risk. Strict regulation."; 
      }
    }
  };

  const resetQuiz = () => nextQ('q-start');

  // --- SCANNER LOGIC ---
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameActive = false;

  const startScan = async () => {
    const inputElement = document.getElementById('domainInput') as HTMLInputElement;
    if (!inputElement) return;
    
    const domain = inputElement.value.replace(/https?:\/\//, '').split('/')[0];
    if (!domain) {
      alert("Enter a domain, Padawan.");
      return;
    }
    
    const gameContainer = document.getElementById('gameContainer');
    const vaderScreen = document.getElementById('vaderScreen');
    const scanLog = document.getElementById('scanLog');
    
    if (gameContainer) gameContainer.style.display = 'block';
    if (vaderScreen) vaderScreen.classList.add('hidden');
    if (scanLog) scanLog.innerHTML = "SCANNING SECTOR " + domain + "...";
    
    canvas = document.getElementById('spaceCanvas') as HTMLCanvasElement;
    if (canvas) {
      ctx = canvas.getContext('2d');
      const container = document.getElementById('gameContainer');
      if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = 400;
      }
      gameActive = true;
      animateSpace();
    }

    const issues: string[] = [];
    
    const log = (m: string) => {
      if (scanLog) scanLog.innerHTML += m + "<br>";
    };
    
    // Fake Scan Logic for Demo
    log(">> CHECKING SHIELDS (SPF)...");
    try {
      const r = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
      const d = await r.json();
      const hasSPF = d.Answer && d.Answer.some((rec: any) => rec.data.includes("v=spf1"));
      setTimeout(() => {
        if (hasSPF) { log(">> SPF DETECTED [PASS]"); }
        else { log(">> SPF MISSING [FAIL]"); issues.push("No SPF Record"); }
      }, 1000);
    } catch (e) { log(">> SENSOR JAMMED (DNS ERROR)"); }

    setTimeout(async () => {
      log(">> CHECKING CLOAKING (DMARC)...");
      try {
        const r = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`);
        const d = await r.json();
        const hasDMARC = d.Answer && d.Answer.some((rec: any) => rec.data.includes("v=DMARC1"));
        if (hasDMARC) log(">> DMARC DETECTED [PASS]");
        else { log(">> DMARC MISSING [FAIL]"); issues.push("No DMARC Record"); }
        setTimeout(() => endGame(issues), 1500);
      } catch (e) { endGame(issues); }
    }, 1500);
  };

  const animateSpace = () => {
    if (!gameActive || !ctx || !canvas) return;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }
    requestAnimationFrame(animateSpace);
  };

  const endGame = (issues: string[]) => {
    gameActive = false;
    const vaderScreen = document.getElementById('vaderScreen');
    const vaderTitle = document.getElementById('vaderTitle');
    const vaderMsg = document.getElementById('vaderMsg');
    
    if (vaderScreen) vaderScreen.classList.remove('hidden');
    
    if (vaderTitle && vaderMsg) {
      if (issues.length === 0) { 
        vaderTitle.innerText = "THE FORCE IS STRONG."; 
        vaderTitle.style.color = "var(--neon-green)"; 
        vaderMsg.innerText = "Domain Secure."; 
      } else { 
        vaderTitle.innerText = "I FIND YOUR LACK OF SECURITY DISTURBING."; 
        vaderTitle.style.color = "var(--neon-red)"; 
        vaderMsg.innerText = "Issues: " + issues.join(", "); 
      }
    }
  };

  const closeGame = () => {
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) gameContainer.style.display = 'none';
  };

  // --- RESISTANCE LOGIC ---
  let trust = 20;
  let stage = 0;
  
  const scenarios = [
    {
      text: "\"We do not need your droids! My stethoscope has served me for 800 years. AI will steal our jobs!\"",
      options: {
        aggressive: { txt: "A: Future is now, old man.", effect: -20, reply: "\"Insolence! You sound like a Sith!\"" },
        tech: { txt: "B: It uses 12B parameters.", effect: -10, reply: "\"Speak Basic! I am a doctor, not a droid mechanic!\"" },
        empathy: { txt: "C: It's a Co-Pilot. It does admin.", effect: 40, reply: "\"Hmm. Less paperwork? Like a protocol droid?\"" },
        bribe: { txt: "D: Take these credits.", effect: -50, reply: "\"Bribery?! Guard! Seize him!\"" }
      }
    },
    {
      text: "\"But is it safe? What if it hallucinates and poisons the patient?\"",
      options: {
        aggressive: { txt: "A: Trust me, bro.", effect: -30, reply: "\"Trust is earned! Get out!\"" },
        tech: { txt: "B: We have a DCB0129 Safety Case.", effect: 40, reply: "\"DCB0129... The Safety Shield? Good.\"" },
        empathy: { txt: "C: Nothing is 100% safe.", effect: -10, reply: "\"A dangerous gamble.\"" },
        bribe: { txt: "D: Blockchain secures it.", effect: -10, reply: "\"Stop making up words!\"" }
      }
    },
    {
      text: "\"The NHS has no credits! We power the lights with a hamster wheel. How can we afford this?\"",
      options: {
        aggressive: { txt: "A: Expensive but worth it.", effect: -10, reply: "\"We cannot afford it!\"" },
        tech: { txt: "B: It scales via Cloud API.", effect: 0, reply: "\"Clouds? We are in a basement!\"" },
        empathy: { txt: "C: It saves 1 hour/day per GP.", effect: 50, reply: "\"An extra hour? To actually see patients? This is the way.\"" },
        bribe: { txt: "D: It's free for data.", effect: -100, reply: "\"You want our data?! SPY!\"" }
      }
    }
  ];
  
  const initBattle = () => {
    trust = 20;
    stage = 0;
    
    const battleOptions = document.getElementById('battleOptions');
    const npcDialogue = document.getElementById('npcDialogue');
    const battleResult = document.getElementById('battleResult');
    
    if (battleOptions) battleOptions.classList.remove('hidden');
    if (npcDialogue) npcDialogue.classList.remove('hidden');
    if (battleResult) battleResult.classList.add('hidden');
    
    updateTrust(0);
    renderStage();
  };

  const renderStage = () => {
    if (stage >= scenarios.length) { 
      endBattle(); 
      return; 
    }
    
    const s = scenarios[stage];
    const npcDialogue = document.getElementById('npcDialogue');
    if (npcDialogue) npcDialogue.innerText = s.text;
    
    const keys: Array<'aggressive' | 'tech' | 'empathy' | 'bribe'> = ['aggressive', 'tech', 'empathy', 'bribe'];
    const btns = document.querySelectorAll('.rpg-btn') as NodeListOf<HTMLButtonElement>;
    
    keys.forEach((k, i) => {
      if (btns[i]) {
        btns[i].innerText = s.options[k].txt;
        btns[i].disabled = false;
        btns[i].onclick = () => makeMove(k);
      }
    });
  };

  const makeMove = (k: 'aggressive' | 'tech' | 'empathy' | 'bribe') => {
    const choice = scenarios[stage].options[k];
    updateTrust(choice.effect);
    
    const npcDialogue = document.getElementById('npcDialogue');
    if (npcDialogue) npcDialogue.innerText = choice.reply;
    
    document.querySelectorAll('.rpg-btn').forEach((b: any) => b.disabled = true);
    
    setTimeout(() => {
      if (trust <= 0) showEnd(false, "TRUST BROKEN", "Ejected from the practice.");
      else if (k === 'bribe' && stage === 2) showEnd(false, "ARRESTED", "To the spice mines of Kessel with you.");
      else { stage++; renderStage(); }
    }, 2000);
  };

  const updateTrust = (val: number) => {
    trust += val;
    if (trust > 100) trust = 100;
    if (trust < 0) trust = 0;
    
    const bar = document.getElementById('trustBar');
    const trustText = document.getElementById('trustText');
    
    if (bar) {
      bar.style.width = trust + "%";
      if (trust < 30) bar.style.background = "var(--neon-red)";
      else if (trust < 70) bar.style.background = "var(--neon-gold)";
      else bar.style.background = "var(--neon-green)";
    }
    
    if (trustText) trustText.innerText = trust + "%";
  };

  const endBattle = () => {
    if (trust >= 80) showEnd(true, "CONTRACT SIGNED", "The Force is strong with this tool.");
    else showEnd(false, "STALEMATE", "Come back when you are a Master.");
  };

  const showEnd = (win: boolean, t: string, m: string) => {
    const battleOptions = document.getElementById('battleOptions');
    const npcDialogue = document.getElementById('npcDialogue');
    const res = document.getElementById('battleResult');
    const battleTitle = document.getElementById('battleTitle');
    const battleMsg = document.getElementById('battleMsg');
    
    if (battleOptions) battleOptions.classList.add('hidden');
    if (npcDialogue) npcDialogue.classList.add('hidden');
    if (res) res.classList.remove('hidden');
    
    if (battleTitle) {
      battleTitle.innerText = t;
      battleTitle.style.color = win ? "var(--neon-green)" : "var(--neon-red)";
    }
    
    if (battleMsg) battleMsg.innerText = m;
  };

  const resetBattle = () => initBattle();

  // Expose functions to window for inline onclick handlers
  useEffect(() => {
    (window as any).openHologram = openHologram;
    (window as any).closeHologram = closeHologram;
    (window as any).nextQ = nextQ;
    (window as any).showResult = showResult;
    (window as any).resetQuiz = resetQuiz;
    (window as any).startScan = startScan;
    (window as any).closeGame = closeGame;
    (window as any).resetBattle = resetBattle;
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-dark: #0d1117;
          --bg-card: #161b22;
          --neon-green: #00ff41;
          --neon-pink: #ff00ff;
          --neon-blue: #00f3ff;
          --neon-red: #ff003c;
          --neon-gold: #ffd700;
          --text-main: #c9d1d9;
          --hologram-blue: rgba(0, 243, 255, 0.15);
        }

        .nhs-quest-container * { box-sizing: border-box; }

        .nhs-quest-container {
          background-color: var(--bg-dark);
          color: var(--text-main);
          font-family: 'Fira Code', monospace;
          overflow-x: hidden;
          line-height: 1.6;
          scroll-behavior: smooth;
          min-height: 100vh;
        }

        .nhs-quest-container h1, .nhs-quest-container h2, .nhs-quest-container h3, .nhs-quest-container h4 {
          font-family: 'Orbitron', sans-serif;
          text-transform: uppercase;
          margin: 0;
        }

        .nhs-quest-header {
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: radial-gradient(circle at center, #1a2230 0%, #0d1117 70%);
          position: relative;
        }

        .nhs-quest-container h1.main-title {
          font-size: 4rem;
          color: var(--neon-green);
          text-shadow: 0 0 10px var(--neon-green);
          margin-bottom: 20px;
        }

        .nhs-quest-container .subtitle {
          font-size: 1.2rem;
          color: var(--neon-blue);
          max-width: 600px;
        }

        .nhs-quest-container .scroll-down {
          position: absolute;
          bottom: 30px;
          animation: bounce 2s infinite;
          color: var(--neon-pink);
          font-size: 2rem;
        }

        .nhs-quest-container section {
          padding: 80px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .nhs-quest-container .section-title {
          font-size: 2.5rem;
          border-bottom: 2px solid var(--neon-blue);
          padding-bottom: 10px;
          margin-bottom: 50px;
          display: inline-block;
        }

        .nhs-quest-container .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
        }

        .nhs-quest-container .card {
          background: var(--bg-card);
          border: 1px solid #30363d;
          padding: 25px;
          border-radius: 8px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }

        .nhs-quest-container .card:hover {
          transform: translateY(-5px);
          border-color: var(--neon-green);
          box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
        }

        .nhs-quest-container .card:hover .card-icon { color: var(--neon-green); }

        .nhs-quest-container .card-icon {
          font-size: 3rem;
          margin-bottom: 20px;
          color: var(--neon-pink);
          transition: 0.3s;
        }

        .nhs-quest-container .badge {
          display: inline-block;
          background: rgba(0, 243, 255, 0.1);
          color: var(--neon-blue);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          margin-bottom: 10px;
        }

        .nhs-quest-container .click-hint {
          font-size: 0.8rem;
          color: #666;
          margin-top: 15px;
          display: block;
        }

        .nhs-quest-container .modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.8);
          z-index: 100;
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          pointer-events: none;
          transition: 0.3s;
          backdrop-filter: blur(5px);
        }

        .nhs-quest-container .modal-overlay.active { opacity: 1; pointer-events: all; }

        .nhs-quest-container .hologram-panel {
          width: 90%;
          max-width: 700px;
          background: rgba(13, 17, 23, 0.95);
          border: 2px solid var(--neon-blue);
          box-shadow: 0 0 30px var(--neon-blue), inset 0 0 20px rgba(0, 243, 255, 0.2);
          padding: 30px;
          position: relative;
          transform: scale(0.8);
          transition: 0.3s;
          max-height: 90vh;
          overflow-y: auto;
        }

        .nhs-quest-container .modal-overlay.active .hologram-panel { transform: scale(1); }

        .nhs-quest-container .hologram-header {
          border-bottom: 1px solid var(--neon-blue);
          padding-bottom: 15px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nhs-quest-container .holo-close {
          background: transparent;
          border: none;
          color: var(--neon-blue);
          font-size: 1.5rem;
          cursor: pointer;
        }

        .nhs-quest-container .holo-content ul { list-style: none; padding: 0; }
        .nhs-quest-container .holo-content li {
          margin-bottom: 15px;
          padding-left: 20px;
          border-left: 2px solid var(--neon-pink);
        }

        .nhs-quest-container .sw-quote {
          font-style: italic;
          color: var(--neon-gold);
          font-family: 'Fira Code', monospace;
          margin-top: 20px;
          border: 1px dashed var(--neon-gold);
          padding: 10px;
        }

        .nhs-quest-container #classifier, .nhs-quest-container #resistance-section {
          border-radius: 15px;
          padding: 40px;
        }
        
        .nhs-quest-container #classifier {
          background: linear-gradient(135deg, #1a051a 0%, #0d1117 100%);
          border: 2px solid var(--neon-pink);
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.2);
        }
        
        .nhs-quest-container #resistance-section {
          background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwTDQwIDBIMHY0MHpNMzggMzlMMiAxdjM4aDM2eiIgZmlsbD0iIzIyMiIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=') #161b22;
          border: 4px solid var(--neon-gold);
        }

        .nhs-quest-container .btn {
          background: transparent;
          border: 2px solid var(--neon-green);
          color: var(--neon-green);
          padding: 15px 30px;
          font-family: 'Fira Code', monospace;
          font-size: 1rem;
          cursor: pointer;
          margin: 10px;
          transition: 0.3s;
          text-transform: uppercase;
          font-weight: bold;
        }
        
        .nhs-quest-container .btn:hover { 
          background: var(--neon-green); 
          color: #000; 
          box-shadow: 0 0 15px var(--neon-green); 
        }
        
        .nhs-quest-container .hidden { display: none !important; }

        .nhs-quest-container #scanner-section { 
          background: #000; 
          border: 1px solid #333; 
          overflow: hidden; 
          position: relative; 
        }
        
        .nhs-quest-container .input-group { 
          display: flex; 
          justify-content: center; 
          gap: 10px; 
          margin-bottom: 20px; 
        }
        
        .nhs-quest-container input[type="text"] { 
          background: #161b22; 
          border: 1px solid var(--neon-blue); 
          color: #fff; 
          padding: 15px; 
          width: 300px; 
        }
        
        .nhs-quest-container .game-container { 
          position: relative; 
          width: 100%; 
          height: 400px; 
          display: none; 
          border-top: 2px solid var(--neon-red); 
        }
        
        .nhs-quest-container .vader-overlay { 
          position: absolute; 
          top: 0; 
          left: 0; 
          width: 100%; 
          height: 100%; 
          background: rgba(0,0,0,0.85); 
          display: flex; 
          flex-direction: column; 
          justify-content: center; 
          align-items: center; 
          z-index: 10; 
          text-align: center; 
        }

        .nhs-quest-container .battle-arena { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          max-width: 800px; 
          margin: 0 auto; 
        }
        
        .nhs-quest-container .opponent-avatar { 
          width: 120px; 
          height: 120px; 
          background: var(--neon-blue); 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          box-shadow: 0 0 30px var(--neon-blue); 
          margin-bottom: 20px; 
          animation: float 3s ease-in-out infinite; 
        }
        
        .nhs-quest-container .dialogue-box { 
          background: rgba(0,0,0,0.8); 
          border: 2px solid #fff; 
          padding: 20px; 
          width: 100%; 
          margin-bottom: 20px; 
          font-family: 'Press Start 2P', cursive; 
          font-size: 0.8rem; 
          line-height: 1.8; 
          min-height: 120px; 
        }
        
        .nhs-quest-container .trust-meter-container { 
          width: 100%; 
          background: #333; 
          height: 20px; 
          border-radius: 10px; 
          margin-bottom: 30px; 
          position: relative; 
          overflow: hidden; 
        }
        
        .nhs-quest-container .trust-meter-fill { 
          height: 100%; 
          background: var(--neon-gold); 
          width: 20%; 
          transition: width 0.5s ease; 
        }
        
        .nhs-quest-container .options-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          width: 100%; 
        }
        
        .nhs-quest-container .rpg-btn { 
          background: #2a2a2a; 
          border: 1px solid #555; 
          color: #fff; 
          padding: 15px; 
          text-align: left; 
          cursor: pointer; 
          font-family: 'Fira Code', monospace; 
          transition: 0.2s; 
        }
        
        .nhs-quest-container .rpg-btn:hover { 
          background: var(--neon-blue); 
          color: #000; 
        }

        @keyframes float { 
          0%, 100% { transform: translateY(0px); } 
          50% { transform: translateY(-15px); } 
        }
        
        @keyframes bounce { 
          0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 
          40% {transform: translateY(-10px);} 
          60% {transform: translateY(-5px);} 
        }

        .nhs-quest-container footer {
          text-align: center;
          padding: 50px;
          background: #000;
          border-top: 1px solid #333;
        }
      `}} />

      <div className="nhs-quest-container">
        {/* HERO */}
        <header className="nhs-quest-header">
          <div className="glitch-wrapper">
            <h1 className="main-title">&lt;NHS_QUEST/&gt;</h1>
          </div>
          <p className="subtitle">
            A long time ago, in a server farm far, far away...<br />
            You built a cool AI tool. Now you must defeat the Empire of Compliance.
          </p>
          <a href="#stack" className="scroll-down"><i className="fas fa-chevron-down"></i></a>
        </header>

        {/* LEVEL 1: THE INVENTORY */}
        <section id="stack">
          <h2 className="section-title">Level 1: The Inventory</h2>
          <p>Tap a Data-Card to access the holographic schematics. Do not launch without these.</p>
          
          <div className="grid">
            <div className="card" onClick={() => openHologram('dtac')}>
              <div className="badge">ENTRY TICKET</div>
              <div className="card-icon"><i className="fas fa-id-card"></i></div>
              <h3>DTAC</h3>
              <p>Digital Technology Assessment Criteria. The entrance exam to the Jedi Temple.</p>
              <span className="click-hint">[ CLICK TO INSPECT ]</span>
            </div>

            <div className="card" onClick={() => openHologram('dcb0129')}>
              <div className="badge">DEV SIDE</div>
              <div className="card-icon"><i className="fas fa-hard-hat"></i></div>
              <h3>DCB0129</h3>
              <p>Clinical Safety (Manufacturer). Prove your lightsaber won't explode.</p>
              <span className="click-hint">[ CLICK TO INSPECT ]</span>
            </div>

            <div className="card" onClick={() => openHologram('dpia')}>
              <div className="badge">DATA PRIVACY</div>
              <div className="card-icon"><i className="fas fa-user-secret"></i></div>
              <h3>DPIA (GDPR)</h3>
              <p>Data Protection Impact Assessment. Don't let the Bothans steal the plans.</p>
              <span className="click-hint">[ CLICK TO INSPECT ]</span>
            </div>

            <div className="card" onClick={() => openHologram('cyber')}>
              <div className="badge">SHIELDS</div>
              <div className="card-icon"><i className="fas fa-shield-virus"></i></div>
              <h3>Cyber Essentials</h3>
              <p>Basic Deflector Shields. Protects against random blaster fire.</p>
              <span className="click-hint">[ CLICK TO INSPECT ]</span>
            </div>

            <div className="card" onClick={() => openHologram('mhra')}>
              <div className="badge">THE SENATE</div>
              <div className="card-icon"><i className="fas fa-dna"></i></div>
              <h3>MHRA Device Regs</h3>
              <p>The ultimate authority. Are you a simple droid or a Medical Device?</p>
              <span className="click-hint">[ CLICK TO INSPECT ]</span>
            </div>
          </div>
        </section>

        {/* HOLOGRAPHIC MODAL */}
        <div className="modal-overlay" id="holoModal" onClick={(e) => closeHologram(e)}>
          <div className="hologram-panel">
            <div className="hologram-header">
              <h2 id="holoTitle" style={{ color: 'var(--neon-blue)' }}>TITLE</h2>
              <button className="holo-close" onClick={(e) => { e.stopPropagation(); closeHologram(null); }}>&times;</button>
            </div>
            <div className="holo-content" id="holoContent">
            </div>
          </div>
        </div>

        {/* LEVEL 2: THE CLASSIFIER */}
        <section id="classifier">
          <h2 className="section-title">Level 2: Class-O-Matic</h2>
          <p style={{ color: '#fff' }}>Example: You built an AI Scribe. Is it a Medical Device?</p>
          <div className="quiz-container">
            <div id="q-start">
              <i className="fas fa-robot fa-3x" style={{ color: 'var(--neon-blue)', marginBottom: '20px' }}></i>
              <h3>Initiate Classification Sequence</h3>
              <button className="btn" onClick={() => nextQ('q1')}>Start Diagnostics</button>
            </div>
            
            <div id="q1" className="hidden">
              <h3>Does your tool affect treatment or diagnosis?</h3>
              <button className="btn" onClick={() => nextQ('q2-yes')}>YES</button>
              <button className="btn" onClick={() => showResult('non-device')}>NO</button>
            </div>
            
            <div id="q2-yes" className="hidden">
              <h3>Does it use AI to generate new info?</h3>
              <button className="btn" onClick={() => nextQ('q3')}>YES</button>
              <button className="btn" onClick={() => showResult('non-device')}>NO</button>
            </div>
            
            <div id="q3" className="hidden">
              <h3>If the AI is wrong, is it critical?</h3>
              <button className="btn" onClick={() => showResult('class2b')}>YES (Death/Critical)</button>
              <button className="btn" onClick={() => showResult('class2a')}>NO (Serious)</button>
              <button className="btn" onClick={() => showResult('class1')}>Unlikely (Minor)</button>
            </div>
            
            <div id="result" className="hidden">
              <div className="result-box" style={{ border: '2px dashed var(--neon-blue)', padding: '20px', marginTop: '20px' }}>
                <h2 id="result-title" style={{ color: 'var(--neon-green)' }}></h2>
                <p id="result-desc"></p>
              </div>
              <button className="btn" onClick={resetQuiz}>Restart</button>
            </div>
          </div>
        </section>

        {/* LEVEL 3: SCANNER */}
        <section id="scanner-section">
          <div className="scanner-ui">
            <h2 className="section-title" style={{ borderColor: 'var(--neon-red)' }}>Level 3: Domain Defense</h2>
            <p>Enter domain to scan for <strong>HTTPS, SPF & DMARC</strong>.</p>
            <div className="input-group">
              <input type="text" id="domainInput" placeholder="mysaas.com" />
              <button className="btn" style={{ borderColor: 'var(--neon-red)', color: 'var(--neon-red)' }} onClick={startScan}>ENGAGE SCANNERS</button>
            </div>
          </div>
          <div className="game-container" id="gameContainer">
            <div className="scan-log" id="scanLog"></div>
            <canvas id="spaceCanvas"></canvas>
            <div id="vaderScreen" className="vader-overlay hidden">
              <i className="fas fa-jedi fa-3x" style={{ color: '#555', marginBottom: '10px' }}></i>
              <div id="vaderTitle" style={{ fontFamily: 'Orbitron', fontSize: '1.5rem', marginBottom: '10px' }}></div>
              <p id="vaderMsg" style={{ color: 'white', maxWidth: '500px' }}></p>
              <button className="btn" onClick={closeGame}>Retreat</button>
            </div>
          </div>
        </section>

        {/* LEVEL 4: THE RESISTANCE */}
        <section id="resistance">
          <h2 className="section-title" style={{ borderColor: 'var(--neon-gold)', color: 'var(--neon-gold)' }}>Level 4: The Resistance</h2>
          <p>Win the hearts of the <strong>Grand Healers Council</strong> (GPs).</p>
          <div id="resistance-section">
            <div className="battle-arena">
              <div className="opponent-avatar"><i className="fas fa-user-md fa-3x" style={{ color: '#fff' }}></i></div>
              <div style={{ marginBottom: '10px', fontFamily: 'Orbitron', color: 'var(--neon-gold)' }}>GRAND HEALER KENOBI</div>
              <div className="trust-meter-container">
                <div className="trust-meter-fill" id="trustBar"></div>
                <div className="trust-label">CLINICAL TRUST: <span id="trustText">20%</span></div>
              </div>
              <div className="dialogue-box" id="npcDialogue">...</div>
              <div className="options-grid" id="battleOptions">
                <button className="rpg-btn"></button>
                <button className="rpg-btn"></button>
                <button className="rpg-btn"></button>
                <button className="rpg-btn"></button>
              </div>
              <div id="battleResult" className="hidden" style={{ textAlign: 'center' }}>
                <h2 id="battleTitle"></h2>
                <p id="battleMsg"></p>
                <button className="btn" onClick={resetBattle}>Try Again</button>
              </div>
            </div>
          </div>
        </section>

        <footer>
          <p>Made for Vibe Coders. May the Source Code be with you.</p>
        </footer>
      </div>
    </>
  );
};

export default NHSQuest;
