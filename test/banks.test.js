const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const { dispararEmParalelo, encontrarDuplicados } = require('../helpers/metricas');
const massa = require('../fixtures/massaTestes.json');

/**
 * Matriz de origem: docs/matriz_unificada_vader_poised_brasilapi.csv
 * Cada caso traz, entre parenteses, o identificador VADER original quando
 * existe, ou a categoria POISED que motivou o caso quando ele e novo.
 */

describe('BANKS - /banks/v1', () => {

  it('BAPI-01 (VADER-001): Deve retornar 200 com um array de bancos ao consultar a listagem', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.not.empty;
  });

  it('BAPI-02 (VADER-002): Deve recusar o verbo POST, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().post('/banks/v1').send({});

    // A API registra apenas o handler de GET. Verbos nao registrados caem no
    // onNoMatch do next-connect, que responde 404 e nao 405.
    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
    registrarLacuna('BAPI-02', '405 nao implementado nem documentado; verbo indevido devolve 404', resposta.status);
  });

  it('BAPI-03 (VADER-003): Deve retornar 200 sem envio de credencial, confirmando endpoint publico', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.status).to.equal(200);
    registrarLacuna('BAPI-03', 'securitySchemes vazio na spec: nenhum controle de acesso declarado', resposta.status);
  });

  it('BAPI-04 (VADER-004): Deve ignorar o header Authorization nao previsto na documentacao', async () => {
    const resposta = await cliente()
      .get('/banks/v1')
      .set('Authorization', 'Bearer token-invalido');

    expect(resposta.status).to.equal(200);
  });

  it('BAPI-05 (VADER-005): Deve ignorar query strings nao documentadas e retornar a lista completa', async () => {
    const semQuery = await cliente().get('/banks/v1');
    const comQuery = await cliente().get('/banks/v1?code=001&debug=true');

    expect(comQuery.status).to.equal(200);
    expect(comQuery.body.length).to.equal(semQuery.body.length);
  });

  it('BAPI-06 (VADER-006): Deve retornar 404 para rota nao mapeada sob o mesmo recurso', async () => {
    const resposta = await cliente().get('/banks/v1/extra/inexistente');

    expect(resposta.status).to.equal(404);
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * A lista devolve itens com code nulo, enquanto o schema Bank declara code
   * como obrigatorio e do tipo integer. Quem confiar na documentacao e usar
   * banco.code diretamente quebra em producao. Mantido vermelho de proposito,
   * como relatorio permanente do defeito. Detalhe em docs/correcoes_aplicadas.md.
   */
  it('BAPI-07 (VADER-007): Deve respeitar o contrato do schema Bank em todos os itens da lista', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.status).to.equal(200);

    const foraDoContrato = resposta.body.filter(
      (banco) => !Number.isInteger(banco.code)
    );
    registrarLacuna('BAPI-07', 'itens da lista com code fora do tipo declarado no schema Bank', {
      total: resposta.body.length,
      foraDoContrato: foraDoContrato.length,
      exemplos: foraDoContrato.slice(0, 3),
    });

    resposta.body.forEach((banco) => validarContrato(banco, 'Bank'));
  });

  it('BAPI-08 (VADER-008): Deve retornar Content-Type application/json e expor os headers de cache', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.headers['content-type']).to.include('application/json');
    expect(resposta.headers['cache-control'], 'header Cache-Control ausente').to.be.a('string');
    registrarLacuna('BAPI-08', 'headers de cache nao documentados na spec', {
      cacheControl: resposta.headers['cache-control'],
      age: resposta.headers['age'],
    });
  });

  it('BAPI-17 (POISED-I): Deve liberar consumo de qualquer origem via CORS', async () => {
    const resposta = await cliente().get('/banks/v1').set('Origin', 'https://exemplo-consumidor.com.br');

    expect(resposta.status).to.equal(200);
    expect(resposta.headers['access-control-allow-origin']).to.equal('*');
    registrarLacuna('BAPI-17', 'politica de CORS totalmente aberta e nao documentada na spec', resposta.headers['access-control-allow-origin']);
  });

  it('BAPI-18 (POISED-I): Deve responder ao preflight OPTIONS sem exigir credencial', async () => {
    const resposta = await cliente()
      .options('/banks/v1')
      .set('Origin', 'https://exemplo-consumidor.com.br')
      .set('Access-Control-Request-Method', 'GET');

    expect([200, 204], `status inesperado no preflight: ${resposta.status}`).to.include(resposta.status);
    registrarLacuna('BAPI-18', 'verbo OPTIONS respondido porem nao documentado', {
      status: resposta.status,
      allowMethods: resposta.headers['access-control-allow-methods'],
    });
  });

  it('BAPI-19 (POISED-I): Deve suportar HEAD devolvendo os mesmos headers do GET sem corpo', async () => {
    const get = await cliente().get('/banks/v1');
    const head = await cliente().head('/banks/v1');

    expect(head.status).to.equal(get.status);
    expect(head.headers['content-type']).to.equal(get.headers['content-type']);
    expect(head.text, 'HEAD nao deve devolver corpo').to.satisfy((texto) => !texto);
  });

  it('BAPI-20 (POISED-I): Deve responder em JSON mesmo quando o cliente negocia outro formato', async () => {
    const resposta = await cliente().get('/banks/v1').set('Accept', 'application/xml');

    // A API nao implementa content negotiation: devolve JSON independente do Accept.
    expect(resposta.status).to.equal(200);
    expect(resposta.headers['content-type']).to.include('application/json');
    registrarLacuna('BAPI-20', 'Accept ignorado; 406 nao implementado nem documentado', {
      accept: 'application/xml',
      contentType: resposta.headers['content-type'],
    });
  });

  /**
   * DEFEITO CONFIRMADO DA API - falha esperada.
   * A lista traz codigos repetidos e codigos nulos. O codigo do banco e o que
   * identifica o item, entao repeticao impede o consumidor de usa-lo como chave.
   * Mantido vermelho de proposito.
   */
  it('BAPI-21 (POISED-D): Deve entregar a lista sem codigos duplicados e com ISPB de oito digitos', async () => {
    const resposta = await cliente().get('/banks/v1');

    const duplicados = encontrarDuplicados(resposta.body, 'code');
    expect(
      duplicados,
      `codigo do banco repetido, o que impede usa-lo como chave: ${JSON.stringify(duplicados)}`
    ).to.be.an('array').that.is.empty;

    const ispbForaDoPadrao = resposta.body.filter((banco) => !/^\d{8}$/.test(banco.ispb));
    expect(
      ispbForaDoPadrao,
      `itens com ISPB fora do formato de oito digitos: ${JSON.stringify(ispbForaDoPadrao.slice(0, 3))}`
    ).to.be.an('array').that.is.empty;
  });

  it('BAPI-23 (POISED-D): Deve manter o tempo de resposta sob chamadas simultaneas', async () => {
    const { respostas, duracaoTotalMs, duracaoMediaMs } = await dispararEmParalelo(
      () => cliente().get('/banks/v1'),
      massa.desempenho.chamadasParalelas
    );

    respostas.forEach((resposta) => expect(resposta.status).to.equal(200));
    expect(duracaoMediaMs, 'tempo medio acima do limite acordado').to.be.below(massa.desempenho.limiteMedioMs);
    registrarLacuna('BAPI-23', 'nenhum rate limit ou limite de concorrencia documentado', {
      chamadas: massa.desempenho.chamadasParalelas,
      duracaoTotalMs,
      duracaoMediaMs,
    });
  });

  it('BAPI-24 (POISED-D): Deve declarar uma politica de cache observavel pelo consumidor', async () => {
    const resposta = await cliente().get('/banks/v1');
    const cacheControl = resposta.headers['cache-control'] || '';

    // A API envia s-maxage no codigo-fonte, mas essa diretiva e dirigida ao
    // cache compartilhado: a CDN a consome e a remove antes de a resposta
    // chegar ao cliente. Por isso o caso verifica o que e de fato observavel
    // de fora e registra as evidencias de cache para analise.
    expect(cacheControl, 'header Cache-Control ausente na resposta').to.be.a('string').that.is.not.empty;
    registrarLacuna('BAPI-24', 'janela de cache nao e observavel de fora: s-maxage e consumido pela CDN', {
      cacheControl,
      idadeDoCache: resposta.headers['age'],
      statusDaCdn: resposta.headers['x-vercel-cache'],
    });
  });

});

