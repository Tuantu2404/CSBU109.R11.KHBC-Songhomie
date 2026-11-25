import { useEffect, useRef, useCallback } from 'react';
import { Volume2 } from 'lucide-react';

// Tần số MIDI chuẩn của 6 dây đàn Guitar (E2, A2, D3, G3, B3, E4)
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

// Bảng 24 hợp âm chuẩn (frets: vị trí ngăn bấm tương đối theo baseFret, -1 là không gảy, 0 là dây buông)
const CHORD_SHAPES = {
  C:   { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Cm:  { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  'C#':{ baseFret: 4, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  'C#m':{ baseFret: 4, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  D:   { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dm:  { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  'D#':{ baseFret: 1, frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
  'D#m':{ baseFret: 1, frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },
  E:   { baseFret: 1, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  Em:  { baseFret: 1, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  F:   { baseFret: 1, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Fm:  { baseFret: 1, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  'F#':{ baseFret: 2, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  'F#m':{ baseFret: 2, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  G:   { baseFret: 1, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  Gm:  { baseFret: 3, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  'G#':{ baseFret: 4, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  'G#m':{ baseFret: 4, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  A:   { baseFret: 1, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Am:  { baseFret: 1, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  'A#':{ baseFret: 1, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  'A#m':{ baseFret: 1, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  B:   { baseFret: 2, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Bm:  { baseFret: 2, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
};

const FLAT_TO_SHARP = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

function normalizeChordKey(chordName = 'C') {
  const match = String(chordName).trim().match(/^([A-G][#b]?)(m?)/);
  if (!match) return 'C';
  let [, root, minor] = match;
  if (FLAT_TO_SHARP[root]) root = FLAT_TO_SHARP[root];
  const key = `${root}${minor}`;
  return CHORD_SHAPES[key] ? key : 'C';
}

// Hàm tổng hợp tiếng gảy dây đàn Acoustic Guitar bằng Web Audio API
export function playGuitarChordSound(chordName) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!window.__songhomieAudioCtx) {
      window.__songhomieAudioCtx = new AudioCtx();
    }
    const ctx = window.__songhomieAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const key = normalizeChordKey(chordName);
    const shape = CHORD_SHAPES[key] || CHORD_SHAPES.C;
    const now = ctx.currentTime;

    shape.frets.forEach((relFret, stringIdx) => {
      if (relFret < 0) return;

      const actualFret = relFret === 0 ? 0 : shape.baseFret + relFret - 1;
      const midi = OPEN_STRING_MIDI[stringIdx] + actualFret;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const startTime = now + stringIdx * 0.035; // Gảy lần lượt từng dây cách nhau 35ms

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2, startTime); // Họa âm bậc 2 cho tiếng ấm

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startTime);
      filter.frequency.exponentialRampToValueAtTime(450, startTime + 1.4);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.14, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 1.5);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + 1.55);
      osc2.stop(startTime + 1.55);
    });
  } catch (_) {
    // Bỏ qua nếu trình duyệt chặn autoplay trước khi người dùng tương tác
  }
}

export default function GuitarFretboard({ chord = 'C', autoPlayTrigger = 0 }) {
  const normalizedKey = normalizeChordKey(chord);
  const shape = CHORD_SHAPES[normalizedKey] || CHORD_SHAPES.C;
  const isFirstRender = useRef(true);

  const handleStrum = useCallback(() => {
    playGuitarChordSound(normalizedKey);
  }, [normalizedKey]);

  // Tự động gảy tiếng đàn mỗi khi autoPlayTrigger thay đổi (lúc chạy Tự động cuộn)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autoPlayTrigger > 0) {
      playGuitarChordSound(normalizedKey);
    }
  }, [autoPlayTrigger, normalizedKey]);

  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  const frets = [1, 2, 3, 4, 5];

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-lg select-none">
      {/* Thanh tiêu đề: Nút Gảy thử & Tên hợp âm */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <button
          type="button"
          onClick={handleStrum}
          title="Preview this chord fingering"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-sky-400 hover:text-sky-300 transition cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" /> STRUM
        </button>

        <span className="px-2.5 py-0.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-300 font-black text-sm">
          {chord || normalizedKey}
        </span>
      </div>

      {/* Ký hiệu dây buông (o) / dây câm (x) phía trên lược đàn */}
      <div className="grid grid-cols-6 text-center text-[10px] font-bold mb-1 pl-4">
        {shape.frets.map((fret, idx) => (
          <span key={idx} className="flex items-center justify-center h-3.5">
            {fret === -1 ? (
              <span className="text-rose-400">×</span>
            ) : fret === 0 ? (
              <span className="w-2 h-2 rounded-full border border-sky-400 inline-block" />
            ) : null}
          </span>
        ))}
      </div>

      {/* Khu vực 5 ngăn đàn */}
      <div className="relative pl-4">
        {/* Thanh lược đàn (nut) dày nếu ở ngăn 1, hoặc ghi số ngăn (VD: 4fr) nếu bấm thế cao */}
        {shape.baseFret === 1 ? (
          <div className="h-1 bg-slate-200 rounded-full mb-0.5" />
        ) : (
          <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 mb-0.5">
            <span>{shape.baseFret}fr</span>
            <div className="flex-1 h-0.5 bg-slate-600 ml-1.5" />
          </div>
        )}

        <div className="relative border-x border-slate-600">
          {/* 6 dây đàn dọc */}
          <div className="absolute inset-0 grid grid-cols-6 pointer-events-none">
            {strings.map((_, idx) => (
              <div key={idx} className="flex justify-center">
                <div className="w-[1.5px] h-full bg-slate-600/80" />
              </div>
            ))}
          </div>

          {/* 5 ngăn đàn ngang */}
          {frets.map((fretNum) => (
            <div
              key={fretNum}
              className="grid grid-cols-6 h-6 border-b border-slate-700/90 relative z-10"
            >
              {/* Số ngăn bên trái */}
              <span className="absolute -left-4 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500">
                {shape.baseFret + fretNum - 1}
              </span>

              {shape.frets.map((targetFret, sIdx) => {
                const isPressed = targetFret === fretNum;
                const finger = shape.fingers[sIdx];

                return (
                  <div
                    key={sIdx}
                    className="flex items-center justify-center"
                  >
                    {isPressed && (
                      <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(56,189,248,0.85)]">
                        {finger || ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Tên 6 dây bên dưới */}
        <div className="grid grid-cols-6 text-center text-[10px] font-mono text-slate-400 mt-1">
          {strings.map((s, idx) => (
            <span key={idx}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}