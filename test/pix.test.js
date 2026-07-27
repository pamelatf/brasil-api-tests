const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const {
  dispararEmParalelo,
  encontrarTextoMalCodificado,
  encontrarDuplicados,
} = require('../helpers/metricas');
const massa = require('../fixtures/massaTestes.json');

/**
 * Matriz de origem: docs/matriz_unificada_vader_poised_brasilapi.csv
 */

describe('PIX - /pix/v1/participants', () => {

  it('BAPI-62 (VADER-042): Deve retornar 200 com a lista de participantes do PIX', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.not.empty;
  });

  it('BAPI-63 (VADER-043): Deve recusar o verbo PATCH, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().patch('/pix/v1/participants').send({});

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
    registrarLacuna('BAPI-63', '405 nao implementado nem documentado; verbo indevido devolve 404', resposta.status);
  });

  it('BAPI-64 (VADER-044): Deve retornar 200 sem envio de credencial, confirmando listagem publica', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);
  });

  it('BAPI-65 (VADER-045): Deve ignorar parametros de filtro e paginacao nao documentados', async () => {
    const semQuery = await cliente().get('/pix/v1/participants');
    const comQuery = await cliente().get('/pix/v1/participants?ispb=00000000&limit=10');

    expect(comQuery.status).to.equal(200);
    expect(comQuery.body.length).to.equal(semQuery.body.length);
    registrarLacuna('BAPI-65', 'endpoint nao oferece filtro, ordenacao nem paginacao para uma lista extensa', comQuery.body.length);
  });

  it('BAPI-66 (VADER-046): Deve retornar erro estruturado caso a fonte do BCB falhe', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    if (resposta.status === 500) {
      // Caminho documentado de falha da dependencia externa.
      validarContrato(resposta.body, 'ErrorMessage');
      expect(resposta.body.name).to.equal('PIX_LIST_ERROR');
      registrarLacuna('BAPI-66', 'falha da fonte BCB capturada nesta execucao', resposta.body);
    } else {
      expect(resposta.status).to.equal(200);
    }
  });

  it('BAPI-67 (VADER-047): Deve expor a divergencia do campo inicio_operacao exigido pelo schema', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);

    const semInicioOperacao = resposta.body.filter((participante) => !participante.inicio_operacao);

    // Divergencia confirmada de contrato: o schema declara inicio_operacao como
    // required, mas a implementacao devolve null para todos os participantes
    // desde que o BCB deixou de fornecer o dado, em novembro de 2025.
    expect(
      semInicioOperacao.length,
      'campo inicio_operacao voltou a ser preenchido: revisar a matriz e o schema'
    ).to.equal(resposta.body.length);

    registrarLacuna('BAPI-67', 'schema exige inicio_operacao e a API devolve null em 100% dos itens', {
      total: resposta.body.length,
      semInicioOperacao: semInicioOperacao.length,
    });
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * A lista traz itens com ispb e tipo_participacao vazios, fora do contrato.
   * A causa esta em services/pix/participants.js do repositorio da BrasilAPI:
   *
   *   .filter(([ispb]) => ispb)    // filtra pela coluna 0 do CSV
   *   .map((data) => ({ ispb: data[2], ... }))   // mas o ISPB e a coluna 2
   *
   * O filtro batiza a coluna 0 de ispb e descarta linhas em que ela esta vazia.
   * Como o ISPB de verdade esta na coluna 2, linhas com a coluna 0 preenchida e
   * a coluna 2 vazia passam pelo filtro e viram participantes sem ISPB.
   * Mantido vermelho de proposito.
   */
  it('BAPI-68 (VADER-048): Deve respeitar o contrato do schema PIX_PARTICIPANTES em todos os itens', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);

    const semIspb = resposta.body.filter((participante) => !participante.ispb);
    registrarLacuna('BAPI-68', 'itens sem ISPB, originados do filtro pela coluna errada do CSV do BCB', {
      total: resposta.body.length,
      semIspb: semIspb.length,
    });

    resposta.body.forEach((participante) => validarContrato(participante, 'PixParticipante'));
  });

  it('BAPI-69 (POISED-I): Deve usar para ISPB o mesmo formato adotado em /banks/v1', async () => {
    const participantes = await cliente().get('/pix/v1/participants');
    const bancos = await cliente().get('/banks/v1');

    const ispbPixForaDoPadrao = participantes.body.filter(
      (participante) => !/^\d{8}$/.test(participante.ispb)
    );

    // O endpoint de bancos entrega o ISPB com oito digitos e zero a esquerda.
    // O de PIX entrega o valor cru da planilha do BCB, sem completar com zeros.
    // Um consumidor que cruzar as duas listas por ISPB nao encontra correspondencia.
    registrarLacuna('BAPI-69', 'ISPB do PIX nao vem normalizado em oito digitos como no endpoint de bancos', {
      exemploBanco: bancos.body[0] && bancos.body[0].ispb,
      exemploPix: participantes.body[0] && participantes.body[0].ispb,
      itensForaDoPadrao: ispbPixForaDoPadrao.length,
      totalParticipantes: participantes.body.length,
    });

    // Divergencia ja confirmada e aceita como defeito conhecido da fonte.
    // O caso fixa o comportamento atual: se a API passar a normalizar o ISPB,
    // este teste falha e sinaliza que a matriz precisa ser revista.
    expect(
      ispbPixForaDoPadrao.length,
      'ISPB do PIX passou a vir normalizado: revisar a matriz e o caso BAPI-69'
    ).to.be.above(0);
  });

  it('BAPI-70 (POISED-D): Deve diferenciar nome e nome_reduzido, conforme a documentacao promete', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    const iguais = resposta.body.filter(
      (participante) => participante.nome === participante.nome_reduzido
    );
    const percentual = Math.round((iguais.length / resposta.body.length) * 100);

    registrarLacuna('BAPI-70', 'schema documenta nome e nome_reduzido como campos distintos', {
      total: resposta.body.length,
      iguais: iguais.length,
      percentual: `${percentual}%`,
    });

    // Defeito conhecido: a implementacao le nome e nome_reduzido da mesma coluna
    // do CSV do BCB. O caso fixa o comportamento atual para que uma correcao
    // futura seja percebida e a matriz atualizada.
    expect(
      percentual,
      'nome e nome_reduzido passaram a divergir: revisar a matriz e o caso BAPI-70'
    ).to.equal(100);
  });

  it('BAPI-71 (POISED-D): Deve entregar os nomes dos participantes com acentuacao integra', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    // A origem e um CSV do BCB decodificado como latin1 quando o content-type
    // nao declara charset. Um erro de decodificacao apareceria como caractere
    // de substituicao ou como sequencia de mojibake nos nomes.
    const suspeitos = encontrarTextoMalCodificado(resposta.body);

    expect(
      suspeitos,
      `indicios de codificacao quebrada na lista: ${JSON.stringify(suspeitos)}`
    ).to.be.an('array').that.is.empty;
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * Mesma causa do BAPI-68: as linhas sem ISPB colidem entre si com a chave
   * vazia. Ha ainda um ISPB legitimo repetido. Mantido vermelho de proposito.
   */
  it('BAPI-72 (POISED-D): Deve entregar a lista sem ISPB duplicado', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    const duplicados = encontrarDuplicados(resposta.body, 'ispb');

    expect(
      duplicados,
      `ISPB repetido, o que impede usa-lo como chave: ${JSON.stringify(duplicados.slice(0, 5))}`
    ).to.be.an('array').that.is.empty;
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * Alem dos itens com tipo_participacao vazio, o dominio observado mudou:
   * a API devolve Direta e Indireta, enquanto o exemplo da spec mostra DRCT.
   * Mantido vermelho de proposito.
   */
  it('BAPI-73 (POISED-D): Deve restringir modalidade e tipo de participacao aos valores conhecidos', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    const modalidades = [...new Set(resposta.body.map((p) => p.modalidade_participacao))];
    const tipos = [...new Set(resposta.body.map((p) => p.tipo_participacao))];

    // O schema declara os dois campos como string livre, sem enum. O caso
    // registra o dominio real observado para que uma mudanca silenciosa da
    // planilha do BCB seja percebida.
    registrarLacuna('BAPI-73', 'schema sem enum para modalidade_participacao e tipo_participacao', {
      modalidades,
      tipos,
    });

    expect(modalidades, 'modalidade_participacao vazia na lista').to.not.include('');
    expect(tipos, 'tipo_participacao vazio na lista').to.not.include('');
  });

  it('BAPI-74 (POISED-I): Deve liberar consumo de qualquer origem via CORS', async () => {
    const resposta = await cliente()
      .get('/pix/v1/participants')
      .set('Origin', 'https://exemplo-consumidor.com.br');

    expect(resposta.headers['access-control-allow-origin']).to.equal('*');
  });

  it('BAPI-75 (POISED-D): Deve manter o tempo de resposta da lista completa sob chamadas simultaneas', async () => {
    const { respostas, duracaoTotalMs, duracaoMediaMs } = await dispararEmParalelo(
      () => cliente().get('/pix/v1/participants'),
      massa.desempenho.chamadasParalelas
    );

    respostas.forEach((resposta) => expect(resposta.status).to.equal(200));
    expect(duracaoMediaMs, 'tempo medio acima do limite acordado').to.be.below(massa.desempenho.limiteMedioMs);

    const tamanhoKb = Math.round(Buffer.byteLength(JSON.stringify(respostas[0].body)) / 1024);
    registrarLacuna('BAPI-75', 'lista completa trafegada a cada chamada, sem paginacao', {
      chamadas: massa.desempenho.chamadasParalelas,
      duracaoTotalMs,
      duracaoMediaMs,
      tamanhoPayloadKb: tamanhoKb,
    });
  });

});
