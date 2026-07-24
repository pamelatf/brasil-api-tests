require('dotenv').config();
const request = require('supertest');

// A URL base nunca deve ser hardcoded nos testes.
const baseUrl = process.env.BASE_URL || 'https://brasilapi.com.br/api';

const cliente = () => request(baseUrl);

module.exports = { cliente, baseUrl };
