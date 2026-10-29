// The entrance: a two-line cover and a playful Bayesian detour.
// Both pages load the shared site.css and site.js, plus entrance.css for their own layout.

// Formula on the detour, pre-rendered once with KaTeX 0.16.11 (the version the blog already uses):
//   \hat{\theta}_{\mathrm{MAP}} = \operatorname*{arg\,max}_{\theta}\; p(\theta \mid \mathrm{CV}) =
// To change it, render the new TeX with katex.renderToString(tex, {displayMode: true}) and paste the result here.
const formulaHTML = "<span class=\"katex-display\"><span class=\"katex\"><span class=\"katex-mathml\"><math xmlns=\"http://www.w3.org/1998/Math/MathML\" display=\"block\"><semantics><mrow><msub><mover accent=\"true\"><mi>θ</mi><mo>^</mo></mover><mrow><mi mathvariant=\"normal\">M</mi><mi mathvariant=\"normal\">A</mi><mi mathvariant=\"normal\">P</mi></mrow></msub><mo>=</mo><munder><mrow><mi mathvariant=\"normal\">arg max</mi><mo>⁡</mo></mrow><mi>θ</mi></munder><mtext>  </mtext><mi>p</mi><mo stretchy=\"false\">(</mo><mi>θ</mi><mo>∣</mo><mrow><mi mathvariant=\"normal\">C</mi><mi mathvariant=\"normal\">V</mi></mrow><mo stretchy=\"false\">)</mo><mo>=</mo></mrow><annotation encoding=\"application/x-tex\">\\hat{\\theta}_{\\mathrm{MAP}} = \\operatorname*{arg\\,max}_{\\theta}\\; p(\\theta \\mid \\mathrm{CV}) =</annotation></semantics></math></span><span class=\"katex-html\" aria-hidden=\"true\"><span class=\"base\"><span class=\"strut\" style=\"height:1.1079em;vertical-align:-0.15em;\"></span><span class=\"mord\"><span class=\"mord accent\"><span class=\"vlist-t\"><span class=\"vlist-r\"><span class=\"vlist\" style=\"height:0.9579em;\"><span style=\"top:-3em;\"><span class=\"pstrut\" style=\"height:3em;\"></span><span class=\"mord mathnormal\" style=\"margin-right:0.02778em;\">θ</span></span><span style=\"top:-3.2634em;\"><span class=\"pstrut\" style=\"height:3em;\"></span><span class=\"accent-body\" style=\"left:-0.1667em;\"><span class=\"mord\">^</span></span></span></span></span></span></span><span class=\"msupsub\"><span class=\"vlist-t vlist-t2\"><span class=\"vlist-r\"><span class=\"vlist\" style=\"height:0.3283em;\"><span style=\"top:-2.55em;margin-left:-0.0278em;margin-right:0.05em;\"><span class=\"pstrut\" style=\"height:2.7em;\"></span><span class=\"sizing reset-size6 size3 mtight\"><span class=\"mord mtight\"><span class=\"mord mtight\"><span class=\"mord mathrm mtight\">MAP</span></span></span></span></span></span><span class=\"vlist-s\">​</span></span><span class=\"vlist-r\"><span class=\"vlist\" style=\"height:0.15em;\"><span></span></span></span></span></span></span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span><span class=\"mrel\">=</span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span></span><span class=\"base\"><span class=\"strut\" style=\"height:1.6965em;vertical-align:-0.9465em;\"></span><span class=\"mop op-limits\"><span class=\"vlist-t vlist-t2\"><span class=\"vlist-r\"><span class=\"vlist\" style=\"height:0.4306em;\"><span style=\"top:-2.1535em;margin-left:0em;\"><span class=\"pstrut\" style=\"height:3em;\"></span><span class=\"sizing reset-size6 size3 mtight\"><span class=\"mord mtight\"><span class=\"mord mathnormal mtight\" style=\"margin-right:0.02778em;\">θ</span></span></span></span><span style=\"top:-3em;\"><span class=\"pstrut\" style=\"height:3em;\"></span><span><span class=\"mop\"><span class=\"mord mathrm\" style=\"margin-right:0.01389em;\">arg</span><span class=\"mspace\" style=\"margin-right:0.1667em;\"></span><span class=\"mord mathrm\">max</span></span></span></span></span><span class=\"vlist-s\">​</span></span><span class=\"vlist-r\"><span class=\"vlist\" style=\"height:0.9465em;\"><span></span></span></span></span></span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span><span class=\"mspace\" style=\"margin-right:0.1667em;\"></span><span class=\"mord mathnormal\">p</span><span class=\"mopen\">(</span><span class=\"mord mathnormal\" style=\"margin-right:0.02778em;\">θ</span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span><span class=\"mrel\">∣</span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span></span><span class=\"base\"><span class=\"strut\" style=\"height:1em;vertical-align:-0.25em;\"></span><span class=\"mord\"><span class=\"mord mathrm\" style=\"margin-right:0.01389em;\">CV</span></span><span class=\"mclose\">)</span><span class=\"mspace\" style=\"margin-right:0.2778em;\"></span><span class=\"mrel\">=</span></span></span></span></span>";

