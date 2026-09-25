/* Utilitários: validação de CPF/CNPJ (com consulta pública), dias úteis e prazos, valor por extenso. */
(function () {
  'use strict';

  const DC = window.DC;
  const T = DC.tools;
  const br = DC.br;
  const esc = DC.escape;
  const icon = DC.icon;
  const fmt = DC.fmt;

  /* ==================== CPF / CNPJ ==================== */
  const limpar = (raw) => String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

  function formatarDoc(raw) {
    const c = limpar(raw).slice(0, 14);
    if (c.length <= 11 && /^\d*$/.test(c)) {
      let out = c.slice(0, 3);
      if (c.length > 3) out += '.' + c.slice(3, 6);
      if (c.length > 6) out += '.' + c.slice(6, 9);
      if (c.length > 9) out += '-' + c.slice(9, 11);
      return out;
    }
    let out = c.slice(0, 2);
    if (c.length > 2) out += '.' + c.slice(2, 5);
    if (c.length > 5) out += '.' + c.slice(5, 8);
    if (c.length > 8) out += '/' + c.slice(8, 12);
    if (c.length > 12) out += '-' + c.slice(12, 14);
    return out;
  }

  /* O 9º dígito do CPF indica a região fiscal onde ele foi emitido */
  const REGIOES_CPF = ['RS', 'DF, GO, MS, MT e TO', 'AC, AM, AP, PA, RO e RR', 'CE, MA e PI', 'AL, PB, PE e RN', 'BA e SE', 'MG', 'ES e RJ', 'SP', 'PR e SC'];

  const consultas = new Map();

  function renderEmpresa(d) {
    const linha = (rotulo, valor) => (valor ? `<div><dt>${rotulo}</dt><dd>${esc(valor)}</dd></div>` : '');
    const data = d.data_inicio_atividade ? fmt.date(br.parseDate(d.data_inicio_atividade)) : '';
    const endereco = [d.logradouro && `${d.descricao_tipo_de_logradouro || ''} ${d.logradouro}`.trim(), d.numero, d.complemento, d.bairro, d.municipio && `${d.municipio}/${d.uf}`, d.cep]
      .filter(Boolean)
      .join(', ');
    const regime = d.opcao_pelo_mei ? 'MEI' : d.opcao_pelo_simples ? 'Simples Nacional' : d.opcao_pelo_simples === false ? 'Fora do Simples' : '';
    const situacao = String(d.descricao_situacao_cadastral || '');
    const socios = (d.qsa || []).map((s) => `${s.nome_socio}${s.qualificacao_socio ? ` (${s.qualificacao_socio})` : ''}`);
    return `<div class="company">
      <div class="company-head">
        <span class="company-icon">${icon('building')}</span>
        <div><strong>${esc(d.razao_social || '')}</strong>${d.nome_fantasia ? `<small>${esc(d.nome_fantasia)}</small>` : ''}</div>
        ${situacao ? `<span class="status-pill ${situacao.toUpperCase() === 'ATIVA' ? 'is-ok' : 'is-bad'}">${esc(situacao)}</span>` : ''}
      </div>
      <dl class="company-grid">
        ${linha('Abertura', data)}
        ${linha('Porte', d.porte)}
        ${linha('Regime', regime)}
        ${linha('Natureza jurídica', d.natureza_juridica)}
        ${linha('Atividade principal', d.cnae_fiscal ? `${d.cnae_fiscal} — ${d.cnae_fiscal_descricao || ''}` : '')}
        ${linha('Capital social', d.capital_social != null ? fmt.brl(Number(d.capital_social)) : '')}
        ${linha('Endereço', endereco)}
        ${linha('Quadro societário', socios.join('; '))}
      </dl>
      <p class="lookup-note">Fonte: BrasilAPI, com dados públicos da Receita Federal. Pode haver defasagem de alguns dias.</p>
    </div>`;
  }

  T.register({
    id: 'cpf-cnpj',
    category: 'utilidades',
    icon: 'id-card',
    title: 'Validar CPF e CNPJ',
    summary: 'Confere os dígitos verificadores e consulta dados públicos do CNPJ.',
    description: 'Valide CPF e CNPJ — inclusive o novo CNPJ alfanumérico, emitido a partir de julho de 2026 — e consulte os dados públicos de uma empresa na Receita Federal.',
    keywords: ['cpf', 'cnpj', 'validar', 'validador', 'digito verificador', 'consulta cnpj', 'receita', 'alfanumerico', 'empresa'],
    tags: ['CNPJ alfanumérico', 'Consulta pública'],
    badge: 'Novo',
    related: ['simples-nacional', 'mei'],
    example: { doc: '11.222.333/0001-81' },
    fields: [{ id: 'doc', type: 'text', label: 'CPF ou CNPJ', large: true, maxlength: 18, placeholder: '000.000.000-00 ou 00.000.000/0000-00', mask: formatarDoc }],
    compute(v) {
      const c = limpar(v.doc);
      if (!c) return { empty: 'Digite um CPF ou CNPJ para validar.' };
      const numerico = /^\d+$/.test(c);

      if (c.length === 11 && numerico) {
        const r = br.validarCpf(c);
        const repetido = /^(\d)\1{10}$/.test(c);
        return {
          headline: { label: r.valido ? 'CPF válido' : 'CPF inválido', value: formatarDoc(c), format: 'text', tone: r.valido ? 'success' : 'danger' },
          alerts: r.valido ? [] : [{ tone: 'danger', text: repetido ? 'Sequências de números repetidos não formam um CPF válido.' : `Os dígitos verificadores deveriam ser <strong>${r.esperado}</strong>, e não ${c.slice(9)}.` }],
          stats: r.valido
            ? [
                { label: 'Dígitos verificadores', value: c.slice(9) },
                { label: 'Região fiscal de emissão', value: REGIOES_CPF[Number(c[8])] }
              ]
            : null,
          notes: ['A validação confere só a regra matemática do número. Ela não indica se o CPF existe ou está regular na Receita Federal.']
        };
      }

      if (c.length === 14) {
        const r = br.validarCnpj(c);
        const ordem = c.slice(8, 12);
        const res = {
          headline: { label: r.valido ? 'CNPJ válido' : 'CNPJ inválido', value: formatarDoc(c), format: 'text', tone: r.valido ? 'success' : 'danger' },
          alerts: r.valido ? [] : [{ tone: 'danger', text: r.esperado ? `Os dígitos verificadores deveriam ser <strong>${r.esperado}</strong>, e não ${c.slice(12)}.` : 'O formato não corresponde a um CNPJ: 12 letras ou números seguidos de 2 dígitos.' }],
          notes: []
        };
        if (r.valido) {
          res.stats = [
            { label: 'Estabelecimento', value: ordem === '0001' ? 'Matriz' : `Filial ${ordem}` },
            { label: 'Formato', value: r.alfanumerico ? 'Alfanumérico' : 'Numérico' },
            { label: 'Raiz (empresa)', value: formatarDoc(c).slice(0, 10) }
          ];
          if (r.alfanumerico) {
            res.notes.push('CNPJs alfanuméricos começaram a ser emitidos em julho de 2026. No cálculo, cada letra vale o seu código ASCII menos 48 (A = 17, B = 18…).');
          } else {
            res.html = `<div class="lookup" data-lookup="${c}">
              <button type="button" class="btn btn-primary btn-sm" data-lookup-btn>${icon('search')}Consultar dados públicos</button>
              <p class="lookup-note">A consulta envia só o número do CNPJ à BrasilAPI, que usa dados abertos da Receita Federal.</p>
              <div data-lookup-out></div>
            </div>`;
          }
        }
        res.notes.push('A validação confere a regra matemática. Para saber se a empresa existe e está ativa, use a consulta pública.');
        return res;
      }

      return { empty: `Faltam caracteres: ${c.length} de 11 (CPF) ou 14 (CNPJ).` };
    },
    afterRender(box) {
      const area = box.querySelector('[data-lookup]');
      if (!area) return;
      const cnpj = area.dataset.lookup;
      const out = area.querySelector('[data-lookup-out]');
      const btn = area.querySelector('[data-lookup-btn]');
      const mostrar = (html) => {
        out.innerHTML = html;
      };
      if (consultas.has(cnpj)) {
        mostrar(consultas.get(cnpj));
        btn.hidden = true;
        return;
      }
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = `${icon('loader', 'spin')}Consultando…`;
        fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
          .then((r) => {
            if (r.status === 404) throw new Error('404');
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
          })
          .then((d) => {
            const html = renderEmpresa(d);
            consultas.set(cnpj, html);
            if (out.isConnected) {
              mostrar(html);
              btn.hidden = true;
            }
          })
          .catch((err) => {
            btn.disabled = false;
            btn.innerHTML = `${icon('search')}Tentar de novo`;
            mostrar(
              `<div class="alert tone-${err.message === '404' ? 'warning' : 'danger'}">${icon('alert-triangle')}<div>${
                err.message === '404' ? 'CNPJ não encontrado na base da Receita Federal.' : 'Não foi possível consultar agora. Verifique a conexão e tente de novo.'
              }</div></div>`
            );
          });
      });
    },
    info: T.info([
      {
        title: 'Como funciona o dígito verificador',
        icon: 'info',
        open: true,
        html: `<p>Os dois últimos dígitos do CPF e do CNPJ são calculados a partir dos demais, com pesos e o resto da divisão por 11 (módulo 11). Se um número for digitado errado, a conta não fecha.</p>
          <p><strong>CNPJ alfanumérico:</strong> desde julho de 2026, novos CNPJs podem ter letras nas 12 primeiras posições, como <code>12.ABC.345/01DE-35</code>. Os CNPJs existentes não mudam, e os dois dígitos verificadores continuam numéricos.</p>` +
          T.sources([['Receita Federal — CNPJ alfanumérico', 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cnpj/cnpj-alfanumerico']])
      }
    ])
  });

  /* ==================== Dias úteis ==================== */
  const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  T.register({
    id: 'dias-uteis',
    category: 'utilidades',
    icon: 'calendar',
    title: 'Dias úteis e prazos',
    summary: 'Conta dias úteis entre datas ou calcula o vencimento de um prazo.',
    description: 'Conte os dias úteis entre duas datas ou descubra a data final de um prazo em dias úteis, considerando fins de semana e feriados nacionais.',
    keywords: ['dias uteis', 'prazo', 'feriado', 'vencimento', 'calendario', 'data', 'contagem', 'bancario', 'dias corridos'],
    tags: ['Feriados nacionais'],
    related: ['valor-extenso', 'rescisao'],
    example: { modo: 'somar', dias: 15 },
    fields: [
      {
        id: 'modo',
        type: 'segmented',
        label: 'O que você quer calcular?',
        default: 'contar',
        options: [
          { value: 'contar', label: 'Dias úteis entre datas' },
          { value: 'somar', label: 'Data final de um prazo' }
        ]
      },
      { id: 'inicio', type: 'date', label: 'Data inicial', half: true, default: () => T.todayISO() },
      { id: 'fim', type: 'date', label: 'Data final', half: true, when: (v) => v.modo === 'contar' },
      { id: 'dias', type: 'int', label: 'Dias úteis', half: true, default: 10, min: 1, max: 3650, when: (v) => v.modo === 'somar' },
      { id: 'sabado', type: 'toggle', label: 'Sábado conta como dia útil', default: false },
      { id: 'bancario', type: 'toggle', label: 'Calendário bancário', hint: 'Considera Carnaval e Corpus Christi como dias não úteis.', default: true }
    ],
    compute(v) {
      const a = br.parseDate(v.inicio);
      if (!a) return { empty: 'Informe a data inicial.' };
      const util = (d) => {
        const dow = d.getDay();
        if (dow === 0 || (dow === 6 && !v.sabado)) return 'fds';
        const feriado = br.nomeFeriado(d, v.bancario);
        return feriado ? feriado : 'util';
      };
      const tabelaFeriados = (lista) =>
        lista.length
          ? [
              {
                title: 'Feriados no período',
                columns: [{ label: 'Data' }, { label: 'Dia' }, { label: 'Feriado' }],
                rows: lista.map(([d, nome]) => [fmt.date(d), DIAS_SEMANA[d.getDay()], nome]),
                limit: 12,
                compact: true
              }
            ]
          : [];

      if (v.modo === 'somar') {
        const dias = v.dias;
        if (!dias) return { empty: 'Informe o prazo em dias úteis.' };
        let d = a;
        let contados = 0;
        let fds = 0;
        const feriados = [];
        while (contados < dias) {
          d = br.addDays(d, 1);
          const t = util(d);
          if (t === 'util') contados++;
          else if (t === 'fds') fds++;
          else feriados.push([d, t]);
        }
        return {
          headline: { label: 'O prazo termina em', value: fmt.dateLong(d), format: 'text', sub: `${dias} dias úteis após ${fmt.date(a)}` },
          stats: [
            { label: 'Dias corridos', value: br.diffDays(a, d), format: 'int' },
            { label: 'Fins de semana', value: fds, format: 'int' },
            { label: 'Feriados no caminho', value: feriados.length, format: 'int' }
          ],
          tables: tabelaFeriados(feriados),
          notes: ['A contagem começa no dia seguinte à data inicial.', 'Só feriados nacionais: confira feriados estaduais e municipais e regras próprias, como o recesso forense.']
        };
      }

      let b = br.parseDate(v.fim);
      if (!b) return { empty: 'Informe a data final.' };
      let inicio = a;
      let invertido = false;
      if (b < inicio) {
        [inicio, b] = [b, inicio];
        invertido = true;
      }
      if (br.diffDays(inicio, b) > 365 * 30) return { error: 'Use um intervalo de até 30 anos.' };
      let uteis = 0;
      let fds = 0;
      const feriados = [];
      for (let d = br.addDays(inicio, 1); d <= b; d = br.addDays(d, 1)) {
        const t = util(d);
        if (t === 'util') uteis++;
        else if (t === 'fds') fds++;
        else feriados.push([d, t]);
      }
      return {
        headline: { label: 'Dias úteis no período', value: uteis, format: 'int', sub: `De ${fmt.date(inicio)} a ${fmt.date(b)}, sem contar o dia inicial` },
        alerts: invertido ? [{ tone: 'info', text: 'A data final era anterior à inicial; invertemos as duas para contar.' }] : [],
        stats: [
          { label: 'Dias corridos', value: br.diffDays(inicio, b), format: 'int' },
          { label: 'Fins de semana', value: fds, format: 'int' },
          { label: 'Feriados em dias de semana', value: feriados.length, format: 'int' }
        ],
        tables: tabelaFeriados(feriados),
        notes: ['Regra usual de prazos: exclui o dia do começo e inclui o do vencimento.', 'Só feriados nacionais; feriados estaduais e municipais não entram na conta.']
      };
    },
    info: T.info([
      {
        title: 'Feriados nacionais considerados',
        icon: 'calendar',
        open: true,
        html: (() => {
          const ano = new Date().getFullYear();
          const lista = Object.entries(br.feriados(ano, true))
            .map(([k, nome]) => {
              const [y, m, d] = k.split('-').map(Number);
              return [new Date(y, m - 1, d), nome];
            })
            .sort((x, y) => x[0] - y[0]);
          return `<p>Feriados de ${ano} (as datas móveis são calculadas a partir da Páscoa):</p>` + T.table(['Data', 'Dia', 'Feriado'], lista.map(([d, n]) => [fmt.date(d), DIAS_SEMANA[d.getDay()], n]));
        })()
      }
    ])
  });

  /* ==================== Valor por extenso ==================== */
  T.register({
    id: 'valor-extenso',
    category: 'utilidades',
    icon: 'pen-line',
    title: 'Valor por extenso',
    summary: 'Escreve valores em reais por extenso para recibos, contratos e cheques.',
    description: 'Converta valores em reais ou números para a forma por extenso, pronta para copiar em recibos, contratos, cheques e notas promissórias.',
    keywords: ['extenso', 'por extenso', 'escrever numero', 'recibo', 'cheque', 'contrato', 'nota promissoria'],
    related: ['dias-uteis', 'cpf-cnpj'],
    example: { valor: 1234567.89 },
    fields: [
      { id: 'valor', type: 'money', label: 'Valor' },
      {
        id: 'formato',
        type: 'segmented',
        label: 'Formato',
        default: 'moeda',
        half: true,
        options: [
          { value: 'moeda', label: 'Em reais' },
          { value: 'numero', label: 'Só o número' }
        ]
      },
      {
        id: 'caixa',
        type: 'segmented',
        label: 'Letras',
        default: 'frase',
        half: true,
        options: [
          { value: 'frase', label: 'Frase' },
          { value: 'min', label: 'minúsculas' },
          { value: 'mai', label: 'MAIÚSC.' }
        ]
      }
    ],
    compute(v) {
      if (v.valor == null) return { empty: 'Digite um valor para escrever por extenso.' };
      if (v.valor >= 1e15) return { error: 'Use valores abaixo de 1 quatrilhão.', invalid: ['valor'] };
      let texto = br.porExtenso(v.valor, v.formato !== 'numero');
      if (v.caixa === 'mai') texto = texto.toUpperCase();
      else if (v.caixa === 'frase') texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      return {
        html: `<figure class="extenso">
            <span class="extenso-num">${v.formato === 'numero' ? fmt.num(v.valor, 2) : fmt.brl(v.valor)}</span>
            <blockquote class="extenso-text" data-extenso>${esc(texto)}</blockquote>
            <button type="button" class="btn btn-primary btn-sm" data-copy-extenso>${icon('copy')}Copiar texto</button>
          </figure>`,
        notes: ['Em documentos, é comum escrever o valor numérico seguido do extenso entre parênteses.']
      };
    },
    afterRender(box) {
      const btn = box.querySelector('[data-copy-extenso]');
      if (!btn) return;
      btn.addEventListener('click', () => {
        DC.copy(box.querySelector('[data-extenso]').textContent).then(
          () => DC.toast('Texto copiado'),
          () => DC.toast('Não foi possível copiar', 'alert-triangle')
        );
      });
    }
  });
})();