describe('BANKS - /banks/v1/{code}', () => {

  it('BAPI-09 (VADER-009): Deve retornar 200 com um unico banco ao consultar por codigo valido', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoValido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('object');
    expect(resposta.body.code).to.equal(massa.banks.codigoValido);
  });

  it('BAPI-10 (VADER-010): Deve recusar o verbo DELETE, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().delete(`/banks/v1/${massa.banks.codigoValido}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
    registrarLacuna('BAPI-10', 'verbo destrutivo devolve 404 em vez de 405', resposta.status);
  });

  it('BAPI-11 (VADER-011): Deve retornar 200 sem envio de credencial na consulta unitaria', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoValido}`);

    expect(resposta.status).to.equal(200);
  });

  it('BAPI-12 (VADER-012): Deve tratar codigo nao numerico sem retornar erro interno', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoNaoNumerico}`);

    // A implementacao converte o parametro com Number(). Um valor nao numerico
    // vira NaN, nao encontra o banco e cai no 404, sem validacao de tipo.
    expect(resposta.status).to.equal(404);
    registrarLacuna('BAPI-12', 'parametro declarado como integer sem validacao de tipo; 400 nao documentado', resposta.status);
  });

  it('BAPI-13 (VADER-013): Deve tratar valores de borda do codigo de forma consistente', async () => {
    const observado = [];

    for (const borda of massa.banks.bordas) {
      const resposta = await cliente().get(`/banks/v1/${borda}`);

      expect(resposta.status, `codigo ${borda}`).to.be.below(500);
      observado.push({ borda, status: resposta.status });
    }

    // Nao se exige o mesmo status nas tres bordas: existe banco com codigo 0
    // na base, entao 0 devolve 200 enquanto -1 e 999999999 devolvem 404.
    // O que se exige e que nenhuma borda derrube o servidor.
    registrarLacuna('BAPI-13', 'nenhum minimo ou maximo documentado para o parametro code; codigo 0 existe na base', observado);
  });

  it('BAPI-14 (VADER-014): Deve retornar 404 quando o codigo do banco nao existir', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoInexistente}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('BANK_CODE_NOT_FOUND');
  });

  it('BAPI-15 (VADER-015): Deve tratar caracteres especiais no path sem vazar informacao interna', async () => {
    for (const payload of massa.seguranca.payloadsDeInjecao) {
      const resposta = await cliente().get(`/banks/v1/${encodeURIComponent(payload)}`);

      expect(resposta.status, `payload ${payload}`).to.be.below(500);

      // Inspeciona corpo estruturado e corpo bruto: rotas nao mapeadas na
      // BrasilAPI caem na pagina 404 do Next.js, que nao devolve JSON.
      const corpo = `${JSON.stringify(resposta.body || '')} ${resposta.text || ''}`;
      massa.seguranca.termosQueNaoPodemVazar.forEach((termo) => {
        expect(corpo, `payload ${payload} vazou o termo ${termo}`).to.not.include(termo);
      });
    }
  });

  it('BAPI-16 (VADER-016): Deve retornar o corpo do 404 aderente ao schema ErrorMessage', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoInexistente}`);

    expect(resposta.status).to.equal(404);
    // Divergencia de documentacao: o exemplo do 404 na spec traz apenas message
    // e type, mas o schema ErrorMessage exige tambem name. A implementacao
    // devolve os tres campos, ou seja, o defeito esta no exemplo da spec.
    validarContrato(resposta.body, 'ErrorMessage');
    registrarLacuna('BAPI-16', 'exemplo do 404 na spec omite o campo name exigido pelo schema', resposta.body);
  });

  it('BAPI-22 (POISED-O): Deve devolver na consulta unitaria o mesmo objeto presente na listagem', async () => {
    const lista = await cliente().get('/banks/v1');
    const bancoNaLista = lista.body.find((banco) => banco.code === massa.banks.codigoValido);

    expect(bancoNaLista, `codigo ${massa.banks.codigoValido} ausente na listagem`).to.be.an('object');

    const unitario = await cliente().get(`/banks/v1/${massa.banks.codigoValido}`);

    expect(unitario.status).to.equal(200);
    expect(unitario.body).to.deep.equal(bancoNaLista);
  });

});
