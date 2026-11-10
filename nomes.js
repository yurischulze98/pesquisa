const search = document.getElementById('nameSearch');
const category = document.getElementById('nameGroup');
const directory = document.getElementById('namesDirectory');
const results = document.getElementById('nameResults');
const copyStatus = document.getElementById('copyStatus');
const copyTimers = new WeakMap();

function normalize(value) {
    return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const groups = Array.from(directory.querySelectorAll('.name-group'), group => ({
    group,
    count: group.querySelector('.section-heading span'),
    cards: Array.from(group.querySelectorAll('.name-card'), card => ({
        card,
        text: normalize(card.querySelector('.name-text').textContent)
    }))
}));

function renderResults() {
    const query = normalize(search.value.trim());
    let total = 0;

    for (const {group, count, cards} of groups) {
        let visible = 0;
        for (const {card, text} of cards) {
            card.hidden = !text.includes(query);
            if (!card.hidden) visible++;
        }
        group.hidden = visible === 0 || Boolean(category.value && category.value !== group.id);
        count.textContent = visible === 1 ? '1 sugestão' : `${visible} sugestões`;
        if (!group.hidden) total += visible;
    }

    results.textContent = total === 0 ? 'Nenhuma sugestão encontrada.'
        : total === 1 ? '1 sugestão encontrada' : `${total} sugestões encontradas`;
}

function copyWithSelection(text, button) {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.className = 'visually-hidden';
    document.body.append(temporary);
    temporary.select();

    try {
        if (!document.execCommand('copy')) throw new Error('Cópia indisponível');
    } finally {
        temporary.remove();
        button.focus();
    }
}

directory.addEventListener('click', async event => {
    const button = event.target.closest('.copy-btn');
    if (!button) return;

    const text = button.closest('.name-card').querySelector('.name-text').textContent.trim();
    try {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            copyWithSelection(text, button);
        }
        copyStatus.textContent = 'Nome copiado.';
        button.textContent = 'Copiado';
        button.classList.add('copied');
    } catch {
        copyStatus.textContent = 'Não foi possível copiar. Selecione o nome para copiar manualmente.';
        button.textContent = 'Falhou';
        button.classList.remove('copied');
    }

    clearTimeout(copyTimers.get(button));
    copyTimers.set(button, setTimeout(() => {
        button.textContent = 'Copiar';
        button.classList.remove('copied');
    }, 1500));
});

search.addEventListener('input', renderResults);
category.addEventListener('change', renderResults);
renderResults();
