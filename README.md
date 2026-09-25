# DevCount Contabilidade

Landing page de um escritório de contabilidade e uma página de ferramentas gratuitas
(calculadoras trabalhistas, de impostos, finanças e utilitários), em HTML, CSS e
JavaScript puros, sem etapa de build.

Página publicada: https://carlosdanyell.github.io/devcount/

## Estrutura

```
index.html                 página inicial
ferramentas.html           catálogo e ferramentas (?f=<id>#<valores>)
calc-salario-liquido.html  endereço antigo, só redireciona para a ferramenta
assets/
  css/base.css             tokens, tema claro/escuro e componentes comuns
  css/home.css             seções da página inicial
  css/tools.css            catálogo, ferramenta, resultados e busca
  js/icons.js              sprite de ícones (carregado no início do <body>)
  js/site.js               tema, cabeçalho, menu, animações, máscaras
  js/home.js               interações da página inicial
  js/tools/calc-br.js      tabelas e regras de 2026 (INSS, IRRF, Simples, MEI…)
  js/tools/core.js         formulários, resultados, gráficos, rotas e busca
  js/tools/*.js            ferramentas de cada categoria
  img/                     imagens em WebP
```

## Rodar localmente

```bash
npx http-server . -p 5173 -c-1
```

## Adicionar uma ferramenta

Registre-a no arquivo da categoria com `DC.tools.register({ id, category, title, fields, compute })`.
A função `compute` recebe os valores já convertidos e devolve `headline`, `stats`,
`breakdown`, `tables`, `chart` e `notes`; a interface é montada pelo `core.js`.

Ao virar o ano, atualize as tabelas em `assets/js/tools/calc-br.js`.
