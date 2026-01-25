import React from 'react';
import { Mic, Hand } from 'lucide-react';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';
import { cn } from '@/lib/utils';

// Localised "Please speak now" phrases
const SPEAK_NOW_PHRASES: Record<string, string> = {
  en: "Please speak now",
  ar: "تفضل بالتحدث الآن",
  zh: "请现在说话",
  'zh-TW': "請現在說話",
  fr: "Veuillez parler maintenant",
  de: "Bitte sprechen Sie jetzt",
  hi: "कृपया अभी बोलें",
  it: "Prego, parli ora",
  es: "Por favor, hable ahora",
  bg: "Моля, говорете сега",
  hr: "Molim vas, govorite sada",
  cs: "Prosím, mluvte nyní",
  da: "Tal venligst nu",
  nl: "Spreek alstublieft nu",
  el: "Παρακαλώ μιλήστε τώρα",
  hu: "Kérem, beszéljen most",
  pl: "Proszę mówić teraz",
  pt: "Por favor, fale agora",
  ro: "Vă rog să vorbiți acum",
  ru: "Пожалуйста, говорите сейчас",
  tr: "Lütfen şimdi konuşun",
  fa: "لطفاً الان صحبت کنید",
  ku: "Ji kerema xwe niha biaxive",
  ps: "مهرباني وکړئ اوس خبرې وکړئ",
  ti: "በጃኻ ሕጂ ተዛረብ",
  bn: "অনুগ্রহ করে এখন বলুন",
  ur: "براہ کرم ابھی بولیں",
  pa: "ਕਿਰਪਾ ਕਰਕੇ ਹੁਣ ਬੋਲੋ",
  gu: "કૃપા કરીને હવે બોલો",
  ta: "தயவுசெய்து இப்போது பேசுங்கள்",
  te: "దయచేసి ఇప్పుడు మాట్లాడండి",
  kn: "ದಯವಿಟ್ಟು ಈಗ ಮಾತನಾಡಿ",
  ml: "ദയവായി ഇപ്പോൾ സംസാരിക്കുക",
  mr: "कृपया आता बोला",
  ne: "कृपया अहिले बोल्नुहोस्",
  uk: "Будь ласка, говоріть зараз",
  vi: "Xin hãy nói ngay bây giờ",
  th: "กรุณาพูดตอนนี้",
  id: "Silakan berbicara sekarang",
  ms: "Sila bercakap sekarang",
  tl: "Magsalita po kayo ngayon",
  sw: "Tafadhali sema sasa",
  am: "እባክዎ አሁን ይናገሩ",
  yo: "Jọwọ sọrọ bayi",
  ig: "Biko kwuo ugbu a",
  ha: "Da fatan za a yi magana yanzu",
  so: "Fadlan hadal hadda",
  om: "Maaloo amma dubbadhu",
  ja: "今お話しください",
  ko: "지금 말씀해 주세요",
  fi: "Ole hyvä ja puhu nyt",
  sv: "Var god tala nu",
  no: "Vennligst snakk nå",
  he: "אנא דבר עכשיו",
  sk: "Prosím, hovorte teraz",
};

// Localised "Tap when finished" phrases  
const TAP_WHEN_FINISHED_PHRASES: Record<string, string> = {
  en: "Tap mic when finished",
  ar: "اضغط على الميكروفون عند الانتهاء",
  zh: "说完后点击麦克风",
  'zh-TW': "說完後點擊麥克風",
  fr: "Appuyez sur le micro quand vous avez fini",
  de: "Tippen Sie auf das Mikrofon, wenn Sie fertig sind",
  hi: "समाप्त होने पर माइक टैप करें",
  it: "Tocca il microfono quando hai finito",
  es: "Toque el micrófono cuando termine",
  bg: "Докоснете микрофона, когато приключите",
  hr: "Dodirnite mikrofon kada završite",
  cs: "Po dokončení klepněte na mikrofon",
  da: "Tryk på mikrofonen, når du er færdig",
  nl: "Tik op de microfoon als u klaar bent",
  el: "Πατήστε το μικρόφωνο όταν τελειώσετε",
  hu: "Érintse meg a mikrofont, ha végzett",
  pl: "Dotknij mikrofonu po zakończeniu",
  pt: "Toque no microfone quando terminar",
  ro: "Atingeți microfonul când ați terminat",
  ru: "Нажмите на микрофон, когда закончите",
  tr: "Bitirdiğinizde mikrofona dokunun",
  fa: "وقتی تمام شد روی میکروفون ضربه بزنید",
  ku: "Dema ku qediya li mîkrofonê bixin",
  ps: "کله چې پای ته ورسیږئ مایکروفون ټچ کړئ",
  ti: "ምስ ወድአካ ማይክሮፎን ጠውቕ",
  bn: "শেষ হলে মাইক ট্যাপ করুন",
  ur: "ختم ہونے پر مائیک ٹیپ کریں",
  pa: "ਖਤਮ ਹੋਣ 'ਤੇ ਮਾਈਕ ਟੈਪ ਕਰੋ",
  gu: "સમાપ્ત થાય ત્યારે માઇક ટેપ કરો",
  ta: "முடிந்ததும் மைக்கைத் தட்டவும்",
  te: "పూర్తయినప్పుడు మైక్ ట్యాప్ చేయండి",
  kn: "ಮುಗಿದ ನಂತರ ಮೈಕ್ ಟ್ಯಾಪ್ ಮಾಡಿ",
  ml: "പൂർത്തിയാകുമ്പോൾ മൈക്ക് ടാപ്പ് ചെയ്യുക",
  mr: "पूर्ण झाल्यावर माइक टॅप करा",
  ne: "सकिएपछि माइक ट्याप गर्नुहोस्",
  uk: "Натисніть мікрофон, коли закінчите",
  vi: "Chạm mic khi nói xong",
  th: "แตะไมค์เมื่อพูดเสร็จ",
  id: "Ketuk mic saat selesai",
  ms: "Ketik mikrofon apabila selesai",
  tl: "I-tap ang mic kapag tapos na",
  sw: "Gusa kipaza sauti ukimaliza",
  am: "ሲጨርሱ ማይክሮፎኑን ይንኩ",
  yo: "Tẹ mic nígbà tí o bá parí",
  ig: "Pịa mic mgbe ị gụchara",
  ha: "Taɓa maik ɗin lokacin da ka gama",
  so: "Taabo makarafoonka markaad dhamaato",
  om: "Yeroo xumurtan maayikii tuqi",
  ja: "終わったらマイクをタップ",
  ko: "끝나면 마이크를 탭하세요",
  fi: "Napauta mikrofonia kun olet valmis",
  sv: "Tryck på mikrofonen när du är klar",
  no: "Trykk på mikrofonen når du er ferdig",
  he: "הקש על המיקרופון כשתסיים",
  sk: "Po dokončení klepnite na mikrofón",
};

