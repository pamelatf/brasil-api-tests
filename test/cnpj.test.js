const { expect } = require('chai');
const { cliente, pausar, pedirComPaciencia } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const massa = require('../fixtures/massaTestes.json');

/**
 * Matriz de origem: docs/matriz_unificada_vader_poised_brasilapi.csv
 *
 * Três pontos orientam a estrutura deste arquivo.
 *
 * 1. A BrasilAPI não valida o CNPJ localmente. O handler encaminha o parâmetro
 *    de path para https://minhareceita.org/{cnpj} e repassa o status e a
 *    mensagem recebidos. Vários casos verificam o comportamento de repasse, e
 *    não uma regra própria da BrasilAPI.
 *
 * 2. O recurso aplica limite de requisições no edge e responde 429 quando
 *    recebe muitas chamadas em pouco tempo. O limite vale para o caminho, não
 *    para o método: até o POST do caso BAPI-50, que sequer chega à fonte
 *    externa, é barrado.
 *
 * 3. Por causa disso, este arquivo separa coleta de verificação. Todas as
 *    chamadas HTTP acontecem uma única vez no bloco `before`, em sequência e
 *    espaçadas entre si. Cada `it` vira uma asserção sobre o que já foi
 *    coletado, sem tocar na rede. São 8 chamadas no total, contra as 11 da
 *    versão anterior, e nenhuma delas é repetida por dois casos diferentes.
 */

const ESPACO_ENTRE_CHAMADAS_MS = 2500;

const coleta = {};

/** Espaça a chamada da anterior e reexecuta se o edge devolver 429. */
async function coletar(executar) {
  await pausar(ESPACO_ENTRE_CHAMADAS_MS);
  return pedirComPaciencia(executar);
}

/**
 * O CNPJ 00.000.000/0001-91, usado como exemplo de 404 na própria
 * documentação da BrasilAPI, é o CNPJ real do Banco do Brasil e devolve 200.
 * Como a inexistência de um cadastro não é garantida por ninguém, o valor não
 * é fixo: os candidatos da massa são testados até um deles devolver 404.
 */
async function coletarCnpjInexistente() {
  const tentados = [];

  for (const candidato of massa.cnpj.candidatosInexistentes) {
    const resposta = await coletar(() => cliente().get(`/cnpj/v1/${candidato}`));
    tentados.push({ candidato, status: resposta.status });

    if (resposta.status === 404) {
      return { candidato, resposta, tentados };
    }
  }

  return { candidato: null, resposta: null, tentados };
}

