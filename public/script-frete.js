/* SCRIPT-FRETE.JS ATUALIZADO
   - Aponta para o caminho relativo (/api/...) 
   - Corrigido bug de "race condition" na validação da Etapa 3.
*/

// --- Variáveis Globais de Controle ---
let currentStep = 1;
const totalSteps = 4;

// --- Função Global de Navegação ---
function updateUI() {
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.step) === currentStep) {
            step.classList.add('active');
        }
    });
    const progressSteps = document.querySelectorAll('.progress-step');
    const progressBar = document.getElementById('progress-bar');
    progressSteps.forEach((step, index) => {
        const stepNum = index + 1;
        if (stepNum <= currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressBar.style.width = `${progressPercent}%`;
}

// --- Inicialização quando a página carregar ---
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMasks();
    initCepSearch();
    initFormSubmit();
    processUrlParams();
});

// --- 1. Lógica de Navegação (Botões Voltar/Continuar) ---
function initNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                if (currentStep < totalSteps) {
                    currentStep++;
                    updateUI();
                }
            }
        });
    });
    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateUI();
            }
        });
    });
}

// --- 2. Validação dos Campos ---
function validateStep(step) {
    let isValid = true;
    if (step === 2) {
        limparErros();
        const veiculo = document.getElementById('tipo-veiculo').value;
        if (!veiculo) {
            document.querySelector('.grid-options').style.border = '1px solid red';
            isValid = false;
        } else {
            document.querySelector('.grid-options').style.border = 'none';
        }
    } else if (step === 3) {
        const cepInput = document.getElementById('cep-destino');
        const numeroInput = document.getElementById('numero-destino');
        const errorSpan = cepInput.closest('.form-group').querySelector('.error-message');
        limparErroDo(numeroInput);
        if (!numeroInput.value) {
            mostrarErro(numeroInput, "Digite o número");
            isValid = false;
        }
        if (errorSpan && errorSpan.textContent === "CEP inválido") {
            limparErroDo(cepInput);
        }
        if (cepInput.value.length < 9) {
            mostrarErro(cepInput, "CEP inválido");
            isValid = false;
        } 
        else if (!document.getElementById('cep-lat').value || !document.getElementById('cep-lon').value) {
            isValid = false;
            if (!errorSpan || !errorSpan.textContent) {
                 mostrarErro(cepInput, "CEP não encontrado ou sem coordenadas. Verifique o CEP.");
            }
        }
    } else if (step === 4) {
         limparErros();
         const nome = document.getElementById('nome-cliente').value;
         const tel = document.getElementById('telefone-cliente').value;
         if (!nome) {
             mostrarErro(document.getElementById('nome-cliente'), "Preencha seu nome");
             isValid = false;
         }
         if (tel.length < 14) {
             mostrarErro(document.getElementById('telefone-cliente'), "WhatsApp inválido");
             isValid = false;
         }
    }
    return isValid;
}

function mostrarErro(input, mensagem) {
    const formGroup = input.closest('.form-group');
    if(formGroup) {
        const errorSpan = formGroup.querySelector('.error-message');
        input.classList.add('input-error');
        if(errorSpan) errorSpan.textContent = mensagem;
    }
}

function limparErros() {
    document.querySelectorAll('.input-error').forEach(input => input.classList.remove('input-error'));
    document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
}

function limparErroDo(input) {
    const formGroup = input.closest('.form-group');
    if(formGroup) {
        const errorSpan = formGroup.querySelector('.error-message');
        input.classList.remove('input-error');
        if(errorSpan) errorSpan.textContent = '';
    }
}

// --- 3. Funções do Usuário (Seleção de Veículo) ---
window.selectVeiculo = function(tipo) {
    const select = document.getElementById('tipo-veiculo');
    if(select) {
        select.value = tipo;
        const event = new Event('change');
        select.dispatchEvent(event);
        document.querySelector('.grid-options').style.border = 'none';
    }
}

// --- 4. Leitura de URL e Mapeamento ---
function processUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const bodyType = params.get('bodyType');
    if (bodyType) {
        let tipoMapeado = '';
        if (bodyType === 'Moto') tipoMapeado = 'moto';
        else if (bodyType === 'Hatch') tipoMapeado = 'pequeno';
        else if (bodyType === 'Sedan' || bodyType === 'SUV') tipoMapeado = 'medio';
        else if (bodyType === 'Utilitario') tipoMapeado = 'grande';
        if (tipoMapeado) {
            selectVeiculo(tipoMapeado);
            const radio = document.querySelector(`input[name="veiculo-select"][value="${tipoMapeado}"]`);
            if (radio) radio.checked = true;
            currentStep = 3;
            updateUI();
        }
    }
}

// --- 5. Busca de CEP (ATUALIZADO) ---
function initCepSearch() {
    const inputCep = document.getElementById('cep-destino');
    if(inputCep) {
        inputCep.addEventListener('blur', () => {
            const cep = inputCep.value.replace(/\D/g, '');
            if (cep.length === 8) {
                fetchCep(cep);
            }
        });
        inputCep.addEventListener('input', () => {
            limparErroDo(inputCep);
            document.getElementById('cep-lat').value = '';
            document.getElementById('cep-lon').value = '';
            document.getElementById('rua-destino').value = '';
            document.getElementById('cidade-destino').value = '';
            document.getElementById('estado-destino').value = '';
            document.getElementById('endereco-container').classList.remove('show');
        });
    }
}

