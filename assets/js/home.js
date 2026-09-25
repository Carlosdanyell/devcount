/* DevCount — interações da página inicial. */
(function () {
  'use strict';

  var DC = window.DC;
  var fmt = DC.fmt;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- Indicadores contam do zero quando aparecem ---------- */
  var stats = document.querySelector('[data-stats]');
  if (stats && 'IntersectionObserver' in window) {
    var counters = stats.querySelectorAll('[data-count]');
    counters.forEach(function (el) {
      el.textContent = '+0';
    });
    new IntersectionObserver(
      function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        counters.forEach(function (el, i) {
          var target = Number(el.dataset.count);
          setTimeout(function () {
            DC.tween(el, 0, target, function (v) {
              return '+' + Math.round(v);
            }, 1600);
          }, i * 150);
        });
      },
      { threshold: 0.5 }
    ).observe(stats);
  }

  /* ---------- Paralaxe suave no hero ---------- */
  var hero = document.querySelector('.hero');
  var visual = document.querySelector('[data-parallax]');
  if (hero && visual && finePointer.matches && !DC.reduceMotion()) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      visual.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      visual.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    hero.addEventListener('pointerleave', function () {
      visual.style.setProperty('--px', 0);
      visual.style.setProperty('--py', 0);
    });
  }

  /* ---------- Luz que acompanha o cursor nos cards de serviço ---------- */
  var bento = document.querySelector('[data-spotlight]');
  if (bento && finePointer.matches) {
    var cards = bento.querySelectorAll('.svc');
    bento.addEventListener('pointermove', function (e) {
      cards.forEach(function (card) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }

  /* ---------- Abas de "Como funciona" (padrão WAI-ARIA, com setas do teclado) ---------- */
  document.querySelectorAll('[data-tabs]').forEach(function (tabs) {
    var list = tabs.querySelector('[role="tablist"]');
    var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

    function moveIndicator() {
      var active = list.querySelector('[aria-selected="true"]');
      list.style.setProperty('--x', active.offsetLeft + 'px');
      list.style.setProperty('--w', active.offsetWidth + 'px');
    }

    function select(btn, focus) {
      buttons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(b.getAttribute('aria-controls'));
        panel.hidden = !on;
        panel.classList.toggle('is-active', on);
      });
      if (focus) btn.focus();
      moveIndicator();
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        select(btn);
      });
      btn.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = buttons[(i + 1) % buttons.length];
        else if (e.key === 'ArrowLeft') next = buttons[(i - 1 + buttons.length) % buttons.length];
        else if (e.key === 'Home') next = buttons[0];
        else if (e.key === 'End') next = buttons[buttons.length - 1];
        if (next) {
          e.preventDefault();
          select(next, true);
        }
      });
    });

    moveIndicator();
    if ('ResizeObserver' in window) new ResizeObserver(moveIndicator).observe(list);
    // A fonte web pode mudar a largura das abas depois do primeiro cálculo
    if (document.fonts) document.fonts.ready.then(moveIndicator);
  });

  /* ---------- Carrossel de depoimentos (scroll-snap nativo + botões e pontos) ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var slides = Array.prototype.slice.call(track.children);
    var dotsBox = carousel.querySelector('[data-dots]');
    var section = carousel.closest('section');
    var prev = section.querySelector('[data-prev]');
    var next = section.querySelector('[data-next]');
    var current = 0;
    var timer = null;
    var paused = false;

    slides.forEach(function (slide, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Ir para o depoimento ' + (i + 1));
      dot.addEventListener('click', function () {
        goTo(i);
      });
      dotsBox.appendChild(dot);
    });
    var dots = Array.prototype.slice.call(dotsBox.children);

    function step() {
      return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
    }

    function maxIndex() {
      return Math.max(0, Math.round((track.scrollWidth - track.clientWidth) / step()));
    }

    function goTo(i) {
      track.scrollTo({ left: Math.max(0, Math.min(i, slides.length - 1)) * step(), behavior: DC.reduceMotion() ? 'auto' : 'smooth' });
    }

    function sync() {
      current = Math.round(track.scrollLeft / step());
      dots.forEach(function (d, i) {
        d.setAttribute('aria-current', String(i === current));
      });
    }

    track.addEventListener('scroll', function () {
      window.requestAnimationFrame(sync);
    }, { passive: true });

    prev.addEventListener('click', function () {
      goTo(current <= 0 ? maxIndex() : current - 1);
    });
    next.addEventListener('click', function () {
      goTo(current >= maxIndex() ? 0 : current + 1);
    });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      }
    });

    // Avança sozinho, mas para enquanto a pessoa interage ou o carrossel está fora da tela
    function tick() {
      if (!paused) goTo(current >= maxIndex() ? 0 : current + 1);
    }
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) {
      carousel.addEventListener(ev, function () {
        paused = true;
      }, { passive: true });
    });
    ['pointerleave', 'focusout'].forEach(function (ev) {
      carousel.addEventListener(ev, function () {
        paused = false;
      });
    });
    if (!DC.reduceMotion() && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        clearInterval(timer);
        if (entries[0].isIntersecting) timer = setInterval(tick, 6000);
      }).observe(carousel);
    }
    sync();
  });

  /* ---------- Perguntas frequentes com abertura e fechamento animados ---------- */
  document.querySelectorAll('.faq-item').forEach(function (details) {
    var summary = details.querySelector('summary');
    var body = details.querySelector('.faq-body');
    var anim = null;

    summary.addEventListener('click', function (e) {
      if (DC.reduceMotion() || !body.animate) return;
      e.preventDefault();
      if (anim) anim.cancel();
      if (details.open) {
        anim = body.animate(
          [
            { height: body.offsetHeight + 'px', opacity: 1 },
            { height: '0px', opacity: 0, paddingBottom: '0px' }
          ],
          { duration: 280, easing: 'cubic-bezier(.65,0,.35,1)' }
        );
        anim.onfinish = function () {
          details.open = false;
          anim = null;
        };
      } else {
        details.open = true;
        var h = body.offsetHeight;
        anim = body.animate(
          [
            { height: '0px', opacity: 0, paddingBottom: '0px' },
            { height: h + 'px', opacity: 1 }
          ],
          { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
        anim.onfinish = function () {
          anim = null;
        };
      }
    });
  });

  /* ---------- Calculadora rápida de salário líquido ---------- */
  var mini = document.querySelector('[data-mini-calc]');
  if (mini && DC.br) {
    var input = mini.querySelector('#mini-salario');
    var outs = {};
    mini.querySelectorAll('[data-out]').forEach(function (el) {
      outs[el.dataset.out] = el;
    });
    var bars = {};
    mini.querySelectorAll('[data-bar]').forEach(function (el) {
      bars[el.dataset.bar] = el;
    });
    var link = mini.querySelector('[data-out-link]');
    var last = { inss: 0, irrf: 0, liquido: 0 };

    var update = function () {
      var salario = DC.parseMoney(input.value) || 0;
      var r = DC.br.salarioLiquido(salario);
      var values = { inss: r.inss.valor, irrf: r.irrf.valor, liquido: Math.max(r.liquido, 0) };
      Object.keys(values).forEach(function (k) {
        var sign = k === 'liquido' ? '' : '− ';
        if (k === 'irrf' && salario > 0 && values.irrf === 0) {
          cancelAnimationFrame(outs[k]._tween);
          outs[k].textContent = 'Isento';
        } else {
          DC.tween(outs[k], last[k], values[k], function (v) {
            return sign + fmt.brl(v);
          }, 420);
        }
        bars[k].style.setProperty('--w', salario > 0 ? (values[k] / salario) * 100 + '%' : '0%');
      });
      last = values;
      link.href = 'ferramentas.html?f=salario-liquido' + (salario > 0 ? '#salario=' + salario : '');
    };
    input.addEventListener('input', update);
    update();
  }

  /* ---------- Formulário de contato: monta a mensagem e abre WhatsApp ou e-mail ---------- */
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var success = form.querySelector('[data-form-success]');
    var successText = form.querySelector('[data-success-text]');

    var rules = {
      nome: function (v) {
        return v.trim().length >= 3 ? '' : 'Informe seu nome.';
      },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Informe um e-mail válido.';
      },
      telefone: function (v) {
        return v.replace(/\D/g, '').length >= 10 ? '' : 'Informe um telefone com DDD.';
      }
    };

    function validate(name) {
      var el = form.elements[name];
      var msg = rules[name](el.value);
      var err = document.getElementById(el.getAttribute('aria-describedby'));
      el.setAttribute('aria-invalid', String(!!msg));
      err.hidden = !msg;
      err.textContent = msg;
      return !msg;
    }

    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      // Valida ao sair do campo e, depois do primeiro erro, a cada tecla
      el.addEventListener('blur', function () {
        if (el.value) validate(name);
      });
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true') validate(name);
      });
    });

    // "Saber mais" nos cards de serviço já deixa o serviço escolhido no formulário
    document.querySelectorAll('[data-service]').forEach(function (a) {
      a.addEventListener('click', function () {
        form.elements.servico.value = a.dataset.service;
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalid = Object.keys(rules).filter(function (name) {
        return !validate(name);
      });
      if (invalid.length) {
        form.elements[invalid[0]].focus();
        return;
      }
      var d = {
        nome: form.elements.nome.value.trim(),
        email: form.elements.email.value.trim(),
        telefone: form.elements.telefone.value.trim(),
        servico: form.elements.servico.value,
        mensagem: form.elements.mensagem.value.trim(),
        canal: form.elements.canal.value
      };
      var texto =
        'Olá, DevCount! Quero receber uma consultoria gratuita.\n\n' +
        'Nome: ' + d.nome + '\n' +
        'E-mail: ' + d.email + '\n' +
        'Telefone: ' + d.telefone + '\n' +
        'Serviço de interesse: ' + d.servico +
        (d.mensagem ? '\n\nMensagem: ' + d.mensagem : '');

      if (d.canal === 'email') {
        window.location.href =
          'mailto:carlosdanyellnsb@hotmail.com?subject=' + encodeURIComponent('Consultoria gratuita — ' + d.servico) + '&body=' + encodeURIComponent(texto);
        successText.textContent = 'Abrimos o seu aplicativo de e-mail com a mensagem pronta. É só enviar.';
      } else {
        window.open(DC.whatsappUrl(texto), '_blank', 'noopener');
        successText.textContent = 'Abrimos o WhatsApp com a sua mensagem pronta. É só tocar em enviar.';
      }
      success.hidden = false;
      success.focus();
    });

    form.querySelector('[data-form-reset]').addEventListener('click', function () {
      form.reset();
      form.querySelectorAll('[aria-invalid]').forEach(function (el) {
        el.removeAttribute('aria-invalid');
      });
      success.hidden = true;
      form.elements.nome.focus();
    });
  }
})();
