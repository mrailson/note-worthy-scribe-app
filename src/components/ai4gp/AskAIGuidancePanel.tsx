import React from 'react';
import { AlertCircle, Stethoscope, Search, Lock, AlertTriangle, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

export const AskAIGuidancePanel: React.FC = () => {
  return (
    <div className="w-full max-w-[800px] mx-auto rounded-2xl overflow-hidden shadow-lg bg-[hsl(36,33%,97%)]">
      {/* Header */}
      <div className="relative overflow-hidden px-8 py-8 text-white" style={{ background: 'linear-gradient(135deg, hsl(210,43%,18%) 0%, hsl(207,44%,28%) 100%)' }}>
        <div className="absolute -top-10 -right-10 w-[200px] h-[200px] rounded-full bg-[hsla(171,83%,30%,0.15)]" />
        <div className="flex items-center gap-3.5 mb-4 relative z-10">
          <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-serif font-bold text-[22px] text-white" style={{ background: 'hsl(171,83%,30%)' }}>
            N
          </div>
          <div className="font-serif text-[26px] font-bold tracking-tight">
            Notewell <span style={{ color: 'hsl(171,82%,39%)' }}>Ask AI</span>
          </div>
        </div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight relative z-10 mb-2">Using AI Wisely in Practice</h1>
        <p className="text-[15px] text-white/75 relative z-10 max-w-[560px] leading-relaxed">
          AI is a powerful assistant — but it works best when you bring your professional judgment. Here's how to get the most from Ask AI safely and confidently.
        </p>
      </div>

      {/* Body */}
      <div className="px-8 py-8">
        {/* Intro callout */}
        <div className="flex gap-3.5 items-start rounded-r-[10px] border-l-4 border-[hsl(32,78%,58%)] bg-[hsl(38,96%,94%)] p-4 mb-7">
          <span className="text-2xl flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm leading-relaxed">
            <strong className="text-[hsl(36,74%,36%)]">AI can make mistakes.</strong> Like any tool, AI-generated responses may occasionally be inaccurate, incomplete, or out of date. It's designed to support your work — not replace your expertise. A quick sense-check is always good practice.
          </p>
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
          <Card
            icon="🩺"
            title="You're Still the Expert"
            description="AI assists with information and drafting — but clinical decisions, patient safety judgments, and professional accountability always remain with you."
            variant="green"
          />
          <Card
            icon="🔍"
            title="Verify Before You Act"
            description="If an AI response informs a clinical decision, check it against trusted sources — NICE guidelines, BNF, local formularies, or colleagues. Treat it like a second opinion, not a final answer."
            variant="blue"
          />
          <Card
            icon="🔒"
            title="Be Mindful with Patient Data"
            description="Avoid entering identifiable patient information into the chat unless the system is explicitly designed for it. When in doubt, anonymise or use generic examples."
            variant="amber"
          />
          <Card
            icon="⚠️"
            title="Know the Limits"
            description="AI may not reflect the very latest guidance, local policies, or individual patient context. It works from patterns in data — it doesn't know your patient."
            variant="rose"
          />
        </div>

        {/* Do / Don't */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
          <div className="rounded-xl p-5 bg-[hsl(142,44%,93%)] border-[1.5px] border-[hsl(142,35%,77%)]">
            <h4 className="font-serif text-[15px] font-semibold text-[hsl(147,56%,28%)] mb-2.5 flex items-center gap-2">✅ Great Uses</h4>
            <ul className="space-y-1.5">
              {[
                'Drafting letters, referrals, and templates',
                'Looking up general clinical information',
                'Summarising guidelines or protocols',
                'Getting a second perspective on admin queries',
                'Saving time on routine documentation',
              ].map((item, i) => (
                <li key={i} className="text-[13px] leading-snug pl-5 relative before:content-['✓'] before:absolute before:left-0 before:text-[hsl(147,56%,28%)] before:font-bold before:text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-5 bg-[hsl(349,89%,95%)] border-[1.5px] border-[hsl(349,62%,85%)]">
            <h4 className="font-serif text-[15px] font-semibold text-[hsl(349,49%,44%)] mb-2.5 flex items-center gap-2">🚫 Think Twice</h4>
            <ul className="space-y-1.5">
              {[
                'Using AI output as the sole basis for a clinical decision',
                'Sharing identifiable patient details unnecessarily',
                'Assuming AI responses are always current or complete',
                'Skipping your usual checks because "the AI said so"',
                'Ignoring your gut feeling when something looks off',
              ].map((item, i) => (
                <li key={i} className="text-[13px] leading-snug pl-5 relative before:content-['✗'] before:absolute before:left-0 before:text-[hsl(349,49%,44%)] before:font-bold before:text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom banner */}
      <div className="flex items-center gap-4 px-8 py-5 text-white" style={{ background: 'linear-gradient(135deg, hsl(210,43%,18%) 0%, hsl(207,44%,28%) 100%)' }}>
        <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[22px] flex-shrink-0" style={{ background: 'hsl(171,83%,30%)' }}>
          🤝
        </div>
        <div>
          <h4 className="font-serif text-[15px] font-semibold mb-0.5">Something Not Right? Tell Us</h4>
          <p className="text-[13px] text-white/70 leading-snug">
            If you spot an inaccurate or unhelpful AI response, please report it. Your feedback is how we make Notewell Ask AI better and safer for everyone. Use the feedback option within the chat or speak to your practice digital lead.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-8 py-3.5 text-[11.5px] text-[hsl(210,14%,49%)] border-t border-[hsl(30,15%,83%)]" style={{ background: 'hsl(36,27%,92%)' }}>
        <span>Notewell AI &bull; MHRA Class I Registered Medical Device &bull; PCN Services Ltd</span>
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded text-white uppercase tracking-wider" style={{ background: 'hsl(210,43%,18%)' }}>V1.0 &bull; Feb 2026</span>
      </div>
    </div>
  );
};

const cardVariants = {
  green: {
    bg: 'bg-[hsl(142,44%,93%)]',
    iconBg: 'hsl(147,56%,28%)',
    titleColor: 'text-[hsl(147,56%,28%)]',
  },
  blue: {
    bg: 'bg-[hsl(210,50%,94%)]',
    iconBg: 'hsl(212,52%,49%)',
    titleColor: 'text-[hsl(212,52%,40%)]',
  },
  amber: {
    bg: 'bg-[hsl(38,96%,94%)]',
    iconBg: 'hsl(32,78%,58%)',
    titleColor: 'text-[hsl(42,54%,33%)]',
  },
  rose: {
    bg: 'bg-[hsl(349,89%,95%)]',
    iconBg: 'hsl(349,49%,44%)',
    titleColor: 'text-[hsl(349,49%,44%)]',
  },
};

const Card: React.FC<{ icon: string; title: string; description: string; variant: keyof typeof cardVariants }> = ({ icon, title, description, variant }) => {
  const v = cardVariants[variant];
  return (
    <div className={`rounded-xl p-5 ${v.bg}`}>
      <div className="w-10 h-10 rounded-[9px] flex items-center justify-center text-xl text-white mb-3" style={{ background: v.iconBg }}>
        {icon}
      </div>
      <h3 className={`font-serif text-base font-semibold mb-1.5 leading-tight ${v.titleColor}`}>{title}</h3>
      <p className="text-[13.5px] leading-relaxed text-[hsl(210,14%,49%)]">{description}</p>
    </div>
  );
};
