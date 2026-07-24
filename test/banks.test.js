const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const massa = require('../fixtures/massaTestes.json');

describe('BANKS - /banks/v1', () => {

  it('VADER-001: Deve retornar 200 com um array de bancos ao consultar a listagem', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.not.empty;
  });

  it('VADER-002: Deve rejeitar o verbo POST, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().post('/banks/v1').send({});

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-002', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-003: Deve retornar 200 sem envio de credencial, confirmando endpoint publico', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.status).to.equal(200);
  });

  it('VADER-004: Deve ignorar o header Authorization nao previsto na documentacao', async () => {
    const resposta = await cliente()
      .get('/banks/v1')
      .set('Authorization', 'Bearer token-invalido');

    expect(resposta.status).to.equal(200);
  });

  it('VADER-005: Deve ignorar query strings nao documentadas e retornar a lista completa', async () => {
    const semQuery = await cliente().get('/banks/v1');
    const comQuery = await cliente().get('/banks/v1?code=001&debug=true');

    expect(comQuery.status).to.equal(200);
    expect(comQuery.body.length).to.equal(semQuery.body.length);
  });

  it('VADER-006: Deve retornar 404 para rota nao mapeada sob o mesmo recurso', async () => {
    const resposta = await cliente().get('/banks/v1/extra/inexistente');

    expect(resposta.status).to.equal(404);
  });

  it('VADER-007: Deve respeitar o contrato do schema Bank em todos os itens da lista', async () => {
    const resposta = await cliente().get('/banks/v1');

    resposta.body.forEach((banco) => validarContrato(banco, 'Bank'));
  });

  it('VADER-008: Deve retornar Content-Type application/json e expor os headers de cache', async () => {
    const resposta = await cliente().get('/banks/v1');

    expect(resposta.headers['content-type']).to.include('application/json');
    registrarLacuna('VADER-008', 'headers de cache nao documentados', {
      cacheControl: resposta.headers['cache-control'],
      age: resposta.headers['age'],
    });
  });

});

describe('BANKS - /banks/v1/{code}', () => {

  it('VADER-009: Deve retornar 200 com um unico banco ao consultar por codigo valido', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoValido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('object');
    expect(resposta.body.code).to.equal(massa.banks.codigoValido);
  });

  it('VADER-010: Deve rejeitar o verbo DELETE, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().delete(`/banks/v1/${massa.banks.codigoValido}`);

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-010', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-011: Deve retornar 200 sem envio de credencial na consulta unitaria', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoValido}`);

    expect(resposta.status).to.equal(200);
  });

  it('VADER-012: Deve tratar codigo nao numerico sem retornar erro interno', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoNaoNumerico}`);

    expect(resposta.status).to.be.below(500);
    registrarLacuna('VADER-012', '400 nao documentado, apenas 200 e 404', resposta.status);
  });

  it('VADER-013: Deve tratar valores de borda do codigo de forma consistente', async () => {
    for (const borda of massa.banks.bordas) {
      const resposta = await cliente().get(`/banks/v1/${borda}`);

      expect(resposta.status, `codigo ${borda}`).to.be.below(500);
      registrarLacuna('VADER-013', `borda ${borda} sem limite documentado`, resposta.status);
    }
  });

  it('VADER-014: Deve retornar 404 quando o codigo do banco nao existir', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoInexistente}`);

    expect(resposta.status).to.equal(404);
  });

  it('VADER-015: Deve tratar caracteres especiais no path sem vazar informacao interna', async () => {
    const resposta = await cliente().get('/banks/v1/%20');

    expect(resposta.status).to.be.below(500);
    expect(JSON.stringify(resposta.body)).to.not.include('stack');
  });

  it('VADER-016: Deve retornar o corpo do 404 aderente ao schema ErrorMessage', async () => {
    const resposta = await cliente().get(`/banks/v1/${massa.banks.codigoInexistente}`);

    expect(resposta.status).to.equal(404);
    // Conflito conhecido: o exemplo da spec omite o campo name, que o schema exige.
    validarContrato(resposta.body, 'ErrorMessage');
  });

});
