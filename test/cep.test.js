const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const { dispararEmParalelo, encontrarTextoMalCodificado } = require('../helpers/metricas');
const massa = require('../fixtures/massaTestes.json');

/**
 * Matriz de origem: docs/matriz_unificada_vader_poised_brasilapi.csv
 */

/**
 * A inexistência de um CEP não é garantida por ninguém. O valor 99999999,
 * usado na primeira versão da suíte, passou a ser reconhecido por um dos
 * provedores e derrubou dois casos. Em vez de trocar por outro valor fixo, que
 * envelheceria do mesmo jeito, os casos descobrem em tempo de execução qual dos
 * candidatos da massa ainda devolve 404. A descoberta é feita uma única vez e
 * reaproveitada pelos dois blocos.
 */
let cepInexistenteEmCache;

async function obterCepInexistente() {
  if (cepInexistenteEmCache) {
    return cepInexistenteEmCache;
  }

  const tentados = [];

  for (const candidato of massa.cep.candidatosInexistentes) {
    const resposta = await cliente().get(`/cep/v1/${candidato}`);
    tentados.push({ candidato, status: resposta.status });

    if (resposta.status === 404) {
      cepInexistenteEmCache = candidato;
      registrarLacuna('massa', 'CEP inexistente escolhido em tempo de execucao', tentados);
      return candidato;
    }
  }

  throw new Error(
    `Nenhum dos candidatos de CEP inexistente devolveu 404. Tentativas: ${JSON.stringify(tentados)}. ` +
    'Acrescente novos valores em fixtures/massaTestes.json -> cep.candidatosInexistentes.'
  );
}

describe('CEP - /cep/v1/{cep}', () => {

  it('BAPI-25 (VADER-017): Deve retornar 200 com o endereco ao consultar um CEP valido', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.cep).to.equal(massa.cep.valido);
  });

  it('BAPI-26 (VADER-018): Deve recusar o verbo PUT, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().put(`/cep/v1/${massa.cep.valido}`).send({});

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
    registrarLacuna('BAPI-26', '405 nao implementado nem documentado; verbo indevido devolve 404', resposta.status);
  });

  it('BAPI-27 (VADER-019): Deve retornar 200 sem envio de credencial, confirmando consulta publica', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    registrarLacuna('BAPI-27', 'consulta de endereco sem autenticacao e sem rate limit documentado', resposta.status);
  });

  it('BAPI-28 (VADER-020): Deve preservar o zero a esquerda mesmo com o parametro declarado como integer', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.comZeroAEsquerda}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.cep).to.equal(massa.cep.comZeroAEsquerda);
    registrarLacuna('BAPI-28', 'parametro declarado como integer int64 nao preservaria o zero a esquerda; a implementacao trata como string', resposta.body.cep);
  });

  it('BAPI-29 (VADER-021): Deve aceitar CEP formatado com hifen mesmo sem previsao no tipo declarado da v1', async () => {
    const resposta = await cliente().get('/cep/v1/01001-000');

    // A implementacao remove os caracteres nao numericos antes de consultar,
    // entao a formatacao e aceita apesar de o tipo declarado ser integer.
    expect(resposta.status).to.equal(200);
    expect(resposta.body.cep).to.equal('01001000');
    registrarLacuna('BAPI-29', 'formatacao com hifen aceita porem nao prevista pelo tipo declarado na v1', resposta.body.cep);
  });

  it('BAPI-30 (VADER-022): Deve retornar 404 com o schema CepError quando o CEP nao existir', async () => {
    const cepInexistente = await obterCepInexistente();
    const resposta = await cliente().get(`/cep/v1/${cepInexistente}`);

    expect(resposta.status).to.equal(404);
    validarContrato(resposta.body, 'CepError');
    expect(resposta.body.errors).to.be.an('array').that.is.not.empty;
    expect(resposta.body.type).to.equal('service_error');

    // A spec exige name em cada item de errors. Verificado a parte porque a
    // ausencia e um defeito conhecido de contrato, nao motivo de falha do caso.
    const itensSemName = resposta.body.errors.filter((erro) => !erro.name);
    if (itensSemName.length > 0) {
      registrarLacuna('BAPI-30', 'itens de errors sem o campo name exigido pelo schema Error', itensSemName);
    }
  });

  it('BAPI-31 (VADER-023): Deve retornar 400 para CEP com quantidade incorreta de digitos', async () => {
    for (const entrada of [massa.cep.curto, massa.cep.longo]) {
      const resposta = await cliente().get(`/cep/v1/${entrada}`);

      expect(resposta.status, `entrada ${entrada}`).to.equal(400);
      expect(resposta.body.type, `entrada ${entrada}`).to.equal('validation_error');
    }

    registrarLacuna('BAPI-31', '400 devolvido pela v1 porem ausente na documentacao, que so declara 200 e 404', 400);
  });

  it('BAPI-32 (VADER-024): Deve respeitar o contrato do schema Address na resposta de sucesso', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    validarContrato(resposta.body, 'Address');
    expect(resposta.body.service).to.be.a('string').that.is.not.empty;
  });

  it('BAPI-43 (POISED-S): Deve tratar payloads de injecao no parametro sem vazar informacao interna', async () => {
    for (const payload of massa.seguranca.payloadsDeInjecao) {
      const resposta = await cliente().get(`/cep/v1/${encodeURIComponent(payload)}`);

      expect(resposta.status, `payload ${payload}`).to.be.below(500);

      const corpo = `${JSON.stringify(resposta.body || '')} ${resposta.text || ''}`;
      massa.seguranca.termosQueNaoPodemVazar.forEach((termo) => {
        expect(corpo, `payload ${payload} vazou o termo ${termo}`).to.not.include(termo);
      });
    }
  });

  it('BAPI-44 (POISED-E): Deve explicar no erro 400 qual e o tamanho esperado do CEP', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.curto}`);

    expect(resposta.status).to.equal(400);
    expect(resposta.body.message, 'mensagem de erro nao informa o tamanho esperado').to.include('8');
    expect(resposta.body.errors, 'erro sem detalhamento por servico').to.be.an('array').that.is.not.empty;
  });

  it('BAPI-45 (POISED-D): Deve devolver os campos de texto com acentuacao integra', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.comAcentuacao}`);

    expect(resposta.status).to.equal(200);

    const suspeitos = encontrarTextoMalCodificado(resposta.body);
    expect(
      suspeitos,
      `indicios de codificacao quebrada no corpo: ${JSON.stringify(suspeitos)}`
    ).to.be.an('array').that.is.empty;
  });

  it('BAPI-47 (POISED-D): Deve declarar uma politica de cache observavel na consulta de CEP', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);
    const cacheControl = resposta.headers['cache-control'] || '';

    // Mesmo raciocinio do BAPI-24: o s-maxage do codigo-fonte e consumido pela
    // CDN e nao chega ao cliente. Verifica-se o que e observavel de fora.
    expect(cacheControl, 'header Cache-Control ausente na resposta').to.be.a('string').that.is.not.empty;
    registrarLacuna('BAPI-47', 'janela de cache do CEP nao e observavel de fora nem documentada', {
      cacheControl,
      idadeDoCache: resposta.headers['age'],
      statusDaCdn: resposta.headers['x-vercel-cache'],
    });
  });

});

