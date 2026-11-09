import { createRuntime } from './sidepanel/runtime.js';
import { createStatsView } from './sidepanel/stats.js';
import { setupChat } from './sidepanel/chat.js';
import { setupCards } from './sidepanel/flashcards.js';
import { setupSettings } from './sidepanel/settings.js';
import { setupSimulation } from './sidepanel/simulation.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const panels = [...document.querySelectorAll('.panel')];
  const links = [...document.querySelectorAll('.footer-nav-link')];
  const runtime = createRuntime();
  const stats = createStatsView($, runtime);
  const settings = setupSettings($, runtime);
  const cards = setupCards($, runtime);
  setupSimulation($, cards);

  function switchPanel(id) {
    panels.forEach(panel => {
      panel.hidden = panel.id !== id;
      panel.classList.toggle('active', panel.id === id);
    });
    links.forEach(link => link.classList.toggle('active', link.dataset.panel === id));
    if (id === 'guide-panel') $('chat-input').focus();
    if (id === 'settings-panel') settings.load();
    if (id === 'cards-panel') cards.load();
  }

  links.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    switchPanel(link.dataset.panel);
  }));

  setupChat($, runtime, settings.isDeveloperMode);
  if (runtime.onMessage) {
    runtime.onMessage.addListener(message => {
      if (message.action === 'tabsChanged') stats.update();
    });
  } else {
    $('status-message').textContent = 'Status: extension preview mode';
  }

  stats.update();
  cards.load();
  settings.load();
  setInterval(stats.update, 60000);
});
