'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n/LocaleProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/** Public marketing landing page content — client component so it can read the UI locale. */
export default function LandingContent() {
  const t = useT();

  const STEPS = [
    { title: t('lp.step1Title'), body: t('lp.step1Body'), icon: <IconLink /> },
    { title: t('lp.step2Title'), body: t('lp.step2Body'), icon: <IconCamera /> },
    { title: t('lp.step3Title'), body: t('lp.step3Body'), icon: <IconShield /> },
  ];

  const FEATURES = [
    { title: t('lp.featureTemplatesTitle'), body: t('lp.featureTemplatesBody'), icon: <IconTemplate /> },
    { title: t('lp.featureVoiceTitle'), body: t('lp.featureVoiceBody'), icon: <IconWave /> },
    { title: t('lp.featureUploadsTitle'), body: t('lp.featureUploadsBody'), icon: <IconCloud /> },
    { title: t('lp.featureCaptionsTitle'), body: t('lp.featureCaptionsBody'), icon: <IconCaption /> },
    { title: t('lp.featureReviewerTitle'), body: t('lp.featureReviewerBody'), icon: <IconCheckCircle /> },
    { title: t('lp.featureWebhooksTitle'), body: t('lp.featureWebhooksBody'), icon: <IconWebhook /> },
  ];

  return (
    <main className="lp">
      <GlowFlare />

      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark">
              <BrandMark />
            </span>
            <span className="lp-brand-text">Accord</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#how">{t('lp.navHow')}</a>
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
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            <span className="lp-dot" /> {t('lp.heroEyebrow')}
          </span>
          <h1>
            {t('lp.heroTitle1')}
            <span className="lp-grad"> {t('lp.heroTitle2')}</span>
          </h1>
          <p className="lp-lead">{t('lp.heroLead')}</p>
          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn lp-btn-primary">{t('lp.staffSignIn')} →</Link>
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

        <div className="lp-hero-art">
          <AgreementScene />
        </div>
      </section>

      <section id="how" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-kicker">{t('lp.howKicker')}</span>
          <h2>{t('lp.howTitle')}</h2>
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
          <span className="lp-kicker">{t('lp.featuresKicker')}</span>
          <h2>{t('lp.featuresTitle')}</h2>
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
            <span className="lp-kicker">{t('lp.complianceKicker')}</span>
            <h2>{t('lp.complianceTitle')}</h2>
            <p>{t('lp.complianceBody')}</p>
            <ul className="lp-check-list">
              <li>{t('lp.complianceItem1')}</li>
              <li>{t('lp.complianceItem2')}</li>
              <li>{t('lp.complianceItem3')}</li>
              <li>{t('lp.complianceItem4')}</li>
            </ul>
          </div>
          <div className="lp-compliance-art">
            <VerifiedRecordScene />
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-final-card">
          <BrandMark />
          <h2>{t('lp.finalTitle')}</h2>
          <p>{t('lp.finalBody')}</p>
          <Link href="/login" className="lp-btn lp-btn-primary">{t('lp.staffSignIn')} →</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="lp-brand-mark"><BrandMark /></span>
          <span className="lp-brand-text">Accord</span>
        </div>
        <p>{t('lp.footerTagline')}</p>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------- art */

/** Ambient glow behind the hero. */
function GlowFlare() {
  return <div className="lp-flare" aria-hidden="true" />;
}

/** Brand mark: two hands closing an agreement — reads at any size, no industry tie-in. */
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 12.5 8 9l3.2 2.1a1.6 1.6 0 0 1-1.7 2.7L7 12.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12.5 16 9l-3.2 2.1a1.6 1.6 0 0 0 1.7 2.7l2.5-1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9 6.5 7.3M16 9l1.5-1.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** Hero illustration: a customer signing on camera, question card beside them. */
function AgreementScene() {
  return (
    <svg viewBox="0 0 460 380" className="lp-art-svg" role="img"
      aria-label="Illustration of a video call capturing a customer's recorded agreement">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f2942" />
          <stop offset="100%" stopColor="#0a1420" />
        </linearGradient>
        <linearGradient id="screenFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b3f68" />
          <stop offset="55%" stopColor="#12314f" />
          <stop offset="100%" stopColor="#0e2942" />
        </linearGradient>
        <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fe6f2" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#7fe6f2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d8ea" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d8ea" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="460" height="380" rx="18" fill="url(#sky)" />
      <circle cx="342" cy="96" r="110" fill="url(#ambientGlow)" />

      {/* main call frame */}
      <rect x="48" y="46" width="364" height="240" rx="14" fill="url(#screenFace)" stroke="#2b5c8f" strokeWidth="1.6" />
      <rect x="48" y="46" width="364" height="240" rx="14" fill="url(#glint)" />

      {/* customer silhouette on camera */}
      <circle cx="180" cy="150" r="34" fill="#2b5c8f" opacity="0.55" />
      <path d="M126 232c8-34 36-52 54-52s46 18 54 52" fill="#2b5c8f" opacity="0.4" />

      {/* burned-in caption bar */}
      <rect x="64" y="238" width="332" height="32" rx="6" fill="#0a1420" opacity="0.82" />
      <rect x="78" y="249" width="180" height="10" rx="5" fill="#e6f4f6" opacity="0.85" />

      {/* REC indicator */}
      <circle cx="76" cy="64" r="5" fill="#ef4444" />
      <rect x="88" y="59" width="30" height="10" rx="3" fill="#e6f4f6" opacity="0.7" />

      {/* question card, floating beside the call */}
      <g transform="translate(300 300)">
        <rect width="130" height="66" rx="10" fill="#0e2942" stroke="#2b5c8f" strokeWidth="1.4" />
        <rect x="14" y="14" width="70" height="8" rx="4" fill="#7fe6f2" opacity="0.7" />
        <rect x="14" y="30" width="100" height="7" rx="3.5" fill="#e6f4f6" opacity="0.5" />
        <rect x="14" y="43" width="34" height="14" rx="4" fill="#22c55e" opacity="0.85" />
        <rect x="54" y="43" width="34" height="14" rx="4" fill="#0a1420" stroke="#2b5c8f" strokeWidth="1" />
      </g>

      {/* signature flourish */}
      <path d="M60 320c14-18 24-2 36-14s18-16 30-6 20 8 30-2"
        fill="none" stroke="#22d8ea" strokeWidth="2.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** Compliance section illustration: a stitched, verified recording. */
function VerifiedRecordScene() {
  return (
    <svg viewBox="0 0 420 320" className="lp-art-svg" role="img"
      aria-label="Illustration of a verified, timestamped recorded agreement">
      <defs>
        <linearGradient id="recSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#102b46" />
          <stop offset="100%" stopColor="#0a1420" />
        </linearGradient>
        <linearGradient id="recPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d456f" />
          <stop offset="100%" stopColor="#0f2c47" />
        </linearGradient>
      </defs>

      <rect width="420" height="320" rx="18" fill="url(#recSky)" />
      <circle cx="88" cy="76" r="70" fill="url(#ambientGlow)" />

      {/* stacked recorded segments becoming one file */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={60 + i * 8} y={110 + i * 14} width="220" height="46" rx="8"
          fill="url(#recPanel)" stroke="#2b5c8f" strokeWidth="1.4" opacity={0.5 + i * 0.2} />
      ))}
      <rect x="60" y="152" width="220" height="46" rx="8" fill="url(#recPanel)" stroke="#2b5c8f" strokeWidth="1.6" />
      <rect x="76" y="166" width="120" height="8" rx="4" fill="#7fe6f2" opacity="0.7" />
      <rect x="76" y="180" width="160" height="7" rx="3.5" fill="#e6f4f6" opacity="0.5" />

      {/* timestamp watermark */}
      <rect x="60" y="90" width="98" height="14" rx="4" fill="#0a1420" opacity="0.7" />
      <rect x="68" y="94" width="70" height="6" rx="3" fill="#e6f4f6" opacity="0.6" />

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
