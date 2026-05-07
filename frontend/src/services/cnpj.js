import axios from 'axios';

export async function buscarCNPJ(cnpj) {
  const cleaned = (cnpj || '').replace(/\D/g, '');
  const res = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
  return res.data;
}
