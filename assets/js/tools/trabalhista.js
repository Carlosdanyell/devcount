/* Ferramentas trabalhistas: salário líquido, férias, 13º, rescisão, horas extras e custo do funcionário. */
(function () {
  'use strict';

  const DC = window.DC;
  const T = DC.tools;
  const br = DC.br;
  const brl = DC.fmt.brl;
  const pct = (v, d) => DC.fmt.pct(v, d == null ? 2 : d);

  const FONTE_INSS = ['Portaria Interministerial MPS/MF nº 13/2026', 'https://www.gov.br/previdencia/pt-br/assuntos/rpps/documentos/PortariaInterministerialMPSMF13de9dejaneirode2026.pdf'];
  const FONTE_IRRF = ['Receita Federal — tabelas 2026', 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026'];
  const FONTE_CLT = ['CLT (Decreto-Lei nº 5.452/1943)', 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm'];

  /* ---------- Tabelas de referência compartilhadas ---------- */
  function inssTable() {
    const rows = br.INSS.map((f, i) => {
      const de = i ? br.INSS[i - 1].ate : 0;
      // Parcela a deduzir equivalente ao cálculo progressivo: base anterior × alíquota − INSS acumulado
      const deduzir = i ? de * f.aliq - br.inss(de).valor : 0;
      return [i ? `De ${brl(de + 0.01)} até ${brl(f.ate)}` : `Até ${brl(f.ate)}`, pct(f.aliq, 1), deduzir ? brl(deduzir) : '—'];
    });
    return T.table(['Salário de contribuição', 'Alíquota', 'Parcela a deduzir'], rows, `Teto: ${brl(br.TETO_INSS)} · desconto máximo do empregado: ${brl(br.inss(br.TETO_INSS).valor)}`);
  }

  function irrfTable() {
    const rows = br.IRRF.map((f, i) => {
      const de = i ? br.IRRF[i - 1].ate + 0.01 : 0;
      const faixa = !i ? `Até ${brl(f.ate)}` : f.ate === Infinity ? `Acima de ${brl(br.IRRF[i - 1].ate)}` : `De ${brl(de)} até ${brl(f.ate)}`;
      return [faixa, f.aliq ? pct(f.aliq, 1) : 'Isento', f.deduzir ? brl(f.deduzir) : '—'];
    });
    return T.table(['Base de cálculo mensal', 'Alíquota', 'Parcela a deduzir'], rows, `Dedução por dependente: ${brl(br.DEDUCAO_DEPENDENTE)} · desconto simplificado: ${brl(br.DESCONTO_SIMPLIFICADO)}`);
  }

  const reducaoHtml = `<p>Desde janeiro de 2026, a <strong>Lei nº 15.270/2025</strong> reduz o imposto calculado pela tabela, conforme o rendimento bruto do mês:</p>
    <ul>
      <li>até <strong>R$ 5.000,00</strong>: redução de até R$ 312,89 — na prática, o IR fica zerado;</li>
      <li>de R$ 5.000,01 a <strong>R$ 7.350,00</strong>: redução de R$ 978,62 menos 13,3145% do rendimento;</li>
      <li>acima de R$ 7.350,00: vale só a tabela.</li>
    </ul>`;

  T.refs = { inssTable, irrfTable, reducaoHtml, FONTE_INSS, FONTE_IRRF, FONTE_CLT };

  /* ---------- Datas ---------- */
  function addMonths(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
    // 31/01 + 1 mês cai em 03/03: volta para o último dia de fevereiro
    if (r.getDate() !== d.getDate()) r.setDate(0);
    return r;
  }

  function fullYears(a, b) {
    let y = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
    return Math.max(y, 0);
  }

  function fullMonths(a, b) {
    let m = 0;
    while (addMonths(a, m + 1) <= br.addDays(b, 1)) m++;
    return m;
  }

  /* Avos de 13º: meses do ano da data final com 15 dias ou mais de trabalho */
  function avos13(adm, fim) {
    const ano = fim.getFullYear();
    const janeiro = new Date(ano, 0, 1);
    const inicio = adm > janeiro ? adm : janeiro;
    let n = 0;
    for (let m = inicio.getMonth(); m <= fim.getMonth(); m++) {
      const ini = m === inicio.getMonth() ? inicio : new Date(ano, m, 1);
      const end = m === fim.getMonth() ? fim : new Date(ano, m + 1, 0);
      if (br.diffDays(ini, end) + 1 >= 15) n++;
    }
    return n;
  }

  /* Avos de férias proporcionais: meses do período aquisitivo em curso; fração acima de 14 dias conta como mês (art. 146 da CLT) */
  function avosFerias(adm, fim) {
    let k = 0;
    while (addMonths(adm, 12 * (k + 1)) <= fim) k++;
    const inicio = addMonths(adm, 12 * k);
    let meses = fullMonths(inicio, fim);
    if (meses < 12) {
      const resto = br.diffDays(addMonths(inicio, meses), fim) + 1;
      if (resto >= 15) meses++;
    }
    return Math.min(meses, 12);
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /* ==================== Salário líquido ==================== */
  T.register({
    id: 'salario-liquido',
    category: 'trabalhista',
    icon: 'wallet',
    title: 'Salário líquido',
    summary: 'Quanto sobra do salário bruto depois de INSS, IRRF e outros descontos.',
    description: 'Calcule o salário líquido com as tabelas de INSS e IRRF de 2026, já com a isenção do imposto de renda para quem ganha até R$ 5 mil.',
    keywords: ['holerite', 'contracheque', 'inss', 'irrf', 'imposto de renda', 'desconto', 'clt', 'bruto', 'isencao'],
    tags: ['Tabelas 2026', 'Isenção do IR até R$ 5 mil'],
    badge: '2026',
    related: ['ferias', 'decimo-terceiro', 'custo-funcionario'],
    example: { salario: 6500, dependentes: 1, vt: true, custoVt: 280 },
    fields: [
      { id: 'salario', type: 'money', label: 'Salário bruto mensal', hint: 'Some horas extras, comissões e adicionais do mês.' },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20, half: true },
      { id: 'outros', type: 'money', label: 'Outros descontos', optional: true, half: true },
      { id: 'vt', type: 'toggle', label: 'Descontar vale-transporte', hint: 'Até 6% do salário, limitado ao custo do benefício.', default: false },
      { id: 'custoVt', type: 'money', label: 'Custo mensal do vale-transporte', optional: true, when: (v) => v.vt, hint: 'Sem esse valor, consideramos o desconto máximo de 6%.' }
    ],
    compute(v) {
      const s = v.salario;
      if (!s) return { empty: 'Informe o salário bruto para ver o salário líquido.' };
      const i = br.inss(s);
      const ir = br.irrf(s, { inss: i.valor, dependentes: v.dependentes || 0 });
      const vt = v.vt ? br.r2(v.custoVt ? Math.min(s * 0.06, v.custoVt) : s * 0.06) : 0;
      const outros = v.outros || 0;
      const descontos = i.valor + ir.valor + vt + outros;
      const liquido = s - descontos;

      const alerts = [];
      if (liquido < 0) alerts.push({ tone: 'warning', text: 'Os descontos informados superam o salário bruto.' });
      if (ir.reducao > 0 && ir.valor === 0) {
        alerts.push({ tone: 'success', text: `Isento de IR em 2026: a redução da Lei nº 15.270/2025 zerou os <strong>${brl(ir.impostoTabela)}</strong> que seriam cobrados pela tabela.` });
      } else if (ir.reducao > 0) {
        alerts.push({ tone: 'success', text: `A redução de 2026 diminuiu o seu IR em <strong>${brl(ir.reducao)}</strong> por mês.` });
      }

      return {
        headline: { label: 'Salário líquido', value: liquido, sub: `${pct(Math.max(liquido, 0) / s, 1)} do salário bruto de ${brl(s)}` },
        alerts,
        stats: [
          { label: 'INSS', value: i.valor, hint: `Alíquota efetiva de ${pct(i.valor / s)}` },
          { label: 'IRRF', value: ir.valor, hint: ir.valor ? `Alíquota efetiva de ${pct(ir.valor / s)}` : 'Isento' },
          { label: 'Total de descontos', value: descontos, tone: 'danger' }
        ],
        breakdown: {
          title: 'Para onde vai o seu salário',
          total: s,
          items: [
            { label: 'Salário líquido', value: Math.max(liquido, 0), tone: 'primary' },
            { label: 'INSS', value: i.valor, tone: 'primary-2' },
            { label: 'IRRF', value: ir.valor, tone: 'accent' },
            { label: 'Vale-transporte', value: vt, tone: 'warning' },
            { label: 'Outros descontos', value: outros, tone: 'muted' }
          ]
        },
        tables: [
          {
            title: 'Demonstrativo do mês',
            columns: [{ label: 'Evento' }, { label: 'Referência', align: 'right' }, { label: 'Proventos', align: 'right' }, { label: 'Descontos', align: 'right', tone: 'neg' }],
            rows: [
              ['Salário bruto', '30 dias', s, null],
              ['INSS', pct(i.valor / s), null, i.valor],
              ['IRRF', ir.valor ? pct(ir.valor / s) : 'isento', null, ir.valor],
              vt ? ['Vale-transporte', pct(vt / s), null, vt] : null,
              outros ? ['Outros descontos', '', null, outros] : null
            ].filter(Boolean),
            foot: ['Totais', '', s, { v: descontos, cls: 'is-neg' }]
          },
          {
            title: 'Como o INSS foi calculado',
            columns: [{ label: 'Faixa' }, { label: 'Alíquota', align: 'right', format: 'pct1' }, { label: 'Parte do salário', align: 'right' }, { label: 'Contribuição', align: 'right' }],
            rows: i.faixas.map((f, k) => [`${k + 1}ª faixa`, f.aliq, f.base, f.valor]),
            foot: ['Total', '', Math.min(s, br.TETO_INSS), i.valor],
            compact: true
          }
        ],
        notes: [
          br.notaIrrf(ir),
          i.noTeto ? `Salário acima do teto do INSS (${brl(br.TETO_INSS)}): a contribuição fica limitada a ${brl(i.valor)}.` : '',
          'O INSS é progressivo: cada alíquota incide só sobre a parte do salário dentro da sua faixa.'
        ].filter(Boolean)
      };
    },
    info: T.info([
      {
        title: 'Como o salário líquido é calculado',
        icon: 'calculator',
        open: true,
        html: `<p>O salário líquido é o que sobra do bruto depois dos descontos obrigatórios e opcionais. O salário bruto já inclui acréscimos como horas extras, comissões e adicionais de periculosidade e insalubridade.</p>
          <ol>
            <li><strong>INSS:</strong> calculado de forma progressiva, faixa a faixa, até o teto.</li>
            <li><strong>IRRF:</strong> a base é o salário menos o INSS e ${brl(br.DEDUCAO_DEPENDENTE)} por dependente — ou o desconto simplificado de ${brl(br.DESCONTO_SIMPLIFICADO)}, quando for mais vantajoso.</li>
            <li><strong>Redução de 2026:</strong> o imposto da tabela é reduzido conforme a Lei nº 15.270/2025.</li>
            <li><strong>Outros descontos:</strong> vale-transporte, plano de saúde, consignado e outros autorizados.</li>
          </ol>`
      },
      { title: 'Tabela do INSS 2026', icon: 'landmark', html: inssTable() + T.sources([FONTE_INSS]) },
      { title: 'Tabela do IRRF 2026 e a nova isenção', icon: 'receipt', html: irrfTable() + reducaoHtml + T.sources([FONTE_IRRF]) },
      {
        title: 'Quais descontos são permitidos por lei?',
        icon: 'shield-check',
        html: `<p>Além de INSS e IRRF, o empregador só pode descontar o que a lei, a convenção coletiva ou o próprio empregado autorizar (art. 462 da CLT). Os mais comuns:</p>
          <ul>
            <li><strong>Vale-transporte:</strong> até 6% do salário-base, limitado ao custo do benefício;</li>
            <li><strong>Plano de saúde e odontológico</strong>, na parte que cabe ao empregado;</li>
            <li><strong>Vale-refeição e alimentação</strong>, quando há participação do empregado;</li>
            <li><strong>Empréstimo consignado</strong>, dentro da margem permitida;</li>
            <li><strong>Pensão alimentícia</strong> determinada judicialmente;</li>
            <li><strong>Faltas e atrasos</strong> não justificados e adiantamentos salariais.</li>
          </ul>`
      }
    ])
  });

  /* ==================== Férias ==================== */
  T.register({
    id: 'ferias',
    category: 'trabalhista',
    icon: 'plane',
    title: 'Férias',
    summary: 'Valor das férias com 1/3, abono pecuniário e adiantamento do 13º.',
    description: 'Simule quanto você recebe nas férias: salário dos dias de descanso, terço constitucional, venda de 10 dias e descontos de INSS e IRRF.',
    keywords: ['ferias', 'terco', '1/3', 'abono pecuniario', 'vender ferias', 'descanso', 'clt', 'inss', 'irrf', 'imposto de renda'],
    tags: ['Tabelas 2026'],
    related: ['salario-liquido', 'decimo-terceiro', 'rescisao'],
    example: { salario: 4200, adicionais: 350, dias: 20, abono: true, dependentes: 0 },
    fields: [
      { id: 'salario', type: 'money', label: 'Salário bruto mensal' },
      { id: 'adicionais', type: 'money', label: 'Média de adicionais', optional: true, half: true, hint: 'Horas extras, comissões… dos últimos 12 meses.' },
      { id: 'dias', type: 'int', label: 'Dias de descanso', default: 30, min: 5, max: 30, half: true },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20, half: true },
      { id: 'abono', type: 'toggle', label: 'Vender 10 dias (abono pecuniário)', hint: 'Você descansa 20 dias e recebe 10 em dinheiro, sem INSS e IR.', default: false },
      { id: 'adiantar13', type: 'toggle', label: 'Adiantar a 1ª parcela do 13º', hint: 'Pode ser pedida até janeiro do ano das férias.', default: false }
    ],
    compute(v) {
      const s = v.salario;
      if (!s) return { empty: 'Informe o salário para calcular as férias.' };
      const base = s + (v.adicionais || 0);
      let dias = v.dias == null ? 30 : v.dias;
      const invalid = {};
      const notes = [];
      if (dias < 5 || dias > 30) {
        invalid.dias = 'Informe entre 5 e 30 dias.';
        dias = Math.min(Math.max(dias, 5), 30);
      }
      if (v.abono && dias > 20) {
        dias = 20;
        notes.push('Com a venda de 10 dias, o descanso fica limitado a 20 dias.');
      }

      const ferias = (base / 30) * dias;
      const terco = ferias / 3;
      const abono = v.abono ? (base / 30) * 10 : 0;
      const abonoTerco = abono / 3;
      const tributavel = ferias + terco;
      const i = br.inss(tributavel);
      const ir = br.irrf(tributavel, { inss: i.valor, dependentes: v.dependentes || 0 });
      const adiant = v.adiantar13 ? base / 2 : 0;
      const bruto = tributavel + abono + abonoTerco + adiant;
      const descontos = i.valor + ir.valor;
      const liquido = bruto - descontos;

      notes.push(br.notaIrrf(ir));
      if (abono) notes.push('O abono pecuniário e o seu terço são isentos de INSS e de imposto de renda.');
      if (adiant) notes.push('A 1ª parcela do 13º vem sem descontos; INSS e IR saem da 2ª parcela, em dezembro.');

      return {
        invalid,
        headline: { label: 'Valor líquido das férias', value: liquido, sub: 'Pago até 2 dias antes do início do descanso' },
        stats: [
          { label: 'Férias + 1/3 (bruto)', value: tributavel, hint: plural(dias, 'dia', 'dias') + ' de descanso' },
          abono ? { label: 'Abono + 1/3 (isento)', value: abono + abonoTerco, tone: 'success', hint: '10 dias vendidos' } : null,
          { label: 'INSS + IRRF', value: descontos, tone: 'danger' }
        ].filter(Boolean),
        breakdown: {
          title: 'Composição do valor bruto',
          total: bruto,
          items: [
            { label: 'Férias', value: ferias, tone: 'primary' },
            { label: '1/3 constitucional', value: terco, tone: 'primary-2' },
            { label: 'Abono + 1/3', value: abono + abonoTerco, tone: 'success' },
            { label: 'Adiantamento do 13º', value: adiant, tone: 'violet' }
          ]
        },
        tables: [
          {
            title: 'Recibo de férias',
            columns: [{ label: 'Verba' }, { label: 'Referência', align: 'right' }, { label: 'Proventos', align: 'right' }, { label: 'Descontos', align: 'right', tone: 'neg' }],
            rows: [
              ['Férias', plural(dias, 'dia', 'dias'), ferias, null],
              ['1/3 constitucional', '1/3', terco, null],
              abono ? ['Abono pecuniário', '10 dias', abono, null] : null,
              abono ? ['1/3 sobre o abono', '1/3', abonoTerco, null] : null,
              adiant ? ['Adiantamento do 13º', '50%', adiant, null] : null,
              ['INSS', pct(i.valor / tributavel), null, i.valor],
              ['IRRF', ir.valor ? pct(ir.valor / tributavel) : 'isento', null, ir.valor]
            ].filter(Boolean),
            foot: ['Totais', '', bruto, { v: descontos, cls: 'is-neg' }]
          }
        ],
        notes
      };
    },
    info: T.info([
      {
        title: 'Como as férias são calculadas',
        icon: 'calculator',
        open: true,
        html: `<p>A cada 12 meses de trabalho (período aquisitivo), o empregado tem direito a até 30 dias de férias, pagas com um acréscimo de <strong>1/3</strong> do salário (art. 7º, XVII, da Constituição).</p>
          <ul>
            <li>O valor considera o salário do mês e a <strong>média</strong> de horas extras, comissões e adicionais;</li>
            <li>INSS e IRRF incidem sobre férias + 1/3, em recibo separado do salário;</li>
            <li>O pagamento deve sair <strong>até 2 dias antes</strong> do início do descanso (art. 145 da CLT).</li>
          </ul>`
      },
      {
        title: 'Faltas reduzem os dias de férias',
        icon: 'calendar',
        html:
          `<p>Faltas injustificadas no período aquisitivo reduzem os dias de férias (art. 130 da CLT):</p>` +
          T.table(['Faltas injustificadas', 'Dias de férias'], [
            ['Até 5', '30 dias'],
            ['De 6 a 14', '24 dias'],
            ['De 15 a 23', '18 dias'],
            ['De 24 a 32', '12 dias'],
            ['Mais de 32', 'Perde o direito']
          ])
      },
      {
        title: 'Venda de férias e fracionamento',
        icon: 'info',
        html: `<p><strong>Abono pecuniário:</strong> o empregado pode converter até 1/3 das férias (10 dias) em dinheiro, pedindo até 15 dias antes do fim do período aquisitivo (art. 143 da CLT).</p>
          <p><strong>Fracionamento:</strong> com a concordância do empregado, as férias podem ser divididas em até 3 períodos — um deles com pelo menos 14 dias corridos e os demais com pelo menos 5 dias cada (art. 134, §1º).</p>` + T.sources([FONTE_CLT])
      }
    ])
  });

  /* ==================== 13º salário ==================== */
  T.register({
    id: 'decimo-terceiro',
    category: 'trabalhista',
    icon: 'gift',
    title: '13º salário',
    summary: 'Primeira e segunda parcelas, com INSS e IR sobre o 13º.',
    description: 'Calcule o 13º salário integral ou proporcional, as datas de pagamento das duas parcelas e os descontos de INSS e IRRF (tributação exclusiva).',
    keywords: ['decimo terceiro', '13', 'gratificacao natalina', 'primeira parcela', 'segunda parcela', 'natal', 'inss', 'irrf', 'imposto de renda'],
    tags: ['Tabelas 2026'],
    related: ['salario-liquido', 'ferias', 'rescisao'],
    example: { salario: 5200, meses: 12, dependentes: 1 },
    fields: [
      { id: 'salario', type: 'money', label: 'Salário bruto mensal' },
      { id: 'adicionais', type: 'money', label: 'Média de adicionais', optional: true, half: true, hint: 'Horas extras, comissões…' },
      { id: 'meses', type: 'int', label: 'Meses trabalhados', default: 12, min: 1, max: 12, half: true, hint: 'Mês com 15 dias ou mais conta inteiro.' },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20, half: true },
      { id: 'adiantado', type: 'toggle', label: 'Já recebi a 1ª parcela nas férias', default: false }
    ],
    compute(v) {
      const s = v.salario;
      if (!s) return { empty: 'Informe o salário para calcular o 13º.' };
      const meses = Math.min(Math.max(v.meses == null ? 12 : v.meses, 1), 12);
      const base = s + (v.adicionais || 0);
      const total = (base * meses) / 12;
      const p1 = total / 2;
      const i = br.inss(total);
      const ir = br.irrf13(total, { inss: i.valor, dependentes: v.dependentes || 0 });
      const liquido = total - i.valor - ir.valor;
      const p2 = total - p1 - i.valor - ir.valor;
      const ano = br.ANO;

      return {
        invalid: v.meses != null && (v.meses < 1 || v.meses > 12) ? { meses: 'Informe de 1 a 12 meses.' } : null,
        headline: { label: '13º salário líquido', value: liquido, sub: `${meses}/12 avos de ${brl(base)} · bruto de ${brl(total)}` },
        stats: [
          { label: v.adiantado ? '1ª parcela · já recebida' : `1ª parcela · até 30/11/${ano}`, value: p1, hint: 'Sem descontos' },
          { label: `2ª parcela · até 20/12/${ano}`, value: p2, tone: 'success', hint: 'Já com INSS e IR' },
          { label: 'INSS + IRRF', value: i.valor + ir.valor, tone: 'danger' }
        ],
        breakdown: {
          title: 'Destino do 13º bruto',
          total,
          items: [
            { label: '1ª parcela', value: p1, tone: 'primary' },
            { label: '2ª parcela líquida', value: Math.max(p2, 0), tone: 'primary-2' },
            { label: 'INSS', value: i.valor, tone: 'warning' },
            { label: 'IRRF', value: ir.valor, tone: 'accent' }
          ]
        },
        tables: [
          {
            title: 'Parcelas',
            columns: [{ label: 'Evento' }, { label: 'Referência', align: 'right' }, { label: 'Valor', align: 'right' }],
            rows: [
              ['13º salário bruto', `${meses}/12`, total],
              ['1ª parcela (adiantamento)', v.adiantado ? 'nas férias' : `até 30/11`, { v: -p1, cls: 'is-neg' }],
              ['INSS sobre o 13º', pct(i.valor / total), { v: -i.valor, cls: 'is-neg' }],
              ['IRRF sobre o 13º', ir.valor ? pct(ir.valor / total) : 'isento', { v: -ir.valor, cls: 'is-neg' }]
            ],
            foot: ['2ª parcela a receber', 'até 20/12', p2]
          }
        ],
        notes: [
          `O 13º tem tributação exclusiva: o IR é calculado separado do salário, deduzindo INSS e dependentes (base de ${brl(ir.base)}), sem o desconto simplificado.` +
            (ir.reducao > 0 ? ` A redução de 2026 abateu ${brl(ir.reducao)} do imposto.` : ''),
          'A 1ª parcela não tem descontos; INSS e IR saem inteiros na 2ª parcela.'
        ]
      };
    },
    info: T.info([
      {
        title: 'Quem tem direito e quando é pago',
        icon: 'calendar',
        open: true,
        html: `<p>Todo empregado com carteira assinada, inclusive domésticos, recebe o 13º salário (Lei nº 4.090/1962). O valor é de 1/12 da remuneração de dezembro para cada mês trabalhado — o mês com 15 dias ou mais conta inteiro.</p>
          <ul>
            <li><strong>1ª parcela:</strong> até 30 de novembro, metade do valor, sem descontos (ou junto com as férias, se pedido até janeiro);</li>
            <li><strong>2ª parcela:</strong> até 20 de dezembro, com o desconto de INSS e IR sobre o valor total.</li>
          </ul>`
      },
      { title: 'Tabela do IRRF 2026', icon: 'receipt', html: irrfTable() + reducaoHtml + T.sources([FONTE_IRRF]) },
      { title: 'Tabela do INSS 2026', icon: 'landmark', html: inssTable() + T.sources([FONTE_INSS]) }
    ])
  });

  /* ==================== Rescisão ==================== */
  const TIPOS_RESCISAO = [
    { value: 'sem-justa', label: 'Demissão sem justa causa' },
    { value: 'pedido', label: 'Pedido de demissão' },
    { value: 'acordo', label: 'Acordo entre as partes (art. 484-A)' },
    { value: 'fim-contrato', label: 'Fim do contrato de experiência' },
    { value: 'justa', label: 'Demissão por justa causa' }
  ];

  T.register({
    id: 'rescisao',
    category: 'trabalhista',
    icon: 'log-out',
    title: 'Rescisão trabalhista',
    summary: 'Verbas rescisórias, aviso prévio proporcional e multa do FGTS.',
    description: 'Estime as verbas da rescisão: saldo de salário, aviso prévio proporcional, 13º e férias proporcionais, férias vencidas e multa do FGTS, para cada tipo de desligamento.',
    keywords: ['rescisao', 'demissao', 'acerto', 'verbas rescisorias', 'aviso previo', 'multa fgts', '40%', 'acordo', 'justa causa', 'pedido de demissao'],
    tags: ['Aviso proporcional', 'Multa do FGTS'],
    related: ['ferias', 'decimo-terceiro', 'salario-liquido'],
    example: { tipo: 'sem-justa', salario: 3800, admissao: '2022-03-14', desligamento: '2026-09-18', aviso: 'indenizado', vencidas: '0', dependentes: 0 },
    fields: [
      { id: 'tipo', type: 'select', label: 'Tipo de desligamento', default: 'sem-justa', options: TIPOS_RESCISAO },
      { id: 'salario', type: 'money', label: 'Último salário bruto' },
      { id: 'admissao', type: 'date', label: 'Data de admissão', half: true },
      { id: 'desligamento', type: 'date', label: 'Data de saída', half: true, default: () => T.todayISO(), hint: 'Último dia trabalhado.' },
      {
        id: 'aviso',
        type: 'segmented',
        label: 'Aviso prévio',
        default: 'indenizado',
        options: [
          { value: 'indenizado', label: 'Indenizado' },
          { value: 'trabalhado', label: 'Trabalhado' }
        ],
        when: (v) => v.tipo === 'sem-justa' || v.tipo === 'acordo'
      },
      {
        id: 'avisoEmpregado',
        type: 'select',
        label: 'Aviso prévio',
        default: 'cumprido',
        options: [
          { value: 'cumprido', label: 'Cumprido (trabalhado)' },
          { value: 'descontado', label: 'Não cumprido — será descontado' },
          { value: 'dispensado', label: 'Dispensado pela empresa' }
        ],
        when: (v) => v.tipo === 'pedido'
      },
      {
        id: 'vencidas',
        type: 'select',
        label: 'Férias vencidas',
        default: '0',
        half: true,
        options: [
          { value: '0', label: 'Nenhuma' },
          { value: '1', label: '1 período' },
          { value: '2', label: '2 períodos (1 em dobro)' }
        ],
        hint: 'Períodos completos ainda não tirados.'
      },
      { id: 'dependentes', type: 'int', label: 'Dependentes no IR', default: 0, min: 0, max: 20, half: true },
      {
        id: 'fgts',
        type: 'money',
        label: 'Saldo do FGTS',
        optional: true,
        hint: 'Veja no app FGTS. Sem ele, estimamos pelo tempo de casa.',
        when: (v) => ['sem-justa', 'acordo', 'fim-contrato'].includes(v.tipo)
      }
    ],
    compute(v) {
      const s = v.salario;
      const adm = br.parseDate(v.admissao);
      const sai = br.parseDate(v.desligamento);
      if (!s || !adm || !sai) return { empty: 'Informe o salário e as datas de admissão e saída.' };
      if (sai < adm) return { error: 'A data de saída é anterior à admissão.', invalid: { desligamento: 'Deve ser posterior à admissão.' } };

      const tipo = v.tipo;
      const tipoLabel = TIPOS_RESCISAO.find((t) => t.value === tipo).label;
      const dep = v.dependentes || 0;
      const anos = fullYears(adm, sai);
      const mesesCasa = fullMonths(adm, sai);
      const avisoProporcional = Math.min(30 + 3 * anos, 90);
      const notes = [];

      // Aviso prévio: dias indenizados e projeção do contrato (que conta para 13º e férias)
      let diasAviso = 0;
      let diasIndenizados = 0;
      let projecao = 0;
      let descontoAviso = 0;
      if (tipo === 'sem-justa') {
        diasAviso = avisoProporcional;
        if (v.aviso === 'indenizado') diasIndenizados = projecao = diasAviso;
        else {
          // Aviso trabalhado: 30 dias cumpridos; os dias proporcionais além deles são indenizados
          diasIndenizados = projecao = diasAviso - 30;
          if (diasIndenizados) notes.push(`Aviso trabalhado: os 30 dias são cumpridos e os ${diasIndenizados} dias proporcionais são indenizados.`);
        }
      } else if (tipo === 'acordo') {
        diasAviso = avisoProporcional;
        if (v.aviso === 'indenizado') {
          diasIndenizados = projecao = Math.round(diasAviso / 2);
          notes.push('No acordo, o aviso indenizado é pago pela metade. Há divergência sobre a projeção do contrato; consideramos só os dias pagos.');
        }
      } else if (tipo === 'pedido') {
        diasAviso = 30;
        if (v.avisoEmpregado === 'descontado') descontoAviso = s;
      }
      const fim = br.addDays(sai, projecao);

      // Saldo de salário: dias trabalhados no mês da saída (mês completo vale 30 dias)
      const inicioMes = new Date(sai.getFullYear(), sai.getMonth(), 1);
      const inicioSaldo = adm > inicioMes ? adm : inicioMes;
      const ultimoDia = new Date(sai.getFullYear(), sai.getMonth() + 1, 0).getDate();
      const mesInteiro = inicioSaldo.getDate() === 1 && sai.getDate() === ultimoDia;
      const saldoDias = mesInteiro ? 30 : Math.min(br.diffDays(inicioSaldo, sai) + 1, 30);
      const saldo = (s / 30) * saldoDias;
      const avisoValor = (s / 30) * diasIndenizados;

      const temProporcionais = tipo !== 'justa';
      const n13 = temProporcionais ? avos13(adm, fim) : 0;
      const dec = (s * n13) / 12;
      const nFerias = temProporcionais ? avosFerias(adm, fim) : 0;
      const feriasProp = (s * nFerias) / 12;
      const tercoProp = feriasProp / 3;
      const vencidas = Number(v.vencidas || 0);
      // Dois períodos vencidos: o mais antigo passou do prazo de concessão e é pago em dobro (art. 137)
      const feriasVenc = vencidas === 2 ? s * 3 : vencidas === 1 ? s : 0;
      const tercoVenc = feriasVenc / 3;

      const inssSaldo = br.inss(saldo).valor;
      const irSaldo = br.irrf(saldo, { inss: inssSaldo, dependentes: dep });
      const inss13 = br.inss(dec).valor;
      const ir13 = br.irrf13(dec, { inss: inss13, dependentes: dep });

      const proventos = saldo + avisoValor + dec + feriasProp + tercoProp + feriasVenc + tercoVenc;
      const descontos = inssSaldo + irSaldo.valor + inss13 + ir13.valor + descontoAviso;
      const liquido = proventos - descontos;

      // FGTS: depósito do mês da rescisão + saldo informado (ou estimado) e multa
      const fgtsMes = 0.08 * (saldo + avisoValor + dec);
      const estimado = v.fgts == null;
      const saldoFgts = estimado ? 0.08 * s * (br.diffDays(adm, sai) / 30.4375) * (1 + 1 / 12 + 1 / 36) : v.fgts;
      const baseFgts = saldoFgts + fgtsMes;
      const multaPct = tipo === 'sem-justa' ? 0.4 : tipo === 'acordo' ? 0.2 : 0;
      const multa = baseFgts * multaPct;
      const saquePct = tipo === 'sem-justa' || tipo === 'fim-contrato' ? 1 : tipo === 'acordo' ? 0.8 : 0;
      const saque = baseFgts * saquePct + multa;

      const alerts = [];
      if (liquido < 0) alerts.push({ tone: 'warning', text: 'O desconto do aviso não cumprido supera as verbas a receber.' });
      if (tipo === 'sem-justa') alerts.push({ tone: 'info', text: 'Na demissão sem justa causa, você pode ter direito ao <strong>seguro-desemprego</strong>, conforme o tempo de trabalho.' });

      notes.push('Prazo de pagamento: até 10 dias corridos após o término do contrato (art. 477, §6º, da CLT).');
      notes.push('Estimativa sem médias de horas extras, adicionais, faltas ou regras de convenção coletiva.');

      const ref = (n) => (n ? `${n}/12` : '—');
      return {
        headline: {
          label: 'Total líquido da rescisão',
          value: liquido,
          sub: `${tipoLabel} · ${anos ? plural(anos, 'ano', 'anos') + ' e ' : ''}${plural(mesesCasa - anos * 12, 'mês', 'meses')} de casa`
        },
        alerts,
        stats: [
          { label: 'Aviso prévio', value: diasAviso ? plural(diasAviso, 'dia', 'dias') : '—', hint: diasIndenizados ? `${diasIndenizados} indenizados` : tipo === 'pedido' ? 'A cumprir pelo empregado' : 'Não se aplica' },
          saquePct ? { label: 'FGTS disponível para saque', value: saque, tone: 'success', hint: `${saquePct === 1 ? 'Saldo integral' : '80% do saldo'}${multa ? ' + multa' : ''}` } : { label: 'FGTS', value: 'Sem saque', hint: 'O saldo continua na conta' },
          multaPct ? { label: `Multa de ${pct(multaPct, 0)} do FGTS`, value: multa, hint: estimado ? 'Sobre saldo estimado' : 'Sobre o saldo informado' } : null
        ].filter(Boolean),
        breakdown: {
          title: 'Composição das verbas',
          total: proventos,
          items: [
            { label: 'Saldo de salário', value: saldo, tone: 'primary' },
            { label: 'Aviso prévio indenizado', value: avisoValor, tone: 'teal' },
            { label: '13º proporcional', value: dec, tone: 'violet' },
            { label: 'Férias + 1/3', value: feriasProp + tercoProp + feriasVenc + tercoVenc, tone: 'warning' }
          ]
        },
        tables: [
          {
            title: 'Verbas rescisórias',
            columns: [{ label: 'Verba' }, { label: 'Referência', align: 'right' }, { label: 'Proventos', align: 'right' }, { label: 'Descontos', align: 'right', tone: 'neg' }],
            rows: [
              ['Saldo de salário', plural(saldoDias, 'dia', 'dias'), saldo, null],
              avisoValor ? ['Aviso prévio indenizado', plural(diasIndenizados, 'dia', 'dias'), avisoValor, null] : null,
              temProporcionais ? ['13º salário proporcional', ref(n13), dec, null] : null,
              temProporcionais ? ['Férias proporcionais', ref(nFerias), feriasProp, null] : null,
              temProporcionais ? ['1/3 sobre férias proporcionais', '1/3', tercoProp, null] : null,
              feriasVenc ? ['Férias vencidas', vencidas === 2 ? '1 simples + 1 em dobro' : '1 período', feriasVenc, null] : null,
              feriasVenc ? ['1/3 sobre férias vencidas', '1/3', tercoVenc, null] : null,
              ['INSS sobre saldo de salário', '', null, inssSaldo],
              ['IRRF sobre saldo de salário', '', null, irSaldo.valor],
              dec ? ['INSS sobre 13º', '', null, inss13] : null,
              dec ? ['IRRF sobre 13º', '', null, ir13.valor] : null,
              descontoAviso ? ['Aviso prévio não cumprido', '30 dias', null, descontoAviso] : null
            ].filter(Boolean),
            foot: ['Totais', '', proventos, { v: descontos, cls: 'is-neg' }]
          },
          multaPct || saquePct
            ? {
                title: 'FGTS',
                columns: [{ label: 'Item' }, { label: 'Valor', align: 'right' }],
                rows: [
                  [estimado ? 'Saldo estimado pelo tempo de casa' : 'Saldo informado', saldoFgts],
                  ['Depósito do mês da rescisão (8%)', fgtsMes],
                  multaPct ? [`Multa de ${pct(multaPct, 0)} (paga pela empresa)`, multa] : null,
                  saquePct < 1 ? ['Parte do saldo que fica retida (20%)', { v: -baseFgts * (1 - saquePct), cls: 'is-neg' }] : null
                ].filter(Boolean),
                foot: ['Disponível para saque', saque]
              }
            : null
        ].filter(Boolean),
        notes
      };
    },
    info: T.info([
      {
        title: 'O que cada tipo de rescisão garante',
        icon: 'scale',
        open: true,
        html: T.table(
          ['Verba', 'Sem justa causa', 'Pedido', 'Acordo', 'Justa causa'],
          [
            ['Saldo de salário', 'Sim', 'Sim', 'Sim', 'Sim'],
            ['Aviso prévio', 'Indenizado ou trabalhado', 'Cumpre ou é descontado', 'Metade, se indenizado', 'Não'],
            ['13º proporcional', 'Sim', 'Sim', 'Sim', 'Não'],
            ['Férias proporcionais + 1/3', 'Sim', 'Sim', 'Sim', 'Não'],
            ['Férias vencidas + 1/3', 'Sim', 'Sim', 'Sim', 'Sim'],
            ['Multa do FGTS', '40%', 'Não', '20%', 'Não'],
            ['Saque do FGTS', '100%', 'Não', '80%', 'Não'],
            ['Seguro-desemprego', 'Pode ter', 'Não', 'Não', 'Não']
          ]
        )
      },
      {
        title: 'Aviso prévio proporcional',
        icon: 'calendar',
        html: `<p>O aviso prévio é de 30 dias, mais <strong>3 dias por ano completo</strong> de trabalho, até o máximo de 90 dias (Lei nº 12.506/2011). O acréscimo proporcional vale a favor do empregado: no pedido de demissão, o aviso a cumprir é de 30 dias.</p>
          <p>Quando indenizado, o aviso conta como tempo de serviço e projeta a data de saída, o que pode acrescentar avos de 13º e de férias.</p>`
      },
      {
        title: 'Impostos nas verbas rescisórias',
        icon: 'receipt',
        html: `<ul>
            <li><strong>Saldo de salário:</strong> INSS e IRRF, como um salário normal;</li>
            <li><strong>13º proporcional:</strong> INSS e IRRF calculados em separado (tributação exclusiva);</li>
            <li><strong>Aviso prévio indenizado, férias indenizadas e 1/3:</strong> isentos de INSS e de IR;</li>
            <li><strong>FGTS de 8%</strong> incide sobre saldo de salário, aviso prévio indenizado e 13º.</li>
          </ul>` + T.sources([FONTE_CLT, ['Lei nº 12.506/2011', 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12506.htm']])
      }
    ])
  });

  /* ==================== Horas extras ==================== */
  T.register({
    id: 'horas-extras',
    category: 'trabalhista',
    icon: 'timer',
    title: 'Horas extras e adicional noturno',
    summary: 'Valor das horas extras a 50% e 100%, adicional noturno e reflexo no DSR.',
    description: 'Calcule quanto recebem as horas extras, as horas em domingos e feriados e o adicional noturno, com o reflexo no descanso semanal remunerado.',
    keywords: ['hora extra', 'he', '50%', '100%', 'adicional noturno', 'dsr', 'descanso semanal', 'jornada', 'banco de horas'],
    tags: ['DSR incluso'],
    related: ['salario-liquido', 'custo-funcionario'],
    example: { salario: 3200, jornada: '220', h1: 12, h2: 4, hn: 10 },
    fields: [
      { id: 'salario', type: 'money', label: 'Salário bruto mensal' },
      {
        id: 'jornada',
        type: 'select',
        label: 'Jornada mensal',
        default: '220',
        options: [
          { value: '220', label: '220 horas (44 h por semana)' },
          { value: '200', label: '200 horas (40 h por semana)' },
          { value: '180', label: '180 horas (36 h por semana)' },
          { value: '150', label: '150 horas (30 h por semana)' }
        ]
      },
      { type: 'heading', label: 'Horas no mês' },
      { id: 'h1', type: 'hours', label: 'Horas extras', half: true, placeholder: '0:00', hint: 'Aceita 10:30 ou 10,5.' },
      { id: 'p1', type: 'percent', label: 'Adicional', default: 50, half: true },
      { id: 'h2', type: 'hours', label: 'Domingos e feriados', half: true, placeholder: '0:00' },
      { id: 'p2', type: 'percent', label: 'Adicional', default: 100, half: true },
      { id: 'hn', type: 'hours', label: 'Horas noturnas', half: true, placeholder: '0:00', hint: 'Das 22h às 5h.' },
      { id: 'pn', type: 'percent', label: 'Adicional noturno', default: 20, half: true },
      { id: 'reduzida', type: 'toggle', label: 'Aplicar a hora noturna reduzida', hint: 'Cada hora noturna vale 52min30s (art. 73 da CLT).', default: true },
      { type: 'heading', label: 'Reflexo no descanso semanal' },
      { id: 'dsr', type: 'toggle', label: 'Calcular o reflexo no DSR', default: true },
      { id: 'diasUteis', type: 'int', label: 'Dias úteis no mês', default: 25, min: 1, max: 31, half: true, when: (v) => v.dsr },
      { id: 'domingos', type: 'int', label: 'Domingos e feriados', default: 5, min: 0, max: 15, half: true, when: (v) => v.dsr }
    ],
    compute(v) {
      const s = v.salario;
      if (!s) return { empty: 'Informe o salário e as horas trabalhadas.' };
      if (!v.h1 && !v.h2 && !v.hn) return { empty: 'Informe as horas extras ou noturnas do mês.' };
      const jornada = Number(v.jornada) || 220;
      const hora = s / jornada;
      const p1 = v.p1 == null ? 50 : v.p1;
      const p2 = v.p2 == null ? 100 : v.p2;
      const pn = v.pn == null ? 20 : v.pn;
      const vh1 = hora * (1 + p1 / 100);
      const vh2 = hora * (1 + p2 / 100);
      const he1 = (v.h1 || 0) * vh1;
      const he2 = (v.h2 || 0) * vh2;
      const hnEquivalentes = (v.hn || 0) * (v.reduzida ? 60 / 52.5 : 1);
      const noturno = hnEquivalentes * hora * (pn / 100);
      const soma = he1 + he2 + noturno;
      const dsr = v.dsr && v.diasUteis > 0 ? (soma / v.diasUteis) * (v.domingos || 0) : 0;
      const total = soma + dsr;
      const hhmm = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

      return {
        headline: { label: 'Total a receber no mês', value: total, sub: `Somado ao salário de ${brl(s)}: ${brl(s + total)} brutos` },
        stats: [
          { label: 'Hora normal', value: hora, hint: `${brl(s)} ÷ ${jornada} h` },
          { label: `Hora extra a ${p1}%`, value: vh1 },
          { label: `Hora a ${p2}%`, value: vh2 },
          { label: 'Reflexo no DSR', value: dsr, hint: v.dsr ? `${v.domingos || 0} dom./feriados ÷ ${v.diasUteis} dias úteis` : 'Não calculado' }
        ],
        breakdown: {
          title: 'Composição',
          items: [
            { label: `Horas extras a ${p1}%`, value: he1, tone: 'primary' },
            { label: `Horas a ${p2}%`, value: he2, tone: 'primary-2' },
            { label: 'Adicional noturno', value: noturno, tone: 'violet' },
            { label: 'Reflexo no DSR', value: dsr, tone: 'teal' }
          ]
        },
        tables: [
          {
            title: 'Memória de cálculo',
            columns: [{ label: 'Item' }, { label: 'Quantidade', align: 'right' }, { label: 'Valor unitário', align: 'right' }, { label: 'Total', align: 'right' }],
            rows: [
              v.h1 ? [`Horas extras (${p1}%)`, hhmm(v.h1), vh1, he1] : null,
              v.h2 ? [`Domingos e feriados (${p2}%)`, hhmm(v.h2), vh2, he2] : null,
              v.hn ? [`Adicional noturno (${pn}%)`, v.reduzida ? `${hhmm(v.hn)} → ${fmtNum(hnEquivalentes)} h` : hhmm(v.hn), hora * (pn / 100), noturno] : null,
              dsr ? ['Reflexo no DSR', '', null, dsr] : null
            ].filter(Boolean),
            foot: ['Total', '', null, total]
          }
        ],
        notes: [
          'Horas extras, adicional noturno e DSR entram na base de INSS, IRRF e FGTS e nas médias de férias e 13º.',
          'O limite legal é de 2 horas extras por dia (art. 59 da CLT). Convenções coletivas podem prever adicionais maiores.'
        ]
      };
    },
    info: T.info([
      {
        title: 'Como calculamos',
        icon: 'calculator',
        open: true,
        html: `<ol>
            <li><strong>Hora normal</strong> = salário ÷ jornada mensal (220 h para 44 h semanais);</li>
            <li><strong>Hora extra</strong> = hora normal × (1 + adicional). O mínimo constitucional é de 50%; domingos e feriados não compensados costumam ser pagos a 100%;</li>
            <li><strong>Adicional noturno</strong> = 20% sobre a hora normal, das 22h às 5h (trabalhador urbano). A hora noturna tem 52min30s, então 7 horas de relógio valem 8 horas;</li>
            <li><strong>DSR</strong> = (total de extras ÷ dias úteis) × domingos e feriados do mês.</li>
          </ol>`
      }
    ])
  });

  function fmtNum(v) {
    return DC.fmt.num(v, 2);
  }

  /* ==================== Custo do funcionário ==================== */
  T.register({
    id: 'custo-funcionario',
    category: 'trabalhista',
    icon: 'building',
    title: 'Custo do funcionário',
    summary: 'Quanto um empregado custa de verdade: encargos, provisões e benefícios.',
    description: 'Descubra o custo mensal e anual de um funcionário CLT para a empresa, com INSS patronal, FGTS, provisões de 13º e férias e benefícios, conforme o regime tributário.',
    keywords: ['custo', 'encargos', 'folha', 'contratar', 'empregado', 'inss patronal', 'fgts', 'provisao', 'rat', 'terceiros'],
    tags: ['Por regime tributário'],
    related: ['salario-liquido', 'clt-pj', 'simples-nacional'],
    example: { salario: 3500, regime: 'presumido', vt: 220, vr: 600, saude: 280 },
    fields: [
      { id: 'salario', type: 'money', label: 'Salário bruto' },
      {
        id: 'regime',
        type: 'select',
        label: 'Regime tributário da empresa',
        default: 'simples',
        options: [
          { value: 'simples', label: 'Simples Nacional (Anexos I, II, III ou V)' },
          { value: 'simples-iv', label: 'Simples Nacional — Anexo IV' },
          { value: 'presumido', label: 'Lucro Presumido ou Lucro Real' }
        ]
      },
      { id: 'rat', type: 'percent', label: 'RAT × FAP', default: 2, half: true, when: (v) => v.regime !== 'simples', hint: 'Entre 0,5% e 6%.' },
      { id: 'terceiros', type: 'percent', label: 'Terceiros (Sistema S)', default: 5.8, half: true, when: (v) => v.regime === 'presumido' },
      { type: 'heading', label: 'Benefícios mensais' },
      { id: 'vt', type: 'money', label: 'Vale-transporte', optional: true, half: true, hint: 'A empresa paga o que passar de 6% do salário.' },
      { id: 'vr', type: 'money', label: 'VR e VA', optional: true, half: true, hint: 'Vale-refeição e alimentação.' },
      { id: 'saude', type: 'money', label: 'Plano de saúde', optional: true, half: true },
      { id: 'outrosBen', type: 'money', label: 'Outros benefícios', optional: true, half: true },
      { id: 'provisaoMulta', type: 'toggle', label: 'Provisionar a multa de 40% do FGTS', hint: 'Reserva para uma eventual demissão sem justa causa.', default: true }
    ],
    compute(v) {
      const s = v.salario;
      if (!s) return { empty: 'Informe o salário para calcular o custo.' };
      const cpp = v.regime !== 'simples';
      const aInss = cpp ? 0.2 : 0;
      const aRat = cpp ? (v.rat == null ? 2 : v.rat) / 100 : 0;
      const aTerc = v.regime === 'presumido' ? (v.terceiros == null ? 5.8 : v.terceiros) / 100 : 0;
      const aFgts = 0.08;
      const aTotal = aInss + aRat + aTerc + aFgts;

      const prov13 = s / 12;
      const provFerias = (s / 12) * (4 / 3);
      const encSalario = s * aTotal;
      const encProv = (prov13 + provFerias) * aTotal;
      const multa = v.provisaoMulta ? 0.4 * aFgts * (s + prov13 + provFerias) : 0;
      const vtEmpresa = Math.max((v.vt || 0) - s * 0.06, 0);
      const beneficios = vtEmpresa + (v.vr || 0) + (v.saude || 0) + (v.outrosBen || 0);
      const total = s + encSalario + prov13 + provFerias + encProv + multa + beneficios;
      const pctS = (x) => pct(x / s, 1);

      return {
        headline: { label: 'Custo mensal para a empresa', value: total, sub: `${DC.fmt.num(total / s, 2)}× o salário · ${brl(total * 12)} por ano` },
        stats: [
          { label: 'Encargos sobre a folha', value: encSalario + encProv, hint: `${pct(aTotal, 1)} sobre salário e provisões` },
          { label: '13º e férias (provisão)', value: prov13 + provFerias, hint: 'Reserva mensal' },
          { label: 'Benefícios', value: beneficios, hint: vtEmpresa ? `VT: ${brl(vtEmpresa)} pela empresa` : '' }
        ],
        breakdown: {
          title: 'Composição do custo',
          total,
          items: [
            { label: 'Salário', value: s, tone: 'primary' },
            { label: 'Encargos', value: encSalario + encProv, tone: 'accent' },
            { label: '13º e férias', value: prov13 + provFerias, tone: 'primary-2' },
            { label: 'Benefícios', value: beneficios, tone: 'success' },
            { label: 'Provisão da multa do FGTS', value: multa, tone: 'muted' }
          ]
        },
        tables: [
          {
            title: 'Detalhamento mensal',
            columns: [{ label: 'Item' }, { label: '% do salário', align: 'right' }, { label: 'Valor', align: 'right' }],
            rows: [
              ['Salário', '100%', s],
              cpp ? ['INSS patronal (20%)', pctS(s * aInss), s * aInss] : null,
              cpp ? ['RAT × FAP', pctS(s * aRat), s * aRat] : null,
              aTerc ? ['Terceiros (Sistema S)', pctS(s * aTerc), s * aTerc] : null,
              ['FGTS (8%)', pctS(s * aFgts), s * aFgts],
              ['Provisão de 13º (1/12)', pctS(prov13), prov13],
              ['Provisão de férias + 1/3', pctS(provFerias), provFerias],
              ['Encargos sobre 13º e férias', pctS(encProv), encProv],
              multa ? ['Provisão da multa do FGTS', pctS(multa), multa] : null,
              vtEmpresa ? ['Vale-transporte (parte da empresa)', pctS(vtEmpresa), vtEmpresa] : null,
              v.vr ? ['Vale-refeição/alimentação', pctS(v.vr), v.vr] : null,
              v.saude ? ['Plano de saúde', pctS(v.saude), v.saude] : null,
              v.outrosBen ? ['Outros benefícios', pctS(v.outrosBen), v.outrosBen] : null
            ].filter(Boolean),
            foot: ['Custo total', pctS(total), total]
          }
        ],
        notes: [
          cpp ? '' : 'No Simples Nacional (exceto Anexo IV), a contribuição patronal ao INSS já está dentro do DAS — ela não some, apenas aparece na guia do Simples.',
          'Provisões são reservas mensais para pagar 13º, férias e rescisão quando chegarem; não são desembolso imediato.'
        ].filter(Boolean)
      };
    },
    info: T.info([
      {
        title: 'Encargos por regime tributário',
        icon: 'landmark',
        open: true,
        html: T.table(
          ['Encargo', 'Simples (I, II, III, V)', 'Simples Anexo IV', 'Presumido / Real'],
          [
            ['INSS patronal', 'No DAS', '20%', '20%'],
            ['RAT × FAP', 'No DAS', '0,5% a 6%', '0,5% a 6%'],
            ['Terceiros (Sistema S)', 'Isento', 'Isento', 'Cerca de 5,8%'],
            ['FGTS', '8%', '8%', '8%']
          ]
        )
      }
    ])
  });
})();
