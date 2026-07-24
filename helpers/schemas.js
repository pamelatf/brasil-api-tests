const { expect } = require('chai');

/**
 * Campos obrigatorios extraidos diretamente do bloco components.schemas
 * do arquivo openapi.json. Alterou a spec, altera aqui.
 */
const camposObrigatorios = {
  Bank: ['ispb', 'name', 'code', 'fullName'],
  Address: ['cep', 'state', 'city', 'neighborhood', 'street', 'service'],
  AddressV2: ['cep', 'state', 'city', 'neighborhood', 'street', 'timezoneName', 'location'],
  Location: ['type', 'coordinates'],
  Coordinates: ['longitude', 'latitude'],
  ErrorMessage: ['message', 'name', 'type'],
  CepError: ['name', 'message', 'type', 'errors'],
  PixParticipante: ['ispb', 'nome', 'nome_reduzido', 'modalidade_participacao', 'tipo_participacao'],
  // Observacao: o schema CNPJ nao declara nenhum campo como required na spec.
  // Esta lista representa o minimo aceitavel acordado com o time, nao o contrato.
  CNPJ: ['cnpj', 'razao_social', 'situacao_cadastral'],
};

/**
 * Valida a presenca dos campos obrigatorios de um schema em um objeto.
 */
function validarContrato(objeto, nomeSchema) {
  const campos = camposObrigatorios[nomeSchema];
  expect(campos, `Schema ${nomeSchema} nao mapeado em helpers/schemas.js`).to.be.an('array');
  campos.forEach((campo) => {
    expect(objeto, `Campo obrigatorio ausente: ${campo}`).to.have.property(campo);
  });
}

/**
 * Usado nos casos de lacuna de documentacao. Nao falha o teste,
 * apenas registra o comportamento real observado para analise posterior.
 */
function registrarLacuna(identificador, descricao, valorObservado) {
  console.log(`      [LACUNA ${identificador}] ${descricao} | observado: ${JSON.stringify(valorObservado)}`);
}

module.exports = { camposObrigatorios, validarContrato, registrarLacuna };
