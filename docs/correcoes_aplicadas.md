# Correções aplicadas na suíte e origem das evidências

Este documento registra o que mudou na suíte de testes ao unificar as heurísticas
VADER e POISED, e de onde vem cada afirmação. Ele existe para que qualquer pessoa
do time consiga auditar as decisões sem precisar refazer a investigação.

## Como as evidências foram levantadas

A API pública não foi usada como fonte de verdade para o comportamento esperado.
As afirmações deste documento vêm de duas fontes verificáveis:

1. A especificação OpenAPI publicada pela própria BrasilAPI, em
   `pages/docs/doc/bank.json`, `cep.json`, `cnpj.json`, `pix.json`, `error.json`
   e `basic_info.json` do repositório `BrasilAPI/BrasilAPI`.
2. O código-fonte dos handlers e serviços do mesmo repositório: `app.js`,
   `middlewares/errorHandler.js`, `middlewares/cache.js`, `middlewares/firewall.js`,
   `pages/api/banks/v1/*`, `pages/api/cep/v1/[cep].js`, `pages/api/cep/v2/[cep].js`,
   `pages/api/cnpj/v1/[cnpj].js`, `pages/api/pix/v1/participants.js`,
   `services/cep/cep.js`, `services/cnpj.js`, `services/pix/participants.js` e
   `services/banco-central/index.js`.

Ler o código do provedor permitiu separar três coisas que a suíte anterior
tratava como uma só: o que a documentação promete, o que a implementação faz e
o que o teste deveria afirmar.

## Defeitos corrigidos nos casos que já existiam

### 1. ISPB do PIX validado com um formato que a API não produz

O caso VADER-048 exigia `/^\d{8}$/` para o campo `ispb` de cada participante.
O serviço `services/pix/participants.js` copia o valor cru da coluna do CSV do
Banco Central, sem completar com zeros à esquerda, e o próprio exemplo da spec
mostra `"360305"`, com seis dígitos. O teste falharia sempre, e a mensagem de
falha não explicaria o motivo.

A correção separou o assunto em dois casos. O BAPI-68 valida o contrato do
schema. O BAPI-69 compara o formato do ISPB do PIX com o do endpoint `/banks/v1`,
que vem com oito dígitos, e registra a divergência: quem tentar cruzar as duas
listas por ISPB não encontra correspondência. Esse é o achado mais relevante da
rodada e ele só apareceu porque a heurística POISED cobre interoperabilidade,
frente que VADER não endereça diretamente.

### 2. Verbos indevidos aceitando 405 como resultado válido

Seis casos aceitavam `[404, 405]` para verbos não documentados. O `app.js` da
BrasilAPI define `onNoMatch` devolvendo sempre 404 com corpo
`{ message: 'Page not found.', type: 'not_found', name: 'NotFoundError' }`.
O 405 não existe na implementação. Aceitar os dois valores tornava o teste
incapaz de detectar uma mudança de comportamento.

Os casos passaram a afirmar 404 e `type` igual a `not_found`, mantendo o
registro da lacuna de que o 405, mais adequado semanticamente, não foi
implementado nem documentado.

### 3. Comparação de corpo inteiro em resposta com dado de fonte externa

O caso VADER-028 usava `deep.equal` entre os corpos completos de duas chamadas
ao `/cep/v2`. A v2 encadeia geocodificação e resolução de timezone em serviços
externos, e as coordenadas podem variar entre chamadas. O caso era instável por
construção.

O BAPI-36 passou a comparar campo a campo os atributos estáveis
(`cep`, `state`, `city`, `neighborhood`, `street`, `timezoneName`), deixando as
coordenadas fora da comparação de igualdade.

### 4. Pattern do CEP tratado como se fosse aplicado

O caso VADER-029 incluía `01310_930` entre as entradas que deveriam devolver 400,
com base no pattern publicado. A função `fetchCep` remove todo caractere não
numérico antes de validar o tamanho, então essa entrada resulta em oito dígitos
válidos e é aceita. O pattern da spec não é efetivamente aplicado.

O BAPI-37 ficou com as entradas que realmente violam a regra de oito dígitos, e
o BAPI-48 foi criado para registrar que o pattern publicado não corresponde à
validação real.

### 5. Assertivas frágeis sobre o texto de mensagens de erro

