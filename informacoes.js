// Cada bloco .guide ganha uma mensagem pronta para colar no Teams.
// Texto inicial opcional: data-message-intro no <article>. Sem ele, usa o título do bloco.
const copyStatus = document.getElementById('copyStatus');
const resetTimers = new WeakMap();

function escapeHtml(value) {
    return value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function buildMessage(guide) {
    const title = guide.querySelector('h2').textContent.trim();
    const intro = guide.dataset.messageIntro?.trim() || `${title}:`;
    const steps = Array.from(guide.querySelectorAll('.steps > li'), item => ({
        text: (item.querySelector('strong') || item).textContent.trim(),
        links: Array.from(item.querySelectorAll('a[href]'), link => link.href)
    }));

    const plain = [intro, '', ...steps.map((step, index) =>
        `${index + 1}. ${step.text}${step.links.length ? ': ' + step.links.join(' ') : ''}`
    )].join('\n');

    const html = `<p>${escapeHtml(intro)}</p><ol>${steps.map(step =>
        `<li>${escapeHtml(step.text)}${step.links.map(url =>
            `: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`).join('')}</li>`
    ).join('')}</ol>`;

    return { plain, html };
}

async function copyMessage({ plain, html }) {
    if (navigator.clipboard && window.ClipboardItem) {
        try {
            await navigator.clipboard.write([new ClipboardItem({
                'text/plain': new Blob([plain], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' })
            })]);
            return;
        } catch { /* tenta texto simples */ }
    }
    if (navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(plain);
            return;
        } catch { /* tenta seleção */ }
    }
    const temporary = document.createElement('textarea');
    temporary.value = plain;
    temporary.className = 'visually-hidden';
    document.body.append(temporary);
    temporary.select();
    const ok = document.execCommand('copy');
    temporary.remove();
    if (!ok) throw new Error('Cópia indisponível');
}

document.addEventListener('click', async event => {
    const button = event.target.closest('.copy-message');
    if (!button) return;

    const label = button.querySelector('span');
    try {
        await copyMessage(buildMessage(button.closest('.guide')));
        label.textContent = 'Copiado';
        button.classList.add('copied');
        copyStatus.textContent = 'Mensagem copiada. Cole no Teams.';
    } catch {
        label.textContent = 'Falhou';
        button.classList.remove('copied');
        copyStatus.textContent = 'Não foi possível copiar a mensagem.';
    }
    button.focus();

    clearTimeout(resetTimers.get(button));
    resetTimers.set(button, setTimeout(() => {
        label.textContent = 'Copiar mensagem';
        button.classList.remove('copied');
    }, 1800));
});