describe('CEP V2 - /cep/v2/{cep}', () => {

  it('BAPI-33 (VADER-025): Deve retornar 200 com dados de geolocalizacao ao consultar um CEP valido', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.location).to.be.an('object');
  });

  it('BAPI-34 (VADER-026): Deve recusar o verbo POST, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().post(`/cep/v2/${massa.cep.valido}`).send({});

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
    registrarLacuna('BAPI-34', '405 nao implementado nem documentado; verbo indevido devolve 404', resposta.status);
  });

  it('BAPI-35 (VADER-027): Deve expor coordenadas geograficas sem exigir credencial', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    registrarLacuna('BAPI-35', 'geolocalizacao publica sem controle de acesso', {
      coordinates: resposta.body.location && resposta.body.location.coordinates,
    });
  });

  it('BAPI-36 (VADER-028): Deve aceitar as duas formas previstas no pattern e retornar dados equivalentes', async () => {
    const semFormatacao = await cliente().get(`/cep/v2/${massa.cep.valido}`);
    const comFormatacao = await cliente().get(`/cep/v2/${massa.cep.validoFormatado}`);

    expect(semFormatacao.status).to.equal(200);
    expect(comFormatacao.status).to.equal(200);

    // Comparacao campo a campo em vez de deep.equal do corpo inteiro: as
    // coordenadas vem de um servico externo de geocodificacao e podem variar
    // entre chamadas, o que tornaria a comparacao total instavel.
    ['cep', 'state', 'city', 'neighborhood', 'street', 'timezoneName'].forEach((campo) => {
      expect(comFormatacao.body[campo], `divergencia no campo ${campo}`).to.equal(semFormatacao.body[campo]);
    });
  });

  it('BAPI-37 (VADER-029): Deve retornar 400 quando o CEP nao tiver oito digitos', async () => {
    for (const entrada of [massa.cep.curto, massa.cep.naoNumerico]) {
      const resposta = await cliente().get(`/cep/v2/${encodeURIComponent(entrada)}`);

      expect(resposta.status, `entrada ${entrada}`).to.equal(400);
      expect(resposta.body.type, `entrada ${entrada}`).to.equal('validation_error');
      validarContrato(resposta.body, 'ErrorMessage');

      // A spec exemplifica o 400 com name igual a BadRequestError, mas a v2
      // serializa o erro do servico de CEP e devolve name CepPromiseError.
      if (resposta.body.name !== 'BadRequestError') {
        registrarLacuna('BAPI-37', 'name do erro 400 diverge do exemplo da spec', resposta.body.name);
      }
    }
  });

  it('BAPI-48 (POISED-P): Deve tratar entrada fora do pattern documentado que ainda contem oito digitos', async () => {
    const resposta = await cliente().get(`/cep/v2/${encodeURIComponent(massa.cep.foraDoPattern)}`);

    // O pattern documentado (^[0-9]{8}$|^[0-9]{5}-[0-9]{3}$) rejeitaria 01310_930,
    // mas a implementacao remove todo caractere nao numerico antes de validar.
    // O pattern da spec nao e efetivamente aplicado na borda.
    expect(resposta.status, `entrada ${massa.cep.foraDoPattern}`).to.be.below(500);
    registrarLacuna('BAPI-48', 'pattern documentado nao e aplicado: separadores arbitrarios sao removidos antes da validacao', {
      entrada: massa.cep.foraDoPattern,
      status: resposta.status,
      cepRetornado: resposta.body && resposta.body.cep,
    });
  });

  it('BAPI-38 (VADER-030): Deve retornar 404 quando o CEP nao for encontrado em nenhum provedor', async () => {
    const cepInexistente = await obterCepInexistente();
    const resposta = await cliente().get(`/cep/v2/${cepInexistente}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('service_error');
    validarContrato(resposta.body, 'ErrorMessage');
  });

  it('BAPI-39 (VADER-031): Deve manter os campos comuns identicos entre as versoes v1 e v2', async () => {
    const v1 = await cliente().get(`/cep/v1/${massa.cep.valido}`);
    const v2 = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    expect(v1.status).to.equal(200);
    expect(v2.status).to.equal(200);

    ['cep', 'state', 'city', 'neighborhood', 'street'].forEach((campo) => {
      expect(v2.body[campo], `divergencia no campo ${campo} entre v1 e v2`).to.equal(v1.body[campo]);
    });
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * A v2 promete geolocalizacao, mas devolve location.coordinates sem
   * longitude nem latitude, embora o schema Coordinates declare os dois campos
   * como obrigatorios. Mantido vermelho de proposito.
   */
  it('BAPI-40 (VADER-032): Deve respeitar o contrato do schema AddressV2 e da estrutura location', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    const coordenadas = (resposta.body.location && resposta.body.location.coordinates) || {};
    registrarLacuna('BAPI-40', 'coordenadas devolvidas pela v2 para o CEP consultado', coordenadas);

    validarContrato(resposta.body, 'AddressV2');
    validarContrato(resposta.body.location, 'Location');
    validarContrato(coordenadas, 'Coordinates');
  });

  it('BAPI-41 (POISED-I): Deve liberar consumo de qualquer origem via CORS nas duas versoes', async () => {
    const v1 = await cliente().get(`/cep/v1/${massa.cep.valido}`).set('Origin', 'https://exemplo-consumidor.com.br');
    const v2 = await cliente().get(`/cep/v2/${massa.cep.valido}`).set('Origin', 'https://exemplo-consumidor.com.br');

    expect(v1.headers['access-control-allow-origin']).to.equal('*');
    expect(v2.headers['access-control-allow-origin']).to.equal('*');
  });

  it('BAPI-42 (POISED-I): Deve manter a v1 compativel apos a introducao da v2', async () => {
    const v1 = await cliente().get(`/cep/v1/${massa.cep.valido}`);
    const v2 = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    // Contrato de compatibilidade entre versoes: a v2 e construida espalhando o
    // objeto da v1 e acrescentando timezoneName e location, entao ela mantem o
    // campo service e quem migrar nao perde a rastreabilidade do provider.
    // O schema AddressV2 da spec, porem, nao declara service: a v2 devolve um
    // campo a mais do que documenta.
    expect(v1.body).to.have.property('service');
    expect(v1.body, 'v1 nao deve expor campos da v2').to.not.have.property('location');
    expect(v2.body).to.have.property('location');
    expect(v2.body).to.have.property('timezoneName');
    expect(v2.body, 'v2 perdeu o campo service e quebrou quem migrou da v1').to.have.property('service');
    registrarLacuna('BAPI-42', 'v2 devolve o campo service, que nao consta no schema AddressV2', {
      v1: Object.keys(v1.body),
      v2: Object.keys(v2.body),
    });
  });

  it('BAPI-46 (POISED-D): Deve manter o tempo de resposta da v2 sob chamadas simultaneas', async () => {
    const { respostas, duracaoTotalMs, duracaoMediaMs } = await dispararEmParalelo(
      () => cliente().get(`/cep/v2/${massa.cep.valido}`),
      massa.desempenho.chamadasParalelas
    );

    respostas.forEach((resposta) => expect(resposta.status).to.equal(200));
    expect(duracaoMediaMs, 'tempo medio acima do limite acordado').to.be.below(massa.desempenho.limiteMedioMs);
    registrarLacuna('BAPI-46', 'v2 depende de geocodificacao e timezone externos, sem SLA documentado', {
      chamadas: massa.desempenho.chamadasParalelas,
      duracaoTotalMs,
      duracaoMediaMs,
    });
  });

});
