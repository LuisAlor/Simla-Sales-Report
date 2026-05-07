import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props { text: string; }

export function InfoTooltip({ text }: Props) {
  const [visible, setVisible] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function show() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    }
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [visible]);

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 text-[10px] font-bold hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors shrink-0 leading-none"
        tabIndex={-1}
        aria-label="Info"
      >
        i
      </button>

      {visible && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translate(-50%, -100%)", zIndex: 9999 }}
          className="mb-2 max-w-[240px] px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-xl pointer-events-none whitespace-normal leading-relaxed"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
        </div>,
        document.body
      )}
    </>
  );
}
