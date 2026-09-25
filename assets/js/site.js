/* DevCount — comportamento compartilhado pelas duas páginas:
 * tema, cabeçalho, menu móvel, animações de entrada, voltar ao topo, máscaras e formatação. */
(function () {
  'use strict';

  var DC = (window.DC = window.DC || {});
  var root = document.documentElement;
  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  DC.reduceMotion = function () {
    return reduceMotionQuery.matches;
  };

  DC.WHATSAPP = '5543999066623';
  DC.whatsappUrl = function (text) {
    return 'https://wa.me/' + DC.WHATSAPP + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  DC.icon = function (name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };

  DC.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Formatação ---------- */
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var numCache = {};
  function numFormat(d) {
    if (!numCache[d]) numCache[d] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return numCache[d];
  }
  var compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

  DC.fmt = {
    brl: function (v) {
      return brl.format(Math.abs(v) < 0.005 ? 0 : v || 0);
    },
    num: function (v, d) {
      return numFormat(d == null ? 2 : d).format(v || 0);
    },
    int: function (v) {
      return numFormat(0).format(Math.round(v || 0));
    },
    /* recebe fração (0,275 → 27,50%) */
    pct: function (v, d) {
      return numFormat(d == null ? 2 : d).format((v || 0) * 100) + '%';
    },
    compactBrl: function (v) {
      return 'R$ ' + compact.format(v || 0);
    },
    date: function (d) {
      return d.toLocaleDateString('pt-BR');
    },
    dateLong: function (d) {
      return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  /* Valor digitado em pt-BR ("1.234,56") ou com ponto decimal ("1234.56") */
  DC.parseNumber = function (str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str) return null;
    if (str.indexOf(',') !== -1) str = str.replace(/\./g, '').replace(',', '.');
    str = str.replace(/[^\d.-]/g, '');
    var n = Number(str);
    return str && Number.isFinite(n) ? n : null;
  };

  DC.parseMoney = function (str) {
    if (str == null) return null;
    var clean = String(str).replace(/[^\d,]/g, '');
    if (!clean) return null;
    var n = Number(clean.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  /* ---------- Máscaras (delegadas: servem também para campos criados depois) ---------- */
  function maskMoney(el, e) {
    var value = el.value;
    var caret = el.selectionStart == null ? value.length : el.selectionStart;
    // Quem digita ponto como separador decimal (teclado numérico) espera vírgula
    if (e && e.inputType === 'insertText' && e.data === '.' && value.slice(0, caret - 1).indexOf(',') === -1) {
      value = value.slice(0, caret - 1) + ',' + value.slice(caret);
    }
    var significantBefore = value.slice(0, caret).replace(/[^\d,]/g, '').length;
    var clean = value.replace(/[^\d,]/g, '');
    var comma = clean.indexOf(',');
    if (comma !== -1) clean = clean.slice(0, comma + 1) + clean.slice(comma + 1).replace(/,/g, '').slice(0, 2);
    var parts = clean.split(',');
    var int = parts[0].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var out = parts.length > 1 ? (int || '0') + ',' + parts[1] : int;
    el.value = out;
    // Reposiciona o cursor contando os mesmos caracteres significativos de antes
    var pos = 0;
    var count = 0;
    while (pos < out.length && count < significantBefore) {
      if (/[\d,]/.test(out[pos])) count++;
      pos++;
    }
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
  }

  function finishMoney(el) {
    if (!el.value) return;
    var parts = el.value.split(',');
    var dec = (parts[1] || '').padEnd(2, '0');
    el.value = (parts[0] || '0') + ',' + dec;
  }

  function maskPhone(el) {
    var d = el.value.replace(/\D/g, '').slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(d.length - 4);
    el.value = out;
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.hasAttribute('data-money')) maskMoney(el, e);
    else if (el.hasAttribute('data-phone')) maskPhone(el);
  });

  document.addEventListener(
    'blur',
    function (e) {
      var el = e.target;
      if (el instanceof HTMLInputElement && el.hasAttribute('data-money')) finishMoney(el);
    },
    true
  );

  /* ---------- Tema ----------
   * O site sempre abre no claro; o escuro só vale depois que a pessoa escolhe no botão (fica salvo). */
  var themeColor = document.querySelector('meta[name="theme-color"]');

  function resolvedTheme() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('dc-theme', theme);
    } catch (err) {
      /* armazenamento indisponível: o tema vale só para esta visita */
    }
    syncThemeButtons();
  }

  function syncThemeButtons() {
    var dark = resolvedTheme() === 'dark';
    if (themeColor) themeColor.content = dark ? '#07111e' : '#ffffff';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
    });
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = resolvedTheme() === 'dark' ? 'light' : 'dark';
      if (document.startViewTransition && !DC.reduceMotion()) {
        document.startViewTransition(function () {
          applyTheme(next);
        });
      } else {
        applyTheme(next);
      }
    });
  });
  syncThemeButtons();

  /* ---------- Cabeçalho: vidro ao rolar, some ao descer e volta ao subir ---------- */
  var header = document.querySelector('[data-header]');
  var toTop = document.querySelector('[data-to-top]');
  var menuOpen = false;
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--scroll', max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
    if (header) {
      header.classList.toggle('is-scrolled', y > 8);
      var goingDown = y > lastY + 2;
      var goingUp = y < lastY - 2;
      if (goingDown && y > 520 && !menuOpen && !header.contains(document.activeElement)) header.classList.add('is-hidden');
      else if (goingUp || y < 520) header.classList.remove('is-hidden');
    }
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  if (header) {
    header.addEventListener('focusin', function () {
      header.classList.remove('is-hidden');
    });
  }

  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: DC.reduceMotion() ? 'auto' : 'smooth' });
      var target = document.querySelector('#conteudo');
      if (target) target.focus({ preventScroll: true });
    });
  }

  /* ---------- Menu móvel ---------- */
  var menuBtn = document.querySelector('[data-menu-toggle]');
  var menu = document.getElementById('menu-mobile');

  function menuFocusables() {
    return [menuBtn].concat(Array.prototype.slice.call(menu.querySelectorAll('a, button')));
  }

  function setMenu(open) {
    if (!menu || !menuBtn || open === menuOpen) return;
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    root.classList.toggle('is-locked', open);
    if (open) {
      menu.hidden = false;
      header.classList.remove('is-hidden');
      requestAnimationFrame(function () {
        menu.classList.add('is-open');
      });
    } else {
      menu.classList.remove('is-open');
      setTimeout(function () {
        if (!menuOpen) menu.hidden = true;
      }, 320);
    }
  }

  if (menuBtn && menu) {
    menu.querySelectorAll('li').forEach(function (li, i) {
      li.style.setProperty('--i', i);
    });
    menuBtn.addEventListener('click', function () {
      setMenu(!menuOpen);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape') {
        setMenu(false);
        menuBtn.focus();
      } else if (e.key === 'Tab') {
        // Mantém o foco dentro do menu enquanto ele cobre a página
        var items = menuFocusables();
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    window.matchMedia('(min-width: 1080px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Link ativo conforme a seção visível ---------- */
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-list a[href^="#"]'));
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    spyLinks.forEach(function (a) {
      byId[a.getAttribute('href').slice(1)] = a;
    });
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          spyLinks.forEach(function (a) {
            a.removeAttribute('aria-current');
          });
          var link = byId[entry.target.id];
          if (link) link.setAttribute('aria-current', 'true');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    document.querySelectorAll('main section[id]').forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------- Animações de entrada ---------- */
  var revealObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { rootMargin: '0px 0px -48px 0px', threshold: 0.08 }
        )
      : null;

  DC.reveal = function (scope) {
    var base = scope || document;
    base.querySelectorAll('[data-reveal-stagger]').forEach(function (group) {
      group.querySelectorAll('[data-reveal]').forEach(function (el, i) {
        el.style.setProperty('--d', i * 80 + 'ms');
      });
    });
    base.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(function (el) {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-visible');
    });
  };
  DC.reveal();

  /* ---------- Toast ---------- */
  var toastRegion = document.querySelector('[data-toasts]');
  DC.toast = function (message, iconName) {
    if (!toastRegion) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = DC.icon(iconName || 'check-circle') + '<span>' + DC.escape(message) + '</span>';
    toastRegion.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () {
        el.remove();
      }, 320);
    }, 2600);
  };

  DC.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // Fallback para contextos sem a API assíncrona (arquivo local, http)
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      if (ok) resolve();
      else reject(new Error('copy'));
    });
  };

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* Anima um número de um valor a outro (respeita movimento reduzido) */
  DC.tween = function (el, from, to, format, duration) {
    if (el._tween) cancelAnimationFrame(el._tween);
    if (DC.reduceMotion() || from === to || !Number.isFinite(from)) {
      el.textContent = format(to);
      return;
    }
    var start = performance.now();
    var dur = duration || 520;
    function frame(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) el._tween = requestAnimationFrame(frame);
    }
    el._tween = requestAnimationFrame(frame);
  };
})();
