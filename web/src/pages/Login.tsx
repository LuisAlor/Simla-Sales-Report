import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import * as authLib from "@/lib/auth";

// ── Animated background ──────────────────────────────────────────────────────

function makeSinePath(totalW: number, cy: number, amplitude: number, period: number): string {
  let d = `M 0 ${cy}`;
  for (let x = 0; x < totalW; x += period) {
    d += ` C ${x + period * 0.33} ${cy - amplitude} ${x + period * 0.67} ${cy + amplitude} ${x + period} ${cy}`;
  }
  return d;
}

const W = 2400;
const H = 700;

const WAVES = [
  { cy: H * 0.30, amp: 38, period: 480, speed: "28s", opacity: 0.18, strokeW: 1.5, delay: "0s"  },
  { cy: H * 0.48, amp: 26, period: 360, speed: "20s", opacity: 0.13, strokeW: 1,   delay: "-7s" },
  { cy: H * 0.62, amp: 50, period: 560, speed: "34s", opacity: 0.22, strokeW: 2,   delay: "-4s" },
  { cy: H * 0.78, amp: 20, period: 300, speed: "16s", opacity: 0.10, strokeW: 1,   delay: "-12s"},
];

const NODES = [
  { cx: "12%",  cy: "22%", r: 3,   glowR: 10, delay: "0s",    dur: "6s"  },
  { cx: "28%",  cy: "68%", r: 2,   glowR: 7,  delay: "-2s",   dur: "8s"  },
  { cx: "45%",  cy: "35%", r: 2.5, glowR: 9,  delay: "-4s",   dur: "7s"  },
  { cx: "60%",  cy: "75%", r: 3,   glowR: 11, delay: "-1s",   dur: "9s"  },
  { cx: "72%",  cy: "20%", r: 2,   glowR: 7,  delay: "-5s",   dur: "6.5s"},
  { cx: "85%",  cy: "55%", r: 3.5, glowR: 12, delay: "-3s",   dur: "7.5s"},
  { cx: "92%",  cy: "30%", r: 2,   glowR: 8,  delay: "-6s",   dur: "8s"  },
];

// Faint connecting lines between some nodes
const EDGES = [
  { x1: "12%", y1: "22%", x2: "28%", y2: "68%", delay: "0s",  dur: "5s"  },
  { x1: "28%", y1: "68%", x2: "45%", y2: "35%", delay: "-2s", dur: "6s"  },
  { x1: "45%", y1: "35%", x2: "60%", y2: "75%", delay: "-1s", dur: "7s"  },
  { x1: "60%", y1: "75%", x2: "72%", y2: "20%", delay: "-3s", dur: "5.5s"},
  { x1: "72%", y1: "20%", x2: "85%", y2: "55%", delay: "-2s", dur: "6.5s"},
  { x1: "85%", y1: "55%", x2: "92%", y2: "30%", delay: "-4s", dur: "5s"  },
];

function LoginBackground() {
  const paths = WAVES.map((w) => makeSinePath(W * 2, w.cy, w.amp, w.period));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{`
        @keyframes waveDrift { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes nodeFloat {
          0%, 100% { transform: translateY(0px);    opacity: var(--op-lo); }
          50%       { transform: translateY(-14px);  opacity: var(--op-hi); }
        }
        @keyframes edgePulse {
          0%, 100% { opacity: 0.04; }
          50%       { opacity: 0.14; }
        }
        @keyframes gridBreath {
          0%, 100% { opacity: 0.035; }
          50%       { opacity: 0.065; }
        }
        @keyframes glowPulse {
          0%, 100% { r: var(--gr-lo); opacity: 0.12; }
          50%       { r: var(--gr-hi); opacity: 0.25; }
        }
      `}</style>

      {/* Base gradient */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0d1a33 0%, #060a14 70%)" }} />

      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full" style={{ animation: "gridBreath 6s ease-in-out infinite" }}>
        <defs>
          <pattern id="lg-dot-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="24" cy="24" r="1" fill="#3b82f6" opacity="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lg-dot-grid)" />
      </svg>

      {/* Sine waves */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="20%"  stopColor="#06b6d4" stopOpacity="1" />
            <stop offset="80%"  stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {WAVES.map((w, i) => (
          <g key={i} style={{ animation: `waveDrift ${w.speed} linear ${w.delay} infinite` }}>
            <path d={paths[i]} fill="none" stroke="url(#waveGrad)" strokeWidth={w.strokeW} opacity={w.opacity} />
          </g>
        ))}
      </svg>

      {/* Data graph nodes + edges */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="nodeGlow">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"   />
          </radialGradient>
        </defs>
        {EDGES.map((e, i) => (
          <line key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#06b6d4" strokeWidth="0.8"
            style={{ animation: `edgePulse ${e.dur} ease-in-out ${e.delay} infinite` }}
          />
        ))}
        {NODES.map((n, i) => (
          <g key={i} style={{
            ["--op-lo" as string]: "0.35",
            ["--op-hi" as string]: "0.7",
            animation: `nodeFloat ${n.dur} ease-in-out ${n.delay} infinite`,
            transformOrigin: `${n.cx} ${n.cy}`,
          }}>
            <circle cx={n.cx} cy={n.cy} r={n.glowR} fill="url(#nodeGlow)"
              style={{
                ["--gr-lo" as string]: `${n.glowR}`,
                ["--gr-hi" as string]: `${n.glowR * 1.6}`,
                animation: `glowPulse ${n.dur} ease-in-out ${n.delay} infinite`,
              }}
            />
            <circle cx={n.cx} cy={n.cy} r={n.r} fill="#06b6d4" opacity="0.9" />
          </g>
        ))}
      </svg>

      {/* Radial spotlight behind the card */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 55% 55% at 50% 48%, rgba(6,182,212,0.06) 0%, transparent 70%)",
      }} />
    </div>
  );
}

