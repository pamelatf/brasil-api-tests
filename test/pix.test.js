const { expect } = require('chai');
const { cliente } = require('../helpers/cliente');
const { validarContrato, registrarLacuna } = require('../helpers/schemas');

describe('PIX - /pix/v1/participants', () => {

  it('VADER-042: Deve retornar 200 com a lista de participantes do PIX', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.not.empty;
  });

  it('VADER-043: Deve rejeitar o verbo PATCH, que nao e documentado para o endpoint', async () => {
    const resposta = await cliente().patch('/pix/v1/participants').send({});

    expect([404, 405]).to.include(resposta.status);
    registrarLacuna('VADER-043', '405 nao documentado na spec', resposta.status);
  });

  it('VADER-044: Deve retornar 200 sem envio de credencial, confirmando listagem publica', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    expect(resposta.status).to.equal(200);
  });

  it('VADER-045: Deve ignorar parametros de filtro e paginacao nao documentados', async () => {
    const semQuery = await cliente().get('/pix/v1/participants');
    const comQuery = await cliente().get('/pix/v1/participants?ispb=00000000&limit=10');

    expect(comQuery.status).to.equal(200);
    expect(comQuery.body.length).to.equal(semQuery.body.length);
    registrarLacuna('VADER-045', 'ausencia de paginacao para lista extensa', comQuery.body.length);
  });

  it('VADER-046: Deve retornar erro estruturado caso a fonte do BCB falhe', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    if (resposta.status === 500) {
      expect(resposta.body.name).to.equal('PIX_LIST_ERROR');
      expect(resposta.body.type).to.equal('internal');
    } else {
      expect(resposta.status).to.equal(200);
    }
  });

  it('VADER-047: Deve registrar participantes sem inicio_operacao, campo exigido pelo schema', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    const semCampo = resposta.body.filter((p) => !p.inicio_operacao);
    // Conflito conhecido: o schema exige inicio_operacao, mas a descricao informa
    // que o BCB deixou de fornecer o dado a partir de novembro de 2025.
    registrarLacuna('VADER-047', 'conflito entre schema e descricao', {
      total: resposta.body.length,
      semInicioOperacao: semCampo.length,
    });
    expect(resposta.status).to.equal(200);
  });

  it('VADER-048: Deve respeitar o contrato do schema PIX_PARTICIPANTES em todos os itens', async () => {
    const resposta = await cliente().get('/pix/v1/participants');

    resposta.body.forEach((participante) => {
      validarContrato(participante, 'PixParticipante');
      expect(participante.ispb).to.match(/^\d{8}$/);
    });
  });

});
