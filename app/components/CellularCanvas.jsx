"use client";

import { useEffect, useRef, useCallback } from "react";

export default function CellularCanvas({ active = false }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => { activeRef.current = active; }, [active]);

  const createParticle = useCallback((canvas, burst = false) => {
    const baseSpeed = burst ? 1.5 : 0.3;
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * (burst ? 4 : 2.5) + 1,
      vx: (Math.random() - 0.5) * baseSpeed,
      vy: (Math.random() - 0.5) * baseSpeed,
      alpha: Math.random() * 0.4 + 0.1,
      hue: Math.random() > 0.5 ? 168 : 246,
      life: burst ? 120 + Math.random() * 60 : Infinity,
      age: 0,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed particles
    const count = Math.min(60, Math.floor(window.innerWidth / 20));
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(canvas));
    }

    let lastBurst = 0;

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Burst particles when active
      if (activeRef.current && time - lastBurst > 200) {
        for (let i = 0; i < 5; i++) {
          particlesRef.current.push(createParticle(canvas, true));
        }
        lastBurst = time;
      }

      const particles = particlesRef.current;
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.08 * (activeRef.current ? 2 : 1);
            ctx.strokeStyle = `hsla(168,60%,60%,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.age++;

        if (p.life !== Infinity && p.age > p.life) {
          particles.splice(i, 1);
          continue;
        }

        // Wrap around
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        let alpha = p.alpha;
        if (p.life !== Infinity) {
          alpha *= Math.max(0, 1 - p.age / p.life);
        }
        if (activeRef.current) alpha *= 1.8;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},60%,65%,${alpha})`;
        ctx.fill();

        // Glow
        if (p.r > 2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, `hsla(${p.hue},60%,65%,${alpha * 0.3})`);
          g.addColorStop(1, `hsla(${p.hue},60%,65%,0)`);
          ctx.fillStyle = g;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      particlesRef.current = [];
    };
  }, [createParticle]);

  return (
    <div className={`cellular-canvas-wrap ${active ? "active" : ""}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
