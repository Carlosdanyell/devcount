/* DevCount — Ferramentas: registro, formulários, resultados, rotas e busca.
 * Cada ferramenta é declarada nos arquivos de categoria (trabalhista.js, empresa.js, financas.js,
 * utilidades.js) com seus campos e uma função compute(); todo o resto da interface vive aqui.
 *
 * URL: ferramentas.html?f=<id>#<valores>. O id fica na query (endereço próprio e indexável para
 * cada ferramenta) e os valores no hash (compartilháveis, mas sem gerar infinitas URLs indexáveis). */
(function () {
  'use strict';

  const DC = window.DC;
  const fmt = DC.fmt;
  const icon = DC.icon;
  const esc = DC.escape;

  const CATEGORIES = [
    { id: 'trabalhista', name: 'Trabalhista', icon: 'briefcase', desc: 'Salário, férias, 13º, rescisão e o custo da folha.' },
    { id: 'empresa', name: 'Empresa e impostos', icon: 'landmark', desc: 'Simples Nacional, MEI, pró-labore e CLT × PJ.' },
    { id: 'financas', name: 'Finanças', icon: 'coins', desc: 'Juros, financiamentos, preço de venda e porcentagens.' },
    { id: 'utilidades', name: 'Utilitários', icon: 'wrench', desc: 'Documentos, prazos e valores por extenso.' }
  ];
  const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  const tools = [];
  const byId = Object.create(null);

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const DEFAULT_TITLE = document.title;
  const metaDescription = document.querySelector('meta[name="description"]');
  const DEFAULT_DESCRIPTION = metaDescription ? metaDescription.content : '';

  let app = null;
  let current = null;

  /* ---------- API para os arquivos de categoria ---------- */
  DC.tools = {
    CATEGORIES,
    register(def) {
      tools.push(def);
      byId[def.id] = def;
    },
    /* Blocos recolhíveis de explicação abaixo da ferramenta */
    info(blocks) {
      return blocks
        .map(
          (b) => `<details class="info-item"${b.open ? ' open' : ''}>
            <summary>${icon(b.icon || 'info')}<span>${b.title}</span>${icon('chevron-down', 'info-chevron')}</summary>
            <div class="info-body prose">${b.html}</div>
          </details>`
        )
        .join('');
    },
    /* Tabela de referência (texto já formatado) */
    table(head, rows, foot) {
      return `<div class="table-scroll"><table class="data-table ref-table">
        <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        ${foot ? `<tfoot><tr><td colspan="${head.length}">${foot}</td></tr></tfoot>` : ''}
      </table></div>`;
    },
    sources(links) {
      return `<p class="sources">Fontes: ${links.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(' · ')}</p>`;
    },
    todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  };

  /* ---------- Preferências locais (favoritas e recentes) ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem('dc-' + key));
        return v == null ? fallback : v;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('dc-' + key, JSON.stringify(value));
      } catch (err) {
        /* modo privado ou armazenamento cheio: a preferência vale só nesta visita */
      }
    }
  };

  const isFav = (id) => store.get('favoritas', []).includes(id);

  function toggleFav(id) {
    const list = store.get('favoritas', []);
    const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
    store.set('favoritas', next);
    return next.includes(id);
  }

  function pushRecent(id) {
    store.set('recentes', [id, ...store.get('recentes', []).filter((x) => x !== id)].slice(0, 5));
  }

  /* ---------- Busca ---------- */
  const norm = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

  function matches(tool, q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const hay = norm([tool.title, tool.summary, catById[tool.category].name, ...(tool.keywords || [])].join(' '));
    return terms.every((t) => hay.includes(t));
  }

  /* ---------- Formatação de valores de resultado ---------- */
  function formatValue(v, format) {
    if (typeof v !== 'number') return v == null ? '—' : v;
    switch (format) {
      case 'pct':
        return fmt.pct(v);
      case 'pct1':
        return fmt.pct(v, 1);
      case 'int':
        return fmt.int(v);
      case 'num':
        return fmt.num(v, 2);
      case 'num1':
        return fmt.num(v, 1);
      case 'text':
        return String(v);
      default:
        return fmt.brl(v);
    }
  }

  const plainNumber = (v) => String(v).replace('.', ',');

  /* Horas aceitam "10:30", "10h30" ou decimal ("10,5") */
  function parseHours(str) {
    str = String(str || '').trim();
    if (!str) return null;
    const m = str.match(/^(\d+)\s*[:h]\s*(\d{1,2})?$/i);
    if (m) return Number(m[1]) + Number(m[2] || 0) / 60;
    return DC.parseNumber(str);
  }

  const stripHtml = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent.trim();
  };

  /* ---------- Rotas ---------- */
  const toolIdFromUrl = () => new URLSearchParams(location.search).get('f');
  const toolUrl = (id, hash) => `${location.pathname}?f=${encodeURIComponent(id)}${hash ? '#' + hash : ''}`;

  function navigate(url, opts) {
    try {
      history.pushState(null, '', url);
    } catch (err) {
      // Alguns navegadores bloqueiam pushState em arquivo local: recarrega no novo endereço
      location.href = url;
      return;
    }
    render({ transition: true, source: opts && opts.source });
  }

  function render(opts) {
    opts = opts || {};
    const id = toolIdFromUrl();
    const tool = id ? byId[id] : null;
    const previousId = current && current.tool.id;

    if (id && !tool) {
      history.replaceState(null, '', location.pathname);
      DC.toast('Ferramenta não encontrada. Veja todas as disponíveis.', 'info');
    }

    const update = () => {
      if (tool) renderTool(tool);
      else renderCatalog(previousId);
      window.scrollTo(0, 0);
    };

    // O ícone do card "vira" o ícone do cabeçalho da ferramenta (View Transitions API)
    if (opts.transition && document.startViewTransition && !DC.reduceMotion()) {
      if (opts.source) opts.source.style.viewTransitionName = 'tool-icon';
      const vt = document.startViewTransition(update);
      vt.finished.finally(() => {
        if (opts.source) opts.source.style.viewTransitionName = '';
        document.querySelectorAll('[data-vt-return]').forEach((el) => {
          el.style.viewTransitionName = '';
          el.removeAttribute('data-vt-return');
        });
      });
    } else {
      update();
    }
  }

  /* ---------- Catálogo ---------- */
  function card(t) {
    return `<a class="tool-card" href="${toolUrl(t.id)}" data-tool-link="${t.id}" data-reveal>
      <span class="tool-card-icon cat-${t.category}">${icon(t.icon)}</span>
      <span class="tool-card-body">
        <span class="tool-card-title">${t.title}${t.badge ? ` <span class="badge">${t.badge}</span>` : ''}</span>
        <span class="tool-card-text">${t.summary}</span>
      </span>
      <span class="tool-card-arrow">${icon('arrow-right')}</span>
    </a>`;
  }

  function shelf(title, iconName, ids) {
    if (!ids.length) return '';
    return `<section class="shelf" data-shelf>
      <h2 class="shelf-title">${icon(iconName)}${title}</h2>
      <div class="shelf-list">${ids
        .map((id) => {
          const t = byId[id];
          return `<a class="shelf-item" href="${toolUrl(id)}" data-tool-link="${id}"><span class="shelf-icon cat-${t.category}">${icon(t.icon)}</span>${t.title}</a>`;
        })
        .join('')}</div>
    </section>`;
  }

  function helpCta(tool) {
    const text = tool
      ? `Olá! Usei a ferramenta "${tool.title}" no site da DevCount e quero conversar com um contador.`
      : 'Olá! Vim pelas ferramentas da DevCount e preciso de ajuda com um cálculo.';
    return `<aside class="help-cta">
      <span class="help-cta-icon">${icon('users')}</span>
      <div>
        <h2>${tool ? 'Quer conferir esse cálculo com um especialista?' : 'Precisa de um cálculo sob medida?'}</h2>
        <p>As ferramentas trazem estimativas. Nossos contadores analisam o seu caso real: convenção coletiva, histórico e regime tributário.</p>
      </div>
      <a class="btn btn-accent" href="${DC.whatsappUrl(text)}" target="_blank" rel="noopener">${icon('whatsapp')}Falar no WhatsApp</a>
    </aside>`;
  }

  function renderCatalog(returnFromId) {
    current = null;
    document.title = DEFAULT_TITLE;
    if (metaDescription) metaDescription.content = DEFAULT_DESCRIPTION;

    const favs = store.get('favoritas', []).filter((id) => byId[id]);
    const recents = store.get('recentes', []).filter((id) => byId[id] && !favs.includes(id)).slice(0, 4);
    const count = (catId) => tools.filter((t) => t.category === catId).length;

    app.innerHTML = `
      <section class="tools-hero">
        <div class="tools-hero-bg" aria-hidden="true"></div>
        <div class="container tools-hero-inner">
          <p class="pill enter" style="--i:0">${icon('sparkles')}${tools.length} ferramentas gratuitas · tabelas de 2026</p>
          <h1 class="enter" style="--i:1">Ferramentas para <span class="text-gradient">decidir com números</span></h1>
          <p class="tools-lead enter" style="--i:2">Simule salário, férias, rescisão, impostos, financiamentos e muito mais. Tudo roda no seu navegador: nenhum dado sai do seu computador.</p>
          <div class="catalog-search enter" style="--i:3">
            ${icon('search')}
            <input type="search" data-catalog-search placeholder="Buscar: férias, DAS, juros, CNPJ…" aria-label="Buscar ferramenta" autocomplete="off" enterkeyhint="go" />
            <kbd>${modKey} K</kbd>
          </div>
          <div class="cat-filters enter" style="--i:4" role="group" aria-label="Filtrar por categoria">
            <button type="button" class="cat-chip" data-cat-filter="" aria-pressed="true">${icon('grid')}Todas<span>${tools.length}</span></button>
            ${CATEGORIES.map(
              (c) => `<button type="button" class="cat-chip" data-cat-filter="${c.id}" aria-pressed="false">${icon(c.icon)}${c.name}<span>${count(c.id)}</span></button>`
            ).join('')}
          </div>
        </div>
      </section>

      <div class="container catalog">
        ${shelf('Favoritas', 'star', favs)}
        ${shelf('Usadas recentemente', 'history', recents)}
        ${CATEGORIES.map(
          (c) => `<section class="cat-section" data-cat="${c.id}" aria-labelledby="cat-${c.id}">
            <header class="cat-head">
              <span class="cat-icon cat-${c.id}">${icon(c.icon)}</span>
              <div><h2 id="cat-${c.id}">${c.name}</h2><p>${c.desc}</p></div>
            </header>
            <div class="tool-grid" data-reveal-stagger>${tools
              .filter((t) => t.category === c.id)
              .map(card)
              .join('')}</div>
          </section>`
        ).join('')}
        <div class="catalog-empty" data-catalog-empty hidden>
          <span class="empty-art">${icon('search')}</span>
          <h2>Nenhuma ferramenta encontrada</h2>
          <p>Tente outro termo, como “salário”, “imposto” ou “juros”.</p>
          <button class="btn btn-ghost btn-sm" type="button" data-clear-search>Limpar busca</button>
        </div>
        ${helpCta()}
      </div>`;

    const search = app.querySelector('[data-catalog-search]');
    const empty = app.querySelector('[data-catalog-empty]');
    let activeCat = '';

    const filter = () => {
      const q = search.value;
      let visible = 0;
      app.querySelectorAll('.cat-section').forEach((sec) => {
        const inCat = !activeCat || sec.dataset.cat === activeCat;
        let n = 0;
        sec.querySelectorAll('.tool-card').forEach((el) => {
          const ok = inCat && matches(byId[el.dataset.toolLink], q);
          el.hidden = !ok;
          if (ok) n++;
        });
        sec.hidden = n === 0;
        visible += n;
      });
      app.querySelectorAll('[data-shelf]').forEach((s) => {
        s.hidden = Boolean(q.trim() || activeCat);
      });
      empty.hidden = visible > 0;
    };

    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const first = app.querySelector('.tool-card:not([hidden])');
      if (first) navigate(first.getAttribute('href'), { source: first.querySelector('.tool-card-icon') });
    });
    app.querySelector('[data-clear-search]').addEventListener('click', () => {
      search.value = '';
      filter();
      search.focus();
    });
    app.querySelectorAll('[data-cat-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCat = chip.dataset.catFilter;
        app.querySelectorAll('[data-cat-filter]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        filter();
      });
    });

    if (returnFromId) {
      const back = app.querySelector(`.cat-section [data-tool-link="${returnFromId}"] .tool-card-icon`);
      if (back) {
        back.style.viewTransitionName = 'tool-icon';
        back.setAttribute('data-vt-return', '');
      }
    }
    DC.reveal(app);
  }

  /* ---------- Campos ---------- */
  function renderField(f, v) {
    if (f.type === 'heading') return `<p class="fields-heading">${f.label}</p>`;

    const id = 'f-' + f.id;
    const describedBy = [f.hint ? id + '-hint' : '', id + '-err'].filter(Boolean).join(' ');
    // Em campos lado a lado o "opcional" vai para o placeholder: no rótulo ele quebraria a linha e desalinharia o par
    const optInPlaceholder = f.optional && f.half && f.placeholder == null;
    const opt = f.optional && !optInPlaceholder ? ' <span class="field-opt">opcional</span>' : '';
    const cls = 'field' + (f.half ? ' field-half' : '');
    const hint = f.hint ? `<p class="field-hint" id="${id}-hint">${f.hint}</p>` : '';
    const err = `<p class="field-error" id="${id}-err" hidden></p>`;
    const placeholder = optInPlaceholder ? ' placeholder="Opcional"' : f.placeholder != null ? ` placeholder="${esc(f.placeholder)}"` : '';
    let control = '';

    switch (f.type) {
      case 'money':
        control = `<div class="input-wrap has-prefix"><span class="input-affix" aria-hidden="true">R$</span>
          <input class="input" id="${id}" name="${f.id}" inputmode="decimal" data-money autocomplete="off"${placeholder || ' placeholder="0,00"'}
          value="${v != null ? fmt.num(v, 2) : ''}" aria-describedby="${describedBy}" /></div>`;
        break;
      case 'number':
      case 'hours':
      case 'percent': {
        const suffix = f.type === 'percent' ? '%' : f.type === 'hours' ? 'h' : f.suffix || '';
        control = `<div class="input-wrap${suffix ? ' has-suffix' : ''}">
          <input class="input" id="${id}" name="${f.id}" inputmode="decimal" autocomplete="off"${placeholder}
          value="${v != null ? plainNumber(v) : ''}" aria-describedby="${describedBy}" />
          ${suffix ? `<span class="input-affix" aria-hidden="true">${suffix}</span>` : ''}</div>`;
        break;
      }
      case 'int':
        control = `<div class="stepper">
          <button type="button" class="stepper-btn" data-step="-1" aria-label="Diminuir ${esc(stripHtml(f.label))}" tabindex="-1">${icon('minus')}</button>
          <input class="input" id="${id}" name="${f.id}" inputmode="numeric" autocomplete="off"${placeholder}
          value="${v != null ? v : ''}" aria-describedby="${describedBy}" />
          <button type="button" class="stepper-btn" data-step="1" aria-label="Aumentar ${esc(stripHtml(f.label))}" tabindex="-1">${icon('plus')}</button>
        </div>`;
        break;
      case 'select':
        control = `<div class="select-wrap"><select class="input" id="${id}" name="${f.id}" aria-describedby="${describedBy}">
          ${f.options.map((o) => `<option value="${o.value}"${String(o.value) === String(v) ? ' selected' : ''}>${o.label}</option>`).join('')}
          </select>${icon('chevron-down', 'select-chevron')}</div>`;
        break;
      case 'segmented':
        control = `<div class="segmented${f.options.length > 3 ? ' is-wrap' : ''}" role="radiogroup" aria-labelledby="${id}-label">
          ${f.options
            .map(
              (o) => `<label class="seg"><input type="radio" name="${f.id}" value="${o.value}"${String(o.value) === String(v) ? ' checked' : ''} /><span>${o.label}</span></label>`
            )
            .join('')}</div>`;
        break;
      case 'toggle':
        return `<div class="${cls}" data-field="${f.id}">
          <label class="switch"><input type="checkbox" role="switch" id="${id}" name="${f.id}"${v ? ' checked' : ''} aria-describedby="${describedBy}" />
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          <span class="switch-label">${f.label}${f.hint ? `<small id="${id}-hint">${f.hint}</small>` : ''}</span></label>${err}</div>`;
      case 'date':
        control = `<input class="input" type="date" id="${id}" name="${f.id}" value="${v || ''}" aria-describedby="${describedBy}" />`;
        break;
      default:
        control = `<input class="input${f.large ? ' input-lg' : ''}" id="${id}" name="${f.id}" autocomplete="off" spellcheck="false"${placeholder}
          ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}
          value="${esc(v || '')}" aria-describedby="${describedBy}" />`;
    }

    const label =
      f.type === 'segmented'
        ? `<span class="field-label" id="${id}-label">${f.label}${opt}</span>`
        : `<label class="field-label" for="${id}">${f.label}${opt}</label>`;
    return `<div class="${cls}" data-field="${f.id}">${label}${control}${hint}${err}</div>`;
  }

  function readValues(tool, form) {
    const v = {};
    tool.fields.forEach((f) => {
      if (f.type === 'heading') return;
      const el = form.elements[f.id];
      if (!el) return;
      switch (f.type) {
        case 'money':
          v[f.id] = DC.parseMoney(el.value);
          break;
        case 'number':
        case 'percent':
          v[f.id] = DC.parseNumber(el.value);
          break;
        case 'hours':
          v[f.id] = parseHours(el.value);
          break;
        case 'int': {
          const n = parseInt(el.value, 10);
          v[f.id] = Number.isFinite(n) ? n : null;
          break;
        }
        case 'toggle':
          v[f.id] = el.checked;
          break;
        default:
          v[f.id] = String(el.value || '').trim();
      }
    });
    return v;
  }

  function setFieldValue(form, f, v) {
    const el = form.elements[f.id];
    if (!el) return;
    switch (f.type) {
      case 'money':
        el.value = v == null ? '' : fmt.num(v, 2);
        break;
      case 'number':
      case 'hours':
      case 'percent':
        el.value = v == null ? '' : plainNumber(v);
        break;
      case 'toggle':
        el.checked = Boolean(v);
        break;
      case 'segmented':
        el.value = v == null ? f.default : v;
        break;
      default:
        el.value = v == null ? '' : v;
    }
  }

  function defaults(tool) {
    const vals = {};
    tool.fields.forEach((f) => {
      if (f.default !== undefined) vals[f.id] = typeof f.default === 'function' ? f.default() : f.default;
    });
    return vals;
  }

  function parseSerialized(f, raw) {
    switch (f.type) {
      case 'money':
      case 'number':
      case 'hours':
      case 'percent': {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      case 'int': {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      }
      case 'toggle':
        return raw === '1';
      default:
        return raw;
    }
  }

  function initialValues(tool) {
    const vals = defaults(tool);
    const hash = new URLSearchParams(location.hash.slice(1));
    tool.fields.forEach((f) => {
      if (f.id && hash.has(f.id)) vals[f.id] = parseSerialized(f, hash.get(f.id));
    });
    return vals;
  }

  function serialize(tool, values) {
    const p = new URLSearchParams();
    tool.fields.forEach((f) => {
      if (f.type === 'heading') return;
      const v = values[f.id];
      if (v == null || v === '') return;
      const def = typeof f.default === 'function' ? undefined : f.default;
      if (def !== undefined && v === def) return;
      p.set(f.id, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    });
    return p.toString();
  }

  /* ---------- Página da ferramenta ---------- */
  function related(tool) {
    const picked = (tool.related || []).map((id) => byId[id]).filter(Boolean);
    const sameCat = tools.filter((t) => t.category === tool.category && t.id !== tool.id && !picked.includes(t));
    const items = picked.concat(sameCat).slice(0, 3);
    return `<section class="tool-related" aria-labelledby="related-title">
      <h2 id="related-title">Veja também</h2>
      <div class="tool-grid" data-reveal-stagger>${items.map(card).join('')}</div>
    </section>`;
  }

  function sidebar(tool) {
    return `<aside class="tool-sidebar" aria-label="Todas as ferramentas">
      <a class="sidebar-back" href="${location.pathname}" data-home-link>${icon('grid')}<span>Todas as ferramentas</span></a>
      <button type="button" class="sidebar-search" data-open-palette>${icon('search')}<span>Buscar</span><kbd>${modKey} K</kbd></button>
      <nav class="sidebar-nav" aria-label="Ferramentas por categoria">
        ${CATEGORIES.map(
          (c) => `<div class="side-group">
            <p class="side-cat">${c.name}</p>
            <ul role="list">${tools
              .filter((t) => t.category === c.id)
              .map(
                (t) => `<li><a class="side-link" href="${toolUrl(t.id)}" data-tool-link="${t.id}"${t.id === tool.id ? ' aria-current="page"' : ''}>
                  <span class="side-icon cat-${t.category}">${icon(t.icon)}</span>${t.title}</a></li>`
              )
              .join('')}</ul>
          </div>`
        ).join('')}
      </nav>
    </aside>`;
  }

  function renderTool(tool) {
    const cat = catById[tool.category];
    const values = initialValues(tool);
    const fav = isFav(tool.id);
    pushRecent(tool.id);
    document.title = `${tool.title} — Ferramentas | DevCount`;
    if (metaDescription) metaDescription.content = tool.description;

    app.innerHTML = `
      <div class="container tool-layout">
        ${sidebar(tool)}
        <article class="tool" data-tool="${tool.id}">
          <div class="tool-mobilebar">
            <a class="mobilebar-back" href="${location.pathname}" data-home-link>${icon('arrow-left')}Ferramentas</a>
            <button class="btn btn-ghost btn-sm" type="button" data-open-palette>${icon('search')}Trocar ferramenta</button>
          </div>

          <header class="tool-header">
            <nav class="breadcrumb" aria-label="Você está em">
              <ol role="list">
                <li><a href="${location.pathname}" data-home-link>Ferramentas</a></li>
                <li>${cat.name}</li>
                <li aria-current="page">${tool.title}</li>
              </ol>
            </nav>
            <div class="tool-title-row">
              <span class="tool-header-icon cat-${tool.category}">${icon(tool.icon)}</span>
              <div class="tool-title-text">
                <h1>${tool.title}</h1>
                <p>${tool.description}</p>
              </div>
            </div>
            <div class="tool-toolbar">
              <ul class="tool-tags" role="list">${(tool.tags || []).concat('Cálculo no seu navegador').map((t) => `<li>${t}</li>`).join('')}</ul>
              <div class="tool-actions">
                <button type="button" class="icon-btn fav-btn" data-action="fav" aria-pressed="${fav}" aria-label="Favoritar ferramenta" title="Favoritar">
                  <svg class="icon" aria-hidden="true"><use href="#i-${fav ? 'star-filled' : 'star'}"/></svg>
                </button>
                <button type="button" class="icon-btn" data-action="share" aria-label="Compartilhar simulação" title="Compartilhar">${icon('share')}</button>
                <button type="button" class="icon-btn" data-action="print" aria-label="Imprimir ou salvar em PDF" title="Imprimir ou salvar em PDF">${icon('printer')}</button>
                <button type="button" class="icon-btn" data-action="reset" aria-label="Limpar campos" title="Limpar campos">${icon('rotate-ccw')}</button>
              </div>
            </div>
          </header>

          <div class="tool-workspace">
            <form class="panel tool-form" data-form novalidate autocomplete="off">
              <div class="panel-head">
                <h2>${icon('calculator')}Dados</h2>
                ${tool.example ? `<button type="button" class="link-btn" data-action="example">${icon('sparkles')}Usar exemplo</button>` : ''}
              </div>
              <div class="fields">${tool.fields.map((f) => renderField(f, values[f.id])).join('')}</div>
            </form>

            <section class="panel tool-result" aria-labelledby="result-title">
              <div class="panel-head">
                <h2 id="result-title">${icon('bar-chart')}Resultado</h2>
                <button type="button" class="link-btn" data-action="copy">${icon('copy')}Copiar resumo</button>
              </div>
              <div class="result-body" data-result></div>
            </section>
          </div>

          ${tool.info ? `<section class="tool-info" aria-label="Entenda o cálculo">${tool.info}</section>` : ''}
          ${related(tool)}
          ${helpCta(tool)}
        </article>
      </div>`;

    const form = app.querySelector('[data-form]');
    current = { tool, form, lastHeadline: null, bars: {}, expanded: {}, hadChart: false, lastResult: null, urlTimer: 0, raf: 0 };

    const fieldById = Object.fromEntries(tool.fields.filter((f) => f.id).map((f) => [f.id, f]));
    const schedule = () => {
      cancelAnimationFrame(current.raf);
      current.raf = requestAnimationFrame(update);
    };

    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('input', (e) => {
      const f = fieldById[e.target.name];
      if (f && f.mask) {
        e.target.value = f.mask(e.target.value);
      }
      schedule();
    });
    form.addEventListener('change', schedule);
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const input = btn.parentElement.querySelector('input');
      const f = fieldById[input.name];
      let n = (parseInt(input.value, 10) || 0) + Number(btn.dataset.step);
      if (f.min != null) n = Math.max(f.min, n);
      if (f.max != null) n = Math.min(f.max, n);
      input.value = n;
      schedule();
    });
    // Setas do teclado ajustam os campos inteiros, como num input numérico
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const f = fieldById[e.target.name];
      if (!f || f.type !== 'int') return;
      e.preventDefault();
      const btn = e.target.parentElement.querySelector(`[data-step="${e.key === 'ArrowUp' ? 1 : -1}"]`);
      btn.click();
    });

    update();
    DC.reveal(app);
  }

  function applyVisibility(tool, form, values) {
    tool.fields.forEach((f) => {
      if (!f.when) return;
      const wrap = form.querySelector(`[data-field="${f.id}"]`);
      if (wrap) wrap.hidden = !f.when(values);
    });
  }

  function markInvalid(form, invalid) {
    const map = Array.isArray(invalid) ? Object.fromEntries(invalid.map((id) => [id, ''])) : invalid || {};
    form.querySelectorAll('[data-field]').forEach((wrap) => {
      const id = wrap.dataset.field;
      const bad = id in map;
      const input = wrap.querySelector('.input');
      const err = wrap.querySelector('.field-error');
      if (input) input.setAttribute('aria-invalid', String(bad));
      if (err) {
        err.hidden = !(bad && map[id]);
        err.textContent = bad ? map[id] : '';
      }
    });
  }

  function update() {
    if (!current) return;
    const { tool, form } = current;
    const values = readValues(tool, form);
    applyVisibility(tool, form, values);
    let res;
    try {
      res = tool.compute(values);
    } catch (err) {
      console.error(err);
      res = { error: 'Não foi possível calcular com esses valores. Revise os campos.' };
    }
    markInvalid(form, res && res.invalid);
    renderResult(res, values);

    clearTimeout(current.urlTimer);
    current.urlTimer = setTimeout(() => {
      try {
        history.replaceState(null, '', toolUrl(tool.id, serialize(tool, values)));
      } catch (err) {
        /* sem histórico (arquivo local): a simulação só não fica no endereço */
      }
    }, 350);
  }

  /* ---------- Resultado ---------- */
  function alertHtml(tone, text) {
    const ic = { success: 'check-circle', warning: 'alert-triangle', danger: 'x-circle' }[tone] || 'info';
    return `<div class="alert tone-${tone}" role="note">${icon(ic)}<div>${text}</div></div>`;
  }

  function headlineHtml(h) {
    const numeric = typeof h.value === 'number';
    return `<div class="headline tone-${h.tone || 'primary'}">
      <span class="headline-label">${h.label}</span>
      <strong class="headline-value${numeric ? '' : ' is-text'}" data-headline>${formatValue(h.value, h.format)}</strong>
      ${h.sub ? `<span class="headline-sub">${h.sub}</span>` : ''}
    </div>`;
  }

  function statsHtml(stats) {
    return `<dl class="kpis">${stats
      .map(
        (s) => `<div class="kpi${s.tone ? ' tone-' + s.tone : ''}">
          <dt>${s.label}</dt><dd>${formatValue(s.value, s.format)}</dd>
          ${s.hint ? `<span class="kpi-hint">${s.hint}</span>` : ''}</div>`
      )
      .join('')}</dl>`;
  }

  function breakdownHtml(b) {
    const items = b.items.filter((i) => i.value > 0.004);
    const total = b.total || items.reduce((s, i) => s + i.value, 0);
    if (!total || !items.length) return '';
    const label = (i) => `${stripHtml(i.label)}: ${fmt.pct(i.value / total, 1)}`;
    return `<div class="breakdown">
      <p class="block-title">${b.title}</p>
      <div class="stack-bar" role="img" aria-label="${esc(items.map(label).join('; '))}">
        ${items
          .map(
            (i) =>
              `<span class="seg tone-${i.tone || 'primary'}" data-key="${esc(i.label)}" data-w="${((i.value / total) * 100).toFixed(3)}"></span>`
          )
          .join('')}
      </div>
      <ul class="legend" role="list">${items
        .map(
          (i) => `<li><span class="swatch tone-${i.tone || 'primary'}"></span><span class="legend-label">${i.label}</span>
            <span class="legend-value">${formatValue(i.value, b.format)}</span><span class="legend-pct">${fmt.pct(i.value / total, 1)}</span></li>`
        )
        .join('')}</ul>
    </div>`;
  }

  function cellHtml(value, col, tag) {
    let v = value;
    let cls = col && col.align === 'right' ? 'num' : '';
    let format = col && col.format;
    if (v && typeof v === 'object') {
      if (v.cls) cls += ' ' + v.cls;
      if (v.format) format = v.format;
      v = v.v;
    }
    let text = v == null || v === '' ? '—' : typeof v === 'number' ? formatValue(v, format) : v;
    if (col && col.tone === 'neg' && typeof v === 'number' && v > 0) text = '− ' + text;
    return `<${tag}${cls.trim() ? ` class="${cls.trim()}"` : ''}>${text}</${tag}>`;
  }

  function tableHtml(t, index) {
    const key = t.title || 'tabela-' + index;
    const expanded = current.expanded[key];
    const rows = t.limit && !expanded ? t.rows.slice(0, t.limit) : t.rows;
    const rowHtml = (r) => {
      const cells = Array.isArray(r) ? r : r.cells;
      const cls = Array.isArray(r) ? '' : [r.highlight ? 'is-highlight' : '', r.muted ? 'is-muted' : ''].join(' ').trim();
      return `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c, i) => cellHtml(c, t.columns[i], i === 0 ? 'th' : 'td')).join('')}</tr>`;
    };
    const more =
      t.limit && t.rows.length > t.limit
        ? `<button type="button" class="link-btn table-more" data-expand="${esc(key)}" aria-expanded="${Boolean(expanded)}">
            ${expanded ? 'Mostrar menos' : `Mostrar todas as ${t.rows.length} linhas`}${icon('chevron-down')}</button>`
        : '';
    return `<div class="table-block">
      ${t.title ? `<p class="block-title">${t.title}</p>` : ''}
      <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(stripHtml(t.title || 'Tabela'))}">
        <table class="data-table${t.compact ? ' is-compact' : ''}">
          <thead><tr>${t.columns
            .map((c) => `<th scope="col"${c.align === 'right' ? ' class="num"' : ''}>${c.label}</th>`)
            .join('')}</tr></thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody>
          ${t.foot ? `<tfoot><tr>${t.foot.map((c, i) => cellHtml(c, t.columns[i], i === 0 ? 'th' : 'td')).join('')}</tr></tfoot>` : ''}
        </table>
      </div>${more}
    </div>`;
  }

  function renderResult(res, values) {
    const box = app.querySelector('[data-result]');
    const st = current;

    if (!res || res.empty) {
      st.lastHeadline = null;
      st.lastResult = null;
      st.hadChart = false;
      box.innerHTML = `<div class="result-empty">
        <span class="empty-art">${icon(st.tool.icon)}</span>
        <p class="empty-title">${typeof (res && res.empty) === 'string' ? res.empty : 'Preencha os dados para ver o resultado.'}</p>
        <p class="empty-sub">O cálculo é feito na hora, enquanto você digita.</p>
        ${st.tool.example ? `<button type="button" class="btn btn-ghost btn-sm" data-action="example">${icon('sparkles')}Ver um exemplo</button>` : ''}
      </div>`;
      announce('');
      return;
    }

    let html = '';
    if (res.error) html += alertHtml('danger', res.error);
    if (res.headline) html += headlineHtml(res.headline);
    (res.alerts || []).forEach((a) => {
      html += alertHtml(a.tone, a.text);
    });
    if (res.stats) html += statsHtml(res.stats);
    if (res.breakdown) html += breakdownHtml(res.breakdown);
    if (res.chart) html += `<figure class="chart${st.hadChart ? '' : ' is-new'}" data-chart></figure>`;
    if (res.html) html += res.html;
    (res.tables || []).forEach((t, i) => {
      html += tableHtml(t, i);
    });
    if (res.notes && res.notes.length) {
      html += `<ul class="result-notes" role="list">${res.notes.map((n) => `<li>${icon('info')}<span>${n}</span></li>`).join('')}</ul>`;
    }
    box.innerHTML = html;

    // Número principal: conta a partir do valor anterior
    const h = res.headline;
    const el = box.querySelector('[data-headline]');
    if (el && h && typeof h.value === 'number') {
      const prev = st.lastHeadline;
      const from = prev && prev.format === h.format && prev.label === h.label ? prev.value : 0;
      DC.tween(el, from, h.value, (v) => formatValue(v, h.format), prev ? 420 : 700);
      st.lastHeadline = { value: h.value, format: h.format, label: h.label };
    } else {
      st.lastHeadline = null;
    }

    // Barras e medidores ([data-w] + [data-key]) partem da largura anterior: a mudança anima em vez de piscar
    const segs = box.querySelectorAll('[data-w][data-key]');
    const nextBars = {};
    segs.forEach((s) => {
      s.style.width = (st.bars[s.dataset.key] || 0) + '%';
      nextBars[s.dataset.key] = Number(s.dataset.w);
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        segs.forEach((s) => {
          s.style.width = s.dataset.w + '%';
        })
      )
    );
    st.bars = nextBars;

    if (res.chart) drawChart(box.querySelector('[data-chart]'), res.chart);
    st.hadChart = Boolean(res.chart);
    if (st.tool.afterRender) st.tool.afterRender(box, values, res);
    st.lastResult = res;
    announce(res.headline ? `${stripHtml(res.headline.label)}: ${stripHtml(String(formatValue(res.headline.value, res.headline.format)))}` : '');
  }

  /* Leitores de tela recebem só o número principal, e só depois de uma pausa na digitação */
  let announceTimer = 0;
  function announce(text) {
    clearTimeout(announceTimer);
    const el = document.querySelector('[data-announcer]');
    if (!el) return;
    announceTimer = setTimeout(() => {
      el.textContent = text;
    }, 900);
  }

  /* ---------- Gráfico de linhas (SVG desenhado na largura real do contêiner) ---------- */
  let chartUid = 0;

  function niceMax(v) {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * exp;
  }

  function drawChart(fig, c) {
    const uid = ++chartUid;
    const W = Math.max(fig.clientWidth, 280);
    const H = W < 480 ? 210 : 250;
    const P = { l: 64, r: 14, t: 14, b: 30 };
    const n = c.labels.length;
    const all = c.series.flatMap((s) => s.values);
    const maxV = niceMax(Math.max(...all, 0));
    const minV = Math.min(0, ...all);
    const x = (i) => P.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
    const y = (v) => P.t + (1 - (v - minV) / (maxV - minV || 1)) * (H - P.t - P.b);
    const yFmt = c.format === 'brl' || !c.format ? (v) => fmt.compactBrl(v) : (v) => formatValue(v, c.format);

    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = minV + ((maxV - minV) * k) / 4;
      grid += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="axis" x="${P.l - 10}" y="${y(v) + 4}" text-anchor="end">${yFmt(v)}</text>`;
    }
    const every = Math.max(1, Math.ceil(n / (W < 480 ? 4 : 7)));
    for (let i = 0; i < n; i += every) {
      grid += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${c.labels[i]}</text>`;
    }

    const lines = c.series
      .map((s, si) => {
        const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        const area = s.area ? `<path class="area" fill="url(#g${uid}-${si})" d="${d} L${x(n - 1).toFixed(1)} ${y(Math.max(minV, 0))} L${x(0)} ${y(Math.max(minV, 0))} Z"/>` : '';
        return `<defs><linearGradient id="g${uid}-${si}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" class="stop-${s.tone}" stop-opacity=".28"/><stop offset="1" class="stop-${s.tone}" stop-opacity="0"/></linearGradient></defs>
          ${area}<path class="line tone-${s.tone}${s.dashed ? ' is-dashed' : ''}" d="${d}" pathLength="1"/>`;
      })
      .join('');

    fig.innerHTML = `<div class="chart-plot">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.label || 'Gráfico')}">
          ${grid}${lines}
          <line class="cursor" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/>
          ${c.series.map((s) => `<circle class="dot tone-${s.tone}" r="4.5" visibility="hidden"/>`).join('')}
        </svg>
        <div class="chart-tip" hidden></div>
      </div>
      <figcaption class="chart-legend">${c.series.map((s) => `<span><i class="swatch tone-${s.tone}"></i>${s.name}</span>`).join('')}</figcaption>`;

    const svg = fig.querySelector('svg');
    const cursor = svg.querySelector('.cursor');
    const dots = svg.querySelectorAll('.dot');
    const tip = fig.querySelector('.chart-tip');

    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1))));
      const cx = x(i);
      cursor.setAttribute('x1', cx);
      cursor.setAttribute('x2', cx);
      cursor.setAttribute('visibility', 'visible');
      c.series.forEach((s, si) => {
        dots[si].setAttribute('cx', cx);
        dots[si].setAttribute('cy', y(s.values[i]));
        dots[si].setAttribute('visibility', 'visible');
      });
      tip.innerHTML = `<strong>${c.tipLabel ? c.tipLabel(i) : c.labels[i]}</strong>${c.series
        .map((s) => `<span><i class="swatch tone-${s.tone}"></i>${s.name}: <b>${formatValue(s.values[i], c.format)}</b></span>`)
        .join('')}`;
      tip.hidden = false;
      const left = Math.min(Math.max(cx, 90), W - 90);
      tip.style.left = left + 'px';
    };
    const hide = () => {
      cursor.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
      tip.hidden = true;
    };
    svg.addEventListener('pointermove', (e) => show(e.clientX));
    svg.addEventListener('pointerdown', (e) => show(e.clientX));
    svg.addEventListener('pointerleave', hide);

    // Redesenha quando o painel muda de largura (rotação do celular, janela redimensionada)
    if ('ResizeObserver' in window) {
      let lastW = W;
      const ro = new ResizeObserver(() => {
        if (!fig.isConnected) return ro.disconnect();
        if (Math.abs(fig.clientWidth - lastW) > 4) {
          lastW = fig.clientWidth;
          ro.disconnect();
          fig.classList.remove('is-new');
          drawChart(fig, c);
        }
      });
      ro.observe(fig);
    }
  }

  /* ---------- Ações da ferramenta ---------- */
  function summaryText() {
    const res = current && current.lastResult;
    if (!res) return '';
    const lines = [`${current.tool.title} — DevCount`, ''];
    if (res.headline) lines.push(`${stripHtml(res.headline.label)}: ${stripHtml(String(formatValue(res.headline.value, res.headline.format)))}`);
    (res.stats || []).forEach((s) => lines.push(`${stripHtml(s.label)}: ${stripHtml(String(formatValue(s.value, s.format)))}`));
    const t = (res.tables || [])[0];
    if (t) {
      lines.push('', stripHtml(t.title || ''));
      t.rows.slice(0, 40).forEach((r) => {
        const cells = Array.isArray(r) ? r : r.cells;
        lines.push(
          cells
            .map((c, i) => {
              const v = c && typeof c === 'object' ? c.v : c;
              const f = (c && typeof c === 'object' && c.format) || (t.columns[i] && t.columns[i].format);
              return v == null || v === '' ? '—' : stripHtml(String(typeof v === 'number' ? formatValue(v, f) : v));
            })
            .join(' | ')
        );
      });
    }
    lines.push('', `Simulação: ${location.href}`);
    return lines.join('\n');
  }

  function fillForm(values) {
    const { tool, form } = current;
    tool.fields.forEach((f) => {
      if (f.id) setFieldValue(form, f, values[f.id]);
    });
    update();
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-tool-link], a[data-home-link]');
    if (link && app && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      navigate(link.getAttribute('href'), { source: link.querySelector('.tool-card-icon, .shelf-icon, .side-icon') });
      return;
    }

    if (e.target.closest('[data-open-palette]')) {
      openPalette();
      return;
    }

    const expand = e.target.closest('[data-expand]');
    if (expand && current) {
      current.expanded[expand.dataset.expand] = !current.expanded[expand.dataset.expand];
      update();
      return;
    }

    const action = e.target.closest('[data-action]');
    if (!action || !current) return;
    const { tool } = current;
    switch (action.dataset.action) {
      case 'fav': {
        const on = toggleFav(tool.id);
        action.setAttribute('aria-pressed', String(on));
        action.querySelector('use').setAttribute('href', on ? '#i-star-filled' : '#i-star');
        DC.toast(on ? 'Adicionada às favoritas' : 'Removida das favoritas', on ? 'star' : 'check-circle');
        break;
      }
      case 'share': {
        const data = { title: `${tool.title} — DevCount`, url: location.href };
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
          navigator.share(data).catch(() => {});
        } else {
          DC.copy(location.href).then(
            () => DC.toast('Link da simulação copiado'),
            () => DC.toast('Não foi possível copiar o link', 'alert-triangle')
          );
        }
        break;
      }
      case 'print':
        window.print();
        break;
      case 'reset':
        current.lastHeadline = null;
        current.expanded = {};
        fillForm(defaults(tool));
        DC.toast('Campos limpos', 'rotate-ccw');
        break;
      case 'example':
        fillForm(Object.assign(defaults(tool), tool.example));
        break;
      case 'copy': {
        const text = summaryText();
        if (!text) {
          DC.toast('Preencha os dados antes de copiar', 'info');
          break;
        }
        DC.copy(text).then(
          () => DC.toast('Resumo copiado'),
          () => DC.toast('Não foi possível copiar', 'alert-triangle')
        );
        break;
      }
    }
  });

  /* ---------- Busca rápida (Ctrl + K) ---------- */
  const palette = document.querySelector('[data-palette]');
  const pInput = palette && palette.querySelector('[data-palette-input]');
  const pList = palette && palette.querySelector('[data-palette-list]');
  let pItems = [];
  let pActive = 0;

  function setActive(i) {
    if (!pItems.length) return;
    pActive = (i + pItems.length) % pItems.length;
    pList.querySelectorAll('[role="option"]').forEach((li, idx) => li.setAttribute('aria-selected', String(idx === pActive)));
    const el = pList.children[pActive];
    pInput.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  }

  function renderPalette() {
    const q = pInput.value.trim();
    let list = tools.filter((t) => matches(t, q));
    if (!q) {
      const recent = store.get('recentes', []).map((id) => byId[id]).filter(Boolean);
      list = recent.concat(list.filter((t) => !recent.includes(t)));
    }
    pItems = list;
    pActive = 0;
    pList.innerHTML = list.length
      ? list
          .map(
            (t, i) => `<li role="option" id="pal-${t.id}" data-id="${t.id}" aria-selected="${i === 0}">
              <span class="pal-icon cat-${t.category}">${icon(t.icon)}</span>
              <span class="pal-text"><strong>${t.title}</strong><small>${catById[t.category].name} · ${t.summary}</small></span>
              ${icon('corner-down-left', 'pal-enter')}
            </li>`
          )
          .join('')
      : `<li class="pal-empty">Nada encontrado para “${esc(q)}”.</li>`;
    pInput.setAttribute('aria-activedescendant', list.length ? 'pal-' + list[0].id : '');
  }

  function openPalette() {
    if (!palette || typeof palette.showModal !== 'function' || palette.open) return;
    pInput.value = '';
    renderPalette();
    palette.showModal();
    pInput.focus();
  }

  function choose(id) {
    palette.close();
    navigate(toolUrl(id));
  }

  if (palette) {
    pInput.addEventListener('input', renderPalette);
    pInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(pActive + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(pActive - 1);
      } else if (e.key === 'Enter' && pItems[pActive]) {
        e.preventDefault();
        choose(pItems[pActive].id);
      }
    });
    pList.addEventListener('click', (e) => {
      const li = e.target.closest('[data-id]');
      if (li) choose(li.dataset.id);
    });
    pList.addEventListener('pointermove', (e) => {
      const li = e.target.closest('[data-id]');
      if (li) {
        const idx = pItems.findIndex((t) => t.id === li.dataset.id);
        if (idx !== pActive) setActive(idx);
      }
    });
    // Clique no fundo escurecido fecha
    palette.addEventListener('click', (e) => {
      if (e.target === palette) palette.close();
    });
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
    } else if (e.key === '/' && !typing) {
      e.preventDefault();
      openPalette();
    }
  });

  /* ---------- Início ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    app = document.querySelector('[data-app]');
    if (!app) return;
    render();
    window.addEventListener('popstate', () => render({ transition: true }));
  });
})();
