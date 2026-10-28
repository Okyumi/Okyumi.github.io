// The playful entrance stays independent of the research and reading layouts.
export async function writeEntrance({write, head}) {
  const pageHead = (title, description, base, canonical) =>
    head(title, description, base, canonical).replace('</head>', `<link rel="stylesheet" href="${base}assets/entrance.css"></head>`);

  await write('index.html', pageHead('Yumi Omori · Research & Personal', 'Yumi Omori. Deep Reinforcement Learning research, writing, and a personal side.', '', '/') + `
<body class="entrance-page">
  <main class="entrance" aria-label="Yumi Omori">
    <h1 class="sr-only">Yumi Omori</h1>
    <nav class="entrance-choices" aria-label="Choose a side">
      <a class="entrance-link" href="personal/hello/">Personal</a>
      <a class="entrance-link" href="research/">Research</a>
    </nav>
  </main>
</body></html>`);

  await write('personal/hello/index.html', pageHead('A small detour · Yumi Omori', 'A small detour on the way to Yumi’s personal page.', '../../', '/personal/hello/').replace('</head>', '<meta name="robots" content="noindex,follow"></head>') + `
<body class="detour-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="detour-header"><a class="detour-back" href="../../"><span aria-hidden="true">←</span> Back</a></header>
  <main class="detour" id="main">
    <p class="detour-intro">Well, I’m applying for PhD programs this cycle. My Bayesian prior says you’re probably here for my</p>
    <h1 class="detour-title"><a href="../../research/">Research<span class="detour-title-arrow" aria-hidden="true">↗</span></a></h1>
    <p class="detour-aside">rather than my personal life.</p>
    <nav class="detour-choices" aria-label="Where would you like to go?">
      <a class="personal-choice" href="../" data-open-personal>Go to Yumi’s personal</a>
      <a class="research-choice" href="../../research/">Go to Research <span aria-hidden="true">↗</span></a>
    </nav>
  </main>

  <dialog class="personal-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-question">
    <div class="conversation">
      <header class="conversation-header">
        <div class="conversation-person"><span class="conversation-avatar" aria-hidden="true">Y</span><span>Yumi</span></div>
        <button class="dialog-close" type="button" aria-label="Close conversation" autofocus><span aria-hidden="true">×</span></button>
      </header>
      <div class="conversation-message">
        <h2 id="dialog-title">Ah, you called my bluff.</h2>
        <p id="dialog-question">Are you sure you want to visit my personal page?</p>
        <p class="conversation-prompt">You have 10 seconds to decide.</p>
      </div>
      <div class="decision-timer" aria-label="A playful ten-second countdown">
        <div class="timer-line"><span class="timer-caption" role="status">Your move.</span><span class="timer-value" aria-hidden="true">00:10</span></div>
        <div class="timer-track" aria-hidden="true"><span class="timer-progress"></span></div>
      </div>
      <nav class="conversation-choices" aria-label="Your decision">
        <a class="confirm-personal" href="../">Yes, I AM SURE <span aria-hidden="true">↗</span></a>
        <a class="confirm-research" href="../../research/">No, I just want to check on a potential PhD candidate <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </dialog>
  <script src="../../assets/entrance.js" defer></script>
</body></html>`);
}
