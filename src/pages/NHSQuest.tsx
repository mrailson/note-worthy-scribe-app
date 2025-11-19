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

  useEffect(() => { initBattle(); }, []);

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
