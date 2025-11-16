/*
  SERVER.JS (TUDO-EM-UM)
  - Serve o seu site da pasta 'public'
  - Responde às chamadas de API
  - **** ATUALIZADO: Agora usa a BrasilAPI para CEPs (mais robusto) ****
*/
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path'); 

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. SERVIR O FRONTEND ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. AS CHAVES DE API ---
// A BrasilAPI não precisa de token, por isso removemos o CEPABERTO_TOKEN
const OPENROUTE_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVkOGZiYzQ5MTdhNzQyYTI5ZjU1N2YzMjdhMTA0ZmMwIiwiaCI6Im11cm11cjY0In0=';
const FRETE_TAXA_POR_KM = 2.50;
const FRETE_COORDENADAS_ORIGEM = [-47.49056581938401, -23.518172000706706];

// --- 3. AS APIs (O "ASSISTENTE") ---

/* Endpoint 1: Busca de CEP
  **** ATUALIZADO PARA BRASILAPI (v2) ****
*/
app.get('/api/cep', async (req, res) => {
    const cep = req.query.cep.replace(/\D/g, ''); // Limpa o CEP
    
    if (!cep || cep.length !== 8) {
        return res.status(400).json({ error: 'CEP inválido' });
    }

    try {
        // Nova URL da API (não precisa de Token/Authorization)
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        
        if (!response.ok) {
            // Se a BrasilAPI não encontrar (404), tratamos como "CEP não encontrado"
            throw new Error('CEP não encontrado');
        }
        
        const data = await response.json();
        
        // Verifica se temos as coordenadas
        if (!data.location || !data.location.coordinates) {
             throw new Error('API não retornou coordenadas para este CEP.');
        }

        // Mapeia os dados da BrasilAPI para o formato que o frontend espera
        res.json({
            logradouro: data.street || '',
            cidade: data.city || '',
            estado: data.state || '',
            latitude: data.location.coordinates.latitude,
            longitude: data.location.coordinates.longitude
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* Endpoint 2: Cálculo de Frete (Sem alterações) */
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
            let errorBody = await response.text(); 
            let errorMessage = errorBody;
            try {
                const errorData = JSON.parse(errorBody); 
                errorMessage = errorData?.error?.message || errorData?.error || errorData?.message || errorBody;
            } catch (e) {
                errorMessage = errorBody;
            }
            console.error("Erro da API OpenRoute:", errorMessage);
            throw new Error(`Erro da API de Rota: ${errorMessage}`);
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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 5. INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de frete rodando na porta ${PORT}`);
});