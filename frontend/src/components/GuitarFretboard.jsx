import React, { useRef } from "react";
import { Volume2 } from "lucide-react";

// Từ điển thế bấm đầy đủ 12 tông: frets = [Dây 6 (E trầm) -> Dây 1 (e cao)], -1: không đánh (×), 0: dây buông (○)
const CHORD_SHAPES = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1] },
  C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  "C#": { frets: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 2, 3, 4, 1] },
  "C#m": { frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1] },

  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  "D#": { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3] },
  "D#m": { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2] },

  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },

  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Fm: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  "F#": { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1] },
  "F#m": { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1] },

  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  Gm: { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1] },
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  "G#": { frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1] },
  "G#m": { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1] },

  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  "A#": { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  "A#m": { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },

  B: { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
  B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
};

const FLAT_ALIASES = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
// Cao độ MIDI chuẩn của 6 dây buông (E2, A2, D3, G3, B3, E4)
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

function normalizeChordName(raw) {
  if (!raw) return "C";
  let cleaned = raw
    .replace(/\s*Major/i, "")
    .replace(/\s*Minor/i, "m")
    .trim();

  // Quy đổi nốt giáng sang thăng (VD: Bbm -> A#m)
  const flatKey = Object.keys(FLAT_ALIASES).find((f) => cleaned.startsWith(f));
  if (flatKey) {
    cleaned = cleaned.replace(flatKey, FLAT_ALIASES[flatKey]);
  }
  return cleaned || "C";
}

export default function GuitarFretboard({ chord = "C" }) {
  const audioCtxRef = useRef(null);

  const normalizedChord = normalizeChordName(chord);
  const shape = CHORD_SHAPES[normalizedChord] || CHORD_SHAPES["C"];

  // Tự động tính ngăn bắt đầu (baseFret) để hợp âm ngăn cao (C#, G#, Gm...) không bị tràn lưới
  const pressedFrets = shape.frets.filter((f) => f > 0);
  const minFret = pressedFrets.length > 0 ? Math.min(...pressedFrets) : 1;
  const maxFret = pressedFrets.length > 0 ? Math.max(...pressedFrets) : 1;
  const baseFret = maxFret > 5 ? minFret : 1;

  // Tính thanh chặn (Barre) nếu ngón trỏ (số 1) chặn từ 2 dây trở lên ở cùng ngăn thấp nhất
  const barreStringIndices = shape.frets
    .map((fret, idx) =>
      fret === minFret && shape.fingers[idx] === 1 ? idx : -1,
    )
    .filter((idx) => idx !== -1);
  const hasBarre = barreStringIndices.length >= 2;
  const barreStartIdx = hasBarre ? barreStringIndices[0] : -1;
  const barreEndIdx = hasBarre
    ? barreStringIndices[barreStringIndices.length - 1]
    : -1;
  const barreRelativeFret = minFret - baseFret + 1;

  // Phát âm thanh gảy thử hợp âm bằng Web Audio API
  const handleStrumChord = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      shape.frets.forEach((fretPos, idx) => {
        if (fretPos < 0) return; // Bỏ qua dây đánh dấu ×

        const midi = OPEN_STRING_MIDI[idx] + fretPos;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const startTime = now + idx * 0.045; // Quạt dây lần lượt từ trầm đến thanh

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, startTime);
        filter.frequency.exponentialRampToValueAtTime(350, startTime + 1.1);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 1.25);
      });
    } catch (err) {
      console.error("Trình duyệt không hỗ trợ phát âm thanh:", err);
    }
  };

  const startX = 28;
  const startY = 32;
  const stringGap = 23;
  const fretGap = 30;

  return (
    <div className="bg-slate-900/95 border border-sky-400/35 rounded-xl p-3 shadow-[0_0_20px_rgba(56,189,248,0.15)] backdrop-blur-md select-none">
      {/* Header tên hợp âm + Nút gảy thử */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <button
          type="button"
          onClick={handleStrumChord}
          title="Nghe thử tiếng hợp âm này"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-300 hover:text-sky-300 font-semibold transition cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5 text-sky-400" />
          Gảy thử
        </button>

        <span className="px-2.5 py-0.5 rounded-md bg-sky-400/20 text-sky-300 font-extrabold text-sm border border-sky-400/40 shadow-[0_0_10px_rgba(56,189,248,0.45)]">
          {normalizedChord}
        </span>
      </div>

      {/* Khung vẽ SVG cần đàn */}
      <svg
        viewBox="0 0 175 196"
        className="w-full max-w-45 mx-auto overflow-visible"
      >
        <defs>
          <filter
            id="lightBlueGlow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Thanh lược đàn trên cùng (Dày nếu ở ngăn 1, mảnh nếu dịch lên ngăn cao) */}
        <line
          x1={startX}
          y1={startY}
          x2={startX + stringGap * 5}
          y2={startY}
          stroke={baseFret === 1 ? "#f1f5f9" : "#64748b"}
          strokeWidth={baseFret === 1 ? 4 : 1.5}
          strokeLinecap="round"
        />

        {/* 5 ngăn phím ngang (Frets) */}
        {[0, 1, 2, 3, 4].map((offset) => {
          const fretNumber = baseFret + offset;
          const row = offset + 1;
          return (
            <g key={row}>
              <line
                x1={startX}
                y1={startY + row * fretGap}
                x2={startX + stringGap * 5}
                y2={startY + row * fretGap}
                stroke="#475569"
                strokeWidth="1.5"
              />
              <text
                x={10}
                y={startY + row * fretGap - fretGap / 2 + 4}
                fill={offset === 0 && baseFret > 1 ? "#7dd3fc" : "#64748b"}
                fontSize="10"
                fontWeight={offset === 0 && baseFret > 1 ? "700" : "400"}
              >
                {fretNumber}
              </text>
            </g>
          );
        })}

        {/* Thanh nối hợp âm chặn (Barre) màu xanh nhạt mờ */}
        {hasBarre && (
          <line
            x1={startX + barreStartIdx * stringGap}
            y1={startY + (barreRelativeFret - 0.5) * fretGap}
            x2={startX + barreEndIdx * stringGap}
            y2={startY + (barreRelativeFret - 0.5) * fretGap}
            stroke="#38bdf8"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.25"
          />
        )}

        {/* 6 dây đàn dọc & các điểm sáng xanh nhạt */}
        {STRING_NAMES.map((name, idx) => {
          const x = startX + idx * stringGap;
          const fretPos = shape.frets[idx];
          const fingerNum = shape.fingers[idx];
          const relativeFret = fretPos > 0 ? fretPos - baseFret + 1 : fretPos;

          return (
            <g key={idx}>
              <line
                x1={x}
                y1={startY}
                x2={x}
                y2={startY + fretGap * 5}
                stroke="#94a3b8"
                strokeWidth={2.2 - idx * 0.22}
              />

              <text
                x={x}
                y={startY + fretGap * 5 + 15}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontWeight="600"
              >
                {name}
              </text>

              {/* Dây không đánh (×) */}
              {fretPos === -1 && (
                <text
                  x={x}
                  y={startY - 9}
                  textAnchor="middle"
                  fill="#f87171"
                  fontSize="11"
                  fontWeight="bold"
                >
                  ×
                </text>
              )}

              {/* Dây buông (○) */}
              {fretPos === 0 && (
                <circle
                  cx={x}
                  cy={startY - 12}
                  r="4.2"
                  fill="none"
                  stroke="#7dd3fc"
                  strokeWidth="1.5"
                />
              )}

              {/* Điểm sáng tròn xanh nhạt đặt ngón tay */}
              {relativeFret > 0 && (
                <g
                  className="transition-all duration-300 ease-out"
                  style={{
                    transform: `translate(${x}px, ${startY + (relativeFret - 0.5) * fretGap}px)`,
                  }}
                >
                  <circle
                    r="10.5"
                    fill="#38bdf8"
                    opacity="0.28"
                    className="animate-ping"
                  />
                  <circle
                    r="8"
                    fill="#7dd3fc"
                    stroke="#e0f2fe"
                    strokeWidth="1.5"
                    filter="url(#lightBlueGlow)"
                  />
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="9.5"
                    fontWeight="800"
                  >
                    {fingerNum}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
