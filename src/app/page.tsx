import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffUser } from '@/lib/supabase-server';

/**
 * Public marketing landing page.
 * Signed-in staff skip straight to their dashboard; everyone else sees this.
 */
export default async function Home() {
  const user = await getStaffUser();
  if (user) redirect('/dashboard');

  return (
    <main className="lp">
      <SunFlare />

      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark">
              <SunMark />
            </span>
            <span className="lp-brand-text">SolarWelcome</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#compliance">Compliance</a>
          </nav>
          <Link href="/login" className="lp-nav-cta">Staff sign in</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <span className="lp-dot" /> Compliance-grade welcome calls
          </span>
          <h1>
            Confirm every solar sale
            <span className="lp-grad"> on camera, in minutes.</span>
          </h1>
          <p className="lp-lead">
            Send customers a one-time link. They consent, answer your questions on
            video, and the recording is captured, captioned, and archived — no app
            downloads, no scheduling, no dropped calls.
          </p>
          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn lp-btn-primary">Staff sign in →</Link>
            <a href="#how" className="lp-btn lp-btn-ghost">See how it works</a>
          </div>
          <div className="lp-trust">
            <div className="lp-trust-item">
              <strong>Immutable</strong>
              <span>audit trail</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <strong>Zero</strong>
              <span>customer installs</span>
            </div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item">
              <strong>Segmented</strong>
              <span>upload recovery</span>
            </div>
          </div>
        </div>

        <div className="lp-hero-art">
          <SolarPanelScene />
        </div>
      </section>

      <section id="how" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">How it works</span>
          <h2>Three steps from sale to signed record</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="lp-step">
              <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="lp-step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">Features</span>
          <h2>Built for the way solar teams actually close</h2>
        </div>
        <div className="lp-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="lp-feature">
              <div className="lp-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="compliance" className="lp-section">
        <div className="lp-compliance">
          <div className="lp-compliance-copy">
            <span className="lp-kicker">Compliance</span>
            <h2>Every answer, timestamped and tamper-evident</h2>
            <p>
              Questions are burned into the video pixels as they&apos;re asked, so the
              record can never be reconstructed after the fact. Consent, geolocation,
              device details, and each yes/no answer are written the moment they happen.
            </p>
            <ul className="lp-check-list">
              <li>Consent captured before recording starts</li>
              <li>Answers saved per question, not at the end</li>
              <li>Recording survives refreshes and dropped connections</li>
              <li>Full lifecycle log for every session</li>
            </ul>
          </div>
          <div className="lp-compliance-art">
            <RooftopScene />
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-final-card">
          <SunMark />
          <h2>Ready to run your first welcome call?</h2>
          <p>Sign in, build a question template, and send a link in under five minutes.</p>
          <Link href="/login" className="lp-btn lp-btn-primary">Staff sign in →</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="lp-brand-mark"><SunMark /></span>
          <span className="lp-brand-text">SolarWelcome</span>
        </div>
        <p>Compliance-grade welcome call recording for solar.</p>
      </footer>
    </main>
  );
}

/* ---------------------------------------------------------------- content */

const STEPS = [
  {
    title: 'Create the session',
    body: 'Pick a template, fill in the customer’s figures, and generate a one-time link tied to that sale.',
    icon: <IconLink />,
  },
  {
    title: 'Customer answers on camera',
    body: 'They open the link in any browser, consent, and respond to each question while the call records.',
    icon: <IconCamera />,
  },
  {
    title: 'Review and approve',
    body: 'Segments are stitched into a final video with answers side by side, ready for compliance sign-off.',
    icon: <IconShield />,
  },
];

const FEATURES = [
  {
    title: 'Dynamic question templates',
    body: 'Write questions once with {{variables}} and every session fills in that customer’s real numbers.',
    icon: <IconTemplate />,
  },
  {
    title: 'Spoken questions and answers',
    body: 'Questions are read aloud and spoken responses are transcribed alongside the yes/no record.',
    icon: <IconWave />,
  },
  {
    title: 'Resilient uploads',
    body: 'Video uploads in short segments with retry, so a flaky connection never costs you the recording.',
    icon: <IconCloud />,
  },
  {
    title: 'Burned-in captions',
    body: 'The question on screen is part of the video itself — not an overlay added later.',
    icon: <IconCaption />,
  },
  {
    title: 'Reviewer workflow',
    body: 'Approve or flag each call, with the full event timeline a click away.',
    icon: <IconCheckCircle />,
  },
  {
    title: 'Webhooks',
    body: 'Push completed calls straight into your CRM the moment they’re signed off.',
    icon: <IconWebhook />,
  },
];

/* ------------------------------------------------------------------- art */

/** Ambient sun glow behind the hero. */
function SunFlare() {
  return <div className="lp-flare" aria-hidden="true" />;
}

function SunMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill="currentColor" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x1 = 12 + Math.cos(angle) * 7.2;
        const y1 = 12 + Math.sin(angle) * 7.2;
        const x2 = 12 + Math.cos(angle) * 9.6;
        const y2 = 12 + Math.sin(angle) * 9.6;
        return (
          <line
            key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** Hero illustration: sun over an angled photovoltaic array. */
function SolarPanelScene() {
  return (
    <svg viewBox="0 0 460 380" className="lp-art-svg" role="img"
      aria-label="Illustration of a solar panel array beneath the sun">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f2942" />
          <stop offset="100%" stopColor="#0a1420" />
        </linearGradient>
        <linearGradient id="panelFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b3f68" />
          <stop offset="55%" stopColor="#12314f" />
          <stop offset="100%" stopColor="#0e2942" />
        </linearGradient>
        <linearGradient id="sunCore" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd76a" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
        <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fe6f2" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#7fe6f2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="460" height="380" rx="18" fill="url(#sky)" />

      {/* sun */}
      <circle cx="342" cy="96" r="86" fill="url(#sunGlow)" />
      <circle cx="342" cy="96" r="30" fill="url(#sunCore)" />

      {/* distant hills */}
      <path d="M0 268 Q86 226 168 262 T340 250 T460 272 V380 H0 Z" fill="#0c2035" />
      <path d="M0 292 Q110 258 214 288 T460 292 V380 H0 Z" fill="#0a1a2c" />

      {/* panel array, angled toward the sun */}
      <g transform="translate(56 176) skewY(-11)">
        {[0, 1].map((row) =>
          [0, 1, 2].map((col) => (
            <g key={`${row}-${col}`} transform={`translate(${col * 116} ${row * 78})`}>
              <rect width="106" height="68" rx="5" fill="url(#panelFace)" stroke="#2b5c8f" strokeWidth="1.6" />
              <rect width="106" height="68" rx="5" fill="url(#glint)" />
              {[1, 2].map((n) => (
                <line key={`v${n}`} x1={n * 35} y1="4" x2={n * 35} y2="64"
                  stroke="#2b5c8f" strokeWidth="1" opacity="0.75" />
              ))}
              <line x1="4" y1="34" x2="102" y2="34" stroke="#2b5c8f" strokeWidth="1" opacity="0.75" />
            </g>
          ))
        )}
      </g>

      {/* mounting legs */}
      {[86, 202, 318].map((x) => (
        <rect key={x} x={x} y="300" width="7" height="42" rx="3" fill="#16324f" />
      ))}
      <rect x="40" y="340" width="330" height="7" rx="3.5" fill="#1b3d60" />
    </svg>
  );
}

/** Compliance section illustration: rooftop panels with a verified badge. */
function RooftopScene() {
  return (
    <svg viewBox="0 0 420 320" className="lp-art-svg" role="img"
      aria-label="Illustration of rooftop solar panels with a verified badge">
      <defs>
        <linearGradient id="roofSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#102b46" />
          <stop offset="100%" stopColor="#0a1420" />
        </linearGradient>
        <linearGradient id="roofPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d456f" />
          <stop offset="100%" stopColor="#0f2c47" />
        </linearGradient>
      </defs>

      <rect width="420" height="320" rx="18" fill="url(#roofSky)" />
      <circle cx="88" cy="76" r="58" fill="url(#sunGlow)" />
      <circle cx="88" cy="76" r="21" fill="url(#sunCore)" />

      {/* house silhouette */}
      <path d="M60 214 L210 128 L360 214 V300 H60 Z" fill="#0d2237" stroke="#1d3e60" strokeWidth="2" />
      {/* roof plane with panels */}
      <path d="M96 208 L210 143 L324 208 Z" fill="#0b1e31" stroke="#1d3e60" strokeWidth="1.6" />
      {[0, 1, 2].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={150 + col * 52 - row * 8} y={168 + row * 16}
            width="46" height="13" rx="2.5"
            fill="url(#roofPanel)" stroke="#2b5c8f" strokeWidth="1"
          />
        ))
      )}

      {/* verified badge */}
      <g transform="translate(296 226)">
        <circle r="34" fill="#0d2237" stroke="#22c55e" strokeWidth="2" />
        <circle r="34" fill="#22c55e" opacity="0.12" />
        <path d="M-13 1 L-4 10 L14 -9" fill="none" stroke="#22c55e"
          strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------------- icons */

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1.1l2.9-2.9a5 5 0 0 0-7.1-7.1L11.5 4.5" />
      <path d="M14 11a5 5 0 0 0-7.1-.1L4 13.8a5 5 0 0 0 7.1 7.1l1.4-1.4" />
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

function IconTemplate() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 13h8M8 16.5h5" />
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
