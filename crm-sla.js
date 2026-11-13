// Atualização de CRM e justificativa de SLA. Lógica portada do projeto AnalisadorChatGPT.
const crmForm = document.getElementById('crmForm');
const textoChamado = document.getElementById('textoChamado');
const crmCount = document.getElementById('crmCount');
const crmError = document.getElementById('crmError');
const crmSubmit = document.getElementById('crmSubmit');
const crmSubmitIdle = crmSubmit.innerHTML;
const resultadoCrm = document.getElementById('resultadoCrm');
const resultadoSla = document.getElementById('resultadoSla');

function updateCount() {
    const total = textoChamado.value.length;
    crmCount.textContent = `${total.toLocaleString('pt-BR')} ${total === 1 ? 'caractere' : 'caracteres'}`;
}

crmForm.addEventListener('submit', async event => {
    event.preventDefault();
    const texto = textoChamado.value.trim();
    showNotice(crmError, '');

    if (texto.length < 20) {
        showNotice(crmError, 'Informe mais detalhes sobre o chamado antes de analisar (mínimo de 20 caracteres).');
        textoChamado.focus();
        return;
    }

    resultadoCrm.value = '';
    resultadoSla.value = '';
    setButtonLoading(crmSubmit, true, crmSubmitIdle, 'Analisando…');
    try {
        const data = await postJson('/api/crm-sla', { texto });
        resultadoCrm.value = data.crm || '';
        resultadoSla.value = data.sla || '';
    } catch (error) {
        showNotice(crmError, error.message);
    } finally {
        setButtonLoading(crmSubmit, false, crmSubmitIdle);
    }
});

document.getElementById('crmClear').addEventListener('click', () => {
    textoChamado.value = '';
    resultadoCrm.value = '';
    resultadoSla.value = '';
    showNotice(crmError, '');
    updateCount();
    textoChamado.focus();
});

document.querySelectorAll('[data-copy-target]').forEach(button => {
    button.addEventListener('click', () => {
        copyWithFeedback(button, document.getElementById(button.dataset.copyTarget).value);
    });
});

textoChamado.addEventListener('input', updateCount);
textoChamado.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        crmForm.requestSubmit();
    }
});
updateCount();