O caso VADER-041 afirmava que a mensagem do 400 do CNPJ não podia conter o
caractere `11`. A BrasilAPI não valida o CNPJ: `services/cnpj.js` encaminha o
parâmetro direto para `https://minhareceita.org/{cnpj}` e repassa a mensagem
recebida. O texto da mensagem é de terceiros e pode mudar sem aviso.

O BAPI-57 passou a afirmar o que é da BrasilAPI (status 400 e `type` igual a
`bad_request`, com mensagem não vazia) e a registrar a mensagem observada para
comparação com o exemplo defeituoso da spec, que cita 11 dígitos quando o
correto são 14.

### 6. Casos que apenas verificavam `status < 500`

Vários casos se limitavam a garantir ausência de erro interno, o que passa
mesmo quando o comportamento muda. Onde o código do provedor permite afirmar o
resultado exato, o caso passou a afirmá-lo: BAPI-12 afirma 404 para código não
numérico, BAPI-14 afirma `type` igual a `BANK_CODE_NOT_FOUND`, BAPI-29 afirma o
CEP normalizado, BAPI-31 afirma 400 com `type` igual a `validation_error`.

### 7. Validação de contrato por presença de campo

O `helpers/schemas.js` verificava apenas se a propriedade existia no objeto, sem
checar tipo nem estrutura aninhada. O README, por sua vez, afirmava que o projeto
usava Ajv, biblioteca que não constava em `package.json` nem no código.

O helper foi reescrito sobre Ajv, com os schemas transcritos da spec, incluindo
tipos, `enum` de `Location.type` e os campos anuláveis traduzidos da sintaxe
`nullable` do OpenAPI 3.0 para `type: ['string', 'null']`. A mensagem de falha
passou a listar todos os desvios encontrados, não apenas o primeiro. O README
deixou de divergir do código.

### 8. Verificação de vazamento apenas no corpo estruturado

O caso VADER-015 procurava por `stack` somente em `resposta.body`. Rotas não
mapeadas na BrasilAPI caem na página 404 do Next.js, que devolve HTML, e nesse
caso `body` vem vazio. A verificação não olhava onde o vazamento apareceria.

Os casos de segurança passaram a inspecionar corpo estruturado e texto bruto, com
uma lista de termos proibidos em `fixtures/massaTestes.json` que inclui caminhos
internos e os hosts das dependências externas.

### 9. Scripts de execução por recurso rodando a suíte inteira

O `.mocharc.json` definia `spec` como `test/**/*.test.js`. O Mocha soma esse
valor aos argumentos passados na linha de comando em vez de substituí-lo, então
`npm run test:banks` executava os quatro arquivos, e não apenas o de bancos. O
problema passava despercebido porque o resultado continuava verde.

A chave `spec` saiu do `.mocharc.json` e o padrão foi movido para o script
`test` do `package.json`. Os scripts por recurso passaram a executar o que
prometem: 24 casos em bancos, 24 em CEP, 13 em CNPJ e 14 em PIX. Depois da
segunda rodada a contagem passou a 24, 24, 14 e 14, somando os 76 da matriz. O `timeout` também subiu de 20s para 30s, porque os casos de
concorrência disparam dez chamadas em paralelo contra dependências externas.

## Duas convenções para defeitos confirmados

Vários achados são defeitos reais da API que o time não tem como corrigir, por
estarem na BrasilAPI ou na fonte de dados. A suíte trata esses casos de duas
formas, e a escolha entre elas depende da gravidade do defeito.

**Fixar o comportamento atual e ficar verde.** É a convenção herdada do caso
VADER-047, aplicada a BAPI-67 (`inicio_operacao` sempre nulo), BAPI-69 (ISPB não
normalizado) e BAPI-70 (`nome` igual a `nome_reduzido`). O teste afirma o
comportamento defeituoso observado, então passa hoje e falha no dia em que a API
for corrigida, avisando que a matriz precisa ser atualizada. Serve para
divergências de contrato que não quebram o consumidor na prática.

**Exigir o comportamento correto e ficar vermelho.** Aplicada a BAPI-07, BAPI-21,
BAPI-40, BAPI-68, BAPI-72 e BAPI-73. O teste continua exigindo o que a
documentação promete e falha a cada execução, funcionando como relatório
permanente. Serve para defeitos que efetivamente quebram quem consome a API:
campo obrigatório nulo, identificador duplicado, registro sem chave.

