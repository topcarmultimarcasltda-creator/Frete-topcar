/*
  SERVER.JS (TUDO-EM-UM)
  - Versão SEGURA (lê do Environment)
  - Usa BrasilAPI (para CEPs)
  - Usa GRAPHOPPER (para Distância)
  - *** CORRIGIDO: Formato do pedido para "locations" ***
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
const GRAPHOPPER_KEY = process.env.GRAPHOPPER_KEY; // <-- Lê do "cofre" do Render
const FRETE_TAXA_POR_KM = 2.50;
// Coordenadas de Origem [Lon, Lat]
const FRETE_COORDENADAS_ORIGEM = [-47.49056581938401, -23.518172000706706];

// --- 3. AS APIs (O "ASSISTENTE") ---

/* Endpoint 1: Busca de CEP (Usando BrasilAPI) */
app.get('/api/cep', async (req, res) => {
    const cep = req.query.cep.replace(/\D/g, ''); 
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

/* Endpoint 2: Cálculo de Frete (*** FORMATO CORRIGIDO DE VOLTA PARA "LOCATIONS" ***) */
app.post('/api/calcular-frete', async (req, res) => {
    const { destinoCoords, cupom } = req.body; // Vem como [Lon, Lat]
    
    if (!GRAPHOPPER_KEY) {
        return res.status(500).json({ error: 'Erro de servidor: Chave de API (GraphHopper) não configurada.' });
    }

    try {
        // **** CORREÇÃO ****
        // O formato correto da Matrix API usa "locations" com objetos {lat, lon}
        const body = {
            "locations": [
                // Origem:
                {
                    "lat": FRETE_COORDENADAS_ORIGEM[1], // Latitude
                    "lon": FRETE_COORDENADAS_ORIGEM[0]  // Longitude
                },
                // Destino:
                {
                    "lat": destinoCoords[1], // Latitude
                    "lon": destinoCoords[0]  // Longitude
                }
            ],
            "out_arrays": ["distances", "times"], // Pedimos distâncias e tempos
            "vehicle": "car" // Para carro
        };
        // **** FIM DA CORREÇÃO ****

        const url = `https://graphhopper.com/api/1/matrix?key=${GRAPHOPPER_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.message || "Erro desconhecido da API GraphHopper";
            console.error("Erro da API GraphHopper:", errorMessage);
            throw new Error(`Erro da API de Rota: ${errorMessage}`);
        }

        const data = await response.json();
        
        // A resposta é uma matriz: [origem][destino]
        const distanciaMetros = data.distances[0][1];
        const duracaoSegundos = data.times[0][1];

        if (distanciaMetros === undefined || duracaoSegundos === undefined) {
            throw new Error("Não foi possível calcular a rota (distância/tempo).");
        }

        const distanciaKM = distanciaMetros / 1000;

        const valorBase = distanciaKM * FRETE_TAXA_POR_KM;
        let desconto = 0;
        let cupomAplicado = false;
        
        // Lógica do Cupom (Ignora espaços)
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