// Localised "Listening..." phrases
const LISTENING_PHRASES: Record<string, string> = {
  en: "Listening...",
  ar: "جارٍ الاستماع...",
  zh: "正在聆听...",
  'zh-TW': "正在聆聽...",
  fr: "Écoute en cours...",
  de: "Hört zu...",
  hi: "सुन रहा है...",
  it: "Ascolto...",
  es: "Escuchando...",
  bg: "Слушам...",
  hr: "Slušam...",
  cs: "Naslouchám...",
  da: "Lytter...",
  nl: "Luisteren...",
  el: "Ακούω...",
  hu: "Hallgatás...",
  pl: "Słucham...",
  pt: "Ouvindo...",
  ro: "Ascult...",
  ru: "Слушаю...",
  tr: "Dinleniyor...",
  fa: "در حال گوش دادن...",
  ku: "Guh didim...",
  ps: "اورېدل کېږي...",
  ti: "እሰምዕ ኣለኹ...",
  bn: "শুনছি...",
  ur: "سن رہا ہے...",
  pa: "ਸੁਣ ਰਿਹਾ ਹੈ...",
  gu: "સાંભળી રહ્યો છું...",
  ta: "கேட்கிறேன்...",
  te: "వింటున్నాను...",
  kn: "ಕೇಳುತ್ತಿದ್ದೇನೆ...",
  ml: "കേൾക്കുന്നു...",
  mr: "ऐकत आहे...",
  ne: "सुन्दैछु...",
  uk: "Слухаю...",
  vi: "Đang nghe...",
  th: "กำลังฟัง...",
  id: "Mendengarkan...",
  ms: "Mendengar...",
  tl: "Nakikinig...",
  sw: "Nasikiliza...",
  am: "እየሰማሁ ነው...",
  yo: "Mo n gbọ́...",
  ig: "Ana-anụ...",
  ha: "Ina saurara...",
  so: "Waan dhagaysanayaa...",
  om: "Dhaggeeffachaan jira...",
  ja: "聞いています...",
  ko: "듣고 있습니다...",
  fi: "Kuuntelen...",
  sv: "Lyssnar...",
  no: "Lytter...",
  he: "מקשיב...",
  sk: "Počúvam...",
};

interface PatientSpeakingPromptProps {
  languageCode: string;
  languageName: string;
  languageFlag?: string;
  isListening: boolean;
  liveTranscript?: string;
  className?: string;
}

export const PatientSpeakingPrompt: React.FC<PatientSpeakingPromptProps> = ({
  languageCode,
  languageName,
  languageFlag,
  isListening,
  liveTranscript,
  className
}) => {
  const speakNowText = SPEAK_NOW_PHRASES[languageCode] || SPEAK_NOW_PHRASES['en'];
  const tapWhenFinishedText = TAP_WHEN_FINISHED_PHRASES[languageCode] || TAP_WHEN_FINISHED_PHRASES['en'];
  const listeningText = LISTENING_PHRASES[languageCode] || LISTENING_PHRASES['en'];

  return (
    <div className={cn(
      "w-full rounded-xl p-6 text-center transition-all",
      isListening 
        ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg" 
        : "bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-800 dark:text-emerald-200",
      className
    )}>
      {/* Language badge */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-3xl">{languageFlag}</span>
        <span className="text-xl font-semibold">{languageName}</span>
      </div>

      {/* Main prompt */}
      <div className="mb-4">
        {isListening ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-3">
              <Mic className="h-10 w-10 animate-pulse" />
              <VoiceWaveform isActive={isListening} className="text-white" />
            </div>
            <p className="text-2xl font-bold mb-2">{speakNowText}</p>
            <p className="text-lg opacity-90">{listeningText}</p>
          </>
        ) : (
          <>
            <Hand className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p className="text-xl font-medium opacity-80">
              Waiting for receptionist to enable patient speaking mode
            </p>
          </>
        )}
      </div>

      {/* Live transcript preview */}
      {isListening && liveTranscript && (
        <div className="mt-4 p-4 bg-white/20 rounded-lg backdrop-blur-sm">
          <p className="text-lg italic">&ldquo;{liveTranscript}&rdquo;</p>
        </div>
      )}

      {/* Instruction */}
      {isListening && (
        <div className="mt-4 pt-4 border-t border-white/30">
          <p className="text-sm opacity-80 flex items-center justify-center gap-2">
            <Mic className="h-4 w-4" />
            {tapWhenFinishedText}
          </p>
        </div>
      )}
    </div>
  );
};

export { SPEAK_NOW_PHRASES, TAP_WHEN_FINISHED_PHRASES, LISTENING_PHRASES };