O risco dessa segunda convenção é conhecido: uma suíte cronicamente vermelha faz
o time parar de olhar o resultado. Por isso os seis casos são poucos, estão
listados no README, marcados no código com o comentário
`DEFEITO CONFIRMADO DA API - falha esperada` e identificados na coluna `Situação`
da matriz. Qualquer falha fora dessa lista é problema novo e merece investigação.

## O que a heurística POISED acrescentou

Dos 76 casos da matriz unificada, 28 não têm origem VADER. Eles se concentram em
três frentes que a VADER não cobre diretamente:

**Interoperabilidade.** Política de CORS aberta a qualquer origem em todos os
recursos, suporte a HEAD e a OPTIONS sem menção na spec, ausência de negociação
de conteúdo, incompatibilidade de formato do ISPB entre `/pix` e `/banks`, e a
perda do campo `service` para quem migrar de `/cep/v1` para `/cep/v2`.

**Escalabilidade e qualidade de dados.** Comportamento sob chamadas simultâneas,
janelas de cache divergentes entre recursos (86400s no padrão, 172800s no CEP e
21600s no PIX, nenhuma documentada), integridade da acentuação em dados vindos de
CSV decodificado como latin1, duplicidade de identificadores e domínio de valores
dos campos sem `enum`.

**Segurança além da autenticação.** VADER tratava autenticação e autorização.
POISED acrescentou proteção de dados e sanitização: payloads de injeção no
parâmetro de path em três recursos, verificação de vazamento de caminho interno e
de host de dependência, e o registro de que o CNPJ é encaminhado sem qualquer
validação local para um serviço de terceiros.

## Segunda rodada: correções após a primeira execução real

A primeira execução contra a API pública devolveu 52 casos passando e 23
falhando. Nem toda falha é defeito do sistema testado: o culpado pode ser o
teste, a massa de teste ou a API. Os 23 se distribuíram assim.

### Erro no teste (5 casos)

**BAPI-24, BAPI-47 e BAPI-61 — o `s-maxage` que nunca chega.** Os casos exigiam
a diretiva `s-maxage` no header `Cache-Control`, com base no que o código-fonte
da BrasilAPI envia. O observado foi `max-age=0, public` no banks e no CEP, e
`private, no-store, max-age=0` no CNPJ. O motivo é conceitual: `s-maxage` é uma
instrução dirigida ao cache compartilhado, ou seja, à CDN. Ela é consumida e
removida antes de a resposta chegar ao cliente, e portanto é invisível de fora
por desenho. Os casos passaram a verificar apenas que o `Cache-Control` existe e
a registrar o valor observado junto com `Age` e `x-vercel-cache`.

O CNPJ rendeu um achado no caminho: chega com `private, no-store`, isto é, sem
cache nenhum, enquanto o código-fonte aplica a ele o cache padrão de 86400s. A
documentação não menciona nem um comportamento nem o outro.

**BAPI-42 — o campo `service` na v2 do CEP.** O caso afirmava que a v2 não
expõe `service`, com base no schema `AddressV2`, que de fato não o declara. Mas
o handler da v2 faz `response.json({ ...cepFromCepPromise, timezoneName, location })`,
e esse objeto espalhado já contém `service`. A v2 devolve o campo sem
documentá-lo. A afirmação foi invertida: o caso agora exige que `service`
continue presente, protegendo quem migra da v1, e registra que ele não consta no
schema publicado.

**BAPI-13 — bordas do código do banco.** O caso exigia status idêntico para as
três bordas. O observado foi 200 para `0` e 404 para `-1` e `999999999`, porque
existe mesmo banco com código 0 na base. A regra era rígida demais: passou a
exigir apenas que nenhuma borda produza erro interno, e o achado de qualidade de
dado ficou concentrado no BAPI-21.

### Massa de teste desatualizada (2 casos)

**BAPI-30 e BAPI-38 — o CEP 99999999 passou a existir.** Os dois casos esperavam
404 e receberam 200. Não é defeito da API nem do teste: é o mundo mudando embaixo
de um dado tratado como estável. Teste que depende de "isto não existe" é frágil
por natureza, porque a inexistência de algo não é garantida por ninguém.

