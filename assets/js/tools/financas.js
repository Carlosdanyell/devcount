/* Ferramentas de finanças: juros compostos, financiamento (SAC × Price), preço de venda e porcentagem. */
(function () {
  'use strict';

  const DC = window.DC;
  const T = DC.tools;
  const brl = DC.fmt.brl;
  const pct = (v, d) => DC.fmt.pct(v, d == null ? 2 : d);
  const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const n2 = (v) => numero.format(v);

  /* Converte a taxa informada para taxa mensal equivalente */
  const taxaMensal = (taxa, periodo) => (periodo === 'mes' ? taxa / 100 : Math.pow(1 + taxa / 100, 1 / 12) - 1);

  /* Reduz uma série longa a no máximo ~120 pontos para o gráfico */
  function amostra(n, max) {
    const step = Math.max(1, Math.ceil(n / (max || 120)));
    const idx = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  }

  const PERIODO = {
    type: 'segmented',
    label: 'Período da taxa',
    default: 'ano',
    half: true,
    options: [
      { value: 'ano', label: 'ao ano' },
      { value: 'mes', label: 'ao mês' }
    ]
  };

  /* ==================== Juros compostos ==================== */
  T.register({
    id: 'juros-compostos',
    category: 'financas',
    icon: 'line-chart',
    title: 'Juros compostos',
    summary: 'Quanto um investimento rende com aportes mensais ao longo do tempo.',
    description: 'Simule o crescimento de um investimento com juros compostos e aportes mensais, veja a evolução no gráfico e quanto do saldo final vem dos juros.',
    keywords: ['investimento', 'rendimento', 'poupanca', 'aporte', 'aplicacao', 'cdi', 'selic', 'tesouro', 'juros sobre juros', 'aposentadoria'],
    tags: ['Gráfico interativo'],
    related: ['financiamento', 'porcentagem'],
    example: { inicial: 5000, aporte: 800, taxa: 11, periodo: 'ano', prazo: 15, unidade: 'anos' },
    fields: [
      { id: 'inicial', type: 'money', label: 'Valor inicial', optional: true, half: true },
      { id: 'aporte', type: 'money', label: 'Aporte mensal', optional: true, half: true },
      { id: 'taxa', type: 'percent', label: 'Taxa de juros', half: true, placeholder: '0,00' },
      Object.assign({ id: 'periodo' }, PERIODO),
      { id: 'prazo', type: 'int', label: 'Prazo', default: 10, min: 1, max: 600, half: true },
      {
        id: 'unidade',
        type: 'segmented',
        label: 'Em',
        default: 'anos',
        half: true,
        options: [
          { value: 'anos', label: 'anos' },
          { value: 'meses', label: 'meses' }
        ]
      }
    ],
    compute(v) {
      const inicial = v.inicial || 0;
      const aporte = v.aporte || 0;
      if (v.taxa == null || (!inicial && !aporte)) return { empty: 'Informe um valor inicial ou um aporte mensal e a taxa de juros.' };
      const prazo = Math.max(1, v.prazo || 1);
      const n = v.unidade === 'meses' ? prazo : prazo * 12;
      if (n > 1200) return { error: 'Use um prazo de até 100 anos.', invalid: ['prazo'] };
      const i = taxaMensal(v.taxa, v.periodo);

      let saldo = inicial;
      let investido = inicial;
      const serieSaldo = [];
      const serieInvestido = [];
      const anos = [];
      let saldoInicioAno = inicial;
      let investidoInicioAno = inicial;
      for (let m = 1; m <= n; m++) {
        saldo = saldo * (1 + i) + aporte;
        investido += aporte;
        serieSaldo.push(saldo);
        serieInvestido.push(investido);
        if (m % 12 === 0 || m === n) {
          anos.push([m % 12 === 0 ? `${m / 12}º ano` : `${m} meses`, investido, saldo - saldoInicioAno - (investido - investidoInicioAno), saldo]);
          saldoInicioAno = saldo;
          investidoInicioAno = investido;
        }
      }
      const juros = saldo - investido;
      const idx = amostra(n);
      const emAnos = n >= 24;
      const equivalente = v.periodo === 'mes' ? `${DC.fmt.num((Math.pow(1 + i, 12) - 1) * 100, 2)}% ao ano` : `${DC.fmt.num(i * 100, 3)}% ao mês`;

      return {
        headline: { label: 'Valor acumulado', value: saldo, sub: `Em ${prazo} ${v.unidade === 'meses' ? 'meses' : prazo === 1 ? 'ano' : 'anos'} · taxa equivalente a ${equivalente}` },
        stats: [
          { label: 'Total investido', value: investido },
          { label: 'Juros ganhos', value: juros, tone: 'success' },
          { label: 'Rendimento sobre o investido', value: investido ? juros / investido : 0, format: 'pct1' }
        ],
        breakdown: {
          title: 'Composição do saldo final',
          total: saldo,
          items: [
            { label: 'Dinheiro investido', value: investido, tone: 'primary-2' },
            { label: 'Juros', value: Math.max(juros, 0), tone: 'success' }
          ]
        },
        chart: {
          label: 'Evolução do saldo e do total investido',
          format: 'brl',
          labels: idx.map((k) => (emAnos ? `${Math.ceil((k + 1) / 12)}a` : `${k + 1}m`)),
          tipLabel: (j) => {
            const m = idx[j] + 1;
            return m % 12 === 0 ? `Fim do ${m / 12}º ano` : `Mês ${m}`;
          },
          series: [
            { name: 'Saldo acumulado', tone: 'primary', area: true, values: idx.map((k) => serieSaldo[k]) },
            { name: 'Total investido', tone: 'muted', dashed: true, values: idx.map((k) => serieInvestido[k]) }
          ]
        },
        tables: [
          {
            title: 'Evolução ano a ano',
            columns: [{ label: 'Período' }, { label: 'Investido', align: 'right' }, { label: 'Juros no período', align: 'right' }, { label: 'Saldo', align: 'right' }],
            rows: anos,
            limit: 10
          }
        ],
        notes: ['Aportes feitos no fim de cada mês.', 'Não considera imposto de renda, taxas, inflação nem variação da taxa ao longo do tempo.']
      };
    },
    info: T.info([
      {
        title: 'Como funcionam os juros compostos',
        icon: 'line-chart',
        open: true,
        html: `<p>Nos juros compostos, os juros de cada mês são somados ao saldo e passam a render juros também. Por isso o crescimento acelera com o tempo — o prazo pesa tanto quanto a taxa.</p>
          <p class="formula">Saldo<sub>mês</sub> = Saldo<sub>anterior</sub> × (1 + taxa mensal) + aporte</p>
          <p>Uma taxa anual é convertida para a mensal equivalente: (1 + taxa anual)<sup>1/12</sup> − 1. Assim, 12% ao ano equivalem a cerca de 0,949% ao mês, e não a 1%.</p>`
      },
      {
        title: 'Imposto de renda em renda fixa',
        icon: 'receipt',
        html:
          `<p>Em CDBs, Tesouro Direto e fundos de renda fixa, o IR incide só sobre o rendimento, com alíquota que cai conforme o prazo (tabela regressiva):</p>` +
          T.table(['Prazo da aplicação', 'Alíquota de IR'], [
            ['Até 180 dias', '22,5%'],
            ['De 181 a 360 dias', '20%'],
            ['De 361 a 720 dias', '17,5%'],
            ['Acima de 720 dias', '15%']
          ]) +
          '<p>Poupança, LCI e LCA são isentas de IR para pessoa física.</p>'
      }
    ])
  });

  /* ==================== Financiamento ==================== */
  function price(pv, i, n) {
    const pmt = i ? (pv * i) / (1 - Math.pow(1 + i, -n)) : pv / n;
    let saldo = pv;
    const rows = [];
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i;
      const amort = pmt - juros;
      saldo = Math.max(saldo - amort, 0);
      rows.push({ parcela: pmt, juros, amort, saldo });
    }
    return rows;
  }

  function sac(pv, i, n) {
    const amort = pv / n;
    let saldo = pv;
    const rows = [];
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i;
      saldo = Math.max(saldo - amort, 0);
      rows.push({ parcela: amort + juros, juros, amort, saldo });
    }
    return rows;
  }

  const somaJuros = (rows) => rows.reduce((s, r) => s + r.juros, 0);

  T.register({
    id: 'financiamento',
    category: 'financas',
    icon: 'house',
    title: 'Financiamento SAC × Price',
    summary: 'Parcelas, juros totais e tabela de amortização nos dois sistemas.',
    description: 'Simule um financiamento imobiliário ou de veículo, compare a Tabela Price com o SAC e veja a evolução das parcelas e do saldo devedor.',
    keywords: ['financiamento', 'emprestimo', 'price', 'sac', 'amortizacao', 'parcela', 'imovel', 'casa', 'carro', 'prestacao'],
    tags: ['Tabela de amortização'],
    related: ['juros-compostos', 'porcentagem'],
    example: { valor: 420000, entrada: 90000, taxa: 11.5, periodo: 'ano', prazo: 360, sistema: 'comparar' },
    fields: [
      { id: 'valor', type: 'money', label: 'Valor do bem', half: true },
      { id: 'entrada', type: 'money', label: 'Entrada', optional: true, half: true },
      { id: 'taxa', type: 'percent', label: 'Taxa de juros', half: true, placeholder: '0,00' },
      Object.assign({ id: 'periodo' }, PERIODO),
      { id: 'prazo', type: 'int', label: 'Prazo em meses', default: 120, min: 1, max: 480 },
      {
        id: 'sistema',
        type: 'segmented',
        label: 'Sistema de amortização',
        default: 'comparar',
        options: [
          { value: 'comparar', label: 'Comparar' },
          { value: 'price', label: 'Price' },
          { value: 'sac', label: 'SAC' }
        ]
      }
    ],
    compute(v) {
      if (!v.valor || v.taxa == null) return { empty: 'Informe o valor do bem, a taxa de juros e o prazo.' };
      const pv = v.valor - (v.entrada || 0);
      if (pv <= 0) return { error: 'A entrada cobre todo o valor do bem: não há o que financiar.', invalid: ['entrada'] };
      const n = Math.min(Math.max(v.prazo || 1, 1), 480);
      const i = taxaMensal(v.taxa, v.periodo);
      const P = price(pv, i, n);
      const S = sac(pv, i, n);
      const jurosP = somaJuros(P);
      const jurosS = somaJuros(S);
      const idx = amostra(n);
      const chart = {
        label: 'Valor das parcelas ao longo do tempo',
        format: 'brl',
        labels: idx.map((k) => (n >= 36 ? `${Math.ceil((k + 1) / 12)}a` : `${k + 1}`)),
        tipLabel: (j) => `Parcela ${idx[j] + 1}`,
        series: []
      };
      const sistema = v.sistema;
      if (sistema !== 'sac') chart.series.push({ name: 'Price', tone: 'accent', values: idx.map((k) => P[k].parcela) });
      if (sistema !== 'price') chart.series.push({ name: 'SAC', tone: 'primary', values: idx.map((k) => S[k].parcela) });

      const tabela = (rows, nome) => ({
        title: `Amortização — ${nome}`,
        columns: [{ label: 'Mês' }, { label: 'Parcela', align: 'right' }, { label: 'Juros', align: 'right' }, { label: 'Amortização', align: 'right' }, { label: 'Saldo devedor', align: 'right' }],
        rows: rows.map((r, k) => [String(k + 1), r.parcela, r.juros, r.amort, r.saldo]),
        foot: ['Total', rows.reduce((s, r) => s + r.parcela, 0), somaJuros(rows), pv, null],
        limit: 12,
        compact: true
      });

      const base = {
        chart,
        notes: [
          'Não inclui seguros obrigatórios (MIP e DFI), taxa de administração nem tarifas: o Custo Efetivo Total (CET) do banco será maior.',
          `Taxa mensal equivalente: ${DC.fmt.num(i * 100, 4)}% ao mês.`
        ]
      };

      if (sistema === 'price') {
        return Object.assign(base, {
          headline: { label: 'Parcela fixa (Price)', value: P[0].parcela, sub: `${n}× · total pago de ${brl(P[0].parcela * n)}` },
          stats: [
            { label: 'Valor financiado', value: pv },
            { label: 'Total de juros', value: jurosP, tone: 'danger' },
            { label: 'Juros sobre o financiado', value: jurosP / pv, format: 'pct1' }
          ],
          tables: [tabela(P, 'Tabela Price')]
        });
      }
      if (sistema === 'sac') {
        return Object.assign(base, {
          headline: { label: 'Primeira parcela (SAC)', value: S[0].parcela, sub: `Caindo até ${brl(S[n - 1].parcela)} na última` },
          stats: [
            { label: 'Valor financiado', value: pv },
            { label: 'Total de juros', value: jurosS, tone: 'danger' },
            { label: 'Amortização mensal', value: pv / n }
          ],
          tables: [tabela(S, 'SAC')]
        });
      }
      return Object.assign(base, {
        headline: { label: 'Economia de juros no SAC', value: jurosP - jurosS, tone: 'success', sub: 'Em relação à Tabela Price, para o mesmo prazo e taxa' },
        stats: [
          { label: 'Price · parcela fixa', value: P[0].parcela, hint: `Juros totais: ${brl(jurosP)}` },
          { label: 'SAC · 1ª parcela', value: S[0].parcela, hint: `Última: ${brl(S[n - 1].parcela)}` },
          { label: 'SAC · juros totais', value: jurosS, tone: 'success' }
        ],
        tables: [
          {
            title: 'Comparativo mês a mês',
            columns: [{ label: 'Mês' }, { label: 'Parcela Price', align: 'right' }, { label: 'Parcela SAC', align: 'right' }, { label: 'Saldo Price', align: 'right' }, { label: 'Saldo SAC', align: 'right' }],
            rows: P.map((r, k) => [String(k + 1), r.parcela, S[k].parcela, r.saldo, S[k].saldo]),
            foot: ['Total pago', P[0].parcela * n, S.reduce((s, r) => s + r.parcela, 0), null, null],
            limit: 12,
            compact: true
          }
        ]
      });
    },
    info: T.info([
      {
        title: 'Price ou SAC?',
        icon: 'scale',
        open: true,
        html: `<p><strong>Tabela Price:</strong> parcelas iguais do começo ao fim. No início, a maior parte da parcela é juro, e o saldo devedor cai devagar.</p>
          <p><strong>SAC (Sistema de Amortização Constante):</strong> a amortização é fixa e os juros caem mês a mês, então a parcela começa mais alta e diminui. O total de juros é menor.</p>
          <p>O SAC costuma ser mais barato no total, mas exige renda maior no início. A Price cabe melhor no orçamento dos primeiros anos.</p>`
      }
    ])
  });

  /* ==================== Preço de venda ==================== */
  T.register({
    id: 'preco-venda',
    category: 'financas',
    icon: 'tag',
    title: 'Preço de venda e markup',
    summary: 'Preço que cobre custos, impostos e despesas e ainda deixa a margem desejada.',
    description: 'Calcule o preço de venda pelo markup divisor, considerando custo, impostos sobre a venda, comissões, despesas fixas e a margem de lucro desejada.',
    keywords: ['preco', 'markup', 'margem', 'lucro', 'precificacao', 'custo', 'venda', 'produto', 'servico', 'comissao'],
    tags: ['Markup divisor'],
    related: ['simples-nacional', 'porcentagem'],
    example: { custo: 42, impostos: 6, comissao: 4.5, despesas: 18, margem: 15, atual: 70 },
    fields: [
      { id: 'custo', type: 'money', label: 'Custo unitário', hint: 'Produto, matéria-prima ou custo direto do serviço.' },
      { id: 'impostos', type: 'percent', label: 'Impostos', half: true, optional: true, hint: 'Sobre a venda, como a alíquota do Simples.' },
      { id: 'comissao', type: 'percent', label: 'Comissões e taxas', half: true, optional: true, hint: 'Vendedor, cartão, marketplace.' },
      { id: 'despesas', type: 'percent', label: 'Despesas fixas', half: true, optional: true, hint: 'Despesas fixas ÷ faturamento.' },
      { id: 'margem', type: 'percent', label: 'Margem de lucro', half: true, hint: 'Desejada, sobre o preço.' },
      { id: 'atual', type: 'money', label: 'Preço praticado hoje', optional: true, hint: 'Para descobrir a sua margem real.' }
    ],
    compute(v) {
      if (!v.custo || v.margem == null) return { empty: 'Informe o custo unitário e a margem de lucro desejada.' };
      const imp = v.impostos || 0;
      const com = v.comissao || 0;
      const desp = v.despesas || 0;
      const soma = imp + com + desp + v.margem;
      if (soma >= 100) {
        return { error: `Impostos, comissões, despesas e margem somam ${n2(soma)}% do preço. A soma precisa ficar abaixo de 100%.`, invalid: ['margem'] };
      }
      const preco = v.custo / (1 - soma / 100);
      const markup = preco / v.custo;
      const lucro = (preco * v.margem) / 100;
      const alerts = [];
      if (v.atual) {
        const margemReal = 1 - v.custo / v.atual - (imp + com + desp) / 100;
        const lucroReal = v.atual * margemReal;
        alerts.push(
          margemReal < 0
            ? { tone: 'danger', text: `Com o preço atual de ${brl(v.atual)}, cada venda dá <strong>prejuízo de ${brl(-lucroReal)}</strong> (margem de ${pct(margemReal, 1)}).` }
            : { tone: margemReal < v.margem / 100 ? 'warning' : 'success', text: `Com o preço atual de ${brl(v.atual)}, a sua margem real é de <strong>${pct(margemReal, 1)}</strong> (${brl(lucroReal)} por unidade).` }
        );
      }

      return {
        headline: { label: 'Preço de venda sugerido', value: preco, sub: `Markup de ${DC.fmt.num(markup, 2)}× sobre o custo` },
        alerts,
        stats: [
          { label: 'Lucro por unidade', value: lucro, tone: 'success' },
          { label: 'Margem sobre o preço', value: v.margem / 100, format: 'pct1' },
          { label: 'Lucro sobre o custo', value: lucro / v.custo, format: 'pct1' }
        ],
        breakdown: {
          title: 'Composição do preço',
          total: preco,
          items: [
            { label: 'Custo', value: v.custo, tone: 'primary-2' },
            { label: 'Impostos', value: (preco * imp) / 100, tone: 'accent' },
            { label: 'Comissões e taxas', value: (preco * com) / 100, tone: 'warning' },
            { label: 'Despesas fixas', value: (preco * desp) / 100, tone: 'muted' },
            { label: 'Lucro', value: lucro, tone: 'success' }
          ]
        },
        notes: [`Preço = custo ÷ (1 − ${n2(soma)}%) = ${brl(v.custo)} ÷ ${n2(1 - soma / 100)}.`, 'Margem é o lucro como parte do preço; markup é quantas vezes o preço é maior que o custo.']
      };
    },
    info: T.info([
      {
        title: 'Por que usar o markup divisor',
        icon: 'tag',
        open: true,
        html: `<p>Impostos, comissões e taxas de cartão incidem sobre o <strong>preço de venda</strong>, não sobre o custo. Por isso somar porcentagens ao custo ("custo + 30%") quase sempre gera uma margem menor do que a pretendida.</p>
          <p>O markup divisor resolve isso: o preço é o custo dividido pela parte que sobra depois de todos os percentuais.</p>
          <p class="formula">Preço = custo ÷ (1 − (impostos + comissões + despesas + margem))</p>`
      }
    ])
  });

  /* ==================== Porcentagem ==================== */
  const MODOS = [
    { value: 'de', label: 'Quanto é X% de um valor' },
    { value: 'quanto', label: 'Um valor é quantos % de outro' },
    { value: 'variacao', label: 'Variação percentual entre dois valores' },
    { value: 'aumento', label: 'Aplicar um aumento de X%' },
    { value: 'desconto', label: 'Aplicar um desconto de X%' }
  ];
  const usaPct = (v) => ['de', 'aumento', 'desconto'].includes(v.modo);

  T.register({
    id: 'porcentagem',
    category: 'financas',
    icon: 'percent',
    title: 'Calculadora de porcentagem',
    summary: 'X% de um valor, variação, aumento e desconto percentual.',
    description: 'Resolva os cálculos de porcentagem do dia a dia: quanto é X% de um valor, quantos por cento um número representa, variação entre dois valores, aumentos e descontos.',
    keywords: ['porcentagem', 'percentual', 'variacao', 'aumento', 'desconto', 'reajuste', 'regra de tres'],
    related: ['preco-venda', 'juros-compostos'],
    example: { modo: 'variacao', inicial: 3850, final: 4312 },
    fields: [
      { id: 'modo', type: 'select', label: 'O que você quer calcular?', default: 'de', options: MODOS },
      { id: 'pct', type: 'percent', label: 'Percentual', half: true, when: usaPct, placeholder: '0' },
      { id: 'valor', type: 'number', label: 'Valor', half: true, when: usaPct, placeholder: '0' },
      { id: 'parte', type: 'number', label: 'Valor da parte', half: true, when: (v) => v.modo === 'quanto', placeholder: '0' },
      { id: 'total', type: 'number', label: 'Valor total', half: true, when: (v) => v.modo === 'quanto', placeholder: '0' },
      { id: 'inicial', type: 'number', label: 'Valor inicial', half: true, when: (v) => v.modo === 'variacao', placeholder: '0' },
      { id: 'final', type: 'number', label: 'Valor final', half: true, when: (v) => v.modo === 'variacao', placeholder: '0' }
    ],
    compute(v) {
      const vazio = { empty: 'Preencha os dois valores.' };
      switch (v.modo) {
        case 'de':
          if (v.pct == null || v.valor == null) return vazio;
          return {
            headline: { label: `${n2(v.pct)}% de ${n2(v.valor)}`, value: n2((v.pct / 100) * v.valor), format: 'text' },
            notes: [`${n2(v.valor)} × ${n2(v.pct)} ÷ 100 = ${n2((v.pct / 100) * v.valor)}`]
          };
        case 'quanto':
          if (v.parte == null || !v.total) return vazio;
          return {
            headline: { label: `${n2(v.parte)} representa de ${n2(v.total)}`, value: `${n2((v.parte / v.total) * 100)}%`, format: 'text' },
            notes: [`${n2(v.parte)} ÷ ${n2(v.total)} × 100 = ${n2((v.parte / v.total) * 100)}%`]
          };
        case 'variacao': {
          if (v.inicial == null || v.final == null) return vazio;
          if (!v.inicial) return { error: 'O valor inicial não pode ser zero.', invalid: ['inicial'] };
          const varPct = ((v.final - v.inicial) / Math.abs(v.inicial)) * 100;
          return {
            headline: {
              label: varPct >= 0 ? 'Aumento de' : 'Redução de',
              value: `${n2(Math.abs(varPct))}%`,
              format: 'text',
              tone: varPct >= 0 ? 'success' : 'danger',
              sub: `De ${n2(v.inicial)} para ${n2(v.final)}: diferença de ${n2(v.final - v.inicial)}`
            },
            notes: [`(${n2(v.final)} − ${n2(v.inicial)}) ÷ ${n2(Math.abs(v.inicial))} × 100 = ${n2(varPct)}%`]
          };
        }
        case 'aumento':
        case 'desconto': {
          if (v.pct == null || v.valor == null) return vazio;
          const sinal = v.modo === 'aumento' ? 1 : -1;
          const resultado = v.valor * (1 + (sinal * v.pct) / 100);
          return {
            headline: {
              label: v.modo === 'aumento' ? `${n2(v.valor)} com aumento de ${n2(v.pct)}%` : `${n2(v.valor)} com desconto de ${n2(v.pct)}%`,
              value: n2(resultado),
              format: 'text',
              sub: `${v.modo === 'aumento' ? 'Acréscimo' : 'Desconto'} de ${n2(Math.abs(resultado - v.valor))}`
            },
            notes: [
              `${n2(v.valor)} × ${n2(1 + (sinal * v.pct) / 100)} = ${n2(resultado)}`,
              v.modo === 'desconto' && v.pct < 100 ? `Para voltar ao valor original, seria preciso um aumento de ${n2((v.pct / (100 - v.pct)) * 100)}% — e não de ${n2(v.pct)}%.` : ''
            ].filter(Boolean)
          };
        }
      }
      return vazio;
    }
  });
})();
