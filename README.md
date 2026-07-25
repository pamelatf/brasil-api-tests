# Brasil API Tests

Suíte de testes automatizados para APIs desenvolvida como parte de um
desafio da turma da Mentoria 2.0 do Júlio de Lima.

## Introdução

Este projeto foi desenvolvido a partir da utilização do **Assistente de
Testes de API**, um projeto criado por alunos da mentoria do Júlio de
Lima com o objetivo de apoiar a criação, organização e execução de
testes automatizados para APIs.

Como parte de um desafio proposto à turma, o projeto foi utilizado para
desenvolver uma suíte de testes automatizados para a
[BrasilAPI](https://brasilapi.com.br/).

A BrasilAPI é uma API pública que disponibiliza diversos dados
relacionados ao Brasil. A partir de seus endpoints, foram elaborados e
automatizados cenários de teste utilizando JavaScript e ferramentas do
ecossistema Node.js.

O projeto tem como foco a aplicação prática de conceitos relacionados a:

-   Testes de API;
-   Automação de testes;
-   Validação de status codes HTTP;
-   Validação de contratos e schemas;
-   Organização de dados de teste;
-   Reutilização de código;
-   Geração de relatórios de testes;
-   Utilização de inteligência artificial como apoio ao processo de
    desenvolvimento de testes.

## Tecnologias utilizadas

-   **JavaScript** --- linguagem utilizada no desenvolvimento dos
    testes;
-   **Node.js** --- ambiente de execução da aplicação;
-   **Mocha** --- framework utilizado para estruturação e execução dos
    testes;
-   **Chai** --- biblioteca utilizada para asserções;
-   **Supertest** --- biblioteca utilizada para realizar requisições
    HTTP;
-   **Ajv** --- biblioteca utilizada para validação de schemas JSON;
-   **dotenv** --- gerenciamento de variáveis de ambiente;
-   **Mochawesome** --- geração de relatórios de execução dos testes;
-   **Git e GitHub** --- controle de versão e hospedagem do código.

## Estrutura do repositório

``` text
brasil-api-tests/
│
├── docs/
│   └── casos_teste_vader_brasilapi.csv
│
├── fixtures/
│   └── massaTestes.json
│
├── helpers/
│   ├── cliente.js
│   └── schemas.js
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

## Objetivo de cada grupo de arquivos

### `docs/`

Contém documentos relacionados à especificação e organização dos casos
de teste.

#### `casos_teste_vader_brasilapi.csv`

Arquivo utilizado para documentar os casos de teste definidos para os
endpoints da BrasilAPI.

A documentação dos casos de teste serve como base para a implementação e
organização dos cenários automatizados.

------------------------------------------------------------------------

### `fixtures/`

Contém os dados utilizados como massa de teste.

#### `massaTestes.json`

Armazena dados que podem ser utilizados pelos testes automatizados,
permitindo centralizar e reutilizar informações de teste.

A utilização de fixtures ajuda a:

-   Evitar a duplicação de dados nos arquivos de teste;
-   Facilitar a manutenção da massa de testes;
-   Separar os dados de teste da lógica de execução;
-   Reutilizar informações em diferentes cenários.

------------------------------------------------------------------------

### `helpers/`

Contém funções e recursos auxiliares utilizados pelos testes.

#### `cliente.js`

Centraliza a configuração e/ou execução das requisições realizadas
contra a API.

A utilização de um cliente compartilhado ajuda a evitar a repetição de
configurações comuns entre os diferentes arquivos de teste.

------------------------------------------------------------------------

#### `schemas.js`

Contém os schemas utilizados para validar a estrutura das respostas da
API.

A validação de schemas permite verificar se os dados retornados possuem
a estrutura esperada, além da validação dos status codes e dos valores
retornados.

------------------------------------------------------------------------

### `test/`

Contém os testes automatizados organizados de acordo com os endpoints ou
recursos da API que estão sendo validados.

#### `banks.test.js`

Contém os testes relacionados aos endpoints de bancos da BrasilAPI.

------------------------------------------------------------------------

#### `cep.test.js`

Contém os testes relacionados à consulta de CEP.

Os cenários podem validar, por exemplo:

-   Consultas com CEP válido;
-   Consultas com CEP inválido;
-   Status codes retornados;
-   Estrutura da resposta da API.

------------------------------------------------------------------------

#### `cnpj.test.js`

Contém os testes relacionados à consulta de CNPJ.

------------------------------------------------------------------------

#### `pix.test.js`

Contém os testes relacionados aos endpoints de informações de
instituições relacionadas ao Pix.

------------------------------------------------------------------------

### `.env.example`

Arquivo de exemplo das variáveis de ambiente necessárias para a execução
do projeto.

Esse arquivo serve como modelo para a criação do arquivo `.env` local.

Informações sensíveis, como tokens, senhas e credenciais, não devem ser
armazenadas no repositório.

------------------------------------------------------------------------

### `.gitignore`

Define arquivos e diretórios que não devem ser versionados pelo Git.

Entre os itens ignorados estão:

-   `node_modules/`;
-   `.env`;
-   Relatórios gerados automaticamente;
-   Arquivos temporários.

------------------------------------------------------------------------

### `.mocharc.json`

Contém as configurações utilizadas pelo Mocha para a execução dos testes
automatizados.

------------------------------------------------------------------------

### `package.json`

Contém as informações do projeto, suas dependências e os scripts
utilizados para executar os testes.

------------------------------------------------------------------------

### `package-lock.json`

Registra as versões específicas das dependências instaladas no projeto.

Esse arquivo ajuda a garantir maior consistência na instalação das
dependências em diferentes ambientes.

## Instalação

### Pré-requisitos

Antes de iniciar, é necessário ter instalado:

-   Node.js;
-   npm;
-   Git.

### 1. Clone o repositório

``` bash
git clone https://github.com/pamelatf/brasil-api-tests.git
```

### 2. Acesse o diretório do projeto

``` bash
cd brasil-api-tests
```

### 3. Instale as dependências

``` bash
npm install
```

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto utilizando o `.env.example`
como referência.

Exemplo:

``` env
BASE_URL=https://brasilapi.com.br/api
```

O arquivo `.env` não deve ser versionado.

## Execução dos testes

Para executar a suíte de testes automatizados, utilize:

``` bash
npm test
```

Esse comando executará os testes configurados no projeto utilizando o
Mocha.

Os testes podem validar diferentes aspectos das respostas da API, como:

-   Status codes HTTP;
-   Corpo das respostas;
-   Estrutura dos dados retornados;
-   Schemas JSON;
-   Comportamentos esperados para diferentes cenários.

## Relatórios de testes

O projeto utiliza o **Mochawesome** para geração de relatórios de
execução dos testes.

Os relatórios gerados são mantidos fora do controle de versão por meio
do arquivo `.gitignore`.

## Objetivo do projeto

O objetivo deste projeto é aplicar, na prática, conceitos de automação
de testes de API e explorar a utilização de inteligência artificial como
apoio ao processo de desenvolvimento de uma suíte de testes.

O projeto também representa uma experiência prática de aprendizado e
colaboração dentro da Mentoria 2.0 do Júlio de Lima, utilizando um
desafio da turma para transformar os conhecimentos adquiridos em um
projeto de automação de testes.

## Créditos

Projeto desenvolvido como parte de um desafio da turma da Mentoria 2.0
do Júlio de Lima.

O projeto teve como base a utilização do **Assistente de Testes de
API**, desenvolvido por alunos da mentoria.
