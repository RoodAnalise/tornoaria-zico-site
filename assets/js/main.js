/* =========================================================
   TORNOARIA ZICO — abas, filtros, lightbox, 3D e formulário
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const WA = '5547991866317';

  /* ---------- ano ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* =============== ABAS =============== */
  const tabBtns = $$('[data-tab-btn]');
  const panels  = $$('.panel');
  const indicator = $('#tabIndicator');
  const tabsBar = $('#tabs');
  const menuBtn = $('#menuBtn');
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  function closeMenu() {
    if (!tabsBar || !menuBtn) return;
    tabsBar.classList.remove('open');
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function moveIndicator(btn) {
    if (!indicator || !btn || isMobile()) return;
    indicator.style.width = btn.offsetWidth + 'px';
    indicator.style.transform = 'translateX(' + (btn.offsetLeft - 5) + 'px)';
  }

  let activeId = 'inicio';

  function openTab(id, opts) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('panel')) return;
    const o = opts || {};

    panels.forEach((p) => {
      const on = p === target;
      p.classList.toggle('active', on);
      if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });

    tabBtns.forEach((b) => {
      const on = b.dataset.tabBtn === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      if (on) moveIndicator(b);
    });

    activeId = id;
    closeMenu();
    window.scrollTo({ top: 0, behavior: o.immediate ? 'auto' : 'smooth' });

    // limpa o hash da URL ao trocar de aba: se gravassemos '#engenharia',
    // o navegador restauraria essa aba na proxima visita em vez de abrir
    // a pagina inicial. Links com #aba continuam funcionando para quem
    // digitar ou compartilhar direto.
    if (!o.immediate && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }

    // redesenha os visores 3D que ficaram com tamanho errado
    setTimeout(resizeViewers, 120);
  }

  tabBtns.forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tabBtn)));
  $$('[data-tab-link]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    openTab(el.dataset.tabLink);
  }));

  if (menuBtn && tabsBar) {
    menuBtn.addEventListener('click', () => {
      const open = tabsBar.classList.toggle('open');
      menuBtn.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }

  const DEFAULT_TAB = 'inicio';

  /* abre a aba pedida no hash; se nao houver hash valido, abre a inicial.
     assim o site sempre comeca pela pagina inicial, a nao ser que o
     visitante chegue por um link direto de secao (ex.: #projetos). */
  function fromHash() {
    const id = (location.hash || '').slice(1);
    if (id && document.getElementById(id) && document.getElementById(id).classList.contains('panel')) {
      openTab(id, { immediate: true });
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', fromHash);

  /* ponto de partida garantido */
  let started = false;
  function start() {
    if (started) return;      // so na primeira chamada, senao voltaria para a home
    started = true;
    if (!fromHash()) {
      openTab(DEFAULT_TAB, { immediate: true });
      // limpa um hash antigo que nao corresponda a nenhuma aba
      if (location.hash && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    syncIndicator();
  }

  function syncIndicator() {
    const a = tabBtns.find((b) => b.classList.contains('active')) || tabBtns[0];
    moveIndicator(a);
  }

  window.addEventListener('resize', () => { syncIndicator(); resizeViewers(); });

  // setas do teclado
  tabBtns.forEach((b, i) => b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabBtns.length) % tabBtns.length;
    tabBtns[n].focus();
    openTab(tabBtns[n].dataset.tabBtn, { immediate: true });
  }));

  // fecha o menu ao clicar fora
  document.addEventListener('click', (e) => {
    if (!tabsBar || !tabsBar.classList.contains('open')) return;
    if (tabsBar.contains(e.target) || (menuBtn && menuBtn.contains(e.target))) return;
    closeMenu();
  });

  function resizeViewers() {
    if (window.TZ3D && TZ3D.state.viewers) {
      TZ3D.state.viewers.forEach((v) => { if (v.built) v.resize(); });
    }
  }

  /* o navegador nao deve restaurar rolagem nem aba de visitas anteriores */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  window.addEventListener('load', start, { once: true });

  /* =============== FILTRO =============== */
  const fbtns = $$('.fbtn');
  const cards = $$('#eqGrid .eq-card');
  const tornadoBlock = $('.eq-block');

  fbtns.forEach((btn) => btn.addEventListener('click', () => {
    fbtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;

    cards.forEach((c) => {
      const show = (f === 'all' || c.dataset.cat === f);
      c.classList.toggle('hide', !show);
      if (show) c.removeAttribute('aria-hidden'); else c.setAttribute('aria-hidden', 'true');
    });

    if (tornadoBlock) tornadoBlock.classList.toggle('hide', !(f === 'all' || f === 'tornado'));
    setTimeout(resizeViewers, 160);
  }));

  /* =============== TOGGLE FOTO <-> 3D =============== */
  $$('.eq-photo').forEach((photo) => {
    const btn = $('[data-act="3d"]', photo);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = photo.classList.toggle('show3d');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));

      if (on) {
        setTimeout(() => {
          if (window.TZ3D) {
            TZ3D.state.viewers.forEach((v) => {
              if (photo.contains(v.el)) { v.acquire(); v.resize(); v.play(); }
            });
          }
        }, 80);
      }
    });
  });

  /* =============== LIGHTBOX =============== */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbClose = $('#lbClose');
  const lbPrev = $('#lbPrev');
  const lbNext = $('#lbNext');

  let lbList = [];
  let lbIdx = 0;
  let lbOpener = null;

  function collectZoomables(scope) {
    return $$('[data-zoom]', scope).map((el) => ({
      src: el.dataset.zoom,
      cap: el.dataset.zoomCap || ''
    }));
  }

  function openLightbox(item, list, opener) {
    lbList = list && list.length ? list : [item];
    lbIdx = Math.max(0, lbList.indexOf(item));
    lbOpener = opener || null;
    paint();
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    if (lbClose) lbClose.focus();
  }

  function paint() {
    const it = lbList[lbIdx];
    if (!it) return;
    lbImg.src = it.src;
    lbImg.alt = it.cap || '';
    lbCap.textContent = (lbList.length > 1 ? (lbIdx + 1) + '/' + lbList.length + ' · ' : '') + (it.cap || '');
    const multi = lbList.length > 1;
    if (lbPrev) lbPrev.hidden = !multi;
    if (lbNext) lbNext.hidden = !multi;
  }

  function step(d) {
    if (lbList.length < 2) return;
    lbIdx = (lbIdx + d + lbList.length) % lbList.length;
    paint();
  }

  function closeLightbox() {
    lb.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
    if (lbOpener && lbOpener.focus) lbOpener.focus();
  }

  document.addEventListener('click', (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z) {
      e.preventDefault();
      const scope = z.closest('.eq-card, .eq-block, section') || document;
      const item = { src: z.dataset.zoom, cap: z.dataset.zoomCap || '' };
      openLightbox(item, collectZoomables(scope), z);
      return;
    }
    if (e.target.closest('.lb-close')) closeLightbox();
  });

  lbImg && lbImg.addEventListener('click', (e) => e.stopPropagation());
  lb && lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  lbPrev && lbPrev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  lbNext && lbNext.addEventListener('click', (e) => { e.stopPropagation(); step(1); });

  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // arrastar / swipe no celular
  let tx = 0;
  lb && lb.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
  lb && lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* =============== CONTADORES =============== */
  function countUp(el) {
    if (el.dataset.raw) { el.textContent = el.dataset.raw; return; }
    const target = parseFloat(el.dataset.count || '0');
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / 1500, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  const counters = $$('.hs b');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.35 });
      counters.forEach((c) => io.observe(c));
    } else counters.forEach(countUp);
  }

  /* =============== FORMULÁRIO =============== */
  const form = $('#ctForm');
  if (form) {
    const msg = $('#ctMsg');
    const btn = $('#ctSubmit');
    const label = btn.querySelector('span');

    const rules = {
      nome: (v) => v.trim().length >= 2,
      telefone: (v) => v.replace(/\D/g, '').length >= 8 || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      servico: (v) => v !== '',
      msg: (v) => v.trim().length >= 8
    };

    $$('.fld', form).forEach((field) => {
      const input = $('input, select, textarea', field);
      if (!input) return;
      input.addEventListener('blur', () => {
        if (rules[input.id]) field.classList.toggle('invalid', !rules[input.id](input.value));
      });
      input.addEventListener('input', () => field.classList.remove('invalid'));
      input.addEventListener('change', () => field.classList.remove('invalid'));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      msg.textContent = '';
      msg.className = 'ct-msg';

      let ok = true, first = null;
      Object.keys(rules).forEach((k) => {
        const input = document.getElementById(k);
        const field = input && input.closest('.fld');
        if (!field) return;
        const valid = rules[k](input.value);
        field.classList.toggle('invalid', !valid);
        if (!valid && !first) first = input;
        ok = ok && valid;
      });

      if (!ok) {
        msg.textContent = 'Verifique os campos destacados.';
        msg.className = 'ct-msg bad';
        if (first) first.focus();
        return;
      }

      const d = {
        nome: $('#nome').value.trim(),
        telefone: $('#telefone').value.trim(),
        servico: $('#servico').value,
        msg: $('#msg').value.trim()
      };

      const texto = '*Solicitação de Orçamento — TORNOARIA ZICO*\n\n' +
        '*Nome/Empresa:* ' + d.nome + '\n' +
        '*Contato:* ' + d.telefone + '\n' +
        '*Serviço:* ' + d.servico + '\n' +
        '*Detalhes:* ' + d.msg;

      const original = label.textContent;
      btn.disabled = true;
      label.textContent = 'Enviando…';

      setTimeout(() => {
        btn.disabled = false;
        label.textContent = original;
        form.reset();
        $$('.fld', form).forEach((f) => f.classList.remove('invalid'));
        msg.textContent = 'Solicitação montada! Abrindo o WhatsApp para enviar.';
        msg.className = 'ct-msg ok';
        window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(texto), '_blank');
      }, 800);
    });
  }

  /* =============== REVEAL =============== */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.style.opacity = '1';
        en.target.style.transform = 'none';
        io.unobserve(en.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

    $$('.sec-head, .sol-card, .card, .eq-card, .proj, .spec-card, .ct-card, .ct-form, .why, .entrega, .eng-hero, .pilar, .eq-block')
      .forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(18px)';
        el.style.transition = 'opacity .55s cubic-bezier(.25,.8,.35,1), transform .55s cubic-bezier(.25,.8,.35,1)';
        io.observe(el);
      });
  }

  /* =============== SCROLL HEADER =============== */
  const topbar = $('.topbar');
  if (topbar) {
    const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

})();
