/*
  SERVER.JS (TUDO-EM-UM)
  - Versão SEGURA (lê do Environment)
  - Usa BrasilAPI (para CEPs)
  - *** USA MAPBOX (para Distância) - MAIS ESTÁVEL ***
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
// Vamos ler a nova chave do Mapbox do "cofre" do Render
const MAPBOX_KEY = process.env.MAPBOX_KEY; 
const FRETE_TAXA_POR_KM = 2.50;
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

/* Endpoint 2: Cálculo de Frete (*** ATUALIZADO PARA MAPBOX ***) */
app.post('/api/calcular-frete', async (req, res) => {
    const { destinoCoords, cupom } = req.body; 
    
    if (!MAPBOX_KEY) {
        return res.status(500).json({ error: 'Erro de servidor: Chave de API (Mapbox) não configurada.' });
    }

    try {
        // O formato do Mapbox é: /mapbox/driving/lon,lat;lon,lat
        const origemLonLat = `${FRETE_COORDENADAS_ORIGEM[0]},${FRETE_COORDENADAS_ORIGEM[1]}`;
        const destinoLonLat = `${destinoCoords[0]},${destinoCoords[1]}`;
        
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origemLonLat};${destinoLonLat}?access_token=${MAPBOX_KEY}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.message || "Erro desconhecido da API Mapbox";
            console.error("Erro da API Mapbox:", errorMessage);
            throw new Error(`Erro da API de Rota: ${errorMessage}`);
        }

        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
            throw new Error("Não foi possível encontrar uma rota.");
        }

        const distanciaMetros = data.routes[0].distance;
        const duracaoSegundos = data.routes[0].duration;
        const distanciaKM = distanciaMetros / 1000;

        const valorBase = distanciaKM * FRETE_TAXA_POR_KM;
        let desconto = 0;
        let cupomAplicado = false;
        
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