A correção não foi trocar por outro valor fixo, que envelheceria do mesmo jeito.
A massa passou a ter uma lista de candidatos e os casos descobrem em tempo de
execução qual deles ainda devolve 404, falhando com instrução explícita se
nenhum servir.

### Limite de requisições (10 casos)

Oito casos de CNPJ falharam com 429, e o BAPI-56 e o BAPI-59 falharam em
cascata, por validarem o corpo da resposta de erro. A suíte disparava cerca de
doze chamadas ao recurso em poucos segundos e era cortada pelo limite aplicado no
edge da BrasilAPI. Não é defeito da API nem do teste: é a suíte sendo
mal-educada com um serviço público e gratuito.

A correção tem três partes. A consulta ao CNPJ válido passou a ser feita uma
única vez, em um bloco `before`, e é reaproveitada por sete casos. As demais
chamadas passam por `pedirComPaciencia`, em `helpers/cliente.js`, que reexecuta
com espera crescente quando recebe 429 e deixa o erro chegar ao teste se todas
as tentativas falharem. E a lista de payloads de injeção do CNPJ foi reduzida
para dois, mantendo os quatro nos demais recursos.

O 429 em si virou achado: não consta na especificação, que declara apenas 200,
400 e 404. O caso **BAPI-76** foi criado para registrar a lacuna e verificar se a
resposta ao menos traz o header `Retry-After`.

### Defeito real da API (6 casos, mantidos vermelhos)

Estes são o resultado que justifica o trabalho. O teste está certo e a API está
errada. Por decisão do time, permanecem falhando, funcionando como relatório
permanente de defeito confirmado. Cada um traz um comentário no código marcando
`DEFEITO CONFIRMADO DA API - falha esperada`, para que ninguém interprete o
vermelho como suíte quebrada.

**BAPI-07 e BAPI-21 — o endpoint de bancos viola o próprio contrato.** A lista
traz 8 itens com `code: null` e 3 repetindo `code: 0`, enquanto o schema `Bank`
declara `code` como obrigatório e do tipo inteiro. Um consumidor que confie na
documentação e use `banco.code` diretamente quebra em produção, e ninguém
consegue usar o campo como chave.

**BAPI-40 — a v2 do CEP promete geolocalização e entrega objeto vazio.** O
`location.coordinates` volta sem `longitude` nem `latitude`, embora o schema
`Coordinates` declare os dois como obrigatórios.

**BAPI-68, BAPI-72 e BAPI-73 — linhas inválidas na lista do PIX.** Foi possível
localizar a causa exata no código da BrasilAPI, em `services/pix/participants.js`:

```js
.map((line) => line.split(';'))
.filter(([ispb]) => ispb)          // filtra pela coluna 0
.map((data) => ({
  ispb: data[2],                   // mas o ISPB está na coluna 2
```

O `filter` batiza a coluna 0 de `ispb` e descarta linhas em que ela está vazia.
Como o ISPB real está na coluna 2, linhas com a coluna 0 preenchida e a coluna 2
vazia passam pelo filtro e viram participantes sem identificador. Foram
observados 19 itens com `ispb` vazio, além de um ISPB legítimo repetido e de
itens sem nenhum dos campos obrigatórios. De quebra, o `tipo_participacao` agora
vem como `Direta` e `Indireta`, enquanto o exemplo da spec mostra `DRCT`.

Este é um defeito concreto, com a linha identificada, e vale reportar como issue
no repositório da BrasilAPI.

### Correção de uma afirmação anterior

Este documento e o README afirmavam que as linhas `[LACUNA BAPI-nn]` apareceriam
dentro do relatório HTML do Mochawesome. Não aparecem: o Mochawesome não captura
`console.log` sem a biblioteca `mochawesome/addContext`. As linhas saem apenas no
terminal. A afirmação foi corrigida no README.

## Terceira rodada: o limite de requisições do CNPJ

A segunda execução real caiu de 23 para 16 falhas. Os seis casos vermelhos por
decisão apareceram como esperado. Os outros dez continuaram no CNPJ, e o relato
de que "os testes de CNPJ demoraram bastante" era a pista principal.

### O que os tempos mostraram

