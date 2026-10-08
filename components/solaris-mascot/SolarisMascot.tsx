"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Music2, Pause, Play, Square } from "lucide-react";
import styles from "./SolarisMascot.module.css";

// Reserved for later phases; only idle and greeting have behavior today.
export type FutureMascotState = "happy" | "attention" | "alert" | "thinking" | "help" | "sleeping";
export type SolarisMascotProps = {
  state?: "idle" | "greeting";
  size?: "small" | "medium" | "large";
  position?: "bottom-right";
};

export function SolarisMascot({ state = "idle", size = "medium", position = "bottom-right" }: SolarisMascotProps) {
  const pathname = usePathname();
  const enabled = (pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login";
  const root = useRef<HTMLDivElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [greeting, setGreeting] = useState(false);
  const [dancing, setDancing] = useState(false);
  const [paused, setPaused] = useState(false);
  const id = useId().replace(/:/g, "");

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  useEffect(() => {
    if (!enabled || !root.current) return;
    const element = root.current;
    let frame = 0;
    function place() {
      frame = 0;
      const mobile = window.innerWidth < 640;
      const base = mobile ? 82 : 24;
      const height = element.getBoundingClientRect().height;
      const width = element.getBoundingClientRect().width;
      const right = parseFloat(getComputedStyle(element).right) || 24;
      const left = window.innerWidth - right - width;
      const viewport = window.visualViewport;
      const keyboard = viewport && viewport.height < window.innerHeight * .75;
      const modal = Array.from(document.querySelectorAll('[aria-modal="true"],dialog[open]')).some(node => node.getBoundingClientRect().height > 0);
      const controls = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"]'))
        .filter(node => !element.contains(node)).map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      const bottom = [base, base + height + 12, base + 2 * (height + 12)].find(offset => {
        const top = window.innerHeight - offset - height;
        return top >= 16 && !controls.some(rect => rect.right > left - 8 && rect.left < left + width + 8 && rect.bottom > top - 8 && rect.top < top + height + 8);
      });
      element.style.setProperty("--mascot-bottom", `${bottom ?? base}px`);
      element.dataset.obscured = String(Boolean(keyboard || modal || bottom === undefined));
      element.dataset.background = String(document.hidden);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(place); }
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || paused) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: fine)");
    let frame = 0;
    let x = 0, y = 0;
    const reset = () => { eyes.current?.style.setProperty("transform", "translate(0px,0px)"); };
    function move(event: PointerEvent) {
      if (motion.matches || !pointer.matches || document.hidden) return;
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = root.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = Math.max(-2, Math.min(2, (x - rect.left - rect.width / 2) / 160));
        const dy = Math.max(-1.5, Math.min(1.5, (y - rect.top - rect.height / 3) / 200));
        eyes.current?.style.setProperty("transform", `translate(${dx}px,${dy}px)`);
      });
    }
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    motion.addEventListener("change", reset);
    return () => { cancelAnimationFrame(frame); reset(); window.removeEventListener("pointermove", move); window.removeEventListener("blur", reset); motion.removeEventListener("change", reset); };
  }, [enabled, paused]);

  function greet() {
    if (greeting) return;
    if (timeout.current) clearTimeout(timeout.current);
    setDancing(false);
    setPaused(false);
    setGreeting(true);
    timeout.current = setTimeout(() => { setGreeting(false); timeout.current = null; }, 1400);
  }

  function dance() {
    if (timeout.current) clearTimeout(timeout.current);
    setGreeting(false);
    setPaused(false);
    setDancing(!dancing);
    timeout.current = dancing ? null : setTimeout(() => { setDancing(false); timeout.current = null; }, 6000);
  }

  if (!enabled) return null;
  return <div ref={root} className={styles.mascot} data-size={size} data-position={position} data-paused={paused} data-state={dancing ? "dancing" : greeting || state === "greeting" ? "greeting" : "idle"}>
    <button type="button" className={styles.character} onClick={greet} aria-label="Saludar a la mascota SOLARIS">
      <svg viewBox="0 0 180 210" aria-hidden="true" focusable="false" className={styles.art}>
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".48" stopColor="#ecf1f6"/><stop offset=".8" stopColor="#a6b8c9"/><stop offset="1" stopColor="#fff"/></linearGradient>
          <linearGradient id={`${id}-navy`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#31516c"/><stop offset=".5" stopColor="#0b2238"/><stop offset="1" stopColor="#020b14"/></linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff6b0"/><stop offset=".45" stopColor="#ffd34c"/><stop offset="1" stopColor="#e5a600"/></linearGradient>
          <radialGradient id={`${id}-visor`} cx=".35" cy=".2" r=".85"><stop stopColor="#203445"/><stop offset=".5" stopColor="#06111c"/><stop offset="1" stopColor="#010509"/></radialGradient>
        </defs>
        <ellipse cx="90" cy="199" rx="39" ry="5" fill="#082338" opacity=".12" className={styles.shadow}/>
        <g className={styles.float}>
          <g fill={`url(#${id}-navy)`} stroke="#061521" strokeWidth="1.5">
            <path d="M66 166 Q61 180 63 189 Q72 196 83 188 L84 165Z"/><path d="M96 165 L97 188 Q110 196 117 188 L113 166Z"/>
          </g>
          <g fill={`url(#${id}-shell)`} stroke="#8fa4b6" strokeWidth="1"><path d="M61 181 Q73 177 83 183 L83 190 Q67 198 59 190Z"/><path d="M97 183 Q108 177 119 181 L121 190 Q109 198 97 190Z"/></g>
          <path d="M77 100 L103 100 L107 118 L74 118Z" fill={`url(#${id}-navy)`}/>
          <g className={styles.leftArm}>
            <path d="M58 116 Q43 116 40 132 L35 156 Q37 166 46 161 L59 138" fill={`url(#${id}-shell)`} stroke="#8fa4b6" strokeWidth="1.5"/>
            <path d="M38 143 L49 147 L46 160 Q43 166 36 160Z" fill={`url(#${id}-navy)`}/><path d="M38 140 L50 144" stroke="#ffd34c" strokeWidth="3"/>
          </g>
          <path d="M64 113 Q90 103 116 113 L123 141 L114 171 Q90 180 66 171 L57 141Z" fill={`url(#${id}-shell)`} stroke="#8fa4b6" strokeWidth="1.5"/>
          <path d="M71 113 Q90 107 109 113 L115 141 L107 162 Q90 169 73 162 L65 141Z" fill={`url(#${id}-navy)`} stroke="#f4b400" strokeWidth="1.5"/>
          <path d="M78 168 Q90 172 102 168" fill="none" stroke="#f4b400" strokeWidth="3"/>
          <g stroke={`url(#${id}-gold)`} strokeWidth="2.5" strokeLinecap="round" fill="none"><circle cx="90" cy="138" r="8"/><path d="M90 121v4m0 26v4m-17-17h4m26 0h4m-29-12 3 3m18 18 3 3m-24 0 3-3m18-18 3-3"/></g>
          <g className={styles.waveArm}>
            <path d="M119 117 Q132 116 138 129 L146 148 Q146 156 137 157 L126 142 L116 132Z" fill={`url(#${id}-shell)`} stroke="#8fa4b6" strokeWidth="1.5"/>
            <path d="M137 140 L147 146" stroke="#ffd34c" strokeWidth="3"/>
            <g fill={`url(#${id}-navy)`} stroke="#243e53" strokeWidth="1"><path d="M141 147 Q155 147 155 158 L151 166 Q144 173 138 164 L134 155Z"/><path d="M153 154 L157 149 Q161 149 160 153 L156 160M148 151 L149 145 Q153 143 154 148 L154 154M143 152 L142 146 Q145 143 148 147 L149 152"/></g>
          </g>
          <g className={styles.head}>
            <ellipse cx="37" cy="68" rx="12" ry="24" fill={`url(#${id}-shell)`} stroke="#879bab"/><ellipse cx="143" cy="68" rx="12" ry="24" fill={`url(#${id}-shell)`} stroke="#879bab"/>
            <ellipse cx="37" cy="68" rx="6" ry="17" fill="#061521" stroke="#ffce45" strokeWidth="3"/><ellipse cx="143" cy="68" rx="6" ry="17" fill="#061521" stroke="#ffce45" strokeWidth="3"/>
            <path d="M39 54 Q39 12 89 11 Q140 12 141 54 L140 83 Q137 112 90 114 Q44 112 40 86Z" fill={`url(#${id}-shell)`} stroke="#92a9bc" strokeWidth="1.5"/>
            <path d="M58 25 Q89 5 121 25 L119 43 L61 43Z" fill={`url(#${id}-navy)`}/><path d="M62 41 Q89 36 118 41" fill="none" stroke="#ffce45" strokeWidth="2"/>
            <path d="M44 60 Q44 43 62 42 Q90 38 118 42 Q136 44 136 62 L134 83 Q132 104 90 106 Q49 104 46 83Z" fill={`url(#${id}-visor)`} stroke="#ffe091" strokeWidth="1.5"/>
            <path d="M52 58 Q52 49 69 48 L90 47" fill="none" stroke="#fff" strokeOpacity=".13" strokeWidth="3" strokeLinecap="round"/>
            <g ref={eyes} className={styles.gaze}><g className={styles.blink} stroke="#ffd664" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M59 73 Q67 56 75 73"/><path d="M105 73 Q113 56 121 73"/></g></g>
            <path d="M80 86 Q90 95 100 86" stroke="#ffd664" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <path d="M62 108 Q90 119 118 108" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2"/>
          </g>
        </g>
      </svg>
    </button>
    <button type="button" className={styles.dance} onClick={dance} aria-label={dancing ? "Detener baile de SOLARIS" : "Bailar con SOLARIS"} aria-pressed={dancing} title={dancing ? "Detener baile" : "¡Vamos a bailar!"}>{dancing ? <Square size={17} aria-hidden="true"/> : <Music2 size={19} aria-hidden="true"/>}</button>
    <button type="button" className={styles.pause} aria-label={paused ? "Activar animación de la mascota" : "Pausar animación de la mascota"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={12} aria-hidden="true"/> : <Pause size={12} aria-hidden="true"/>}</button>
  </div>;
}
