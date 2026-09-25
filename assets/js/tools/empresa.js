/* Ferramentas para empresas: Simples Nacional (com Fator R), MEI, pró-labore e CLT × PJ. */
(function () {
  'use strict';

  const DC = window.DC;
  const T = DC.tools;
  const br = DC.br;
  const brl = DC.fmt.brl;
  const pct = (v, d) => DC.fmt.pct(v, d == null ? 2 : d);
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const FONTE_SIMPLES = ['Lei Complementar nº 123/2006 (anexos)', 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm'];
  const FONTE_MEI = ['Portal do Empreendedor', 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor'];
  const FONTE_DIVIDENDOS = ['Lei nº 15.270/2025', 'https://www2.camara.leg.br/legin/fed/lei/2025/lei-15270-26-novembro-2025-798354-publicacaooriginal-177117-pl.html'];

  function simplesTable(anexo, faixaAtual) {
    const t = br.SIMPLES[anexo];
    return {
      title: `Anexo ${anexo} do Simples Nacional`,
      columns: [{ label: 'Faixa' }, { label: 'Receita em 12 meses', align: 'right' }, { label: 'Alíquota', align: 'right', format: 'pct' }, { label: 'Parcela a deduzir', align: 'right' }],
      rows: t.map((f, i) => ({
        cells: [`${i + 1}ª`, i ? `${brl(t[i - 1][0] + 0.01)} a ${brl(f[0])}` : `Até ${brl(f[0])}`, f[1], f[2] || '—'],
        highlight: i + 1 === faixaAtual
      })),
      compact: true
    };
  }

  /* ==================== Simples Nacional ==================== */
  const ATIVIDADES = [
    { value: 'I', label: 'Comércio — Anexo I' },
    { value: 'II', label: 'Indústria — Anexo II' },
    { value: 'III', label: 'Serviços — Anexo III' },
    { value: 'IV', label: 'Serviços — Anexo IV (limpeza, vigilância, obras, advocacia)' },
    { value: 'V', label: 'Serviços — Anexo V' },
    { value: 'FR', label: 'Serviços sujeitos ao Fator R (consultoria, TI, engenharia, saúde…)' }
  ];

  T.register({
    id: 'simples-nacional',
    category: 'empresa',
    icon: 'landmark',
    title: 'Simples Nacional e Fator R',
    summary: 'DAS do mês, alíquota efetiva e se o Fator R leva você ao Anexo III.',
    description: 'Calcule o DAS do Simples Nacional pela alíquota efetiva de cada anexo e descubra, pelo Fator R, se sua empresa de serviços paga pelo Anexo III ou pelo Anexo V.',
    keywords: ['das', 'simples', 'aliquota efetiva', 'anexo', 'fator r', 'rbt12', 'imposto', 'me', 'epp', 'faturamento'],
    tags: ['Anexos I a V', 'Fator R'],
    badge: 'Popular',
    related: ['pro-labore', 'clt-pj', 'mei'],
    example: { atividade: 'FR', rbt12: 540000, receita: 48000, folha12: 118000 },
    fields: [
      { id: 'atividade', type: 'select', label: 'Atividade da empresa', default: 'FR', options: ATIVIDADES },
      { id: 'rbt12', type: 'money', label: 'Receita bruta dos últimos 12 meses (RBT12)', hint: 'Faturamento dos 12 meses anteriores ao mês de apuração.' },
      { id: 'receita', type: 'money', label: 'Faturamento do mês' },
      {
        id: 'folha12',
        type: 'money',
        label: 'Folha de salários dos últimos 12 meses',
        hint: 'Salários, pró-labore, 13º, férias, FGTS e INSS patronal.',
        when: (v) => v.atividade === 'FR'
      }
    ],
    compute(v) {
      if (v.rbt12 == null || v.receita == null) return { empty: 'Informe a receita dos últimos 12 meses e o faturamento do mês.' };
      if (v.rbt12 > br.LIMITE_SIMPLES) {
        return { error: `A receita de 12 meses passou do limite do Simples Nacional (${brl(br.LIMITE_SIMPLES)}). A empresa deve migrar para o Lucro Presumido ou Real.`, invalid: ['rbt12'] };
      }
      let anexo = v.atividade;
      let fatorR = null;
      if (anexo === 'FR') {
        if (v.folha12 == null) return { empty: 'Informe a folha dos últimos 12 meses para calcular o Fator R.' };
        fatorR = v.rbt12 > 0 ? v.folha12 / v.rbt12 : 0;
        anexo = fatorR >= 0.28 ? 'III' : 'V';
      }
      const r = br.simples(anexo, v.rbt12, v.receita);
      const alerts = [];

      if (fatorR != null) {
        const outro = br.simples(anexo === 'III' ? 'V' : 'III', v.rbt12, v.receita);
        if (anexo === 'V') {
          const falta = 0.28 * v.rbt12 - v.folha12;
          alerts.push({
            tone: 'warning',
            text: `Seu Fator R é de <strong>${pct(fatorR, 1)}</strong>, abaixo de 28%. Com mais <strong>${brl(falta)}</strong> de folha em 12 meses (aumentando o pró-labore, por exemplo), a empresa iria para o Anexo III e o DAS deste mês cairia para <strong>${brl(outro.das)}</strong> — ${brl(r.das - outro.das)} a menos.`
          });
        } else {
          alerts.push({ tone: 'success', text: `Fator R de <strong>${pct(fatorR, 1)}</strong>: a empresa fica no Anexo III. No Anexo V, o DAS deste mês seria de ${brl(outro.das)}.` });
        }
      }
      if (v.rbt12 > 3600000) {
        alerts.push({ tone: 'info', text: 'Receita acima do sublimite de R$ 3,6 milhões: ICMS e ISS passam a ser recolhidos fora do DAS, pelas regras normais.' });
      }

      return {
        headline: { label: 'DAS estimado do mês', value: r.das, sub: `Anexo ${anexo} · ${r.faixa}ª faixa · alíquota efetiva de ${pct(r.aliqEfetiva)}` },
        alerts,
        stats: [
          { label: 'Alíquota efetiva', value: r.aliqEfetiva, format: 'pct' },
          { label: 'Alíquota nominal', value: r.aliqNominal, format: 'pct' },
          fatorR != null
            ? { label: 'Fator R', value: fatorR, format: 'pct1', tone: fatorR >= 0.28 ? 'success' : 'warning', hint: 'Folha ÷ receita (mínimo de 28%)' }
            : { label: 'Parcela a deduzir', value: r.deduzir }
        ],
        tables: [simplesTable(anexo, r.faixa)],
        notes: [
          `Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12 = (${brl(v.rbt12)} × ${pct(r.aliqNominal)} − ${brl(r.deduzir)}) ÷ ${brl(v.rbt12)}.`,
          'Empresa com menos de 12 meses de atividade: use a média mensal do faturamento × 12 como RBT12.',
          'Estimativa: não considera retenções, substituição tributária, produtos monofásicos nem receitas de exportação.'
        ]
      };
    },
    info: T.info([
      {
        title: 'Como o DAS é calculado',
        icon: 'calculator',
        open: true,
        html: `<p>No Simples Nacional, a alíquota não é fixa: ela depende do anexo da atividade e do faturamento dos últimos 12 meses (RBT12). A fórmula da <strong>alíquota efetiva</strong> é:</p>
          <p class="formula">(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12</p>
          <p>O DAS do mês é o faturamento do mês multiplicado por essa alíquota. Assim, a carga sobe aos poucos, sem saltos entre as faixas.</p>`
      },
      {
        title: 'O que é o Fator R',
        icon: 'percent',
        html: `<p>Para várias atividades de serviço — como consultoria, tecnologia, engenharia, arquitetura, publicidade e medicina — o anexo depende do <strong>Fator R</strong>:</p>
          <p class="formula">Fator R = folha de salários dos últimos 12 meses ÷ RBT12</p>
          <p>Com Fator R de <strong>28% ou mais</strong>, a empresa é tributada pelo Anexo III (a partir de 6%). Abaixo disso, vai para o Anexo V (a partir de 15,5%). Ajustar o pró-labore costuma ser a forma mais simples de chegar aos 28%.</p>`
      },
      {
        title: 'Tabelas de todos os anexos',
        icon: 'landmark',
        html:
          ['I', 'II', 'III', 'IV', 'V']
            .map((a) => {
              const t = br.SIMPLES[a];
              return `<h4>Anexo ${a}</h4>` + T.table(['Faixa', 'Receita em 12 meses', 'Alíquota', 'Deduzir'], t.map((f, i) => [`${i + 1}ª`, `até ${brl(f[0])}`, pct(f[1]), f[2] ? brl(f[2]) : '—']));
            })
            .join('') + T.sources([FONTE_SIMPLES])
      }
    ])
  });

  /* ==================== MEI ==================== */
  const DAS_MEI = {
    comercio: br.MEI.inss + br.MEI.icms,
    servicos: br.MEI.inss + br.MEI.iss,
    ambos: br.MEI.inss + br.MEI.icms + br.MEI.iss
  };

  T.register({
    id: 'mei',
    category: 'empresa',
    icon: 'store',
    title: 'Limite do MEI',
    summary: 'Quanto ainda dá para faturar no ano e o valor do DAS-MEI de 2026.',
    description: 'Acompanhe o limite de faturamento do MEI em 2026, inclusive o proporcional para quem abriu no meio do ano, veja a projeção para dezembro e o que acontece se passar do teto.',
    keywords: ['mei', 'microempreendedor', 'limite', '81 mil', 'das mei', 'desenquadramento', 'faturamento', 'teto'],
    tags: ['Limite de R$ 81 mil', 'DAS 2026'],
    related: ['simples-nacional', 'pro-labore'],
    example: { atividade: 'servicos', abertura: 'antes', faturamento: 58400, mes: '8' },
    fields: [
      {
        id: 'atividade',
        type: 'select',
        label: 'Atividade',
        default: 'servicos',
        options: [
          { value: 'comercio', label: 'Comércio ou indústria' },
          { value: 'servicos', label: 'Prestação de serviços' },
          { value: 'ambos', label: 'Comércio e serviços' }
        ]
      },
      {
        id: 'abertura',
        type: 'select',
        label: 'Abertura do MEI',
        default: 'antes',
        half: true,
        options: [{ value: 'antes', label: `Antes de ${br.ANO}` }].concat(MESES.map((m, i) => ({ value: String(i + 1), label: `${m} de ${br.ANO}` })))
      },
      {
        id: 'mes',
        type: 'select',
        label: 'Faturamento até',
        default: () => String(Math.max(new Date().getMonth(), 1)),
        half: true,
        options: MESES.map((m, i) => ({ value: String(i + 1), label: m }))
      },
      { id: 'faturamento', type: 'money', label: `Faturamento acumulado em ${br.ANO}` }
    ],
    compute(v) {
      if (v.faturamento == null) return { empty: `Informe quanto o MEI faturou em ${br.ANO}.` };
      const inicio = v.abertura === 'antes' ? 1 : Number(v.abertura);
      const mesRef = Number(v.mes);
      if (mesRef < inicio) return { error: 'O mês de referência é anterior à abertura do MEI.', invalid: ['mes'] };
      const mesesAtivos = 12 - inicio + 1;
      const limite = br.MEI.limiteMensal * mesesAtivos;
      const fat = v.faturamento;
      const decorridos = mesRef - inicio + 1;
      const media = fat / decorridos;
      const projecao = media * mesesAtivos;
      const uso = fat / limite;
      const das = DAS_MEI[v.atividade];
      const aliqExcesso = { comercio: 0.04, servicos: 0.06, ambos: 0.05 }[v.atividade];

      const alerts = [];
      let headline;
      let tone = 'primary';
      if (fat <= limite) {
        headline = { label: `Você ainda pode faturar em ${br.ANO}`, value: limite - fat, tone: 'success', sub: `${pct(uso, 1)} do limite de ${brl(limite)} já usado` };
        if (projecao > limite * 1.2) {
          tone = 'warning';
          alerts.push({ tone: 'danger', text: `No ritmo atual (${brl(media)} por mês), o ano fecharia em <strong>${brl(projecao)}</strong>, mais de 20% acima do limite. Vale planejar a migração para microempresa (ME) antes disso.` });
        } else if (projecao > limite) {
          tone = 'warning';
          alerts.push({ tone: 'warning', text: `No ritmo atual (${brl(media)} por mês), o ano fecharia em <strong>${brl(projecao)}</strong>, acima do limite. Até 20% de excesso, você paga um DAS complementar e vira ME em janeiro.` });
        } else {
          alerts.push({ tone: 'success', text: `No ritmo atual, o ano fecha em ${brl(projecao)}: dentro do limite.` });
        }
      } else if (fat <= limite * 1.2) {
        tone = 'warning';
        headline = { label: 'Excesso sobre o limite', value: fat - limite, tone: 'warning', sub: `Até 20% acima de ${brl(limite)}` };
        alerts.push({
          tone: 'warning',
          text: `Com excesso de até 20%, você continua MEI até 31 de dezembro e passa a microempresa em 1º de janeiro de ${br.ANO + 1}. Sobre o excesso, paga um DAS complementar, estimado em <strong>${brl((fat - limite) * aliqExcesso)}</strong>.`
        });
      } else {
        tone = 'danger';
        headline = { label: 'Limite ultrapassado em', value: fat - limite, tone: 'danger', sub: `Mais de 20% acima de ${brl(limite)}` };
        alerts.push({
          tone: 'danger',
          text: `Excesso acima de 20%: o desenquadramento é <strong>retroativo</strong> a janeiro de ${br.ANO} (ou à data de abertura), e os impostos passam a ser calculados como microempresa desde então. Procure um contador o quanto antes.`
        });
      }

      const escala = limite * 1.3;
      const meter = `<div class="meter" role="img" aria-label="${pct(uso, 0)} do limite anual usado">
        <div class="meter-track">
          <span class="meter-zone" style="left:${(100 / 1.3).toFixed(2)}%;width:${(20 / 1.3).toFixed(2)}%"></span>
          <span class="meter-fill tone-${tone}" data-key="mei-uso" data-w="${Math.min((fat / escala) * 100, 100).toFixed(2)}"></span>
          <span class="meter-mark" style="left:${(100 / 1.3).toFixed(2)}%"><em>Limite</em></span>
          <span class="meter-mark" style="left:${(120 / 1.3).toFixed(2)}%"><em>+20%</em></span>
        </div>
        <div class="meter-scale"><span>R$ 0</span><span>${brl(limite)}</span></div>
      </div>`;

      return {
        headline,
        html: meter,
        alerts,
        stats: [
          { label: `Limite em ${br.ANO}`, value: limite, hint: mesesAtivos < 12 ? `${mesesAtivos} meses × ${brl(br.MEI.limiteMensal)}` : 'Ano completo' },
          { label: 'Média mensal', value: media, hint: `${decorridos} ${decorridos === 1 ? 'mês' : 'meses'} de faturamento` },
          { label: 'Projeção para dezembro', value: projecao, tone: projecao > limite ? 'warning' : 'success' },
          { label: `DAS-MEI mensal ${br.ANO}`, value: das, hint: `${brl(das * mesesAtivos)} no ano` }
        ],
        tables: [
          {
            title: `Valor do DAS-MEI em ${br.ANO}`,
            columns: [{ label: 'Atividade' }, { label: 'INSS (5% do mínimo)', align: 'right' }, { label: 'ICMS', align: 'right' }, { label: 'ISS', align: 'right' }, { label: 'Total', align: 'right' }],
            rows: [
              { cells: ['Comércio ou indústria', br.MEI.inss, br.MEI.icms, null, DAS_MEI.comercio], highlight: v.atividade === 'comercio' },
              { cells: ['Serviços', br.MEI.inss, null, br.MEI.iss, DAS_MEI.servicos], highlight: v.atividade === 'servicos' },
              { cells: ['Comércio e serviços', br.MEI.inss, br.MEI.icms, br.MEI.iss, DAS_MEI.ambos], highlight: v.atividade === 'ambos' }
            ],
            compact: true
          }
        ],
        notes: [
          `O limite do MEI é de ${brl(br.MEI.limiteAnual)} por ano, ou ${brl(br.MEI.limiteMensal)} por mês de atividade no ano de abertura.`,
          'O DAS vence todo dia 20. A declaração anual (DASN-SIMEI) deve ser entregue até 31 de maio.'
        ]
      };
    },
    info: T.info([
      {
        title: 'Regras do MEI',
        icon: 'store',
        open: true,
        html: `<ul>
            <li>Faturamento de até <strong>${brl(br.MEI.limiteAnual)} por ano</strong> (proporcional no ano de abertura);</li>
            <li>No máximo <strong>1 empregado</strong>, recebendo um salário mínimo ou o piso da categoria;</li>
            <li>Não pode ter sócio nem participar de outra empresa como sócio ou titular;</li>
            <li>A atividade precisa estar na lista de ocupações permitidas.</li>
          </ul>` + T.sources([FONTE_MEI])
      },
      {
        title: 'Se passar do limite',
        icon: 'alert-triangle',
        html: `<p><strong>Até 20% de excesso:</strong> o MEI continua enquadrado até 31/12, paga um DAS complementar sobre o valor excedente e vira microempresa em 1º de janeiro.</p>
          <p><strong>Mais de 20% de excesso:</strong> o desenquadramento é retroativo a janeiro (ou à abertura), com os impostos recalculados como microempresa do Simples Nacional.</p>`
      }
    ])
  });

  /* ==================== Pró-labore ==================== */
  T.register({
    id: 'pro-labore',
    category: 'empresa',
    icon: 'user-check',
    title: 'Pró-labore',
    summary: 'Pró-labore líquido do sócio, com INSS de 11% e IRRF.',
    description: 'Calcule o pró-labore líquido do sócio com o INSS de 11% e o IRRF de 2026, e quanto ele custa para a empresa conforme o regime tributário.',
    keywords: ['pro labore', 'socio', 'retirada', 'inss 11%', 'contribuinte individual', 'fator r', 'distribuicao de lucros', 'irrf', 'imposto de renda', 'dividendos'],
    tags: ['Tabelas 2026'],
    related: ['simples-nacional', 'clt-pj', 'salario-liquido'],
    example: { valor: 6000, dependentes: 1, regime: 'simples' },
    fields: [
      { id: 'valor', type: 'money', label: 'Valor do pró-labore' },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20, half: true },
      {
        id: 'regime',
        type: 'select',
        label: 'Regime da empresa',
        default: 'simples',
        half: true,
        options: [
          { value: 'simples', label: 'Simples (Anexos I, II, III, V)' },
          { value: 'cpp', label: 'Simples IV, Presumido ou Real' }
        ]
      }
    ],
    compute(v) {
      const p = v.valor;
      if (!p) return { empty: 'Informe o valor do pró-labore.' };
      const baseInss = Math.max(p, br.SALARIO_MINIMO);
      const inss = br.inssContribuinte(baseInss);
      const ir = br.irrf(p, { inss, dependentes: v.dependentes || 0 });
      const liquido = p - inss - ir.valor;
      const cpp = v.regime === 'cpp' ? p * 0.2 : 0;

      return {
        headline: { label: 'Pró-labore líquido', value: liquido, sub: `${pct(liquido / p, 1)} do valor bruto` },
        alerts: p < br.SALARIO_MINIMO ? [{ tone: 'warning', text: `A contribuição ao INSS tem como base mínima o salário mínimo (${brl(br.SALARIO_MINIMO)}).` }] : [],
        stats: [
          { label: 'INSS do sócio (11%)', value: inss, hint: baseInss >= br.TETO_INSS ? 'Limitado ao teto' : '' },
          { label: 'IRRF', value: ir.valor, hint: ir.valor ? '' : 'Isento' },
          { label: 'Custo para a empresa', value: p + cpp, hint: cpp ? `Inclui 20% de INSS patronal (${brl(cpp)})` : 'Sem INSS patronal fora do DAS' }
        ],
        breakdown: {
          title: 'Destino do pró-labore',
          total: p,
          items: [
            { label: 'Líquido para o sócio', value: liquido, tone: 'primary' },
            { label: 'INSS', value: inss, tone: 'primary-2' },
            { label: 'IRRF', value: ir.valor, tone: 'accent' }
          ]
        },
        notes: [
          br.notaIrrf(ir),
          'O pró-labore entra na folha de salários do Fator R: um pró-labore de 28% do faturamento pode levar a empresa do Anexo V para o Anexo III.',
          'A distribuição de lucros continua isenta até R$ 50 mil por mês de uma mesma empresa; acima disso há retenção de 10% (Lei nº 15.270/2025).'
        ]
      };
    },
    info: T.info([
      {
        title: 'Pró-labore × distribuição de lucros',
        icon: 'info',
        open: true,
        html: `<p>O <strong>pró-labore</strong> remunera o trabalho do sócio na empresa: tem INSS de 11% (até o teto) e IRRF pela tabela mensal. A <strong>distribuição de lucros</strong> remunera o capital investido e não tem INSS.</p>
          <p>Desde 2026, lucros acima de R$ 50 mil por mês pagos por uma mesma empresa a uma mesma pessoa sofrem retenção de 10% de IR na fonte sobre o total pago no mês.</p>` + T.sources([FONTE_DIVIDENDOS])
      },
      { title: 'Tabela do IRRF 2026', icon: 'receipt', html: T.refs.irrfTable() + T.refs.reducaoHtml + T.sources([T.refs.FONTE_IRRF]) }
    ])
  });

  /* ==================== CLT × PJ ==================== */
  T.register({
    id: 'clt-pj',
    category: 'empresa',
    icon: 'scale',
    title: 'CLT × PJ',
    summary: 'Compare a renda anual como CLT e como PJ no Simples Nacional.',
    description: 'Compare a renda líquida anual de um emprego CLT (com 13º, férias e FGTS) com a de uma empresa PJ no Simples Nacional, e descubra o faturamento PJ que empata com o CLT.',
    keywords: ['clt', 'pj', 'pessoa juridica', 'comparar', 'proposta', 'contrato', 'simples', 'fator r', 'vale a pena'],
    tags: ['13º, férias e FGTS', 'Fator R'],
    badge: 'Novo',
    related: ['simples-nacional', 'pro-labore', 'custo-funcionario'],
    example: { salario: 9000, beneficios: 900, faturamento: 13000, modelo: 'fatorr', contador: 350, dependentes: 0 },
    fields: [
      { type: 'heading', label: 'Proposta CLT' },
      { id: 'salario', type: 'money', label: 'Salário bruto mensal', half: true },
      { id: 'beneficios', type: 'money', label: 'Benefícios por mês', optional: true, half: true, hint: 'VR, VA, plano de saúde…' },
      { type: 'heading', label: 'Proposta PJ' },
      { id: 'faturamento', type: 'money', label: 'Faturamento mensal', half: true },
      { id: 'contador', type: 'money', label: 'Contador e taxas', optional: true, half: true, hint: 'Custo mensal.' },
      {
        id: 'modelo',
        type: 'select',
        label: 'Tributação da empresa',
        default: 'fatorr',
        options: [
          { value: 'fatorr', label: 'Simples com Fator R — pró-labore de 28% (Anexo III)' },
          { value: 'iii', label: 'Simples Anexo III — pró-labore de 1 salário mínimo' },
          { value: 'v', label: 'Simples Anexo V — pró-labore de 1 salário mínimo' }
        ]
      },
      { id: 'beneficiosPj', type: 'money', label: 'Custos que a PJ vai assumir', optional: true, hint: 'Plano de saúde, previdência, equipamentos…' },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20 }
    ],
    compute(v) {
      const s = v.salario;
      const fat = v.faturamento;
      if (!s || !fat) return { empty: 'Informe o salário CLT e o faturamento como PJ.' };
      const dep = v.dependentes || 0;
      const contador = v.contador || 0;
      const custosPj = v.beneficiosPj || 0;
      const SM = br.SALARIO_MINIMO;

      // CLT: 12 salários líquidos + 13º + terço de férias + FGTS + benefícios
      const liqMensal = br.salarioLiquido(s, { dependentes: dep }).liquido;
      const inss13 = br.inss(s).valor;
      const liq13 = s - inss13 - br.irrf13(s, { inss: inss13, dependentes: dep }).valor;
      const ferias = (s * 4) / 3;
      const inssF = br.inss(ferias).valor;
      const liqTerco = ferias - inssF - br.irrf(ferias, { inss: inssF, dependentes: dep }).valor - liqMensal;
      const fgts = 0.08 * (13 * s + s / 3);
      const clt = { mensal: liqMensal, anual: 12 * liqMensal + liq13 + liqTerco + fgts + 12 * (v.beneficios || 0) };

      const pj = (f) => {
        if (f * 12 > br.LIMITE_SIMPLES) return null;
        const prolabore = v.modelo === 'fatorr' ? Math.max(f * 0.28, SM) : SM;
        const anexo = v.modelo === 'v' ? 'V' : 'III';
        const das = br.simples(anexo, f * 12, f).das;
        const inss = br.inssContribuinte(prolabore);
        const ir = br.irrf(prolabore, { inss, dependentes: dep }).valor;
        const lucro = Math.max(f - das - prolabore - contador, 0);
        // Lucros acima de R$ 50 mil no mês retêm 10% sobre o total (Lei nº 15.270/2025)
        const irLucros = lucro > 50000 ? lucro * 0.1 : 0;
        const mensal = prolabore - inss - ir + lucro - irLucros - custosPj;
        return { prolabore, anexo, das, inss, ir, lucro, irLucros, mensal, anual: mensal * 12 };
      };

      const p = pj(fat);
      if (!p) return { error: `Com esse faturamento, a empresa passaria de ${brl(br.LIMITE_SIMPLES)} por ano, o limite do Simples Nacional.`, invalid: ['faturamento'] };

      // Faturamento PJ que empata com o CLT (busca binária; a renda PJ cresce com o faturamento)
      let lo = 0;
      let hi = br.LIMITE_SIMPLES / 12;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const r = pj(mid);
        if (r && r.anual < clt.anual) lo = mid;
        else hi = mid;
      }
      const empate = hi;
      const diff = p.anual - clt.anual;
      const maior = Math.max(clt.anual, p.anual);

      const compare = `<div class="compare" role="img" aria-label="CLT: ${brl(clt.anual)} por ano; PJ: ${brl(p.anual)} por ano">
        <div class="compare-row"><span class="compare-label">CLT</span>
          <span class="compare-track"><span class="compare-fill tone-primary-2" data-key="clt" data-w="${((clt.anual / maior) * 100).toFixed(2)}"></span></span>
          <strong>${brl(clt.anual)}</strong></div>
        <div class="compare-row"><span class="compare-label">PJ</span>
          <span class="compare-track"><span class="compare-fill tone-primary" data-key="pj" data-w="${((Math.max(p.anual, 0) / maior) * 100).toFixed(2)}"></span></span>
          <strong>${brl(p.anual)}</strong></div>
      </div>`;

      return {
        headline:
          diff >= 0
            ? { label: 'Como PJ, você ganharia a mais por ano', value: diff, tone: 'success', sub: `${pct(diff / clt.anual, 1)} acima do pacote CLT` }
            : { label: 'Como CLT, você ganharia a mais por ano', value: -diff, sub: `O PJ renderia ${pct(-diff / clt.anual, 1)} a menos` },
        html: compare,
        stats: [
          { label: 'Faturamento PJ que empata', value: empate, hint: 'Por mês, para igualar o CLT' },
          { label: 'DAS mensal', value: p.das, hint: `Anexo ${p.anexo} · ${pct(p.das / fat, 1)} do faturamento` },
          { label: 'Pró-labore', value: p.prolabore, hint: v.modelo === 'fatorr' ? '28% do faturamento' : 'Salário mínimo' }
        ],
        tables: [
          {
            title: 'Comparativo mensal',
            columns: [{ label: 'Item' }, { label: 'CLT', align: 'right' }, { label: 'PJ', align: 'right' }],
            rows: [
              ['Salário / faturamento bruto', s, fat],
              ['INSS', { v: -br.inss(s).valor, cls: 'is-neg' }, { v: -p.inss, cls: 'is-neg' }],
              ['IRRF', { v: -br.irrf(s, { inss: br.inss(s).valor, dependentes: dep }).valor, cls: 'is-neg' }, { v: -p.ir, cls: 'is-neg' }],
              ['DAS (Simples Nacional)', null, { v: -p.das, cls: 'is-neg' }],
              contador ? ['Contador e taxas', null, { v: -contador, cls: 'is-neg' }] : null,
              p.irLucros ? ['IR sobre lucros (10%)', null, { v: -p.irLucros, cls: 'is-neg' }] : null,
              custosPj ? ['Custos assumidos pela PJ', null, { v: -custosPj, cls: 'is-neg' }] : null,
              { cells: ['Líquido no mês', clt.mensal, p.mensal], highlight: true },
              ['13º salário líquido (no ano)', liq13, null],
              ['1/3 de férias líquido (no ano)', liqTerco, null],
              ['FGTS depositado (no ano)', fgts, null],
              v.beneficios ? ['Benefícios (no ano)', 12 * v.beneficios, null] : null
            ].filter(Boolean),
            foot: ['Total no ano', clt.anual, p.anual]
          }
        ],
        notes: [
          'Como PJ, não há FGTS, 13º, férias remuneradas, seguro-desemprego nem multa rescisória: considere formar uma reserva própria.',
          'O IR sobre lucros acima de R$ 50 mil por mês é retido na fonte e pode ser ajustado na declaração anual; o imposto mínimo para rendas acima de R$ 600 mil por ano não foi considerado.',
          'Estimativa para prestação de serviços no Simples Nacional, sem ISS fixo municipal, retenções ou outros custos da empresa.'
        ]
      };
    },
    info: T.info([
      {
        title: 'O que entra em cada lado',
        icon: 'scale',
        open: true,
        html: `<p><strong>CLT:</strong> 12 salários líquidos, 13º líquido, o terço de férias, os depósitos de FGTS (8% sobre salários, 13º e férias) e os benefícios.</p>
          <p><strong>PJ:</strong> faturamento menos o DAS do Simples, o INSS e o IR do pró-labore, o contador e os custos que passam a ser seus. O lucro que sobra é distribuído ao sócio sem IR até R$ 50 mil por mês.</p>
          <p>Com o <strong>Fator R</strong>, um pró-labore de 28% do faturamento mantém a empresa no Anexo III, com DAS a partir de 6% — em geral, a opção mais econômica para serviços intelectuais.</p>` + T.sources([FONTE_SIMPLES, FONTE_DIVIDENDOS])
      }
    ])
  });
})();
