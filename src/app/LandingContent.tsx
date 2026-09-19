'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/LocaleProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BrandMark from '@/components/BrandMark';

/** Public marketing landing page content — client component so it can read the UI locale. */
export default function LandingContent() {
  const t = useT();
  const navHidden = useHideNavOnScroll();

  const STEPS = [
    { title: t('lp.step1Title'), body: t('lp.step1Body'), icon: <IconShare />, tag: 'DISPATCH ENCRYPTED', active: false },
    { title: t('lp.step2Title'), body: t('lp.step2Body'), icon: <IconCamera />, tag: 'WEBRTC STREAMING', active: true },
    { title: t('lp.step3Title'), body: t('lp.step3Body'), icon: <IconShield />, tag: 'IMMUTABLE ATTESTATION', active: false },
  ];

  return (
    <main className="lp">
      <header className={`lp-nav${navHidden ? ' lp-nav-hidden' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark">
              <BrandMark />
            </span>
            <span className="lp-brand-text">Accord</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#how" aria-current="page">{t('lp.navHow')}</a>
            <a href="#features">{t('lp.navFeatures')}</a>
            <a href="#compliance">{t('lp.navCompliance')}</a>
          </nav>
          <div className="lp-nav-actions">
            <LanguageSwitcher />
            <Link href="/login" className="lp-nav-cta">{t('lp.staffSignIn')}</Link>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <ShaderBackground />
        <div className="lp-hero-inner">
          <span className="lp-eyebrow">
            <span className="lp-dot" /> {t('lp.heroEyebrow')}
          </span>
          <h1>
            {t('lp.heroTitle1')} {t('lp.heroTitle2')}
          </h1>
          <p className="lp-lead">{t('lp.heroLead')}</p>
          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn lp-btn-primary">
              {t('lp.staffSignIn')}
              <IconArrowRight />
            </Link>
            <a href="#how" className="lp-btn lp-btn-ghost">{t('lp.ctaSeeHow')}</a>
          </div>
          <div className="lp-trust">
            <div className="lp-trust-item">
              <strong>{t('lp.trustImmutable')}</strong>
              <span>{t('lp.trustAuditTrail')}</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <strong>{t('lp.trustZero')}</strong>
              <span>{t('lp.trustInstalls')}</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <strong>{t('lp.trustSegmented')}</strong>
              <span>{t('lp.trustRecovery')}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">{t('lp.howKicker')}</span>
          <h2>{t('lp.howTitle')}</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`lp-step${step.active ? ' is-active' : ''}`}>
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="lp-step-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <div className="lp-step-tag">
                <span className="lp-tag-dot" />
                <span>{step.tag}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">{t('lp.featuresKicker')}</span>
          <h2>{t('lp.featuresTitle')}</h2>
        </div>
        <div className="lp-bento">
          <div className="lp-bento-item span-2">
            <div>
              <div className="lp-bento-head">
                <div className="lp-bento-title">
                  <span className="lp-bento-icon"><IconSchema /></span>
                  <h3>{t('lp.featureTemplatesTitle')}</h3>
                </div>
                <span className="lp-bento-badge">jurisdiction: US-CA / v2.4</span>
              </div>
              <p>{t('lp.featureTemplatesBody')}</p>
            </div>
            <div className="lp-bento-foot">
              <span><span className="lp-dot-sm" />Branching rules: ACTIVE</span>
              <span><span className="lp-dot-sm" />Fallbacks: 4</span>
            </div>
          </div>

          <div className="lp-bento-item">
            <div>
              <div className="lp-bento-title" style={{ marginBottom: 16 }}>
                <span className="lp-bento-icon"><IconWave /></span>
                <h3>{t('lp.featureVoiceTitle')}</h3>
              </div>
              <p>{t('lp.featureVoiceBody')}</p>
            </div>
            <div className="lp-bento-foot between">
              <span>SNR THRESHOLD</span>
              <span className="lp-cyan">&gt; 28 dB [PASS]</span>
            </div>
          </div>

          <div className="lp-bento-item">
            <div>
              <div className="lp-bento-title" style={{ marginBottom: 16 }}>
                <span className="lp-bento-icon"><IconCloud /></span>
                <h3>{t('lp.featureUploadsTitle')}</h3>
              </div>
              <p>{t('lp.featureUploadsBody')}</p>
            </div>
            <div className="lp-bento-foot between">
              <span>CHUNK CADENCE</span>
              <span className="lp-cyan">3000ms SLICES</span>
            </div>
          </div>

          <div className="lp-bento-item span-2">
            <div>
              <div className="lp-bento-title" style={{ marginBottom: 16 }}>
                <span className="lp-bento-icon"><IconCaption /></span>
                <h3>{t('lp.featureCaptionsTitle')}</h3>
              </div>
              <p>{t('lp.featureCaptionsBody')}</p>
            </div>
            <div className="lp-bento-foot lp-bento-grid-3">
              <span>CODEC: H.264 / AAC</span>
              <span>STANDARD: SMPTE-12M</span>
              <span className="lp-cyan">HARD-BURNED: TRUE</span>
            </div>
          </div>

          <div className="lp-bento-item">
            <div>
              <div className="lp-bento-title" style={{ marginBottom: 16 }}>
                <span className="lp-bento-icon"><IconCheckCircle /></span>
                <h3>{t('lp.featureReviewerTitle')}</h3>
              </div>
              <p>{t('lp.featureReviewerBody')}</p>
            </div>
            <div className="lp-bento-foot between">
              <span>DUAL-CONTROL</span>
              <span className="lp-cyan">2FA REQUIRED</span>
            </div>
          </div>

          <div className="lp-bento-item span-2">
            <div>
              <div className="lp-bento-title" style={{ marginBottom: 16 }}>
                <span className="lp-bento-icon"><IconWebhook /></span>
                <h3>{t('lp.featureWebhooksTitle')}</h3>
              </div>
              <p>{t('lp.featureWebhooksBody')}</p>
            </div>
            <div className="lp-bento-foot">
              <span>EVENT: <code>agreement.executed</code></span>
              <span>LATENCY: <code className="lp-cyan">&lt;140ms</code></span>
            </div>
          </div>
        </div>
      </section>

      <section id="compliance" className="lp-section">
        <div className="lp-compliance">
          <div className="lp-compliance-copy">
            <span className="lp-kicker">{t('lp.complianceKicker')}</span>
            <h2>{t('lp.complianceTitle')}</h2>
            <p>{t('lp.complianceBody')}</p>
            <ul className="lp-check-list">
              <li><span className="lp-check-icon"><IconCheckCircleSmall /></span>{t('lp.complianceItem1')}</li>
              <li><span className="lp-check-icon"><IconCheckCircleSmall /></span>{t('lp.complianceItem2')}</li>
              <li><span className="lp-check-icon"><IconCheckCircleSmall /></span>{t('lp.complianceItem3')}</li>
              <li><span className="lp-check-icon"><IconCheckCircleSmall /></span>{t('lp.complianceItem4')}</li>
            </ul>
          </div>
          <div>
            <VerificationPanel />
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-final-card">
          <h2>{t('lp.finalTitle')}</h2>
          <p>{t('lp.finalBody')}</p>
          <Link href="/login" className="lp-btn lp-btn-primary">
            {t('lp.staffSignIn')}
            <IconArrowRight />
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div>
            <div className="lp-brand">
              <span className="lp-brand-mark"><BrandMark /></span>
              <span className="lp-brand-text">Accord</span>
            </div>
            <p className="lp-tagline">{t('lp.footerTagline')}</p>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} Accord. All rights reserved.</div>
          <div className="lp-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#compliance">Security &amp; Trust</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/**
 * Hides the nav on scroll-down, reveals it again on scroll-up — never on the
 * initial screen, so it doesn't flicker while the user is still at the top.
 */
function useHideNavOnScroll() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const goingDown = y > lastY;
      if (y < 80) {
        setHidden(false);
      } else if (Math.abs(y - lastY) > 4) {
        setHidden(goingDown);
      }
      lastY = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}

/* ------------------------------------------------------------------- art */

/** Live ambient WebGL noise field behind the hero — restrained cyan glow on near-black. */
function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return () => resizeObserver.disconnect();
    const glContext = gl as WebGLRenderingContext;

    const vs = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 0.12;

    float n1 = snoise(st * 2.2 + vec2(t * 0.4, -t * 0.25));
    float n2 = snoise(st * 4.0 - vec2(t * 0.3, t * 0.5) + vec2(n1 * 0.5));
    float n3 = snoise(st * 1.2 + vec2(-t * 0.15, t * 0.2));

    float distFromCenter = length(st * vec2(1.1, 1.6));
    float centerVignette = smoothstep(0.9, 0.1, distFromCenter);

    vec3 bgBase = vec3(0.039, 0.039, 0.043);
    vec3 cyanAccent = vec3(0.0, 0.898, 1.0);
    vec3 deepCyan = vec3(0.005, 0.12, 0.16);

    float waveIntensity = (n1 * 0.5 + n2 * 0.25 + n3 * 0.25);
    waveIntensity = smoothstep(-0.2, 0.8, waveIntensity);

    vec3 col = bgBase;
    col += deepCyan * (waveIntensity * 0.85) * centerVignette;
    float filament = smoothstep(0.48, 0.52, abs(n2)) * 0.08;
    col += cyanAccent * filament * centerVignette;
    float coreGlow = smoothstep(0.55, 0.0, distFromCenter) * 0.16;
    col += cyanAccent * coreGlow;

    float bottomFade = smoothstep(0.0, 0.25, uv.y);
    col = mix(bgBase, col, bottomFade);

    gl_FragColor = vec4(col, 1.0);
}`;

    function compile(type: number, src: string) {
      const shader = glContext.createShader(type)!;
      glContext.shaderSource(shader, src);
      glContext.compileShader(shader);
      return shader;
    }

    const prog = glContext.createProgram()!;
    glContext.attachShader(prog, compile(glContext.VERTEX_SHADER, vs));
    glContext.attachShader(prog, compile(glContext.FRAGMENT_SHADER, fs));
    glContext.linkProgram(prog);
    glContext.useProgram(prog);

    const buf = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, buf);
    glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), glContext.STATIC_DRAW);
    const posLoc = glContext.getAttribLocation(prog, 'a_position');
    glContext.enableVertexAttribArray(posLoc);
    glContext.vertexAttribPointer(posLoc, 2, glContext.FLOAT, false, 0, 0);

    const uTime = glContext.getUniformLocation(prog, 'u_time');
    const uRes = glContext.getUniformLocation(prog, 'u_resolution');

    let raf = 0;
    function render(time: number) {
      glContext.viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) glContext.uniform1f(uTime, time * 0.001);
      if (uRes) glContext.uniform2f(uRes, canvas!.width, canvas!.height);
      glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="lp-shader" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

