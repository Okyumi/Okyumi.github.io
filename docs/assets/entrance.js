(() => {
  const trigger = document.querySelector('[data-open-personal]');
  const dialog = document.querySelector('.personal-dialog');
  // Without dialog support or JavaScript, the personal link remains a normal link.
  if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;
  const close = dialog.querySelector('.dialog-close');
  const value = dialog.querySelector('.timer-value');
  const progress = dialog.querySelector('.timer-progress');
  const caption = dialog.querySelector('.timer-caption');
  let timer;
  const stop = () => { window.clearInterval(timer); timer = undefined; };
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.addEventListener('click', event => {
    // Keep modifier-click and open-in-new-tab behavior as standard links.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    stop();
    value.textContent = '00:10';
    caption.textContent = 'Your move.';
    progress.style.transform = 'scaleX(1)';
    dialog.showModal();
    const deadline = performance.now() + 10000;
    const tick = () => {
      const remaining = Math.max(0, deadline - performance.now());
      value.textContent = `00:${String(Math.ceil(remaining / 1000)).padStart(2, '0')}`;
      progress.style.transform = `scaleX(${remaining / 10000})`;
      if (!remaining) {
        stop();
        caption.textContent = 'Time’s up. I trust your judgment.';
        // The countdown is a joke, never a deadline for navigation.
      }
    };
    timer = window.setInterval(tick, 100);
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { stop(); trigger.focus(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => { if (event.persisted && dialog.open) dialog.close(); });
})();