describe('CNPJ - /cnpj/v1/{cnpj}', () => {

  before(async function () {
    this.timeout(180000);

    const inicio = Date.now();
    coleta.valido = await coletar(() =>
      cliente()
        .get(`/cnpj/v1/${massa.cnpj.valido}`)
        .set('Origin', 'https://exemplo-consumidor.com.br')
    );
    coleta.duracaoDoValidoMs = Date.now() - inicio;

    coleta.formatado = await coletar(() =>
      cliente().get(`/cnpj/v1/${encodeURIComponent(massa.cnpj.validoFormatado)}`)
    );

    coleta.digitoInvalido = await coletar(() =>
      cliente().get(`/cnpj/v1/${massa.cnpj.digitoVerificadorInvalido}`)
    );

    coleta.inexistente = await coletarCnpjInexistente();

    coleta.malFormatado = await coletar(() =>
      cliente().get(`/cnpj/v1/${massa.cnpj.malFormatado}`)
    );

    coleta.verboIndevido = await coletar(() =>
      cliente().post(`/cnpj/v1/${massa.cnpj.valido}`).send({})
    );

    coleta.injecoes = [];
    for (const payload of massa.seguranca.payloadsDeInjecaoCnpj) {
      const resposta = await coletar(() =>
        cliente().get(`/cnpj/v1/${encodeURIComponent(payload)}`)
      );
      coleta.injecoes.push({ payload, resposta });
    }

    // Considera tanto o 429 que chegou ao final quanto o que foi absorvido
    // por uma retentativa, para o caso BAPI-76 registrar os dois cenarios.
    coleta.houve429 = [
      coleta.valido,
      coleta.formatado,
      coleta.digitoInvalido,
      coleta.malFormatado,
      coleta.verboIndevido,
      ...coleta.injecoes.map(({ resposta }) => resposta),
    ]
      .filter(Boolean)
      .map((resposta) => (resposta.status === 429 ? resposta : resposta.respostaLimitada))
      .find(Boolean);
  });

  it.only('BAPI-49 (VADER-033): Deve retornar 200 com os dados cadastrais ao consultar um CNPJ valido', () => {
    expect(
      coleta.valido.status,
      'consulta ao CNPJ valido nao devolveu 200; se o status for 429, aumente ESPACO_ENTRE_CHAMADAS_MS'
    ).to.equal(200);
    expect(coleta.valido.body.cnpj).to.equal(massa.cnpj.valido);
  });

  it('BAPI-50 (VADER-034): Deve recusar o verbo POST, que nao e documentado para o endpoint', () => {
    expect(coleta.verboIndevido.status).to.equal(404);
    expect(coleta.verboIndevido.body.type).to.equal('not_found');
    registrarLacuna('BAPI-50', '405 nao implementado nem documentado; verbo indevido devolve 404', coleta.verboIndevido.status);
  });

  it('BAPI-51 (VADER-035): Deve retornar quadro societario e contatos sem exigir credencial', () => {
    expect(coleta.valido.status).to.equal(200);
    registrarLacuna('BAPI-51', 'dados societarios e de contato expostos sem nenhum controle de acesso', {
      qsa: Array.isArray(coleta.valido.body.qsa) ? coleta.valido.body.qsa.length : null,
      possuiEmail: Boolean(coleta.valido.body.email),
      possuiTelefone: Boolean(coleta.valido.body.ddd_telefone_1),
    });
  });

  it('BAPI-52 (VADER-036): Deve aceitar CNPJ com e sem formatacao, conforme o pattern documentado', () => {
    expect(coleta.valido.status).to.equal(200);

    // O pattern documentado aceita a forma pontuada, que contem uma barra.
    // Como a barra e o separador de segmentos de path, a forma formatada
    // depende de o roteamento preservar o %2F. Se nao preservar, o caso expoe
    // uma inconsistencia entre o pattern documentado e a URL efetivamente usavel.
    if (coleta.formatado.status === 200) {
      expect(coleta.formatado.body.cnpj).to.equal(coleta.valido.body.cnpj);
    } else {
      registrarLacuna('BAPI-52', 'forma pontuada prevista no pattern nao e roteavel por conter barra codificada', {
        entrada: massa.cnpj.validoFormatado,
        status: coleta.formatado.status,
      });
    }

    expect(coleta.formatado.status, 'forma pontuada nao pode gerar erro interno').to.be.below(500);
  });

  it('BAPI-53 (VADER-037): Deve recusar CNPJ com digito verificador invalido', () => {
    expect(coleta.digitoInvalido.status).to.be.oneOf([400, 404]);
    registrarLacuna('BAPI-53', 'validacao de digito verificador acontece na fonte externa e nao e documentada na spec', {
      status: coleta.digitoInvalido.status,
      type: coleta.digitoInvalido.body && coleta.digitoInvalido.body.type,
    });
  });

  it('BAPI-54 (VADER-038): Deve retornar 404 quando o CNPJ nao existir na base', () => {
    registrarLacuna('BAPI-54', 'candidatos testados ate encontrar um CNPJ realmente inexistente', coleta.inexistente.tentados);

    expect(
      coleta.inexistente.candidato,
      `nenhum candidato devolveu 404: ${JSON.stringify(coleta.inexistente.tentados)}. ` +
      'Acrescente valores em fixtures/massaTestes.json -> cnpj.candidatosInexistentes.'
    ).to.be.a('string');

    expect(coleta.inexistente.resposta.status).to.equal(404);
    expect(coleta.inexistente.resposta.body.type).to.equal('not_found');
    validarContrato(coleta.inexistente.resposta.body, 'ErrorMessage');
  });

  it('BAPI-55 (VADER-039): Deve responder dentro do tempo aceitavel mesmo dependendo de fonte externa', () => {
    expect(coleta.valido.status).to.be.below(500);
    expect(
      coleta.duracaoDoValidoMs - ESPACO_ENTRE_CHAMADAS_MS,
      'tempo de resposta acima do limite acordado'
    ).to.be.below(massa.desempenho.limiteUnitarioMs);
    registrarLacuna('BAPI-55', 'nenhum SLA, timeout ou status 500 documentado para a dependencia minhareceita.org', {
      duracaoMs: coleta.duracaoDoValidoMs - ESPACO_ENTRE_CHAMADAS_MS,
    });
  });

  it('BAPI-56 (VADER-040): Deve conter os campos minimos acordados, ja que o schema nao declara required', () => {
    expect(coleta.valido.status).to.equal(200);

    // Lacuna de contrato: o schema CNPJ da spec possui 48 propriedades e nenhuma
    // lista de required, ou seja, nenhum campo pode ser assumido pelo consumidor.
    validarContrato(coleta.valido.body, 'CNPJ');
    registrarLacuna('BAPI-56', 'schema com 48 propriedades e nenhuma required; contrato inutil para o consumidor', {
      camposRetornados: Object.keys(coleta.valido.body).length,
    });
  });

  it('BAPI-57 (VADER-041): Deve retornar 400 com mensagem coerente para CNPJ mal formatado', () => {
    expect(coleta.malFormatado.status).to.equal(400);
    expect(coleta.malFormatado.body.type).to.equal('bad_request');
    expect(coleta.malFormatado.body.message, 'mensagem de erro vazia').to.be.a('string').that.is.not.empty;

    // A spec exemplifica o 400 com a mensagem "CNPJ deve conter exatamente 11
    // digitos", quando o correto sao 14. O caso registra a mensagem real para
    // comparacao, sem falhar por causa de um defeito que esta na documentacao.
    registrarLacuna('BAPI-57', 'exemplo do 400 na spec cita 11 digitos; o correto sao 14', coleta.malFormatado.body.message);
  });

  it('BAPI-58 (POISED-S): Deve tratar payloads de injecao sem repassar detalhes da fonte externa', () => {
    coleta.injecoes.forEach(({ payload, resposta }) => {
      expect(resposta.status, `payload ${payload}`).to.be.below(500);

      const corpo = `${JSON.stringify(resposta.body || '')} ${resposta.text || ''}`;
      massa.seguranca.termosQueNaoPodemVazar.forEach((termo) => {
        expect(corpo, `payload ${payload} vazou o termo ${termo}`).to.not.include(termo);
      });
    });
  });

  it('BAPI-59 (POISED-I): Deve liberar consumo de qualquer origem via CORS', () => {
    expect(coleta.valido.status, 'sem resposta valida nao ha como avaliar o CORS').to.equal(200);
    expect(coleta.valido.headers['access-control-allow-origin']).to.equal('*');
  });

  it('BAPI-60 (POISED-O): Deve devolver exatamente o CNPJ consultado, sem normalizacao silenciosa', () => {
    expect(coleta.valido.status).to.equal(200);
    expect(coleta.valido.body.cnpj, 'CNPJ retornado diferente do consultado').to.equal(massa.cnpj.valido);
    expect(coleta.valido.body.razao_social, 'razao social ausente ou vazia').to.be.a('string').that.is.not.empty;
  });

  it('BAPI-61 (POISED-D): Deve declarar uma politica de cache coerente com o dado cadastral', () => {
    const cacheControl = coleta.valido.headers['cache-control'] || '';

    expect(cacheControl, 'header Cache-Control ausente na resposta').to.be.a('string').that.is.not.empty;

    // Achado: o codigo-fonte aplica o cache padrao de 86400s a este recurso,
    // mas a resposta observada chega com private e no-store, ou seja, sem
    // cache algum. A documentacao nao menciona nem um comportamento nem o outro.
    registrarLacuna('BAPI-61', 'cache observado diverge do declarado no codigo-fonte da API', {
      cacheControl,
      naoCacheado: cacheControl.includes('no-store'),
      possuiCampoDeAtualizacao: Boolean(coleta.valido.body.data_situacao_cadastral),
    });
  });

  it('BAPI-76 (POISED-E): Deve documentar o limite de requisicoes aplicado ao recurso', () => {
    // A spec declara apenas 200, 400 e 404 para este recurso, mas o edge
    // devolve 429 sob volume. Quem seguir a documentacao nao tem como saber
    // que precisa tratar esse status nem quanto tempo deve esperar.
    // O caso nao falha quando o 429 aparece: ele registra a evidencia, porque
    // o defeito esta na documentacao e nao no comportamento da suite.
    if (!coleta.houve429) {
      registrarLacuna('BAPI-76', 'nenhum 429 nesta execucao; limite nao foi atingido com o espacamento atual', {
        espacoEntreChamadasMs: ESPACO_ENTRE_CHAMADAS_MS,
      });
      return;
    }

    registrarLacuna('BAPI-76', '429 devolvido pelo recurso porem ausente da documentacao', {
      retryAfter: coleta.houve429.headers['retry-after'] || 'ausente',
      corpo: coleta.houve429.body,
      espacoEntreChamadasMs: ESPACO_ENTRE_CHAMADAS_MS,
    });

    expect(coleta.houve429.status).to.equal(429);
  });

});
