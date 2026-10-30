/* Contador global alojado por Hits. No almacena ni inventa totales locales. */
(function () {
  'use strict';
  const badge = document.getElementById('visits-badge');
  const status = document.getElementById('visits-status');
  const link = document.getElementById('visits-link');
  const production = location.hostname === 'cintiacapece.github.io'
    && /^\/arc-risc-simulator\/(?:index\.html)?$/.test(location.pathname);
  if (!production) {
    status.textContent = 'Vista previa · visitas sin contabilizar';
    link.hidden = true;
    return;
  }
  let settled = false;
  const unavailable = () => {
    if (settled) return;
    settled = true;
    badge.hidden = true;
    link.hidden = true;
    status.hidden = false;
    status.textContent = 'Contador no disponible';
  };
  const timeout = setTimeout(unavailable, 12000);
  badge.addEventListener('load', () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    badge.hidden = false;
    status.hidden = true;
  }, { once: true });
  badge.addEventListener('error', () => {
    clearTimeout(timeout);
    unavailable();
  }, { once: true });
  badge.src = 'https://hits.sh/cintiacapece.github.io/arc-risc-simulator.svg?label=Visitas&color=759c55&labelColor=1b493d';
})();
