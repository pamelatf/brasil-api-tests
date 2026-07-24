# brasilapi-tests

Testes funcionais de API da **Brasil API**, derivados da matriz exploratória VADER
(`casos_teste_vader_brasilapi.csv`). Escopo atual: recursos **BANKS, CEP, CNPJ e PIX**.

## Estrutura

```
brasilapi-tests/
├── test/
│   ├── banks.test.js       VADER-001 a VADER-016
│   ├── cep.test.js         VADER-017 a VADER-032
│   ├── cnpj.test.js        VADER-033 a VADER-041
│   └── pix.test.js         VADER-042 a VADER-048
├── helpers/
│   ├── cliente.js          URL base e instância do Supertest
│   └── schemas.js          campos obrigatórios extraídos do openapi.json
├── fixtures/
│   └── massaTestes.json    massa de teste centralizada
├── .env.example
├── .mocharc.json
└── package.json
```

## Execução

```bash
npm install
cp .env.example .env
npm test                # executa toda a suíte
npm run test:cep        # executa apenas um recurso
npm run test:report     # gera relatório HTML com Mochawesome
```

O relatório é gravado em `mochawesome-report/mochawesome.html`.

## Convenções adotadas

- Um arquivo `.test.js` por recurso, seguindo o padrão do repositório `banco-api-tests`.
- Nome do teste em português, iniciado pelo identificador VADER e descrevendo o resultado esperado.
  Isso mantém a rastreabilidade direta entre o caso da matriz e o teste automatizado.
- URL base sempre via variável de ambiente, nunca hardcoded.
- Massa de teste isolada em `fixtures/`, não espalhada pelos testes.
- Validação de contrato centralizada em `helpers/schemas.js`, com os campos obrigatórios
  copiados de `components.schemas` do arquivo OpenAPI. Se a spec mudar, altera-se um único ponto.

## Tratamento de lacunas de documentação

Casos que investigam comportamento não documentado não devem falhar a suíte por presunção.
Eles usam `registrarLacuna()`, que apenas imprime o comportamento real observado no relatório.
A asserção fica restrita ao que é verificável, por exemplo "não retornar 5xx".

Casos que verificam contrato explicitamente documentado usam asserção rígida e falham quando violados.

## Riscos conhecidos desta suíte

1. **Dependência de serviço externo.** A API é pública e consome fontes de terceiros
   (OpenCep, Minha Receita, Banco Central). Falhas intermitentes da origem podem gerar
   falsos negativos. O `.mocharc.json` já define `retries: 1` para mitigar oscilação pontual.
2. **Cache de CDN.** A documentação declara uso de Vercel Smart CDN. Respostas cacheadas
   podem mascarar falhas reais, principalmente em cenários de dado inexistente.
3. **Massa de teste real.** CNPJ e CEP usados são dados públicos reais e podem mudar de
   situação cadastral ou de logradouro. Evite asserções em valores voláteis.
4. **Testes ainda não executados.** Esta suíte foi estruturada a partir da especificação
   OpenAPI, sem execução contra o ambiente. A primeira rodada serve para confirmar os
   comportamentos marcados como lacuna e ajustar as asserções.
