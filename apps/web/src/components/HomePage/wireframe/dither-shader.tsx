
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, type ReactNode } from "react";
import { observeVisibility } from "@/lib/wireframe_lib/visibility";
const useTheme = () => ({ resolvedTheme: "dark" });

const vertexShader = /* glsl */ `#version 300 es
  in vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `#version 300 es
  precision highp float;

  uniform vec2  iResolution;
  uniform float iTime;
  uniform vec2  iMouse;
  uniform float iMouseActive;
  uniform float uTheme;
  uniform float uVariant;
  uniform float uTransparent;
  uniform vec3  uGlyphColor;

  out vec4 fragColor;

  const float kBayer[16] = float[16](
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );

  float box(vec2 p, vec2 c, vec2 h) {
    vec2 q = abs(p - c) - h;
    return (1.0 - step(0.0, q.x)) * (1.0 - step(0.0, q.y));
  }

  float synthesizeCharacter(vec2 uv, float lum) {
    vec2 p = uv * 2.0 - 1.0;
    int tier = int(clamp(lum * 5.0, 0.0, 4.0));

    if (tier == 0) return 0.0;
    if (tier == 1) return 1.0 - step(0.2, length(p));
    if (tier == 2) return box(p, vec2(0.0), vec2(0.6, 0.2));
    if (tier == 3) {
      return max(box(p, vec2(0.0), vec2(0.6, 0.2)),
                 box(p, vec2(0.0), vec2(0.2, 0.6)));
    }
    float bounds = box(p, vec2(0.0), vec2(0.8));
    float bars = max(
      max(box(p, vec2(0.0,  0.3), vec2(1.0, 0.15)),
          box(p, vec2(0.0, -0.3), vec2(1.0, 0.15))),
      max(box(p, vec2( 0.3, 0.0), vec2(0.15, 1.0)),
          box(p, vec2(-0.3, 0.0), vec2(0.15, 1.0)))
    );
    return bars * bounds;
  }

  float computeBayer(vec2 cell) {
    ivec2 q = ivec2(mod(cell, 4.0));
    return kBayer[q.x + q.y * 4] / 16.0;
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    float gridResolution = mix(10.0, 14.0, uVariant);
    vec2 cellIndex = floor(fragCoord / gridResolution);
    vec2 localUV   = fract(fragCoord / gridResolution);

    float aspect = iResolution.x / iResolution.y;
    vec2 uv = (cellIndex * gridResolution) / iResolution.xy * 2.0 - 1.0;
    uv.x *= aspect;

    vec2 m = iMouse / iResolution.xy * 2.0 - 1.0;
    m.x *= aspect;

    vec2  d = uv - m;
    float r = length(d);
    vec2  perp = vec2(-d.y, d.x);
    float shear = exp(-r * 2.2) * (1.0 - exp(-r * 6.0)) * iMouseActive;
    vec2  warped = uv + normalize(perp + 1e-5) * shear * 0.35;

    float timeScale  = mix(0.5, 0.22, uVariant);
    float waveFreq   = mix(5.0, 3.4,  uVariant);
    float radialFreq = mix(10.0, 6.0, uVariant);
    float time = iTime * timeScale;
    float baseLuminance = (
      sin(warped.x * waveFreq + time) +
      sin(warped.y * waveFreq + time) +
      sin(warped.x * warped.y * radialFreq - time) +
      sin(length(warped) * radialFreq - time * 2.0)
    ) * 0.25 + 0.5;

    baseLuminance = pow(smoothstep(0.15, 0.95, baseLuminance), 0.75);
    baseLuminance *= 1.0 - smoothstep(0.45, 0.0, r) * iMouseActive * 0.85;

    float adjustedLuminance = clamp(
      baseLuminance + (computeBayer(cellIndex) - 0.5) * 0.5,
      0.0, 1.0
    );

    float mask = synthesizeCharacter(localUV, adjustedLuminance);

    vec3 bg = mix(vec3(1.0), vec3(0.039), uTheme);
    vec3 fg = mix(vec3(0.0), vec3(0.98),  uTheme);
    vec3 themedColor = mix(bg, fg, mask);

    fragColor = vec4(
      mix(themedColor, uGlyphColor, uTransparent),
      mix(1.0, mask, uTransparent)
    );
  }