// A tiny bell curve: the avatar for "Yumi's posterior" in the conversation window.
const bellCurve = (() => {
  const points = Array.from({length: 41}, (_, i) => {
    const t = i / 40 * 6 - 3;
    return `${(6 + i / 40 * 24).toFixed(2)} ${(25 - 15 * Math.exp(-t * t / 2)).toFixed(2)}`;
  });
  const line = `M${points.join(' L')}`;
  return `<svg viewBox="0 0 36 36" width="36" height="36" focusable="false"><path d="${line} L30 25 L6 25 Z" fill="currentColor" opacity=".14"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 9.6 V25" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 2" opacity=".55"/></svg>`;
})();

export async function writeEntrance({write, site, esc, menuHand, fontLinks}) {
  const pageHead = ({title, description, base, canonical, detour = false}) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#ffffff">${detour ? '\n  <meta name="robots" content="noindex, follow">' : ''}
  <link rel="canonical" href="${esc(site.origin + canonical)}">
  <link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg">
${fontLinks(detour ? ['mono', 'display'] : ['mono'], '  ')}${detour ? `
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">` : ''}
  <link rel="stylesheet" href="${base}assets/site.css">
  <link rel="stylesheet" href="${base}assets/entrance.css">
  <script src="${base}assets/site.js" defer></script>
</head>`;

  await write('index.html', pageHead({
    title: site.name,
    description: `${site.name}: research in deep reinforcement learning, and a personal blog.`,
    base: '', canonical: '/'
  }) + `
<body class="cover-page game-cursor">
  <main class="cover">
    <h1 class="sr-only">${esc(site.name)}</h1>
    <nav class="cover-choices" aria-label="Personal or Research">
      <a class="cover-link cover-personal" href="personal/hello/" data-personal-gate data-personal-direct="personal/">Personal</a>
      <a class="cover-link cover-research" href="research/">Research</a>
      <span class="menu-hand" aria-hidden="true">${menuHand}</span>
    </nav>
  </main>
</body>
</html>
`);

  await write('personal/hello/index.html', pageHead({
    title: `A Bayesian detour · ${site.name}`,
    description: 'A short detour on the way to Yumi’s personal page.',
    base: '../../', canonical: '/personal/hello/', detour: true
  }) + `
<body class="detour-page">
  <div class="detour-shell">
    <header class="detour-header">
      <a class="back-link" href="../../"><span aria-hidden="true">←</span> back</a>
    </header>
    <main class="detour-main" id="main">
      <div class="detour-copy">
        <p>Well, I’m applying for PhD programs this cycle,<br class="wide-break"> and I put links on my CV by convention.</p>
        <p>So, conditioning on the evidence, my maximum a posteriori (MAP)<br class="wide-break"> estimate of what you’re actually looking&nbsp;for&nbsp;is</p>
      </div>
      <div class="detour-formula">${formulaHTML}</div>
      <h1 class="research-punchline"><a href="../../research/">Research<span class="punchline-arrow" aria-hidden="true">↗</span></a></h1>
      <p class="detour-aside">rather than my <span class="aside-personal">Personal</span> :’]</p>
      <nav class="detour-choices" aria-label="Where to next">
        <a class="personal-choice" href="../" data-open-chat>go to Yumi’s personal</a>
        <a class="research-choice" href="../../research/">go to Research<span aria-hidden="true">↗</span></a>
      </nav>
    </main>
  </div>

  <dialog class="chat" id="personal-chat" tabindex="-1" aria-labelledby="chat-name" aria-describedby="chat-log">
    <header class="chat-header">
      <span class="chat-avatar" aria-hidden="true">${bellCurve}</span>
      <div class="chat-who">
        <p class="chat-name" id="chat-name">Yumi’s posterior</p>
        <p class="chat-status" aria-hidden="true">updated just now</p>
      </div>
      <button class="chat-close" type="button" aria-label="Close" title="Close (Esc)" autofocus><span aria-hidden="true">×</span></button>
    </header>
    <div class="chat-timer" aria-hidden="true"><span></span></div>
    <div class="chat-log" id="chat-log" role="log">
      <p class="bubble" data-message="1">Ahh, ok, you got me there.</p>
      <p class="bubble" data-message="2">Are you sure you want to visit Yumi’s Personal? You have <b class="countdown"><span class="count">10</span> <span class="unit">seconds</span></b> to decide.</p>
      <p class="bubble" data-message="bonus" hidden>Fine, <b class="countdown"><span class="bonus-count">5</span> bonus <span class="bonus-unit">seconds</span></b>, as a treat.</p>
      <p class="bubble" data-message="final" hidden>Time’s up. Your silence is now strong evidence for Research. Taking you there…</p>
      <p class="bubble" data-message="again-1" hidden>Wow, it’s you again.</p>
      <p class="bubble" data-message="again-2" hidden>I guess you really tried to get into Yumi’s Personal.</p>
      <p class="bubble" data-message="again-3" hidden>Okay, I’ll give you a free pass.</p>
      <p class="typing" aria-hidden="true" hidden><span></span><span></span><span></span></p>
    </div>
    <nav class="chat-replies" aria-label="Your reply">
      <a class="reply reply-yes" href="../">Yes, I AM SURE</a>
      <a class="reply reply-no" href="../../research/" data-bonus-text="No, I just want to check on this PhD applicant full of potential, who I’d absolutely love to work with">No, I just want to check on a potential PhD applicant</a>
    </nav>
  </dialog>
  <script src="../../assets/entrance.js" defer></script>
</body>
</html>
`);
}
