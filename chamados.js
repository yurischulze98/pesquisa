const STORAGE_KEY = 'recentTicketIDs';
const MAX_HISTORY = 20;
const BASE_URL = 'https://support.sevensuite.com.br/TicketDossier/';
const SUFFIX = '/OpenBySequentialId';
const form = document.getElementById('ticketForm');
const input = document.getElementById('idInput');
const feedback = document.getElementById('ticketFeedback');

function getHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(stored)
            ? stored.filter(id => typeof id === 'string' && /^\d+$/.test(id)).slice(0, MAX_HISTORY)
            : [];
    } catch {
        return [];
    }
}

let historyIds = getHistory();

function renderHistory() {
    const list = document.getElementById('recentList');
    list.replaceChildren();

    for (const id of historyIds) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = BASE_URL + id + SUFFIX;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '#' + id;
        link.insertAdjacentHTML('beforeend', '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h6v6m0-6-9 9m8-1v5H6V6h5"/></svg>');
        item.append(link);
        list.append(item);
    }

    list.hidden = historyIds.length === 0;
    document.getElementById('historyEmpty').hidden = historyIds.length > 0;
    document.getElementById('historyCount').textContent = `${historyIds.length} / ${MAX_HISTORY}`;
}

form.addEventListener('submit', event => {
    event.preventDefault();
    const ids = [...new Set(input.value.split(/[\s,]+/).filter(id => /^\d+$/.test(id)))];

    if (!ids.length) {
        input.setAttribute('aria-invalid', 'true');
        feedback.setAttribute('data-error', '');
        feedback.hidden = false;
        feedback.textContent = 'Informe pelo menos um ID numérico.';
        input.focus();
        return;
    }

    for (const id of ids) {
        window.open(BASE_URL + id + SUFFIX, '_blank', 'noopener,noreferrer');
    }

    historyIds = [...new Set([...ids, ...historyIds])].slice(0, MAX_HISTORY);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyIds));
    } catch {
        // O histórico continua disponível nesta página se o armazenamento estiver bloqueado.
    }
    renderHistory();
    input.value = '';
    input.removeAttribute('aria-invalid');
    feedback.removeAttribute('data-error');
    feedback.hidden = false;
    feedback.textContent = 'Se alguma aba não abrir, acesse o chamado pelo histórico.';
});

input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    feedback.hidden = true;
});

input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
    }
});

const shiftLabel = document.getElementById('shift-label');
const shiftTimer = document.getElementById('countdown');
const dateTimers = Array.from(document.querySelectorAll('[data-date]'), card => ({
    date: Date.parse(card.dataset.date),
    element: card.querySelector('.timer')
}));

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function updateAgenda() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(17, 0, 0, 0);
    let label = 'Até 17h';

    if (now >= target) {
        target.setHours(18);
        label = 'Até 18h';
    }
    if (now >= target) {
        target.setDate(target.getDate() + 1);
        target.setHours(17);
        label = 'Amanhã, às 17h';
    }

    shiftLabel.textContent = label;
    shiftTimer.textContent = formatTime(Math.ceil((target - now) / 1000));

    for (const {date, element} of dateTimers) {
        const seconds = Math.ceil((date - now) / 1000);
        if (seconds <= 0) {
            element.textContent = 'Encerrado';
        } else if (seconds >= 86400) {
            const days = Math.floor(seconds / 86400);
            element.textContent = days === 1 ? '1 dia' : `${days} dias`;
        } else {
            element.textContent = formatTime(seconds);
        }
    }
}

renderHistory();
updateAgenda();
setInterval(updateAgenda, 1000);