`;

export type DitherVariant = "hero" | "cta";
export type DitherTone = { r: number; g: number; b: number };

let webgl2Support: boolean | null = null;
function isWebGL2Supported(): boolean {
  if (typeof window === "undefined") return false;
  if (webgl2Support !== null) return webgl2Support;
  try {
    const canvas = document.createElement("canvas");
    webgl2Support = !!canvas.getContext("webgl2");
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

function readDomThemeValue(): number {
  if (typeof document === "undefined") return 0;
  return document.documentElement.classList.contains("dark") ? 1 : 0;
}

export function DitherShader({
  variant = "hero",
  tone,
}: { variant?: DitherVariant; tone?: DitherTone } = {}): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();

  const themeTargetRef = useRef(readDomThemeValue());
  const variantRef = useRef(variant === "cta" ? 1 : 0);
  const transparentRef = useRef(tone ? 1 : 0);
  const glyphColorRef = useRef<[number, number, number]>(
    tone ? [tone.r, tone.g, tone.b] : [0.85, 0.85, 0.85]
  );

  useEffect(() => {
    variantRef.current = variant === "cta" ? 1 : 0;
  }, [variant]);

  useEffect(() => {
    transparentRef.current = tone ? 1 : 0;
    if (tone) {
      glyphColorRef.current = [tone.r, tone.g, tone.b];
    }
  }, [tone]);

  useEffect(() => {
    // Ignore the transient `undefined` next-themes reports before it resolves,
    // so we never snap the shader to the light (white) theme.
    if (!resolvedTheme) return;
    themeTargetRef.current = resolvedTheme === "dark" ? 1 : 0;
  }, [resolvedTheme]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const cover = coverRef.current;
    if (!container || !canvas) return;
    if (!isWebGL2Supported()) return;

    let renderer: Renderer | null = null;
    let program: Program | null = null;
    let mesh: Mesh | null = null;
    let gl: Renderer["gl"] | null = null;
    let ro: ResizeObserver | null = null;
    let frameId = 0;
    let presentedFrames = 0;
    let running = false;
    const start = performance.now();

    const target = { x: 0, y: 0, active: 0 };
    const current = { x: 0, y: 0, active: 0 };

    const resize = (): void => {
      if (!renderer || !program || !gl) return;
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      program.uniforms.iResolution.value = [
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      ];
      if (current.x === 0 && current.y === 0) {
        current.x = gl.drawingBufferWidth / 2;
        current.y = gl.drawingBufferHeight / 2;
        target.x = current.x;
        target.y = current.y;
      }
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!gl) return;
      const rect = container.getBoundingClientRect();
      const dpr = gl.drawingBufferWidth / rect.width;
      target.x = (event.clientX - rect.left) * dpr;
      target.y = (rect.height - (event.clientY - rect.top)) * dpr;
      target.active = 1;
    };

    const handlePointerLeave = (): void => {
      target.active = 0;
    };

    const render = (prewarm = false): void => {
      if (!renderer || !program || !mesh) return;
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      current.active += (target.active - current.active) * 0.06;

      const themeNow = program.uniforms.uTheme.value as number;
      program.uniforms.uTheme.value =
        themeNow + (themeTargetRef.current - themeNow) * 0.12;

      program.uniforms.uVariant.value = variantRef.current;
      program.uniforms.uTransparent.value = transparentRef.current;
      const gc = program.uniforms.uGlyphColor.value as number[];
      gc[0] = glyphColorRef.current[0];
      gc[1] = glyphColorRef.current[1];
      gc[2] = glyphColorRef.current[2];

      program.uniforms.iTime.value = (performance.now() - start) / 1000;
      program.uniforms.iMouse.value = [current.x, current.y];
      program.uniforms.iMouseActive.value = current.active;

      renderer.render({ scene: mesh });

      // `prewarm` draws happen synchronously in startLoop to seed both WebGL
      // buffers; they must not reveal the canvas or schedule the rAF loop.
      if (prewarm) return;

      // Reveal the canvas on the first real animation frame. By now both GPU
      // buffers hold drawn shader content (seeded synchronously), and the
      // browser has composited the hidden (opacity:0) state at least once, so
      // the fade-in can never expose an undrawn/white surface.
      presentedFrames += 1;
      if (presentedFrames === 1) {
        canvas.style.opacity = "1";
      }

      // Hold the solid themed cover on top of the canvas through the entire
      // flash-prone window (context creation, first composites, opacity
      // transition) and only fade it out once the shader has been drawing
      // stably for several frames. The cover is a plain DOM element, so it can
      // never be presented white the way a fresh WebGL layer can on some GPUs.
      if (cover && presentedFrames === 8) {
        cover.style.opacity = "0";
      }

      if (running) frameId = requestAnimationFrame(() => render());
    };

    const init = (): void => {
      if (renderer) return;
      try {
        renderer = new Renderer({
          // Render into the canvas React already put in the DOM rather than
          // letting OGL create and append one after mount.
          canvas,
          webgl: 2,
          // Match the flash-free template's context exactly.
          alpha: true,
          premultipliedAlpha: false,
          antialias: false,
          dpr: Math.min(window.devicePixelRatio, 2),
        });
      } catch {
        renderer = null;
        return;
      }

      gl = renderer.gl;
      const transparent = transparentRef.current === 1;
      if (transparent) {
        gl.clearColor(0, 0, 0, 0);
      } else if (themeTargetRef.current === 1) {
        gl.clearColor(0.039, 0.039, 0.039, 1);
      } else {
        gl.clearColor(1, 1, 1, 1);
      }

      // Creating the WebGL context immediately allocates a compositor layer.
      // Clear it synchronously so that layer is backed by the themed color
      // (transparent for overlays, dark/light otherwise) the instant it exists,
      // instead of an undrawn GPU surface the driver may present as white.
      gl.clear(gl.COLOR_BUFFER_BIT);

      program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          iResolution: { value: [1, 1] },
          iTime: { value: 0 },
          iMouse: { value: [0, 0] },
          iMouseActive: { value: 0 },
          uTheme: { value: themeTargetRef.current },
          uVariant: { value: variantRef.current },
          uTransparent: { value: transparentRef.current },
          uGlyphColor: { value: glyphColorRef.current.slice() },
        },
      });

      mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      ro = new ResizeObserver(resize);
      ro.observe(container);
      resize();

      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      container.addEventListener("pointerleave", handlePointerLeave);
    };

    const startLoop = (): void => {
      init();
      if (!renderer || running) return;
      running = true;
      // Draw the first frames synchronously, before yielding to rAF. WebGL is
      // double-buffered, so rendering twice fills both the front and back
      // buffers with real shader content; whichever surface the compositor
      // grabs when this layer is first presented is therefore already drawn,
      // never the undrawn (white) buffer. Without this, the very first paint can
      // race ahead of the first rAF draw and flash on some GPUs.
      render(true);
      render(true);
      frameId = requestAnimationFrame(() => render());
    };

    const stopLoop = (): void => {
      running = false;
      cancelAnimationFrame(frameId);
    };

    // Defer WebGL context creation until the shader is near the viewport.
    // Creating all 8 of these contexts eagerly on load spins up 8 GPU layers at
    // once, which is what produced the multi-element white flash on reload. The
    // flash-free template uses this same visibility gate.
    const unobserve = observeVisibility(container, (active) => {
      if (active) startLoop();
      else stopLoop();
    });

    return () => {
      unobserve();
      stopLoop();
      ro?.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  // Opaque variants (no `tone`) fill their area, but until the first WebGL
  // frame is presented the canvas is transparent, so back it with the themed
  // page background to guarantee nothing white can show through. Transparent
  // overlay variants must stay clear.
  const isOpaque = !tone;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full ${
        isOpaque ? "bg-background" : ""
      }`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ opacity: 0, transition: "opacity 150ms ease" }}
      />
      {isOpaque ? (
        // Solid themed cover sitting on top of the canvas. It is a plain DOM
        // layer (never white in dark mode) and is held opaque until the WebGL
        // shader has been drawing stably for several frames, then faded out —
        // guaranteeing no GPU white flash can ever be seen during init.
        <div
          ref={coverRef}
          aria-hidden="true"
          className="bg-background pointer-events-none absolute inset-0"
          style={{ opacity: 1, transition: "opacity 200ms ease" }}
        />
      ) : null}
    </div>
  );
}
