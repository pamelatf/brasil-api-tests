# Brasil API Tests

Suíte de testes automatizados para a [BrasilAPI](https://brasilapi.com.br/),
desenvolvida como parte de um desafio da turma da Mentoria 2.0 do Júlio de Lima.

## Introdução

Este projeto foi desenvolvido a partir da utilização do **Assistente de Testes de
API**, um projeto criado por alunos da mentoria com o objetivo de apoiar a
criação, organização e execução de testes automatizados para APIs.

A BrasilAPI é uma API pública que disponibiliza diversos dados relacionados ao
Brasil. A partir de seus endpoints, foram elaborados e automatizados cenários de
teste utilizando JavaScript e ferramentas do ecossistema Node.js.

A suíte cobre quatro recursos: bancos, CEP nas versões 1 e 2, CNPJ e
participantes do PIX.

## Heurísticas aplicadas

A primeira versão da suíte foi construída apenas com a heurística **VADER**, que
olha para o contrato da API e é especialmente boa para encontrar divergências
entre o que a documentação promete e o que a implementação entrega.

A versão atual acrescenta a heurística **POISED**, que amplia a cobertura para
frentes que VADER não endereça diretamente: interoperabilidade, escalabilidade e
qualidade dos dados, além de tratar segurança de forma mais ampla do que apenas
autenticação e autorização.

As duas heurísticas foram cruzadas em uma matriz única, em
`docs/matriz_unificada_vader_poised_brasilapi.csv`. Cada caso recebeu um
identificador próprio no formato `BAPI-nn`, uma coluna `origem_ids` que aponta
para o identificador VADER original, quando ele existe, ou para a categoria
POISED que motivou o caso, quando ele é novo, e uma coluna `Situação` que
informa se o caso passa ou se está vermelho de propósito.

Distribuição dos 76 casos:

| Origem | Casos |
|---|---|
| Herdados da matriz VADER | 48 |
| Novos, motivados por POISED | 28 |

| Categoria POISED | Casos |
|---|---|
| P — Parameter | 16 |
| E — Error | 15 |
| D — Data | 13 |
| O — Output | 12 |
| S — Security | 10 |
| I — Interoperability | 10 |

## Tecnologias utilizadas

- **JavaScript** e **Node.js** — linguagem e ambiente de execução
- **Mocha** — estruturação e execução dos testes
- **Chai** — asserções
- **Supertest** — requisições HTTP
- **Ajv** — validação dos corpos de resposta contra os schemas JSON da spec
- **dotenv** — gerenciamento de variáveis de ambiente
- **Mochawesome** — geração de relatórios de execução
- **Git e GitHub** — controle de versão e hospedagem

## Estrutura do repositório

```text
brasil-api-tests/
│
├── docs/
│   ├── matriz_unificada_vader_poised_brasilapi.csv
│   ├── casos_teste_vader_brasilapi.csv
│   └── correcoes_aplicadas.md
│
├── fixtures/
│   └── massaTestes.json
│
├── helpers/
│   ├── cliente.js
│   ├── schemas.js
│   └── metricas.js
│
├── test/
│   ├── banks.test.js
│   ├── cep.test.js
│   ├── cnpj.test.js
│   └── pix.test.js
│
├── .env.example
├── .gitignore
├── .mocharc.json
├── package.json
├── package-lock.json
└── README.md
```

### `docs/`

`matriz_unificada_vader_poised_brasilapi.csv` é a matriz vigente, com os 76 casos
cruzando as duas heurísticas. O arquivo é CSV em UTF-8 separado por ponto e
vírgula, no mesmo padrão das demais matrizes do projeto.

`casos_teste_vader_brasilapi.csv` é a matriz VADER original, mantida como
histórico da primeira rodada.

`correcoes_aplicadas.md` registra os defeitos encontrados na suíte anterior, a
correção aplicada em cada um e a origem das evidências usadas para decidir.

### `fixtures/`

`massaTestes.json` centraliza a massa de teste. Além dos dados de cada recurso,
o arquivo traz os payloads usados nos casos de segurança, a lista de termos que
não podem vazar em nenhuma resposta e os limites acordados de tempo de resposta
e de concorrência.

### `helpers/`

`cliente.js` centraliza a configuração das requisições. A URL base nunca é
escrita direto no teste.

`schemas.js` traz os schemas JSON transcritos da especificação OpenAPI da
BrasilAPI e a função `validarContrato`, que valida um corpo de resposta com Ajv e
lista todos os desvios encontrados. Também expõe `registrarLacuna`, usada nos
casos que documentam uma divergência sem falhar o teste.

`metricas.js` reúne os utilitários dos casos POISED de dados: medição de tempo,
disparo de chamadas em paralelo, detecção de texto mal codificado e busca de
valores duplicados em uma lista.

### `test/`

Um arquivo por recurso. Cada caso é nomeado com o identificador da matriz e, entre
parênteses, sua origem, no formato `BAPI-01 (VADER-001)` para os casos herdados e
`BAPI-17 (POISED-I)` para os casos novos. Isso permite ir do resultado da execução
para a linha da matriz sem consulta intermediária.

## Instalação

### Pré-requisitos

Node.js, npm e Git.

### 1. Clone o repositório

```bash
git clone https://github.com/pamelatf/brasil-api-tests.git
```

### 2. Acesse o diretório do projeto

```bash
cd brasil-api-tests
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto utilizando o `.env.example` como
referência:

```env
BASE_URL=https://brasilapi.com.br/api
```

O arquivo `.env` não deve ser versionado.

## Execução dos testes

```bash
npm test              # suíte completa
npm run test:banks    # apenas bancos
npm run test:cep      # apenas CEP v1 e v2
npm run test:cnpj     # apenas CNPJ
npm run test:pix      # apenas participantes do PIX
npm run test:report   # execução com relatório Mochawesome
```

## Como ler o resultado da execução

**A suíte não fica verde, e isso é intencional.** Seis casos falham de propósito.

Nesses seis, o teste está certo e a API está errada: são defeitos confirmados da
BrasilAPI, fora do alcance deste projeto para corrigir. Eles funcionam como um
relatório permanente, que volta a aparecer a cada execução até que o problema
seja resolvido na origem. No código, cada um traz um comentário marcando
`DEFEITO CONFIRMADO DA API - falha esperada`, e na matriz a coluna `Situação`
registra o mesmo.

| Caso | Defeito |
|---|---|
| BAPI-07 e BAPI-21 | `/banks/v1` devolve itens com `code` nulo e `code` repetido, violando o schema `Bank` |
| BAPI-40 | `/cep/v2` devolve `location.coordinates` sem `longitude` nem `latitude` |
| BAPI-68, BAPI-72 e BAPI-73 | `/pix/v1/participants` devolve linhas sem ISPB e com `tipo_participacao` vazio |

O detalhamento de cada um, incluindo a linha de código da BrasilAPI que causa o
problema do PIX, está em `docs/correcoes_aplicadas.md`.

Outros três casos seguem convenção diferente. BAPI-67, BAPI-69 e BAPI-70 também
tratam de defeitos confirmados, mas fixam o comportamento atual em vez de exigir
o correto. Assim ficam verdes hoje e falham no dia em que a API for corrigida,
avisando que a matriz precisa ser atualizada. Uma falha nesses três é boa notícia.

Além de passar ou falhar, vários casos imprimem no terminal uma linha começando
com `[LACUNA BAPI-nn]`. Essas linhas não indicam falha: são divergências entre a
documentação e o comportamento observado, registradas para análise posterior.
Elas aparecem apenas no terminal, não no relatório HTML, porque o Mochawesome não
captura `console.log` sem a biblioteca `mochawesome/addContext`.

## Objetivo do projeto

Aplicar, na prática, conceitos de automação de testes de API e explorar a
utilização de inteligência artificial como apoio ao processo de desenvolvimento
de uma suíte de testes, usando duas heurísticas complementares de teste
exploratório de API.

## Créditos

Projeto desenvolvido como parte de um desafio da turma da Mentoria 2.0 do Júlio
de Lima, com base no **Assistente de Testes de API** desenvolvido por alunos da
mentoria.
