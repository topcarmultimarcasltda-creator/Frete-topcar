/*
  SERVER.JS (TUDO-EM-UM)
  - Serve o seu site da pasta 'public'
  - Responde às chamadas de API
  - Suas chaves já estão aqui.
*/
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path'); 

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. SERVIR O FRONTEND ---
// Diz ao Express para servir os ficheiros estáticos (HTML, CSS, JS) da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. AS CHAVES DE API ---
const CEPABERTO_TOKEN = '1266645890454565003a29a7e0c2b08c';
const OPENROUTE_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVkOGZiYzQ5MTdhNzQyYTI5ZjU1N2YzMjdhMTA0ZmMwIiwiaCI6Im11cm11cjYyNDgifQ=='; // (A sua chave do OpenRoute)
const FRETE_TAXA_POR_KM = 2.50;
const FRETE_COORDENADAS_ORIGEM = [-47.49056581938401, -23.518172000706706];

// --- 3. AS APIs (O "ASSISTENTE") ---

/* Endpoint 1: Busca de CEP */
app.get('/api/cep', async (req, res) => {
    const cep = req.query.cep;
    if (!cep) return res.status(400).json({ error: 'CEP não fornecido' });
    if (!CEPABERTO_TOKEN) return res.status(500).json({ error: 'Chave do CepAberto não configurada' });

    try {
        const response = await fetch(`https://www.cepaberto.com/api/v3/cep?cep=${cep}`, {
            headers: { 'Authorization': `Token token=${CEPABERTO_TOKEN}` }
        });
        if (!response.ok) throw new Error('CEP não encontrado');
        const data = await response.json();
        if (!data.latitude || !data.longitude) throw new Error('API não retornou coordenadas para este CEP.');

        res.json({
            logradouro: data.logradouro || '',
            cidade: data.cidade.nome || '',
            estado: data.estado.sigla || '',
            latitude: data.latitude,
            longitude: data.longitude
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* Endpoint 2: Cálculo de Frete */
app.post('/api/calcular-frete', async (req, res) => {
    const { destinoCoords, cupom } = req.body; 
    if (!OPENROUTE_KEY) return res.status(500).json({ error: 'Chave do OpenRoute não configurada' });

    try {
        const body = {
            "locations": [FRETE_COORDENADAS_ORIGEM, destinoCoords],
            "metrics": ["distance", "duration"], "units": "km"
        };
        const response = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': OPENROUTE_KEY
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro da API de Rota: ${errorData.error.message}`);
        }
        const data = await response.json();
        const distancia = data.distances[0][1];
        const duracaoSegundos = data.durations[0][1];
        if (distancia === undefined || duracaoSegundos === undefined) throw new Error("Resposta da API de Rota inválida.");

        const valorBase = distancia * FRETE_TAXA_POR_KM;
        let desconto = 0;
        let cupomAplicado = false;
        if (cupom && cupom.toUpperCase() === 'DESCONTO10') {
            desconto = valorBase * 0.10;
            cupomAplicado = true;
        }
        const valorFinal = valorBase - desconto;
        const duracaoDias = Math.ceil(duracaoSegundos / 60 / 60 / 24);
        const prazo = `Aprox. ${duracaoDias + 2} dias`; 

        res.json({
            valorBase: valorBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            desconto: desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            valorFinal: valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            cupomAplicado: cupomAplicado,
            prazo: prazo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 4. ROTA PRINCIPAL (Servir o index.html) ---
// (Esta é a correção. Tem de vir DEPOIS das suas rotas de API)
// Qualquer pedido GET que não seja para a API, envia o index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 5. INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de frete rodando na porta ${PORT}`);
});