// Título de chamado externo (Renner-ServiceNow). Lógica portada do projeto Alterar-Titulo.
const TITLE_PREFIX = 'Renner-ServiceNow -';
const titleForm = document.getElementById('titleForm');
const description = document.getElementById('description');
const charCount = document.getElementById('charCount');
const titleError = document.getElementById('titleError');
const generateButton = document.getElementById('generateButton');
const generateIdle = generateButton.innerHTML;
const titleResult = document.getElementById('titleResult');
const titlePrefix = document.getElementById('titlePrefix');
const titleText = document.getElementById('titleText');
const copyTitle = document.getElementById('copyTitle');
let fullTitle = '';

function extractTicketNumber(text) {
    const match = text.match(/\bRITM\s*\d+\b/i);
    return match ? match[0].replace(/\s+/g, '').toUpperCase() : null;
}

function extractTicketDescription(text) {
    const match = text.match(/\*{0,2}Descrição do chamado:\*{0,2}\s*([\s\S]*)/i);
    return match?.[1]?.trim() || text.trim();
}

function updateCount() {
    charCount.textContent = `${description.value.length}/4000`;
}

titleForm.addEventListener('submit', async event => {
    event.preventDefault();
    showNotice(titleError, '');
    if (!description.value.trim()) {
        showNotice(titleError, 'Cole a descrição do chamado antes de gerar o título.');
        description.focus();
        return;
    }

    setButtonLoading(generateButton, true, generateIdle, 'Gerando…');
    titleResult.hidden = true;
    try {
        const ticketNumber = extractTicketNumber(description.value);
        const data = await postJson('/api/gerar-titulo', { description: extractTicketDescription(description.value) });
        const prefix = `${ticketNumber ? `[${ticketNumber}] ` : ''}${TITLE_PREFIX}`;
        titlePrefix.textContent = prefix;
        titleText.textContent = data.title;
        fullTitle = `${prefix} ${data.title}`;
        titleResult.hidden = false;
    } catch (error) {
        showNotice(titleError, error.message);
    } finally {
        setButtonLoading(generateButton, false, generateIdle);
    }
});

document.getElementById('clearButton').addEventListener('click', () => {
    description.value = '';
    fullTitle = '';
    titleResult.hidden = true;
    showNotice(titleError, '');
    updateCount();
    description.focus();
});

description.addEventListener('input', updateCount);
description.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        titleForm.requestSubmit();
    }
});
copyTitle.addEventListener('click', () => copyWithFeedback(copyTitle, fullTitle, 'Copiar título'));
updateCount();
