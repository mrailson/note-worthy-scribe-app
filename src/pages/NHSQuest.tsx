import { useEffect, useState, useRef } from 'react';

const NHSQuest = () => {
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [arcadeActive, setArcadeActive] = useState(false);
  const [arcadeScore, setArcadeScore] = useState(0);
  const [trust, setTrust] = useState(20);
  const [stage, setStage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });
  const [showBattleResult, setShowBattleResult] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState({ title: '', msg: '', win: false });
  const [quizStep, setQuizStep] = useState('start');
  const [quizResult, setQuizResult] = useState('');
  const [scanLog, setScanLog] = useState('');

  const arcadeCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef({ x: 350, y: 350 });
  const bulletsRef = useRef<Array<{ x: number; y: number }>>([]);
  const enemiesRef = useRef<Array<{ x: number; y: number; text: string }>>([]);
  const particlesRef = useRef<Array<{ x: number; y: number; life: number; vx: number; vy: number }>>([]);
  const moveDirRef = useRef(0);
  const animationFrameRef = useRef<number>();

  const scenarios = [
    {
      text: "\"I don't need droids! My stethoscope has served me for 800 years. This AI will just steal our jobs!\"",
      options: {
        a: { txt: "A: The future is now, old man.", effect: -20, reply: "\"Insolence! You sound like a Sith!\"" },
        b: { txt: "B: It uses 12B parameters.", effect: -10, reply: "\"Speak Basic! I am a doctor, not a mechanic!\"" },
        c: { txt: "C: It's a Co-Pilot. It does admin.", effect: 40, reply: "\"Hmm. Less paperwork? Like a protocol droid?\"" },
        d: { txt: "D: Take these credits.", effect: -50, reply: "\"Bribery?! Guard! Seize him!\"" }
      }
    },
    {
      text: "\"But the Integration? Do I have to login to another portal? I already have 50 passwords on post-it notes!\"",
      options: {
        a: { txt: "A: Just use a second screen.", effect: -30, reply: "\"I don't have desk space for a second screen!\"" },
        b: { txt: "B: It launches from the EHR.", effect: 40, reply: "\"One click? Even Master Yoda would approve.\"" },
        c: { txt: "C: We use a RESTful FHIR API.", effect: 0, reply: "\"I don't know what a FHIR is, but it sounds dangerous.\"" },
        d: { txt: "D: Just email yourself the data.", effect: -40, reply: "\"And violate Caldicott Principles? Are you mad?\"" }
      }
    },
    {
      text: "\"Wait. The Data Guardian (Darth Karen) says the Cloud is illegal. Where are your servers?\"",
      options: {
        a: { txt: "A: In California (Silicon Valley).", effect: -100, reply: "\"US DATA SOVEREIGNTY VIOLATION! ALARM!\"" },
        b: { txt: "B: London. Under lock and key.", effect: 40, reply: "\"Good. The UK data must stay in the UK system.\"" },
        c: { txt: "C: It's on the Blockchain.", effect: -10, reply: "\"Stop making up words.\"" },
        d: { txt: "D: We sell the data to pay for it.", effect: -999, reply: "\"YOU SELL PATIENT DATA?! ARREST HIM!\"" }
      }
    },
    {
      text: "\"Finally... I heard AI hallucinates. What if it prescribes poison and I get sued?\"",
      options: {
        a: { txt: "A: It's smarter than you.", effect: -50, reply: "\"Out! Get out of my surgery!\"" },
        b: { txt: "B: You are the Human in the Loop.", effect: 50, reply: "\"So I am still the Master? I decide? Good.\"" },
        c: { txt: "C: It's 99% accurate.", effect: 10, reply: "\"In medicine, 1% error kills 10 people a day.\"" },
        d: { txt: "D: We have good insurance.", effect: -20, reply: "\"I prefer patient safety over insurance.\"" }
      }
    }
  ];

  const holoContent: Record<string, { title: string; content: string }> = {
    dtac: { title: 'DTAC', content: '<b>DTAC</b>: 4 Pillars. Clinical Safety, Data Protection, Tech Security, Interoperability.' },
    dcb0129: { title: 'DCB0129', content: '<b>DCB0129</b>: Manufacturer Safety. You need a Hazard Log.' },
    dpia: { title: 'DPIA', content: '<b>DPIA</b>: UK/EEA hosting only. Encryption mandatory.' },
    mhra: { title: 'MHRA', content: '<b>MHRA</b>: Medical Device? Class IIa needs an Audit.' }
  };

  const initBattle = () => {
    setTrust(20);
    setStage(0);
    setShowBattleResult(false);
  };

  const makeChoice = (key: string) => {
    if (stage >= scenarios.length) return;
    const choice = scenarios[stage].options[key as keyof typeof scenarios[0]['options']];

    if (choice.effect === -999) {
      finishBattle(false, "ARRESTED", "You tried to sell patient data. You are now in the Spice Mines of Kessel.");
      return;
    }
    if (choice.effect === -100) {
      finishBattle(false, "DATA BREACH", "Hosting UK patient data in the US without adequacy agreements? GDPR fines destroyed you.");
      return;
    }

    const newTrust = Math.max(0, Math.min(100, trust + choice.effect));
    setTrust(newTrust);

    setTimeout(() => {
      if (newTrust <= 0) {
        finishBattle(false, "TRUST BROKEN", "The Grand Healer has ejected you.");
      } else if (stage + 1 >= scenarios.length) {
        if (newTrust >= 80) {
          finishBattle(true, "CONTRACT SIGNED", "You navigated the politics, the fears, and the IG rules. The Force is strong with you.");
        } else {
          finishBattle(false, "STALEMATE", "They didn't say no, but they didn't say yes. \"Let's do a pilot study,\" they said. (The Pilot Purgatory).");
        }
      } else {
        setStage(stage + 1);
      }
    }, 2000);
  };

  const finishBattle = (win: boolean, title: string, msg: string) => {
    setBattleOutcome({ win, title, msg });
    setShowBattleResult(true);
  };

  const openHologram = (key: string) => {
    setModalContent(holoContent[key]);
    setShowModal(true);
  };

  const initArcade = () => {
    setShowStartScreen(false);
    const canvas = arcadeCanvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
    playerRef.current.x = canvas.width / 2 - 20;
    playerRef.current.y = canvas.height - 40;
    setArcadeActive(true);
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    setArcadeScore(0);

    setTimeout(spawnEnemy, 1000);
    loopArcade();
  };

  const movePlayer = (dir: string) => {
    moveDirRef.current = dir === 'left' ? -5 : 5;
  };

  const stopPlayer = () => {
    moveDirRef.current = 0;
  };

  const fireBullet = () => {
    if (arcadeActive && arcadeCanvasRef.current) {
      bulletsRef.current.push({ x: playerRef.current.x + 20, y: playerRef.current.y });
    }
  };

  const spawnEnemy = () => {
    if (!arcadeActive) return;
    const canvas = arcadeCanvasRef.current;
    if (!canvas) return;

    const words = ["DTAC", "GDPR", "MHRA", "CSO", "FAX", "RISK"];
    enemiesRef.current.push({
      x: Math.random() * (canvas.width - 60),
      y: 0,
      text: words[Math.floor(Math.random() * words.length)]
    });

    setTimeout(spawnEnemy, Math.max(500, 1500 - arcadeScore * 30));
  };

  const loopArcade = () => {
    if (!arcadeActive) return;

    const canvas = arcadeCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    playerRef.current.x += moveDirRef.current;
    if (playerRef.current.x < 0) playerRef.current.x = 0;
    if (playerRef.current.x > canvas.width - 40) playerRef.current.x = canvas.width - 40;

    ctx.fillStyle = '#00ff41';
    ctx.fillRect(playerRef.current.x, playerRef.current.y, 40, 30);

    ctx.fillStyle = '#00f3ff';
    bulletsRef.current = bulletsRef.current.filter(b => {
      b.y -= 7;
      ctx.fillRect(b.x, b.y, 4, 10);
      return b.y > 0;
    });

    ctx.font = "16px 'Press Start 2P'";
    let newScore = arcadeScore;
    let gameOver = false;

    enemiesRef.current = enemiesRef.current.filter(e => {
      e.y += 1.5 + arcadeScore * 0.1;
      ctx.fillStyle = e.text === "FAX" ? "#ff003c" : "#fff";
      ctx.fillText(e.text, e.x, e.y);

      bulletsRef.current = bulletsRef.current.filter((b, j) => {
        if (b.x > e.x && b.x < e.x + 60 && b.y < e.y && b.y > e.y - 20) {
          newScore++;
          for (let k = 0; k < 10; k++) {
            particlesRef.current.push({
              x: e.x + 20,
              y: e.y,
              life: 20,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5
            });
          }
          return false;
        }
        return true;
      });

      if (e.y > canvas.height) {
        gameOver = true;
        return false;
      }

      return !bulletsRef.current.some(b => b.x > e.x && b.x < e.x + 60 && b.y < e.y && b.y > e.y - 20);
    });

    if (gameOver) {
      setArcadeActive(false);
      setShowStartScreen(true);
      return;
    }

    if (newScore !== arcadeScore) setArcadeScore(newScore);

    particlesRef.current = particlesRef.current.filter(p => {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      ctx.fillStyle = `rgba(0,255,65,${p.life / 20})`;
      ctx.fillRect(p.x, p.y, 3, 3);
      return p.life > 0;
    });

    ctx.fillStyle = "#ffd700";
    ctx.fillText("SCORE: " + arcadeScore, 10, 30);

    animationFrameRef.current = requestAnimationFrame(loopArcade);
  };

  const startScan = () => {
    setScanLog("SCANNING...<br/>HTTPS: [OK]<br/>SPF: [OK]<br/>DMARC: [MISSING!]");
  };

  useEffect(() => {
    initBattle();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Orbitron:wght@500;900&family=Press+Start+2P&display=swap');
        * { box-sizing: border-box; user-select: none; }
        @keyframes flash { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.3; } }
        @keyframes pulse-red { 0% {box-shadow: 0 0 0 0 rgba(255, 0, 60, 0.7);} 70% {box-shadow: 0 0 0 15px rgba(255, 0, 60, 0);} 100% {box-shadow: 0 0 0 0 rgba(255, 0, 60, 0);} }
        @keyframes float { 0%, 100% {transform: translateY(0);} 50% {transform: translateY(-15px);} }
        .hidden { display: none !important; }
      `}</style>

      <div style={{ background: '#0d1117', color: '#c9d1d9', minHeight: '100vh', fontFamily: "'Fira Code', monospace" }}>
        <header style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'radial-gradient(circle at center, #1a2230 0%, #0d1117 70%)' }}>
          <h1 style={{ fontSize: '4rem', color: '#00ff41', textShadow: '0 0 10px #00ff41', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', marginBottom: '20px', padding: '0 20px' }}>&lt;NHS_QUEST/&gt;</h1>
          <p style={{ fontSize: '1.2rem', color: '#00f3ff', maxWidth: '600px', marginBottom: '50px', padding: '0 20px' }}>The Vibe Coder's Guide to Galactic Compliance</p>
          <a href="#stack" style={{ fontFamily: "'Press Start 2P', cursive", color: '#ff00ff', textDecoration: 'none', fontSize: '1.2rem', marginTop: '40px', animation: 'flash 0.8s infinite', cursor: 'pointer', border: '2px solid #ff00ff', padding: '15px 20px', boxShadow: '0 0 10px #ff00ff', display: 'inline-block' }}>
            ↓ PRESS START ↓
          </a>
        </header>

        <section id="stack" style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #00f3ff', paddingBottom: '10px', marginBottom: '50px', display: 'inline-block', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>Level 1: The Inventory</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            {[
              { key: 'dtac', badge: 'ENTRY TICKET', icon: '🆔', title: 'DTAC', desc: 'Digital Tech Assessment Criteria' },
              { key: 'dcb0129', badge: 'DEV SIDE', icon: '👷', title: 'DCB0129', desc: 'Clinical Safety (Manufacturer)' },
              { key: 'dpia', badge: 'PRIVACY', icon: '🕵️', title: 'DPIA (GDPR)', desc: 'Data Protection Impact' },
              { key: 'mhra', badge: 'THE BOSS', icon: '🧬', title: 'MHRA', desc: 'Medical Device Regs' }
            ].map(item => (
              <div key={item.key} onClick={() => openHologram(item.key)} style={{ background: '#161b22', border: '1px solid #30363d', padding: '25px', borderRadius: '8px', transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ background: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block', marginBottom: '10px' }}>{item.badge}</div>
                <div style={{ fontSize: '3rem', marginBottom: '20px', color: '#ff00ff' }}>{item.icon}</div>
                <h3 style={{ fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="arcade-section" style={{ background: '#000', border: '4px solid #00ff41', padding: '20px', textAlign: 'center', position: 'relative', borderRadius: '10px', boxShadow: '0 0 30px rgba(0, 255, 65, 0.2)', maxWidth: '1200px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#00ff41', borderBottom: '2px solid #00ff41', paddingBottom: '10px', marginBottom: '50px', display: 'inline-block', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>Level 1.5: Blast The Bureaucracy</h2>
          {showStartScreen && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.9)', padding: '40px', border: '2px solid #00ff41', zIndex: 10 }}>
              <h3 style={{ color: '#00ff41', fontFamily: "'Press Start 2P'" }}>READY PLAYER ONE?</h3>
              <p style={{ marginBottom: '20px' }}>Process the falling regulations.</p>
              <button onClick={initArcade} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', fontWeight: 'bold' }}>INSERT COIN</button>
            </div>
          )}
          <canvas ref={arcadeCanvasRef} id="arcadeCanvas" style={{ background: '#111', width: '100%', maxWidth: '800px', height: '400px', display: 'block', margin: '0 auto', border: '2px solid #333' }}></canvas>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onMouseDown={() => movePlayer('left')} onMouseUp={stopPlayer} onMouseLeave={stopPlayer} onTouchStart={() => movePlayer('left')} onTouchEnd={stopPlayer} style={{ background: '#333', border: '2px solid #666', color: 'white', width: '60px', height: '60px', borderRadius: '10px', fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 5px 0 #000', transition: '0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
              <button onMouseDown={() => movePlayer('right')} onMouseUp={stopPlayer} onMouseLeave={stopPlayer} onTouchStart={() => movePlayer('right')} onTouchEnd={stopPlayer} style={{ background: '#333', border: '2px solid #666', color: 'white', width: '60px', height: '60px', borderRadius: '10px', fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 5px 0 #000', transition: '0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
            </div>
            <button onClick={fireBullet} style={{ background: '#ff003c', border: '2px solid #ff5f56', width: '120px', height: '80px', borderRadius: '50px', fontFamily: "'Press Start 2P'", fontSize: '0.8rem', color: 'white', textShadow: '1px 1px 0 #000', cursor: 'pointer', boxShadow: '0 8px 0 #990000', animation: 'pulse-red 2s infinite' }}>COMPLY!</button>
          </div>
        </section>

        <section id="classifier" style={{ textAlign: 'center', padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #ff00ff', paddingBottom: '10px', marginBottom: '50px', display: 'inline-block', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>Level 2: Class-O-Matic</h2>
          <div style={{ border: '1px solid #ff00ff', padding: '30px', borderRadius: '10px' }}>
            <div className={quizStep === 'start' ? '' : 'hidden'}>
              <h3>Is your AI a Medical Device?</h3>
              <button onClick={() => setQuizStep('q1')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', marginTop: '20px' }}>Start Diagnostics</button>
            </div>
            <div className={quizStep === 'q1' ? '' : 'hidden'}>
              <h3>Does it affect treatment/diagnosis?</h3>
              <button onClick={() => setQuizStep('q2')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', margin: '10px' }}>YES</button>
              <button onClick={() => { setQuizResult('No'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', margin: '10px' }}>NO</button>
            </div>
            <div className={quizStep === 'q2' ? '' : 'hidden'}>
              <h3>Is the AI generative/interpretive?</h3>
              <button onClick={() => { setQuizResult('Yes'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', margin: '10px' }}>YES</button>
              <button onClick={() => { setQuizResult('No'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', margin: '10px' }}>NO</button>
            </div>
            <div className={quizStep === 'result' ? '' : 'hidden'}>
              <h2 style={{ color: '#00ff41' }}>{quizResult === 'Yes' ? 'CLASS IIa DEVICE (MHRA)' : 'IT SYSTEM (DTAC ONLY)'}</h2>
              <button onClick={() => setQuizStep('start')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', marginTop: '20px' }}>Reset</button>
            </div>
          </div>
        </section>

        <section id="scanner-section" style={{ background: '#000', border: '1px solid #333', position: 'relative', height: '450px', padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', position: 'absolute', width: '100%', zIndex: 2, left: 0, top: '20px' }}>
            <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #00f3ff', paddingBottom: '10px', marginBottom: '20px', display: 'inline-block', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', color: '#00f3ff' }}>Level 3: Domain Defense</h2>
            <div>
              <input type="text" placeholder="mysaas.com" style={{ background: '#222', border: '1px solid #00f3ff', color: 'white', padding: '10px', width: '250px' }} />
              <button onClick={startScan} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', fontFamily: "'Fira Code'", cursor: 'pointer', transition: '0.3s', fontWeight: 'bold', marginLeft: '10px' }}>SCAN</button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: scanLog }} style={{ fontFamily: "'Press Start 2P'", fontSize: '0.7rem', marginTop: '20px', color: '#00ff41' }} />
          </div>
        </section>

        <section id="resistance" style={{ padding: '80px 20px', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #ffd700', color: '#ffd700', paddingBottom: '10px', marginBottom: '20px', display: 'inline-block', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>Level 4: Win The GP</h2>
          <p style={{ textAlign: 'center', marginBottom: '30px' }}>
            You have the tech. Now you must defeat the ultimate boss: <strong>Skeptical Grand Healer Kenobi</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#161b22', padding: '40px', border: '4px solid #ffd700', borderRadius: '10px' }}>
            <div style={{ width: '100px', height: '100px', background: '#00f3ff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', boxShadow: '0 0 20px #00f3ff', animation: 'float 3s infinite ease-in-out', fontSize: '3rem' }}>👨‍⚕️</div>
            <h3 style={{ color: '#ffd700', fontSize: '1rem', marginBottom: '5px' }}>GRAND HEALER KENOBI</h3>

            <div style={{ width: '100%', background: '#333', height: '25px', marginBottom: '20px', borderRadius: '15px', overflow: 'hidden', border: '1px solid #555', position: 'relative' }}>
              <div style={{ height: '100%', width: `${trust}%`, background: trust < 30 ? '#ff003c' : trust < 70 ? '#ffd700' : '#00ff41', transition: 'width 0.5s' }}></div>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', textAlign: 'center', lineHeight: '25px', fontWeight: 'bold', fontSize: '0.8rem', textShadow: '1px 1px 2px #000' }}>TRUST: {trust}%</div>
            </div>

            {!showBattleResult && stage < scenarios.length && (
              <>
                <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #fff', padding: '20px', width: '100%', minHeight: '100px', marginBottom: '20px', fontFamily: "'Press Start 2P'", fontSize: '0.7rem', lineHeight: 1.8 }}>
                  {scenarios[stage].text}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                  {['a', 'b', 'c', 'd'].map(key => (
                    <button key={key} onClick={() => makeChoice(key)} style={{ background: '#2a2a2a', color: 'white', padding: '15px', border: '1px solid #555', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: "'Fira Code'", transition: '0.2s' }}>
                      {scenarios[stage].options[key as keyof typeof scenarios[0]['options']].txt}
                    </button>
                  ))}
                </div>
              </>
            )}

            {showBattleResult && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: battleOutcome.win ? '#00ff41' : '#ff003c' }}>{battleOutcome.title}</h2>
                <p>{battleOutcome.msg}</p>
                <button onClick={initBattle} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', marginTop: '20px' }}>Try Again</button>
              </div>
            )}
          </div>
        </section>

        {showModal && (
          <div onClick={() => setShowModal(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '700px', background: 'rgba(13, 17, 23, 0.95)', border: '2px solid #00f3ff', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#00f3ff', fontSize: '1.5rem', cursor: 'pointer', float: 'right' }}>&times;</button>
              <h2 style={{ color: '#00f3ff' }}>{modalContent.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: modalContent.content }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NHSQuest;
