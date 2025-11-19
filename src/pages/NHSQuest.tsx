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
  const spaceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [playerX, setPlayerX] = useState(350);
  const [moveDir, setMoveDir] = useState(0);
  const bulletsRef = useRef<Array<{x: number, y: number}>>([]);
  const enemiesRef = useRef<Array<{x: number, y: number, text: string}>>([]);
  const particlesRef = useRef<Array<{x: number, y: number, life: number, vx: number, vy: number}>>([]);
  const animationFrameRef = useRef<number>();

  const scenarios = [
    {
      text: "\"I don't need droids! My stethoscope has served me for 800 years. This AI will just steal our jobs!\"",
      options: {
        a: { txt: "A: The future is now, old man.", effect: -20 },
        b: { txt: "B: It uses 12B parameters.", effect: -10 },
        c: { txt: "C: It's a Co-Pilot. It does admin.", effect: 40 },
        d: { txt: "D: Take these credits.", effect: -50 }
      }
    },
    {
      text: "\"But the Integration? Do I have to login to another portal? I already have 50 passwords on post-it notes!\"",
      options: {
        a: { txt: "A: Just use a second screen.", effect: -30 },
        b: { txt: "B: It launches from the EHR.", effect: 40 },
        c: { txt: "C: We use a RESTful FHIR API.", effect: 0 },
        d: { txt: "D: Just email yourself the data.", effect: -40 }
      }
    },
    {
      text: "\"Wait. The Data Guardian (Darth Karen) says the Cloud is illegal. Where are your servers?\"",
      options: {
        a: { txt: "A: In California (Silicon Valley).", effect: -100 },
        b: { txt: "B: London. Under lock and key.", effect: 40 },
        c: { txt: "C: It's on the Blockchain.", effect: -10 },
        d: { txt: "D: We sell the data to pay for it.", effect: -999 }
      }
    },
    {
      text: "\"Finally... I heard AI hallucinates. What if it prescribes poison and I get sued?\"",
      options: {
        a: { txt: "A: It's smarter than you.", effect: -50 },
        b: { txt: "B: You are the Human in the Loop.", effect: 50 },
        c: { txt: "C: It's 99% accurate.", effect: 10 },
        d: { txt: "D: We have good insurance.", effect: -20 }
      }
    }
  ];

  const holoContent: Record<string, { title: string, content: string }> = {
    'dtac': { title: 'DTAC', content: '<b>DTAC</b>: 4 Pillars. Clinical Safety, Data Protection, Tech Security, Interoperability.' },
    'dcb0129': { title: 'DCB0129', content: '<b>DCB0129</b>: Manufacturer Safety. You need a Hazard Log.' },
    'dpia': { title: 'DPIA', content: '<b>DPIA</b>: UK/EEA hosting only. Encryption mandatory.' },
    'mhra': { title: 'MHRA', content: '<b>MHRA</b>: Medical Device? Class IIa needs an Audit.' }
  };

  const initBattle = () => {
    setTrust(20);
    setStage(0);
    setShowBattleResult(false);
  };

  const makeChoice = (key: string) => {
    if (stage >= scenarios.length) return;
    const choice = scenarios[stage].options[key as keyof typeof scenarios[0]['options']];
    
    if (choice.effect === -999 || choice.effect === -100) {
      finishBattle(false, "GAME OVER", "Critical failure!");
      return;
    }

    const newTrust = Math.max(0, Math.min(100, trust + choice.effect));
    setTrust(newTrust);

    setTimeout(() => {
      if (newTrust <= 0) finishBattle(false, "TRUST BROKEN", "The Grand Healer has ejected you.");
      else if (stage + 1 >= scenarios.length) {
        finishBattle(newTrust >= 80, newTrust >= 80 ? "CONTRACT SIGNED" : "STALEMATE", "Results vary.");
      } else setStage(stage + 1);
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
    setPlayerX(canvas.width / 2 - 20);
    setArcadeActive(true);
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    setArcadeScore(0);
    
    setTimeout(spawnEnemy, 1000);
    animationFrameRef.current = requestAnimationFrame(loopArcade);
  };

  const movePlayer = (dir: string) => {
    setMoveDir(dir === 'left' ? -5 : 5);
  };

  const stopPlayer = () => {
    setMoveDir(0);
  };

  const fireBullet = () => {
    if (arcadeActive) {
      bulletsRef.current.push({ x: playerX + 20, y: arcadeCanvasRef.current!.height - 40 });
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

    const newX = playerX + moveDir;
    setPlayerX(Math.max(0, Math.min(canvas.width - 40, newX)));

    ctx.fillStyle = '#00ff41';
    ctx.fillRect(playerX, canvas.height - 40, 40, 30);

    ctx.fillStyle = '#00f3ff';
    bulletsRef.current = bulletsRef.current.filter(b => {
      b.y -= 7;
      ctx.fillRect(b.x, b.y, 4, 10);
      return b.y > 0;
    });

    ctx.font = "16px 'Press Start 2P'";
    let newScore = arcadeScore;
    
    enemiesRef.current = enemiesRef.current.filter((e, i) => {
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
        setArcadeActive(false);
        setShowStartScreen(true);
        return false;
      }
      return bulletsRef.current.some(b => b.x > e.x && b.x < e.x + 60 && b.y < e.y && b.y > e.y - 20) ? false : true;
    });

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

  useEffect(() => { initBattle(); }, []);
  
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div style={{ background: '#0d1117', color: '#c9d1d9', minHeight: '100vh', fontFamily: "'Fira Code', monospace" }}>
      <header style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', color: '#00ff41', textShadow: '0 0 10px #00ff41' }}>&lt;NHS_QUEST/&gt;</h1>
        <p style={{ fontSize: '1.2rem', color: '#00f3ff' }}>The Vibe Coder's Guide to Galactic Compliance</p>
      </header>

      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #00f3ff', display: 'inline-block' }}>Level 1: The Inventory</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '50px' }}>
          {['dtac', 'dcb0129', 'dpia', 'mhra'].map(key => (
            <div key={key} onClick={() => openHologram(key)} style={{ background: '#161b22', padding: '25px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #30363d' }}>
              <h3>{key.toUpperCase()}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* LEVEL 1.5: ARCADE */}
      <section style={{ background: '#000', border: '4px solid #00ff41', padding: '20px', borderRadius: '10px', position: 'relative', maxWidth: '1200px', margin: '40px auto' }}>
        <h2 style={{ fontSize: '2.5rem', color: '#00ff41', borderBottom: '2px solid #00ff41', display: 'inline-block', marginBottom: '30px' }}>
          Level 1.5: Blast The Bureaucracy
        </h2>
        {showStartScreen && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.9)', padding: '40px', border: '2px solid #00ff41', zIndex: 10, textAlign: 'center' }}>
            <h3 style={{ color: '#00ff41', fontFamily: "'Press Start 2P'" }}>READY PLAYER ONE?</h3>
            <p style={{ marginBottom: '20px' }}>Process the falling regulations.</p>
            <button onClick={initArcade} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', fontFamily: "'Fira Code'" }}>INSERT COIN</button>
          </div>
        )}
        <canvas ref={arcadeCanvasRef} style={{ background: '#111', width: '100%', maxWidth: '800px', height: '400px', display: 'block', margin: '0 auto', border: '2px solid #333' }}></canvas>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onMouseDown={() => movePlayer('left')} onMouseUp={stopPlayer} onMouseLeave={stopPlayer} onTouchStart={() => movePlayer('left')} onTouchEnd={stopPlayer} style={{ background: '#333', border: '2px solid #666', color: 'white', width: '60px', height: '60px', borderRadius: '10px', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
            <button onMouseDown={() => movePlayer('right')} onMouseUp={stopPlayer} onMouseLeave={stopPlayer} onTouchStart={() => movePlayer('right')} onTouchEnd={stopPlayer} style={{ background: '#333', border: '2px solid #666', color: 'white', width: '60px', height: '60px', borderRadius: '10px', fontSize: '1.5rem', cursor: 'pointer' }}>→</button>
          </div>
          <button onClick={fireBullet} style={{ background: '#ff003c', border: '2px solid #ff5f56', width: '120px', height: '80px', borderRadius: '50px', fontFamily: "'Press Start 2P'", fontSize: '0.8rem', color: 'white', cursor: 'pointer' }}>COMPLY!</button>
        </div>
      </section>

      {/* LEVEL 2: CLASSIFIER */}
      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #ff00ff', display: 'inline-block' }}>Level 2: Class-O-Matic</h2>
        <div style={{ border: '1px solid #ff00ff', padding: '30px', borderRadius: '10px', marginTop: '30px' }}>
          {quizStep === 'start' && (
            <>
              <h3>Is your AI a Medical Device?</h3>
              <button onClick={() => setQuizStep('q1')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', marginTop: '20px', fontFamily: "'Fira Code'" }}>Start Diagnostics</button>
            </>
          )}
          {quizStep === 'q1' && (
            <>
              <h3>Does it affect treatment/diagnosis?</h3>
              <button onClick={() => setQuizStep('q2')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', margin: '10px', fontFamily: "'Fira Code'" }}>YES</button>
              <button onClick={() => { setQuizResult('No'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', margin: '10px', fontFamily: "'Fira Code'" }}>NO</button>
            </>
          )}
          {quizStep === 'q2' && (
            <>
              <h3>Is the AI generative/interpretive?</h3>
              <button onClick={() => { setQuizResult('Yes'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', margin: '10px', fontFamily: "'Fira Code'" }}>YES</button>
              <button onClick={() => { setQuizResult('No'); setQuizStep('result'); }} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', margin: '10px', fontFamily: "'Fira Code'" }}>NO</button>
            </>
          )}
          {quizStep === 'result' && (
            <>
              <h2 style={{ color: '#00ff41' }}>{quizResult === 'Yes' ? 'CLASS IIa DEVICE (MHRA)' : 'IT SYSTEM (DTAC ONLY)'}</h2>
              <button onClick={() => setQuizStep('start')} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer', marginTop: '20px', fontFamily: "'Fira Code'" }}>Reset</button>
            </>
          )}
        </div>
      </section>

      {/* LEVEL 3: SCANNER */}
      <section style={{ background: '#000', border: '1px solid #333', position: 'relative', height: '450px', padding: '20px', maxWidth: '1200px', margin: '40px auto' }}>
        <div style={{ textAlign: 'center', position: 'absolute', width: '100%', zIndex: 2, left: 0, top: '20px' }}>
          <h2 style={{ fontSize: '2.5rem', borderBottom: '2px solid #00f3ff', display: 'inline-block', color: '#00f3ff' }}>Level 3: Domain Defense</h2>
          <div style={{ marginTop: '20px' }}>
            <input type="text" placeholder="mysaas.com" style={{ background: '#222', border: '1px solid #00f3ff', color: 'white', padding: '10px', width: '250px' }} />
            <button onClick={startScan} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '10px 30px', cursor: 'pointer', marginLeft: '10px', fontFamily: "'Fira Code'" }}>SCAN</button>
          </div>
          <div dangerouslySetInnerHTML={{ __html: scanLog }} style={{ fontFamily: "'Press Start 2P'", fontSize: '0.7rem', marginTop: '20px', color: '#00ff41' }} />
        </div>
        <canvas ref={spaceCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }}></canvas>
      </section>

      <section style={{ padding: '80px 20px', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', color: '#ffd700', borderBottom: '2px solid #ffd700', display: 'inline-block' }}>Level 4: Win The GP</h2>
        <div style={{ background: '#161b22', padding: '40px', border: '4px solid #ffd700', borderRadius: '10px', marginTop: '30px' }}>
          <div style={{ width: '100%', background: '#333', height: '25px', marginBottom: '20px', borderRadius: '15px', position: 'relative' }}>
            <div style={{ height: '100%', width: `${trust}%`, background: trust < 30 ? '#ff003c' : trust < 70 ? '#ffd700' : '#00ff41', transition: 'width 0.5s' }}></div>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', textAlign: 'center', lineHeight: '25px', fontWeight: 'bold' }}>TRUST: {trust}%</div>
          </div>

          {!showBattleResult && stage < scenarios.length && (
            <>
              <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #fff', padding: '20px', marginBottom: '20px', minHeight: '100px' }}>
                {scenarios[stage].text}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {['a', 'b', 'c', 'd'].map(key => (
                  <button key={key} onClick={() => makeChoice(key)} style={{ background: '#2a2a2a', color: 'white', padding: '15px', border: '1px solid #555', cursor: 'pointer' }}>
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
              <button onClick={initBattle} style={{ background: 'transparent', border: '2px solid #00ff41', color: '#00ff41', padding: '15px 30px', cursor: 'pointer' }}>Try Again</button>
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(13, 17, 23, 0.95)', border: '2px solid #00f3ff', padding: '30px', maxWidth: '700px', width: '90%' }}>
            <h2 style={{ color: '#00f3ff' }}>{modalContent.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: modalContent.content }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default NHSQuest;
