
/* --- Referencing DOM Elements such as Inputs, Buttons, and Outputs. ---*/
var inputValue = document.querySelector('#dinheiro');
var inputDescontos = document.querySelector('#inputDescontos');
var inputDpvalue = document.querySelector('#dependente');

/* --- Referencing DOM Elements such as Buttons. ---*/
var btnCalc = document.querySelector('#btn-calc');
var btnClear = document.querySelector('#btn-clear');

/* --- Referencing DOM Elements such as Outputs. ---*/
var vlrBruto = document.querySelector('#vlr-bruto');
var vlrDescontos = document.querySelector('#cel-table-desconto');
var aliquotaInss = document.querySelector('#ali-inss');
var aliquotaIrrf = document.querySelector('#ali-irrf');
var resultInss = document.querySelector('#result-inss');
var resultIrrf = document.querySelector('#result-irrf');
var vlrTotalProventos = document.querySelector('#tl-proventos');
var tlDescontos = document.querySelector('#tl-descontos');
var resultSl = document.querySelector('#sl-liquido');
var notaIrrf = document.querySelector('#nota-irrf');


/* --- 2026 parameters ---
 * INSS: Portaria Interministerial MPS/MF nº 13, de 9 de janeiro de 2026.
 * IRRF: monthly table in force since May/2025 (Lei nº 15.191/2025) plus the tax reduction
 * of Lei nº 15.270/2025, which zeroes the IRRF for monthly income up to R$ 5.000,00 from 2026 on.
 */
var FAIXAS_INSS = [
    { ate: 1621.00, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 }
];

var FAIXAS_IRRF = [
    { ate: 2428.80, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
    { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 }
];

var DEDUCAO_DEPENDENTE = 189.59;
var DESCONTO_SIMPLIFICADO = 607.20;


function arredondar(valor){
    return Math.round(valor * 100) / 100;
};

function formatarReal(valor){
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function lerValor(input){
    if(input.value == ""){
        return 0;
    }
    return parseFloat(input.value.replace(/\./g, "").replace(",", "."));
};


/* --- INSS is progressive: each rate applies only to the slice of salary inside its bracket, up to the ceiling. ---*/
function calcInss(salario){
    var inss = 0;
    var limiteAnterior = 0;

    for(var i = 0; i < FAIXAS_INSS.length; i++){
        var faixa = FAIXAS_INSS[i];
        if(salario <= limiteAnterior){
            break;
        }
        inss += (Math.min(salario, faixa.ate) - limiteAnterior) * faixa.aliquota;
        limiteAnterior = faixa.ate;
    }

    return arredondar(inss);
};


/* --- IRRF: the payer uses whichever deduction is larger (INSS + dependents or the simplified discount),
 * applies the monthly table and then the 2026 reduction, which is based on the gross taxable income. ---*/
function calcIrrf(salario, inss, dependentes){
    var deducoesLegais = inss + (dependentes * DEDUCAO_DEPENDENTE);
    var usaSimplificado = DESCONTO_SIMPLIFICADO > deducoesLegais;
    var deducao = usaSimplificado ? DESCONTO_SIMPLIFICADO : deducoesLegais;
    var base = Math.max(salario - deducao, 0);

    var faixa = FAIXAS_IRRF.find(function(f){ return base <= f.ate; });
    var impostoTabela = Math.max(base * faixa.aliquota - faixa.deducao, 0);

    var reducao = 0;
    if(salario <= 5000){
        reducao = 312.89;
    }else if(salario <= 7350){
        reducao = Math.max(978.62 - (0.133145 * salario), 0);
    }
    reducao = Math.min(reducao, impostoTabela);

    return {
        valor: arredondar(impostoTabela - reducao),
        base: arredondar(base),
        deducao: arredondar(deducao),
        usaSimplificado: usaSimplificado,
        impostoTabela: arredondar(impostoTabela),
        reducao: arredondar(reducao)
    };
};


 /* --- Showing result calc section--- */

function showResultCalcSection (){
    var resultCalcSection = document.querySelector('#info-result');

    resultCalcSection.classList.remove('hiddenResult');
    resultCalcSection.classList.add('showing');

};


/* --- Main function: reads the inputs, runs INSS, then IRRF, then fills in the table. ---*/
const calcValues =()=>{

 /* --- Validator input--- */
    if(inputValue.value == ""){
        alert("insira um valor!")
        return 0
    };

    var salario = lerValor(inputValue);
    var outrosDescontos = lerValor(inputDescontos);
    var dependentes = parseInt(inputDpvalue.value) || 0;

    if(outrosDescontos > salario){
        alert('ops ... valor inválido! o desconto é maior que o salário')
        outrosDescontos = 0;
    }

    showResultCalcSection()

    var inss = calcInss(salario);
    var irrf = calcIrrf(salario, inss, dependentes);
    var descontos = inss + irrf.valor + outrosDescontos;

    vlrBruto.innerHTML = formatarReal(salario);
    vlrTotalProventos.innerHTML = formatarReal(salario);
    vlrDescontos.innerHTML = formatarReal(outrosDescontos);
    resultInss.innerText = formatarReal(inss);
    resultIrrf.innerText = formatarReal(irrf.valor);
    tlDescontos.innerHTML = formatarReal(descontos);
    resultSl.innerText = formatarReal(salario - descontos);

    aliquotaInss.innerHTML = ((inss * 100) / salario).toFixed(2) + "%";
    aliquotaIrrf.innerHTML = ((irrf.valor * 100) / salario).toFixed(2) + "%";

    var nota = 'Base do IRRF: ' + formatarReal(irrf.base) + ', com ' +
        (irrf.usaSimplificado
            ? 'o desconto simplificado de ' + formatarReal(irrf.deducao) + ', mais vantajoso que INSS e dependentes.'
            : 'a dedução de INSS e dependentes (' + formatarReal(irrf.deducao) + ').');
    if(irrf.reducao > 0){
        nota += ' Imposto pela tabela: ' + formatarReal(irrf.impostoTabela) +
            ', menos a redução de 2026 (Lei nº 15.270/2025) de ' + formatarReal(irrf.reducao) + '.';
    }
    notaIrrf.innerText = nota;

};


function reloadPage (){


    window.scrollTo({top:0, behavior:'smooth'})


    inputValue.value = "";
    inputDescontos.value ="";
    inputDpvalue.value = "";

};



btnCalc.onclick = calcValues;
btnClear.onclick= reloadPage;
