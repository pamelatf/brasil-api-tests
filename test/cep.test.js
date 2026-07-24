const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const massa = require('../fixtures/massaTestes.json');

describe('CEP - /cep/v1/{cep}', () => {

  it('VADER-017: Deve retornar 200 com o endereco ao consultar um CEP valido', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.cep).to.equal(massa.cep.valido);
  });

  it('VADER-018: Deve rejeitar o verbo PUT, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().put(`/cep/v1/${massa.cep.valido}`).send({});

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-018', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-019: Deve retornar 200 sem envio de credencial, confirmando consulta publica', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
  });

  it('VADER-020: Deve preservar o zero a esquerda mesmo com o parametro declarado como integer', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.comZeroAEsquerda}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.cep).to.equal(massa.cep.comZeroAEsquerda);
  });

  it('VADER-021: Deve tratar CEP formatado com hifen, nao previsto pelo tipo declarado na v1', async () => {
    const resposta = await cliente().get('/cep/v1/01001-000');

    expect(resposta.status).to.be.below(500);
    registrarLacuna('VADER-021', 'formatacao com hifen nao prevista na v1', resposta.status);
  });

  it('VADER-022: Deve retornar 404 com o schema CepError quando o CEP nao existir', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.inexistente}`);

    expect(resposta.status).to.equal(404);
    validarContrato(resposta.body, 'CepError');
    expect(resposta.body.errors).to.be.an('array');
  });

  it('VADER-023: Deve tratar CEP com quantidade incorreta de digitos', async () => {
    const resposta = await cliente().get('/cep/v1/123');

    expect(resposta.status).to.be.below(500);
    registrarLacuna('VADER-023', '400 nao documentado na v1', resposta.status);
  });

  it('VADER-024: Deve respeitar o contrato do schema Address na resposta de sucesso', async () => {
    const resposta = await cliente().get(`/cep/v1/${massa.cep.valido}`);

    validarContrato(resposta.body, 'Address');
    expect(resposta.body.service).to.be.a('string').that.is.not.empty;
  });

});

describe('CEP V2 - /cep/v2/{cep}', () => {

  it('VADER-025: Deve retornar 200 com dados de geolocalizacao ao consultar um CEP valido', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.location).to.be.an('object');
  });

  it('VADER-026: Deve rejeitar o verbo POST, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().post(`/cep/v2/${massa.cep.valido}`).send({});

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-026', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-027: Deve expor coordenadas geograficas sem exigir credencial', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    expect(resposta.status).to.equal(200);
    registrarLacuna('VADER-027', 'geolocalizacao publica sem controle de acesso', resposta.status);
  });

  it('VADER-028: Deve aceitar as duas formas previstas no pattern e retornar corpos equivalentes', async () => {
    const semFormatacao = await cliente().get(`/cep/v2/${massa.cep.valido}`);
    const comFormatacao = await cliente().get(`/cep/v2/${massa.cep.validoFormatado}`);

    expect(semFormatacao.status).to.equal(200);
    expect(comFormatacao.status).to.equal(200);
    expect(comFormatacao.body).to.deep.equal(semFormatacao.body);
  });

  it('VADER-029: Deve retornar 400 quando o CEP violar o pattern documentado', async () => {
    const entradas = [massa.cep.curto, massa.cep.naoNumerico];

    for (const entrada of entradas) {
      const resposta = await cliente().get(`/cep/v2/${entrada}`);

      expect(resposta.status, `entrada ${entrada}`).to.equal(400);
      validarContrato(resposta.body, 'ErrorMessage');
    }
  });

  it('VADER-030: Deve retornar 404 quando o CEP nao for encontrado em nenhum provedor', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.inexistente}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('service_error');
  });

  it('VADER-031: Deve manter os campos comuns identicos entre as versoes v1 e v2', async () => {
    const v1 = await cliente().get(`/cep/v1/${massa.cep.valido}`);
    const v2 = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    ['cep', 'state', 'city', 'neighborhood', 'street'].forEach((campo) => {
      expect(v2.body[campo], `divergencia no campo ${campo}`).to.equal(v1.body[campo]);
    });
  });

  it('VADER-032: Deve respeitar o contrato do schema AddressV2 e da estrutura location', async () => {
    const resposta = await cliente().get(`/cep/v2/${massa.cep.valido}`);

    validarContrato(resposta.body, 'AddressV2');
    validarContrato(resposta.body.location, 'Location');
    validarContrato(resposta.body.location.coordinates, 'Coordinates');
  });

});
