import { useEffect, useRef } from "react";
type Particle = {x: number; y: number; vx: number; vy: number; life: number; color: string; size: number};
export default function Celebration({trigger, onFinish}: {trigger: number; onFinish: () => void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = innerWidth, height = innerHeight, frame = 0;
    const resize = () => {
      width = innerWidth; height = innerHeight;
      const scale = Math.min(devicePixelRatio || 1, 2);
      surface.width = width * scale; surface.height = height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    const palette = ["#e9ff9d", "#d4b9ff", "#88d9ff", "#ffbc80", "#ff92c5", "#ffffff"];
    const particles: Particle[] = [];
    const burst = (x: number, y: number, index: number) => {
      const color = palette[index % palette.length];
      for (let i = 0; i < 56; i++) {
        const angle = i / 56 * Math.PI * 2;
        const speed = 1.4 + Math.random() * 3;
        particles.push({x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1, color, size: 1.5 + Math.random() * 1.7});
      }
    };
    if (reduced) {
      for (let i = 0; i < 26; i++) {
        context.fillStyle = palette[i % palette.length];
        context.beginPath(); context.arc(Math.random() * width, Math.random() * height, 3, 0, Math.PI * 2); context.fill();
      }
      const timer = window.setTimeout(() => finish.current(), 3000);
      return () => {clearTimeout(timer); window.removeEventListener("resize", resize);};
    }
    const start = performance.now();
    let last = start, bursts = 0;
    const draw = (now: number) => {
      const elapsed = now - start;
      const dt = Math.min(2, (now - last) / 16.667); last = now;
      context.clearRect(0, 0, width, height);
      if (elapsed < 6000 && elapsed >= bursts * 260) {
        burst(width * (.08 + Math.random() * .84), height * (.12 + Math.random() * .62), bursts++);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= .009 * dt;
        if (p.life <= 0) {particles.splice(i, 1);continue;}
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .028 * dt; p.vx *= Math.pow(.99, dt);
        context.globalAlpha = Math.max(0, p.life);
        context.strokeStyle = p.color; context.lineWidth = p.size;
        context.beginPath();context.moveTo(p.x - p.vx * 2, p.y - p.vy * 2);context.lineTo(p.x, p.y);context.stroke();
      }
      context.globalAlpha = 1;
      if (elapsed < 8500) frame = requestAnimationFrame(draw);
      else finish.current();
    };
    frame = requestAnimationFrame(draw);
    return () => {cancelAnimationFrame(frame);window.removeEventListener("resize", resize);};
  }, [trigger]);
  return <div className="celebration-overlay">
    <canvas ref={canvas} aria-hidden="true"/>
    <div className="celebration-message" role="status">✨ Det här är värt att fira! ✨</div>
    <button className="celebration-close" onClick={() => finish.current()} aria-label="Avsluta fyrverkerier">✕</button>
  </div>;
}
