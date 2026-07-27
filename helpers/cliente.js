require('dotenv').config();
const request = require('supertest');

// A URL base nunca deve ser hardcoded nos testes.
const baseUrl = process.env.BASE_URL || 'https://brasilapi.com.br/api';

const cliente = () => request(baseUrl);

/** Espera o número de milissegundos informado. */
const pausar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * O recurso de CNPJ aplica limite de requisições no edge da BrasilAPI e
 * responde 429 quando recebe muitas chamadas em pouco tempo. O 429 não consta
 * na especificação, e o caso BAPI-76 registra essa lacuna.
 *
 * A primeira tentativa de contornar isso usou espera curta entre as
 * retentativas, de 2s e 4s, e não resolveu: cada retentativa consome a mesma
 * cota que se está tentando poupar, então insistir rápido piora a situação. A
 * espera passou a ser longa, e a estratégia principal deixou de ser a
 * retentativa e passou a ser fazer menos chamadas, espaçadas entre si.
 *
 * Esta função não mascara o problema: se todas as tentativas falharem, o 429
 * chega a quem chamou e o caso falha normalmente.
 */
async function pedirComPaciencia(executar, tentativas = 3, esperaBaseMs = 5000) {
  let resposta = await executar();
  let primeiraLimitada = resposta.status === 429 ? resposta : null;

  for (let tentativa = 1; tentativa < tentativas && resposta.status === 429; tentativa += 1) {
    await pausar(esperaBaseMs * tentativa);
    resposta = await executar();
  }

  // Guarda a resposta 429 que foi absorvida pela retentativa. Sem isso o caso
  // BAPI-76 nao teria como registrar que o limite foi atingido, já que a
  // resposta final devolvida aqui é a bem-sucedida.
  resposta.respostaLimitada = primeiraLimitada;

  return resposta;
}

module.exports = { cliente, baseUrl, pausar, pedirComPaciencia };
