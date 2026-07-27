const Ajv = require('ajv');
const { expect } = require('chai');

/**
 * Schemas transcritos do OpenAPI publicado pela BrasilAPI
 * (pages/docs/doc/bank.json, cep.json, cnpj.json, pix.json e error.json
 * do repositorio BrasilAPI/BrasilAPI).
 *
 * Observacao sobre nullable: a spec usa a sintaxe OpenAPI 3.0
 * ("type": "string", "nullable": true), que nao existe em JSON Schema puro.
 * Aqui ela foi traduzida para type: ['string', 'null'], que e o equivalente
 * aceito pelo Ajv. Onde isso acontece ha um comentario no schema.
 */
const schemas = {
  Bank: {
    type: 'object',
    required: ['ispb', 'name', 'code', 'fullName'],
    properties: {
      ispb: { type: 'string' },
      name: { type: 'string' },
      code: { type: 'integer' },
      fullName: { type: 'string' },
    },
  },

  Address: {
    type: 'object',
    required: ['cep', 'state', 'city', 'neighborhood', 'street', 'service'],
    properties: {
      cep: { type: 'string' },
      state: { type: 'string' },
      city: { type: 'string' },
      neighborhood: { type: ['string', 'null'] },
      street: { type: ['string', 'null'] },
      service: { type: 'string' },
    },
  },

  AddressV2: {
    type: 'object',
    required: [
      'cep',
      'state',
      'city',
      'neighborhood',
      'street',
      'timezoneName',
      'location',
    ],
    properties: {
      cep: { type: 'string' },
      state: { type: 'string' },
      city: { type: 'string' },
      // nullable na spec
      neighborhood: { type: ['string', 'null'] },
      street: { type: ['string', 'null'] },
      timezoneName: { type: ['string', 'null'] },
      location: { $ref: '#/definitions/Location' },
    },
  },

  Location: {
    type: 'object',
    required: ['type', 'coordinates'],
    properties: {
      type: { type: 'string', enum: ['Point'] },
      coordinates: { $ref: '#/definitions/Coordinates' },
    },
  },

  Coordinates: {
    type: 'object',
    required: ['longitude', 'latitude'],
    properties: {
      // nullable na spec
      longitude: { type: ['string', 'null'] },
      latitude: { type: ['string', 'null'] },
    },
  },

  ErrorMessage: {
    type: 'object',
    required: ['message', 'name', 'type'],
    properties: {
      message: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
    },
  },

  CepError: {
    type: 'object',
    required: ['name', 'message', 'type', 'errors'],
    properties: {
      name: { type: 'string' },
      message: { type: 'string' },
      type: { type: 'string' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          // A spec exige name, message e service em cada item de errors, mas o
          // erro de validacao montado em services/cep/cep.js nao traz name.
          // Por isso o required aqui cobre apenas message e service, e a
          // divergencia e verificada explicitamente no caso BAPI-30.
          required: ['message', 'service'],
          properties: {
            name: { type: 'string' },
            message: { type: 'string' },
            service: { type: 'string' },
          },
        },
      },
    },
  },

  /**
   * O schema CNPJ da spec declara 48 propriedades e nenhuma lista de required.
   * Um schema sem required aceita qualquer objeto, o que nao serve como
   * verificacao. A lista abaixo e o minimo acordado com o time e a divergencia
   * de contrato fica registrada no caso BAPI-55.
   */
  CNPJ: {
    type: 'object',
    required: ['cnpj', 'razao_social', 'situacao_cadastral'],
    properties: {
      cnpj: { type: 'string' },
      razao_social: { type: 'string' },
      situacao_cadastral: { type: ['integer', 'string'] },
    },
  },

  PixParticipante: {
    type: 'object',
    required: [
      'ispb',
      'nome',
      'nome_reduzido',
      'modalidade_participacao',
      'tipo_participacao',
    ],
    properties: {
      ispb: { type: 'string' },
      nome: { type: 'string' },
      nome_reduzido: { type: 'string' },
      modalidade_participacao: { type: 'string' },
      tipo_participacao: { type: 'string' },
      // A spec declara inicio_operacao como required e do tipo string, mas a
      // implementacao devolve null desde novembro de 2025. A divergencia e
      // verificada no caso BAPI-66, por isso o campo fica fora do required.
      inicio_operacao: { type: ['string', 'null'] },
    },
  },
};

const ajv = new Ajv({ allErrors: true, strict: false });

// definitions permite que AddressV2 referencie Location e Coordinates
const validadores = Object.keys(schemas).reduce((acumulador, nome) => {
  acumulador[nome] = ajv.compile({
    definitions: schemas,
    ...schemas[nome],
  });
  return acumulador;
}, {});

/**
 * Valida um objeto contra o schema JSON correspondente usando Ajv.
 * Falha o teste listando todos os desvios encontrados, nao apenas o primeiro.
 */
function validarContrato(objeto, nomeSchema) {
  const validar = validadores[nomeSchema];
  expect(validar, `Schema ${nomeSchema} nao mapeado em helpers/schemas.js`).to.be.a('function');

  const valido = validar(objeto);
  const desvios = (validar.errors || [])
    .map((erro) => `${erro.instancePath || '(raiz)'} ${erro.message}`)
    .join(' | ');

  expect(valido, `Corpo fora do contrato ${nomeSchema}: ${desvios}`).to.equal(true);
}

/**
 * Lista os campos obrigatorios declarados para um schema.
 * Usado pelos casos que precisam citar o contrato na mensagem de falha.
 */
function camposObrigatoriosDe(nomeSchema) {
  return (schemas[nomeSchema] && schemas[nomeSchema].required) || [];
}

/**
 * Usado nos casos de lacuna de documentacao. Nao falha o teste,
 * apenas registra o comportamento real observado para analise posterior.
 */
function registrarLacuna(identificador, descricao, valorObservado) {
  // eslint-disable-next-line no-console
  console.log(
    `      [LACUNA ${identificador}] ${descricao} | observado: ${JSON.stringify(valorObservado)}`
  );
}

module.exports = { schemas, validarContrato, camposObrigatoriosDe, registrarLacuna };
