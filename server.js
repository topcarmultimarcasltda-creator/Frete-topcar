/*
  SERVER.JS (TUDO-EM-UM)
  - Versão SEGURA (lê do Environment)
  - Usa BrasilAPI
  - *** ADICIONADO: DEBUG PARA MOSTRAR A CHAVE EM USO ***
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

// --- 2. AS CHAVES DE API (SEGURAS) ---
const OPENROUTE_KEY = process.env.OPENROUTE_KEY; // <-- Lê do "cofre" do Render
const FRETE_TAXA_POR_KM = 2.50;
const FRETE_COORDENADAS_ORIGEM = [-47.49056581938401, -23.518172000706706];

// --- 3. AS APIs (O "ASSISTENTE") ---

/* Endpoint 1: Busca de CEP (Usando BrasilAPI) */
app.get('/api/cep', async (req, res) => {
    const cep = req.query.cep.replace(/\D/g, ''); // Limpa o CEP
    if (!cep || cep.length !== 8) return res.status(400).json({ error: 'CEP inválido' });

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        if (!response.ok) throw new Error('CEP não encontrado');
        const data = await response.json();
        if (!data.location || !data.location.coordinates) throw new Error('API não retornou coordenadas para este CEP.');

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

/* Endpoint 2: Cálculo de Frete */
app.post('/api/calcular-frete', async (req, res) => {
    const { destinoCoords, cupom } = req.body; 
    
    if (!OPENROUTE_KEY) {
        return res.status(500).json({ error: 'Erro de servidor: Chave de API não configurada.' });
    }

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
        
        // **** DEBUG ADICIONADO AQUI ****
        if (!response.ok) {
            let errorBody = await response.text();
            let finalErrorMessage = errorBody;
            try {
                const errorData = JSON.parse(errorBody);
                if (typeof errorData.error === 'string') finalErrorMessage = errorData.error;
                else if (errorData.error && typeof errorData.error.message === 'string') finalErrorMessage = errorData.error.message;
                else if (typeof errorData.message === 'string') finalErrorMessage = errorData.message;
            } catch (e) {
                // Não é JSON
            }
            
            // Pega os últimos 10 dígitos da chave que o Render está a usar
            const keyInUse = OPENROUTE_KEY || "CHAVE_NAO_ENCONTRADA";
            const partialKey = keyInUse.substring(keyInUse.length - 10);

            console.error("Erro da API OpenRoute:", finalErrorMessage);
            // Envia a mensagem de erro E os últimos dígitos da chave
            throw new Error(`Erro: ${finalErrorMessage}. (Debug: Chave usada termina em ...${partialKey})`);
        }
        // **** FIM DO DEBUG ****

        const data = await response.json();
        const distancia = data.distances[0][1];
        const duracaoSegundos = data.durations[0][1];
        if (distancia === undefined || duracaoSegundos === undefined) throw new Error("Resposta da API de Rota inválida.");

        const valorBase = distancia * FRETE_TAXA_POR_KM;
        let desconto = 0;
        let cupomAplicado = false;
        
        // Lógica do Cupom (Corrigida para ignorar espaços)
        if (cupom && cupom.replace(/\s/g, '').toUpperCase() === 'DESCONTO10') {
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