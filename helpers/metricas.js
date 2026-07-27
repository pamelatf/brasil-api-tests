/**
 * Utilitarios usados pelos casos POISED de Data (escalabilidade e integridade)
 * e de Output. Ficam separados de schemas.js porque nao tratam de contrato.
 */

/**
 * Executa uma funcao que devolve uma promise e retorna o resultado
 * junto com a duracao em milissegundos.
 */
async function medirTempo(executar) {
  const inicio = Date.now();
  const resultado = await executar();
  return { resultado, duracaoMs: Date.now() - inicio };
}

/**
 * Dispara N chamadas em paralelo e devolve as respostas, a duracao total
 * e a duracao media por chamada. Usado nos casos de escalabilidade.
 */
async function dispararEmParalelo(executar, quantidade) {
  const inicio = Date.now();
  const respostas = await Promise.all(
    Array.from({ length: quantidade }, () => executar())
  );
  const duracaoTotalMs = Date.now() - inicio;

  return {
    respostas,
    duracaoTotalMs,
    duracaoMediaMs: Math.round(duracaoTotalMs / quantidade),
  };
}

/**
 * Marcadores de codificacao quebrada. O caractere U+FFFD e o substituto
 * inserido quando o decodificador nao reconhece um byte. As demais sequencias
 * sao o resultado tipico de um texto latin1 lido como UTF-8 e vice-versa.
 */
const MARCADORES_DE_CODIFICACAO_QUEBRADA = ['�', 'Ã£', 'Ã§', 'Ã©', 'Ã¡', 'Ãµ', 'Ã­', 'Ã³', 'Âº', 'Âª'];

/**
 * Procura indicios de codificacao quebrada em qualquer texto de uma estrutura.
 * Devolve a lista de trechos suspeitos encontrados.
 */
function encontrarTextoMalCodificado(valor) {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  if (!texto) {
    return [];
  }

  return MARCADORES_DE_CODIFICACAO_QUEBRADA.filter((marcador) => texto.includes(marcador));
}

/**
 * Devolve os valores duplicados de um campo em uma lista de objetos.
 * Usado nos casos de qualidade de dados.
 */
function encontrarDuplicados(lista, campo) {
  const contagem = new Map();

  lista.forEach((item) => {
    const chave = item[campo];
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });

  return [...contagem.entries()]
    .filter(([, quantidade]) => quantidade > 1)
    .map(([chave, quantidade]) => ({ [campo]: chave, ocorrencias: quantidade }));
}

module.exports = {
  medirTempo,
  dispararEmParalelo,
  encontrarTextoMalCodificado,
  encontrarDuplicados,
};
