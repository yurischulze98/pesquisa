// Utilidades compartilhadas pelas ferramentas de IA do portal.

const ICON_COPY = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
const ICON_CHECK = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const copyTimers = new WeakMap();

/** Copia texto para a área de transferência, com alternativa para navegadores antigos. */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return;
    } catch { /* tenta seleção */ }
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.className = 'visually-hidden';
    document.body.append(temporary);
    temporary.select();
    const ok = document.execCommand('copy');
    temporary.remove();
    if (!ok) throw new Error('Cópia indisponível');
}

/** Copia e dá retorno visual no botão (o rótulo fica em um <span> dentro dele). */
async function copyWithFeedback(button, text, label = button.dataset.label || 'Copiar') {
    button.dataset.label = label;
    let message = 'Copiado';
    try {
        if (!text.trim()) throw new Error('Nada para copiar');
        await copyToClipboard(text);
        button.classList.add('copied');
    } catch {
        message = text.trim() ? 'Falhou' : 'Vazio';
        button.classList.remove('copied');
    }
    button.innerHTML = `${message === 'Copiado' ? ICON_CHECK : ICON_COPY}<span>${message}</span>`;
    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = `${ICON_COPY}<span>${label}</span>`;
    }, 1600));
}

/** Alterna o estado de carregamento de um botão de ação. */
function setButtonLoading(button, loading, idleHtml, loadingText) {
    button.disabled = loading;
    button.innerHTML = loading ? `<span class="spinner" aria-hidden="true"></span><span>${loadingText}</span>` : idleHtml;
}

/** Exibe ou oculta um aviso (.notice). */
function showNotice(element, message, type = 'error') {
    element.hidden = !message;
    element.textContent = message || '';
    element.className = `notice${type ? ` notice-${type}` : ''}`;
}

/** POST JSON com mensagem de erro legível. */
async function postJson(url, payload) {
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch {
        throw new Error('Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 413) throw new Error(data.error || 'O conteúdo enviado é grande demais. Reduza o texto ou as imagens.');
        throw new Error(data.error || data.erro || `Erro ao processar (HTTP ${response.status}).`);
    }
    return data;
}