async function fetchCep(cep) {
    const inputCepDestino = document.getElementById('cep-destino');
    const containerEndereco = document.getElementById('endereco-container');
    const inputRua = document.getElementById('rua-destino');
    const inputCidade = document.getElementById('cidade-destino');
    const inputEstado = document.getElementById('estado-destino');
    const inputNumero = document.getElementById('numero-destino');
    const inputLat = document.getElementById('cep-lat');
    const inputLon = document.getElementById('cep-lon');

    try {
        // **** URL ATUALIZADA ****
        // Removemos o "http://localhost:3000"
        const response = await fetch(`/api/cep?cep=${cep}`);
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'CEP não encontrado');
        }
        const data = await response.json();

        if(inputRua) inputRua.value = data.logradouro;
        if(inputCidade) inputCidade.value = data.cidade;
        if(inputEstado) inputEstado.value = data.estado;
        if(inputLat) inputLat.value = data.latitude;
        if(inputLon) inputLon.value = data.longitude;
        
        if(containerEndereco) containerEndereco.classList.add('show');
        limparErroDo(inputCepDestino);
        if(inputNumero) inputNumero.focus();

    } catch (error) {
        console.error("Erro na busca de CEP:", error);
        if(inputLat) inputLat.value = "";
        if(inputLon) inputLon.value = "";
        mostrarErro(inputCepDestino, error.message);
        if(containerEndereco) containerEndereco.classList.remove('show');
    }
}

// --- 6. Submissão do Formulário e Simulação (ATUALIZADO) ---
async function initFormSubmit() {
    const form = document.getElementById('form-simulador');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateStep(4)) return;

            const btnSubmit = document.getElementById('btn-submit-form');
            btnSubmit.classList.add('loading');
            btnSubmit.disabled = true;
            
            const modal = document.getElementById('approval-modal');
            const loadingState = document.getElementById('loading-state');
            const approvedState = document.getElementById('approved-state');
            
            modal.style.display = 'flex';
            loadingState.style.display = 'block';
            approvedState.style.display = 'none';
            document.querySelector('.cupom-feedback-message').textContent = '';

            try {
                const destinoCoords = [
                    parseFloat(document.getElementById('cep-lon').value),
                    parseFloat(document.getElementById('cep-lat').value)
                ];
                const cupom = document.getElementById('cupom-desconto').value;
                const veiculo = document.getElementById('tipo-veiculo').value;
                const destino = `${document.getElementById('cidade-destino').value}/${document.getElementById('estado-destino').value}`;

                // **** URL ATUALIZADA ****
                // Removemos o "http://localhost:3000"
                const response = await fetch('/api/calcular-frete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destinoCoords, cupom })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Não foi possível calcular a distância.");
                }

                const quote = await response.json();
                const cupomFeedback = document.querySelector('.cupom-feedback-message');
                
                if (cupom) {
                   if (quote.cupomAplicado) {
                       cupomFeedback.textContent = "Cupom aplicado com sucesso!";
                       cupomFeedback.style.color = "var(--success)";
                   } else {
                       cupomFeedback.textContent = "Cupom inválido";
                       cupomFeedback.style.color = "var(--primary)";
                   }
                }

                const quoteData = {
                    destino: destino,
                    veiculo: veiculo,
                    prazo: quote.prazo,
                    valorBase: quote.valorBase,
                    desconto: quote.desconto,
                    valorFinal: quote.valorFinal,
                    cupomAplicado: quote.cupomAplicado
                };

                populateModalWithQuote(quoteData);
                loadingState.style.display = 'none';
                approvedState.style.display = 'block';

            } catch (error) {
                console.error("Erro no cálculo de frete:", error);
                alert(`Erro ao calcular o frete: ${error.message}. Tente novamente.`);
                modal.style.display = 'none';
            } finally {
                btnSubmit.classList.remove('loading');
                btnSubmit.disabled = false;
            }
        });
    }
}

// Preenche o Ticket Final
function populateModalWithQuote(quote) {
    document.getElementById('cidade-resumo').textContent = quote.destino.split('/')[0];
    document.getElementById('veiculo-final-display').textContent = quote.veiculo.toUpperCase();
    document.getElementById('prazo-final-display').textContent = quote.prazo;
    document.getElementById('base-final-display').textContent = quote.valorBase;
    document.getElementById('total-final-display').textContent = quote.valorFinal;

    const descontoLi = document.getElementById('desconto-final-li');
    const descontoDisplay = document.getElementById('desconto-final-display');
    
    if (quote.cupomAplicado) {
        descontoDisplay.textContent = `- ${quote.desconto}`;
        descontoLi.style.display = 'flex';
    } else {
        descontoLi.style.display = 'none';
    }
    
    const btnWhats = document.getElementById('btn-whatsapp-final');
    if(btnWhats) {
        const text = `Olá! Fiz uma cotação no site TOPCAR.\nVeículo: ${quote.veiculo}\nDestino: ${quote.destino}\nValor: ${quote.valorFinal}`;
        btnWhats.href = `https://wa.me/5515996452232?text=${encodeURIComponent(text)}`;
    }
}

// Função Global para fechar modal
window.closeModal = function() {
    document.getElementById('approval-modal').style.display = 'none';
    document.getElementById('cupom-desconto').value = '';
    document.querySelector('.cupom-feedback-message').textContent = '';
}

// --- 7. Máscaras Simples (Helper) ---
function initMasks() {
    const cepInput = document.getElementById('cep-destino');
    if(cepInput) {
        cepInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
            e.target.value = v;
        });
    }
    const telInput = document.getElementById('telefone-cliente');
    if(telInput) {
        telInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/^(\d{2})(\d)/g, '($1) $2'); v = v.replace(/(\d)(\d{4})$/, '$1-$2');
            e.target.value = v;
        });
    }
}