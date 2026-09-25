/* Tabelas e regras de 2026 usadas pela página inicial e pelas ferramentas.
 * Fica separado das telas para que uma mudança de tabela seja feita num lugar só. */
(function () {
  'use strict';

  var DC = (window.DC = window.DC || {});

  /* Arredonda a centavos; o toFixed evita que 121,575 vire 121,57 por imprecisão do ponto flutuante */
  function r2(v) {
    return Math.round(Number((v * 100).toFixed(6))) / 100;
  }

  var ANO = 2026;
  var SALARIO_MINIMO = 1621;

  /* INSS do empregado — Portaria Interministerial MPS/MF nº 13, de 9/1/2026 */
  var INSS = [
    { ate: 1621.0, aliq: 0.075 },
    { ate: 2902.84, aliq: 0.09 },
    { ate: 4354.27, aliq: 0.12 },
    { ate: 8475.55, aliq: 0.14 }
  ];
  var TETO_INSS = 8475.55;

  /* IRRF mensal — tabela em vigor desde maio/2025 (Lei nº 15.191/2025) */
  var IRRF = [
    { ate: 2428.8, aliq: 0, deduzir: 0 },
    { ate: 2826.65, aliq: 0.075, deduzir: 182.16 },
    { ate: 3751.05, aliq: 0.15, deduzir: 394.16 },
    { ate: 4664.68, aliq: 0.225, deduzir: 675.49 },
    { ate: Infinity, aliq: 0.275, deduzir: 908.73 }
  ];
  var DEDUCAO_DEPENDENTE = 189.59;
  var DESCONTO_SIMPLIFICADO = 607.2;

  /* O INSS é progressivo: cada alíquota incide só sobre a parte do salário dentro da sua faixa, até o teto. */
  function inss(salario) {
    var total = 0;
    var anterior = 0;
    var faixas = [];
    for (var i = 0; i < INSS.length; i++) {
      var f = INSS[i];
      if (salario <= anterior) break;
      var base = Math.min(salario, f.ate) - anterior;
      var valor = base * f.aliq;
      faixas.push({ de: anterior, ate: f.ate, aliq: f.aliq, base: base, valor: valor });
      total += valor;
      anterior = f.ate;
    }
    return { valor: r2(total), faixas: faixas, noTeto: salario >= TETO_INSS };
  }

  /* Sócio e autônomo (contribuinte individual): 11% até o teto */
  function inssContribuinte(valor) {
    return r2(Math.min(valor, TETO_INSS) * 0.11);
  }

  /* Redução da Lei nº 15.270/2025: até R$ 312,89 para quem recebe até R$ 5 mil
   * (o que zera o imposto) e decrescente até R$ 7.350. Nunca maior que o próprio imposto. */
  function reducao2026(rendimento, imposto) {
    var red = 0;
    if (rendimento <= 5000) red = 312.89;
    else if (rendimento <= 7350) red = Math.max(978.62 - 0.133145 * rendimento, 0);
    return Math.min(red, imposto);
  }

  /* IRRF mensal: a fonte pagadora usa a maior dedução entre (INSS + dependentes) e o desconto simplificado. */
  function irrf(rendimento, opts) {
    opts = opts || {};
    var legais = (opts.inss || 0) + (opts.dependentes || 0) * DEDUCAO_DEPENDENTE;
    var podeSimplificado = opts.simplificado !== false;
    var usaSimplificado = podeSimplificado && DESCONTO_SIMPLIFICADO > legais;
    var deducao = usaSimplificado ? DESCONTO_SIMPLIFICADO : legais;
    var base = Math.max(rendimento - deducao, 0);
    var faixa = IRRF.find(function (f) {
      return base <= f.ate;
    });
    var impostoTabela = Math.max(base * faixa.aliq - faixa.deduzir, 0);
    var reducao = reducao2026(rendimento, impostoTabela);
    return {
      valor: r2(impostoTabela - reducao),
      base: r2(base),
      deducao: r2(deducao),
      usaSimplificado: usaSimplificado,
      impostoTabela: r2(impostoTabela),
      reducao: r2(reducao),
      aliqNominal: faixa.aliq
    };
  }

  /* 13º salário: tributação exclusiva, sem desconto simplificado; a redução de 2026 vale sobre o valor bruto. */
  function irrf13(valor, opts) {
    return irrf(valor, { inss: opts && opts.inss, dependentes: opts && opts.dependentes, simplificado: false });
  }

  /* Texto que explica como o IRRF foi apurado */
  function notaIrrf(ir) {
    var f = DC.fmt.brl;
    var nota =
      'Base do IRRF: ' +
      f(ir.base) +
      (ir.usaSimplificado
        ? ', usando o desconto simplificado de ' + f(ir.deducao) + ', mais vantajoso que INSS e dependentes.'
        : ', deduzindo INSS e dependentes (' + f(ir.deducao) + ').');
    if (ir.reducao > 0) {
      nota += ' Imposto pela tabela: ' + f(ir.impostoTabela) + ', menos a redução de 2026 (Lei nº 15.270/2025) de ' + f(ir.reducao) + '.';
    }
    return nota;
  }

  /* Salário líquido mensal completo — usado na página inicial e na ferramenta */
  function salarioLiquido(salario, opts) {
    opts = opts || {};
    var i = inss(salario);
    var ir = irrf(salario, { inss: i.valor, dependentes: opts.dependentes || 0 });
    var outros = opts.outros || 0;
    return {
      bruto: salario,
      inss: i,
      irrf: ir,
      outros: outros,
      liquido: r2(salario - i.valor - ir.valor - outros)
    };
  }

  /* ---------- Simples Nacional — LC 123/2006, anexos com a redação da LC 155/2016 ---------- */
  var SIMPLES = {
    I: [
      [180000, 0.04, 0],
      [360000, 0.073, 5940],
      [720000, 0.095, 13860],
      [1800000, 0.107, 22500],
      [3600000, 0.143, 87300],
      [4800000, 0.19, 378000]
    ],
    II: [
      [180000, 0.045, 0],
      [360000, 0.078, 5940],
      [720000, 0.1, 13860],
      [1800000, 0.112, 22500],
      [3600000, 0.147, 85500],
      [4800000, 0.3, 720000]
    ],
    III: [
      [180000, 0.06, 0],
      [360000, 0.112, 9360],
      [720000, 0.135, 17640],
      [1800000, 0.16, 35640],
      [3600000, 0.21, 125640],
      [4800000, 0.33, 648000]
    ],
    IV: [
      [180000, 0.045, 0],
      [360000, 0.09, 8100],
      [720000, 0.102, 12420],
      [1800000, 0.14, 39780],
      [3600000, 0.22, 183780],
      [4800000, 0.33, 828000]
    ],
    V: [
      [180000, 0.155, 0],
      [360000, 0.18, 4500],
      [720000, 0.195, 9900],
      [1800000, 0.205, 17100],
      [3600000, 0.23, 62100],
      [4800000, 0.305, 540000]
    ]
  };
  var LIMITE_SIMPLES = 4800000;

  function simples(anexo, rbt12, receitaMes) {
    var tabela = SIMPLES[anexo];
    var idx = tabela.findIndex(function (f) {
      return rbt12 <= f[0];
    });
    if (idx === -1) return null;
    var faixa = tabela[idx];
    // Sem faturamento anterior (início de atividade), vale a alíquota nominal da 1ª faixa
    var efetiva = rbt12 > 0 ? (rbt12 * faixa[1] - faixa[2]) / rbt12 : faixa[1];
    return {
      anexo: anexo,
      faixa: idx + 1,
      aliqNominal: faixa[1],
      deduzir: faixa[2],
      aliqEfetiva: efetiva,
      das: r2((receitaMes || 0) * efetiva)
    };
  }

  /* ---------- MEI 2026 ---------- */
  var MEI = {
    limiteAnual: 81000,
    limiteMensal: 6750,
    inss: r2(SALARIO_MINIMO * 0.05),
    icms: 1,
    iss: 5
  };

  /* ---------- Datas e feriados nacionais ---------- */
  function parseDate(str) {
    if (!str) return null;
    var p = String(str).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d) ? null : d;
  }

  function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    return d;
  }

  function diffDays(a, b) {
    // Usa UTC para não perder/ganhar um dia na mudança de horário de verão
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  }

  function key(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) */
  function pascoa(ano) {
    var a = ano % 19;
    var b = Math.floor(ano / 100);
    var c = ano % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31);
    var dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }

  var feriadoCache = {};
  function feriados(ano, bancario) {
    var cacheKey = ano + (bancario ? 'b' : '');
    if (feriadoCache[cacheKey]) return feriadoCache[cacheKey];
    var p = pascoa(ano);
    var lista = [
      [new Date(ano, 0, 1), 'Confraternização Universal'],
      [addDays(p, -2), 'Sexta-feira Santa'],
      [new Date(ano, 3, 21), 'Tiradentes'],
      [new Date(ano, 4, 1), 'Dia do Trabalho'],
      [new Date(ano, 8, 7), 'Independência do Brasil'],
      [new Date(ano, 9, 12), 'Nossa Senhora Aparecida'],
      [new Date(ano, 10, 2), 'Finados'],
      [new Date(ano, 10, 15), 'Proclamação da República'],
      [new Date(ano, 11, 25), 'Natal']
    ];
    // Dia da Consciência Negra é feriado nacional desde 2024 (Lei nº 14.759/2023)
    if (ano >= 2024) lista.push([new Date(ano, 10, 20), 'Dia Nacional de Zumbi e da Consciência Negra']);
    if (bancario) {
      lista.push([addDays(p, -48), 'Carnaval (segunda-feira)']);
      lista.push([addDays(p, -47), 'Carnaval (terça-feira)']);
      lista.push([addDays(p, 60), 'Corpus Christi']);
    }
    var mapa = {};
    lista.forEach(function (item) {
      mapa[key(item[0])] = item[1];
    });
    feriadoCache[cacheKey] = mapa;
    return mapa;
  }

  function nomeFeriado(date, bancario) {
    return feriados(date.getFullYear(), bancario)[key(date)] || null;
  }

  /* ---------- Valor por extenso ---------- */
  var UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  var DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  var CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  var ESCALAS = [
    ['', ''],
    ['mil', 'mil'],
    ['milhão', 'milhões'],
    ['bilhão', 'bilhões'],
    ['trilhão', 'trilhões']
  ];

  function ate999(n) {
    if (n === 100) return 'cem';
    var partes = [];
    var c = Math.floor(n / 100);
    var resto = n % 100;
    if (c) partes.push(CENTENAS[c]);
    if (resto) {
      if (resto < 20) partes.push(UNIDADES[resto]);
      else {
        var d = Math.floor(resto / 10);
        var u = resto % 10;
        partes.push(u ? DEZENAS[d] + ' e ' + UNIDADES[u] : DEZENAS[d]);
      }
    }
    return partes.join(' e ');
  }

  function inteiroPorExtenso(n) {
    if (n === 0) return 'zero';
    var grupos = [];
    while (n > 0) {
      grupos.push(n % 1000);
      n = Math.floor(n / 1000);
    }
    var partes = [];
    for (var i = grupos.length - 1; i >= 0; i--) {
      var g = grupos[i];
      if (!g) continue;
      var texto;
      if (i === 1 && g === 1) texto = 'mil';
      else texto = ate999(g) + (i ? ' ' + ESCALAS[i][g === 1 ? 0 : 1] : '');
      partes.push({ texto: texto, valor: g });
    }
    // "mil e duzentos", mas "mil duzentos e trinta": o "e" só liga o último grupo quando ele é redondo ou menor que cem
    return partes.reduce(function (acc, p, idx) {
      if (!idx) return p.texto;
      var ultimo = idx === partes.length - 1;
      var liga = ultimo && (p.valor < 100 || p.valor % 100 === 0);
      return acc + (liga ? ' e ' : ' ') + p.texto;
    }, '');
  }

  function porExtenso(valor, moeda) {
    var total = Math.round(Math.abs(valor) * 100);
    var inteiro = Math.floor(total / 100);
    var centavos = total % 100;
    if (!moeda) {
      var txt = inteiroPorExtenso(inteiro);
      if (centavos) txt += ' vírgula ' + (centavos < 10 ? 'zero ' : '') + inteiroPorExtenso(centavos);
      return txt;
    }
    var partes = [];
    if (inteiro) {
      var reais = inteiro === 1 ? 'real' : 'reais';
      // "um milhão de reais", "dois bilhões de reais"
      var de = inteiro >= 1000000 && inteiro % 1000000 === 0 ? 'de ' : '';
      partes.push(inteiroPorExtenso(inteiro) + ' ' + de + reais);
    }
    if (centavos) partes.push(inteiroPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos'));
    if (!partes.length) return 'zero real';
    return partes.join(' e ');
  }

  /* ---------- CPF e CNPJ (inclusive o CNPJ alfanumérico, emitido a partir de julho/2026) ---------- */
  function validarCpf(cpf) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return { valido: false };
    var dv = function (len) {
      var soma = 0;
      for (var i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
      var r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    var d1 = dv(9);
    var d2 = dv(10);
    return { valido: d1 === Number(cpf[9]) && d2 === Number(cpf[10]), esperado: '' + d1 + d2 };
  }

  function validarCnpj(cnpj) {
    if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return { valido: false };
    // No CNPJ alfanumérico cada caractere vale o código ASCII menos 48 ("A" = 17); para dígitos nada muda
    var valor = function (ch) {
      return ch.charCodeAt(0) - 48;
    };
    var dv = function (len) {
      var pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var soma = 0;
      for (var i = 0; i < len; i++) soma += valor(cnpj[i]) * pesos[i];
      var r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    var d1 = dv(12);
    var d2 = dv(13);
    return { valido: d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]), esperado: '' + d1 + d2, alfanumerico: /[A-Z]/.test(cnpj) };
  }

  DC.br = {
    ANO: ANO,
    SALARIO_MINIMO: SALARIO_MINIMO,
    INSS: INSS,
    TETO_INSS: TETO_INSS,
    IRRF: IRRF,
    DEDUCAO_DEPENDENTE: DEDUCAO_DEPENDENTE,
    DESCONTO_SIMPLIFICADO: DESCONTO_SIMPLIFICADO,
    SIMPLES: SIMPLES,
    LIMITE_SIMPLES: LIMITE_SIMPLES,
    MEI: MEI,
    r2: r2,
    inss: inss,
    inssContribuinte: inssContribuinte,
    irrf: irrf,
    irrf13: irrf13,
    notaIrrf: notaIrrf,
    salarioLiquido: salarioLiquido,
    simples: simples,
    parseDate: parseDate,
    addDays: addDays,
    diffDays: diffDays,
    feriados: feriados,
    nomeFeriado: nomeFeriado,
    porExtenso: porExtenso,
    validarCpf: validarCpf,
    validarCnpj: validarCnpj
  };
})();