// ── Form inputs ──────────────────────────────────────────────────────────────

const inputCls = "w-full border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 bg-slate-800/60 text-slate-100 placeholder-slate-500 transition-colors";

// ── Login page ───────────────────────────────────────────────────────────────

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = login(email, password);
    if (user) { navigate("/"); } else { setError(t("login_err_invalid")); }
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    const users = authLib.getUsers();
    const user = users.find((u) => u.email === resetEmail);
    if (!user) { setResetError(t("login_err_not_found")); return; }
    if (!resetNewPassword) { setResetError(t("login_err_empty_password")); return; }
    if (resetNewPassword !== resetConfirm) { setResetError(t("login_err_no_match")); return; }
    authLib.updateUser({ ...user, password: resetNewPassword });
    setResetSuccess(true);
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <LoginBackground />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Top glow line */}
        <div className="h-px rounded-t-xl" style={{ background: "linear-gradient(90deg, transparent, #06b6d4, #3b82f6, transparent)" }} />

        <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/40 rounded-b-xl rounded-tr-xl shadow-2xl p-8"
          style={{ boxShadow: "0 0 60px rgba(6,182,212,0.08), 0 25px 50px rgba(0,0,0,0.6)" }}>

          {/* Brand header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", boxShadow: "0 0 20px rgba(6,182,212,0.35)" }}>
              {logoError ? (
                <span className="text-white font-bold text-xl">S</span>
              ) : (
                <img src="/logo.png" alt="Simla" className="w-full h-full object-contain"
                  onError={() => setLogoError(true)} />
              )}
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight tracking-wide">{t("login_brand")}</p>
              <p className="text-slate-400 text-xs mt-0.5">{t("login_tagline")}</p>
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-5">{t("login_title")}</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">{t("login_email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login_email_placeholder")} required className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">{t("login_password")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className={inputCls} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit"
              className="w-full text-white font-semibold py-2.5 rounded-lg text-sm transition-all hover:opacity-90 active:scale-[0.98] mt-1"
              style={{ background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", boxShadow: "0 0 20px rgba(6,182,212,0.25)" }}>
              {t("login_submit")}
            </button>
          </form>

          <button
            onClick={() => { setShowReset(true); setResetSuccess(false); setResetError(null); }}
            className="mt-5 text-cyan-500 hover:text-cyan-400 text-xs transition-colors"
          >
            {t("login_forgot")}
          </button>
        </div>
      </div>

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-white mb-4">{t("login_reset_title")}</h2>
            {resetSuccess ? (
              <div>
                <p className="text-green-400 text-sm mb-4">{t("login_password_updated")}</p>
                <button onClick={() => setShowReset(false)}
                  className="w-full text-white font-semibold py-2 rounded-lg text-sm"
                  style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                  {t("login_close")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">{t("login_email")}</label>
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t("login_email_placeholder")} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">{t("login_new_password")}</label>
                  <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">{t("login_confirm_password")}</label>
                  <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="••••••••" required className={inputCls} />
                </div>
                {resetError && <p className="text-red-400 text-sm">{resetError}</p>}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setShowReset(false)}
                    className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors">
                    {t("login_cancel")}
                  </button>
                  <button type="submit"
                    className="flex-1 text-white font-semibold py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                    {t("login_save")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