Quatro casos levaram exatamente 6,3 segundos cada. Esse número corresponde à
soma das esperas de `pedirComPaciencia` na configuração anterior, de 2s e 4s:
ou seja, as três tentativas foram gastas e o 429 persistiu do começo ao fim.
Outros casos do mesmo bloco responderam em 0,1s sem nenhum problema.

Isso desmontou a hipótese inicial. Não era uma rajada curta que a espera de
poucos segundos resolveria. A conclusão prática é que **retentativa rápida piora
o problema**: cada nova tentativa consome a mesma cota que se está tentando
poupar. Insistir é exatamente o comportamento que o limite existe para punir.

### A correção estrutural

O arquivo passou a separar coleta de verificação. Todas as chamadas HTTP
acontecem uma única vez, no bloco `before`, em sequência e espaçadas por 2,5
segundos. Cada `it` virou uma asserção sobre dados já coletados, sem tocar na
rede.

O ganho é triplo. O número de chamadas caiu de onze para oito, e nenhuma é
repetida por dois casos diferentes. A espera de `pedirComPaciencia` subiu para
5s e 10s, mas passou a ser rede de segurança em vez de estratégia principal. E
como os `it` não fazem mais requisições, o `retries: 1` do Mocha deixou de
dobrar o consumo quando um caso falha.

O bloco de CNPJ passou a levar cerca de vinte segundos, previsíveis e
proporcionais ao espaçamento. Se o limite voltar a aparecer, a constante
`ESPACO_ENTRE_CHAMADAS_MS`, no topo do arquivo, é o único ponto a ajustar, e a
mensagem de falha do BAPI-49 diz isso explicitamente.

### O exemplo de 404 da documentação é um CNPJ que existe

O BAPI-54 falhou com `expected 200 to equal 404`. O valor usado era
`00000000000191`, que a massa tratava como inexistente porque é o próprio
exemplo de 404 da documentação da BrasilAPI.

Só que `00.000.000/0001-91` é o CNPJ real do Banco do Brasil. Ele existe, está
registrado e devolve 200. A documentação escolheu como exemplo de "não
encontrado" justamente um cadastro que é encontrado.

A correção seguiu o mesmo raciocínio aplicado ao CEP: a massa passou a ter uma
lista de candidatos com dígito verificador válido, calculado pela regra oficial,
e o caso testa cada um até encontrar o que devolve 404. O achado sobre o exemplo
da documentação ficou registrado na matriz.

### O 429 deixou de derrubar o BAPI-76

O caso BAPI-76 exigia o header `Retry-After` na resposta 429. A resposta
observada não traz esse header, o que é uma lacuna legítima, mas transformá-la em
falha ampliaria o conjunto de casos vermelhos além dos seis acordados.

O caso passou a registrar a evidência sem falhar, que é a convenção de lacuna já
usada no resto da suíte. Para isso, `pedirComPaciencia` guarda a resposta 429
que foi absorvida por uma retentativa, em `resposta.respostaLimitada`. Sem esse
detalhe o caso não teria como saber que o limite foi atingido, já que a resposta
final devolvida é a bem-sucedida.

## Limitação desta rodada

Os testes foram escritos a partir da spec e do código-fonte da BrasilAPI e
verificados contra um dublê local que reproduz esse comportamento. A execução
contra a API pública ainda precisa ser feita no ambiente do time, porque o
ambiente onde a suíte foi montada não tem acesso de rede ao domínio
`brasilapi.com.br`.

O que essa verificação garante: a suíte carrega, os schemas Ajv aceitam os
exemplos da spec e rejeitam corpos fora do contrato, e nenhuma asserção é
autocontraditória. O que ela não garante: que a API pública se comporte hoje
exatamente como o código-fonte lido indica. A primeira execução real deve ser
tratada como parte da investigação, e qualquer divergência encontrada deve voltar
para a matriz.

Há ainda um ponto que a suíte não consegue exercitar de fora: o middleware
`firewall` recusa com 401 toda requisição que não chegue através do Cloudflare
quando `NEXT_PUBLIC_VERCEL_ENV` é `production`. Esse controle não aparece em
lugar nenhum da documentação e é invisível para quem consome pelo domínio
oficial. Vale registrar como risco de operação para consumidores que tentem
acessar a origem diretamente.
