import { useEffect, useMemo, useRef, useState } from 'react';

const SANDBOX_PERMISSIONS =
  'allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts';

const FONT_STACKS = {
  onest: {
    stack: "'Onest', system-ui, -apple-system, 'Helvetica Neue', sans-serif",
  },
  'instrument-serif': {
    stack: '"Instrument Serif", Georgia, serif',
    google: 'Instrument+Serif',
  },
  newsreader: {
    stack: '"Newsreader", Georgia, serif',
    google: 'Newsreader:wght@200..700',
  },
  geist: {
    stack: '"Geist", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    google: 'Geist:wght@100..900',
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function normalizeHex(val, fallback) {
  if (typeof val !== 'string') return fallback;
  const m = val.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!m) return fallback;
  const raw = m[1].toLowerCase();
  return `#${raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw}`;
}

function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    ((r === max ? ((g - b) / d) % 6 : g === max ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) %
    360;
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r + m, g + m, b + m]
    .map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function retoneEmber(basePrimary, targetPrimary, emberHex) {
  if (basePrimary === targetPrimary) return emberHex;
  const src = hexToHsl(basePrimary);
  const dst = hexToHsl(targetPrimary);
  const cur = hexToHsl(emberHex);
  return hslToHex({
    h: (cur.h + (dst.h - src.h) + 360) % 360,
    s: clamp01(cur.s * (src.s > 0.01 ? Math.min(3, dst.s / src.s) : 1)),
    l: clamp01(cur.l * (src.l > 0.01 ? Math.min(3, dst.l / src.l) : 1)),
  });
}

function applyPageCustomization(iframe, customization) {
  const doc = iframe?.contentDocument;
  if (!doc?.head) return;

  const fontLinkId = 'threeui-page-typography-fonts';
  const styleId = 'threeui-page-typography';

  const existingLink = doc.getElementById(fontLinkId);
  if (customization?.fontHref) {
    const link = existingLink ?? doc.createElement('link');
    link.id = fontLinkId;
    link.rel = 'stylesheet';
    if (link.getAttribute('href') !== customization.fontHref) {
      link.href = customization.fontHref;
    }
    if (!existingLink) doc.head.append(link);
  } else {
    existingLink?.remove();
  }

  if (!customization?.css) {
    doc.getElementById(styleId)?.remove();
    return;
  }

  const styleEl = doc.getElementById(styleId) ?? doc.createElement('style');
  styleEl.id = styleId;
  if (styleEl.textContent !== customization.css) {
    styleEl.textContent = customization.css;
  }
  doc.head.append(styleEl);
}

/**
 * KageLandingPage — React iframe host matching the ThreeUI LandingPageFrame +
 * pageTypography contract while serving the portfolio-adapted Kage document.
 */
export default function KageLandingPage({
  className = '',
  style,
  title = 'ASWIN — Full-Stack, Flutter & AI Developer',
  sourceUrl = '/landing-pages/portfolio.html',
  headingFont = 'onest',
  bodyFont = 'onest',
  headingWeight = '400',
  bodyWeight = '300',
  primaryColor = '#e0231c',
  headingSize = 46,
  bodySize = 17,
  headingLetterSpacing = -0.012,
}) {
  const [ready, setReady] = useState(false);
  const iframeRef = useRef(null);

  const customization = useMemo(() => {
    const hFont = FONT_STACKS[headingFont] ?? FONT_STACKS.onest;
    const bFont = FONT_STACKS[bodyFont] ?? FONT_STACKS.onest;
    const hWeight = ['400', '500', '600', '700'].includes(String(headingWeight))
      ? String(headingWeight)
      : '400';
    const bWeight = ['300', '400', '500', '600'].includes(String(bodyWeight))
      ? String(bodyWeight)
      : '300';
    const primary = normalizeHex(primaryColor, '#e0231c');
    const ember = retoneEmber('#e0231c', primary, '#ff5a3c');
    const hSize = Number.isFinite(headingSize) ? Math.min(72, Math.max(30, headingSize)) : 46;
    const bSize = Number.isFinite(bodySize) ? Math.min(24, Math.max(13, bodySize)) : 17;
    const tracking = Number.isFinite(headingLetterSpacing)
      ? Math.min(0.12, Math.max(-0.06, headingLetterSpacing))
      : -0.012;

    const googleFamilies = [...new Set([hFont.google, bFont.google].filter(Boolean))];
    const fontHref = googleFamilies.length
      ? `https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${f}`).join('&')}&display=swap`
      : undefined;

    const px = (n) => `${Number(n.toFixed(3))}px`;
    const css = `
:root {
  --vermilion: ${primary};
  --ember: ${ember};
}
body { font-family: ${bFont.stack}; }
body, .body, .body-lg, .num { font-weight: ${bWeight}; }
h1:not(.jp), h2:not(.jp), h3:not(.jp), .display:not(.jp) {
  font-family: ${hFont.stack};
  font-weight: ${hWeight};
}
.display { letter-spacing: ${tracking}em; }
.h-hero { font-size: clamp(26px, 3.05vw, ${px(hSize)}); }
.h-sec { font-size: clamp(30px, 4vw, ${px((hSize * 60) / 46)}); }
.body-lg { font-size: clamp(14px, 1.02vw, ${px(bSize)}); }
.body { font-size: ${px(Math.max(11, bSize - 3))}; }
`;

    return { css, fontHref };
  }, [
    headingFont,
    bodyFont,
    headingWeight,
    bodyWeight,
    primaryColor,
    headingSize,
    bodySize,
    headingLetterSpacing,
  ]);

  useEffect(() => {
    applyPageCustomization(iframeRef.current, customization);
  }, [customization]);

  return (
    <div
      className={`threeui-background landing-page-frame${className ? ` ${className}` : ''}`}
      data-state={ready ? 'ready' : 'loading'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#080808',
        pointerEvents: 'auto',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        src={sourceUrl}
        sandbox={SANDBOX_PERMISSIONS}
        loading="eager"
        onLoad={(e) => {
          applyPageCustomization(e.currentTarget, customization);
          setReady(true);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          border: 0,
          background: '#080808',
        }}
      />
    </div>
  );
}