/** Mock verification panel: a session's video frame + timestamped event log, side by side. */
function VerificationPanel() {
  return (
    <div className="lp-panel">
      <div className="lp-panel-head">
        <div className="lp-panel-dots">
          <span /><span /><span />
          <span className="lp-panel-id">Session #AC-98241</span>
        </div>
        <div className="lp-panel-verified">
          <span className="lp-tag-dot" />
          VERIFIED
        </div>
      </div>
      <div className="lp-panel-body">
        <div className="lp-panel-video">
          <div className="lp-panel-video-frame">
            <svg width="180" height="180" viewBox="0 0 200 200" fill="none" className="lp-scan-svg">
              <circle cx="100" cy="80" r="36" stroke="#00E5FF" strokeDasharray="4 4" strokeWidth="1.5" className="lp-scan-ring" />
              <path d="M40 180C40 145 66.8629 130 100 130C133.137 130 160 145 160 180" stroke="#849396" strokeDasharray="4 4" strokeWidth="1.5" />
              <path d="M20 35 V20 H35" stroke="#00E5FF" strokeWidth="1.5" />
              <path d="M180 35 V20 H165" stroke="#00E5FF" strokeWidth="1.5" />
              <path d="M20 165 V180 H35" stroke="#00E5FF" strokeWidth="1.5" />
              <path d="M180 165 V180 H165" stroke="#00E5FF" strokeWidth="1.5" />
              <clipPath id="lp-scan-clip">
                <circle cx="100" cy="80" r="36" />
              </clipPath>
              <rect x="64" y="44" width="72" height="4" fill="#00E5FF" opacity="0.7" clipPath="url(#lp-scan-clip)" className="lp-scan-beam" />
            </svg>
          </div>
          <div className="lp-panel-video-top">
            <div className="lp-panel-rec">
              <span className="lp-rec-dot" />
              REC
            </div>
            <div className="lp-panel-time">00:02:14:18 UTC</div>
          </div>
          <div className="lp-panel-caption-wrap">
            <div className="lp-panel-caption">
              <span className="lp-panel-caption-label">Subtitles burned:</span>
              <p>&ldquo;I confirm that I have reviewed the disclosures and agree to the terms.&rdquo;</p>
            </div>
          </div>
        </div>
        <div className="lp-panel-log">
          <div>
            <div className="lp-log-title">Event Sequence</div>
            <div className="lp-log-items">
              <div className="lp-log-item">
                <div className="lp-log-row">
                  <span className="lp-log-time">00:00:12</span>
                  <span className="lp-log-pass">[PASS]</span>
                </div>
                <span className="lp-log-desc">Identity consent accepted</span>
              </div>
              <div className="lp-log-item">
                <div className="lp-log-row">
                  <span className="lp-log-time">00:00:48</span>
                  <span className="lp-log-pass">[PASS]</span>
                </div>
                <span className="lp-log-desc">Q1: Address verified</span>
              </div>
              <div className="lp-log-item">
                <div className="lp-log-row">
                  <span className="lp-log-time">00:01:32</span>
                  <span className="lp-log-pass">[PASS]</span>
                </div>
                <span className="lp-log-desc">Q2: Disclosure read aloud</span>
              </div>
              <div className="lp-log-item is-active">
                <div className="lp-log-row">
                  <span className="lp-log-time">00:02:14</span>
                  <span className="lp-log-rec"><span className="lp-rec-dot-sm" />REC</span>
                </div>
                <span className="lp-log-desc">Q3: Execution consent</span>
              </div>
            </div>
          </div>
          <div className="lp-hash-bar">
            <span>SHA-256: 8f4b...c391</span>
            <span className="lp-locked">[LOCKED]</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- icons */

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h7A2.5 2.5 0 0 1 15 8.5v7A2.5 2.5 0 0 1 12.5 18h-7A2.5 2.5 0 0 1 3 15.5z" />
      <path d="M15 10.5 21 7v10l-6-3.5z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 20 6v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconSchema() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="15" width="7" height="6" rx="1.5" />
      <path d="M6.5 11v2.5a1.5 1.5 0 0 0 1.5 1.5h1M17.5 11v2.5a1.5 1.5 0 0 1-1.5 1.5h-1" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M3 12h2M7 8v8M11 5v14M15 8.5v7M19 11h2" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 10.5a3.75 3.75 0 0 1 .3 7.5z" />
      <path d="M12 15V9M9.5 11.5 12 9l2.5 2.5" />
    </svg>
  );
}

function IconCaption() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M8 14.5h3.5M14 14.5h2" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

function IconCheckCircleSmall() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

function IconWebhook() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="7" r="3" />
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M10.5 9.6 7.5 14.4M13.5 9.6l3 4.8M9 17h6" />
    </svg>
  );
}
