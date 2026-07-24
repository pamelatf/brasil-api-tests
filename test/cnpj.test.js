const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');
const massa = require('../fixtures/massaTestes.json');

describe('CNPJ - /cnpj/v1/{cnpj}', () => {

  it('VADER-033: Deve retornar 200 com os dados cadastrais ao consultar um CNPJ valido', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.valido}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.cnpj).to.equal(massa.cnpj.valido);
  });

  it('VADER-034: Deve rejeitar o verbo POST, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().post(`/cnpj/v1/${massa.cnpj.valido}`).send({});

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-034', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-035: Deve retornar quadro societario e contatos sem exigir credencial', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.valido}`);

    expect(resposta.status).to.equal(200);
    registrarLacuna('VADER-035', 'dados societarios e de contato publicos', {
      qsa: Array.isArray(resposta.body.qsa) ? resposta.body.qsa.length : null,
      possuiEmail: Boolean(resposta.body.email),
    });
  });

  it('VADER-036: Deve aceitar CNPJ com e sem formatacao e retornar corpos equivalentes', async () => {
    const semFormatacao = await cliente().get(`/cnpj/v1/${massa.cnpj.valido}`);
    const comFormatacao = await cliente().get(`/cnpj/v1/${encodeURIComponent(massa.cnpj.validoFormatado)}`);

    expect(semFormatacao.status).to.equal(200);
    expect(comFormatacao.status).to.equal(200);
    expect(comFormatacao.body.cnpj).to.equal(semFormatacao.body.cnpj);
  });

  it('VADER-037: Deve tratar CNPJ com digito verificador invalido', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.digitoVerificadorInvalido}`);

    expect(resposta.status).to.be.oneOf([400, 404]);
    registrarLacuna('VADER-037', 'validacao de digito verificador nao documentada', resposta.status);
  });

  it('VADER-038: Deve retornar 404 quando o CNPJ nao existir na base', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.inexistente}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body.type).to.equal('not_found');
  });

  it('VADER-039: Deve responder dentro do tempo aceitavel mesmo dependendo de fonte externa', async () => {
    const inicio = Date.now();
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.valido}`);
    const duracao = Date.now() - inicio;

    expect(resposta.status).to.be.below(500);
    expect(duracao, 'tempo de resposta acima do limite acordado').to.be.below(5000);
  });

  it('VADER-040: Deve conter os campos minimos acordados, ja que o schema nao declara required', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.valido}`);

    // Lacuna de contrato: o schema CNPJ da spec possui 48 propriedades e nenhuma required.
    validarContrato(resposta.body, 'CNPJ');
  });

  it('VADER-041: Deve retornar mensagem de erro coerente com a quantidade real de digitos do CNPJ', async () => {
    const resposta = await cliente().get(`/cnpj/v1/${massa.cnpj.malFormatado}`);

    expect(resposta.status).to.equal(400);
    // A spec exemplifica a mensagem com "11 digitos", quando o correto sao 14.
    expect(resposta.body.message, 'mensagem replica o defeito de documentacao').to.not.include('11');
  });

});
