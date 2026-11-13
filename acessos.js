// Acessos: lê /api/acessos (planilha do Google) e monta as visões por analista e por cliente.
const PASSWORD_KEY = 'acessos-senha';
const AUTO_REFRESH_MS = 2 * 60_000;

const STATUS_STYLE = {
    'Ativo': 'st-ativo',
    'Aguardando reset de senha': 'st-reset',
    'Aguardando cliente': 'st-cliente',
    'Inativo': 'st-inativo',
    'Não deve ter acesso': 'st-bloqueado'
};
const STATUS_ORDER = Object.keys(STATUS_STYLE);
const STATUS_COUNT_LABEL = {
    'Ativo': ['ativo', 'ativos'],
    'Aguardando reset de senha': ['aguardando reset', 'aguardando reset'],
    'Aguardando cliente': ['aguardando cliente', 'aguardando cliente'],
    'Inativo': ['inativo', 'inativos'],
    'Não deve ter acesso': ['não deve ter acesso', 'não devem ter acesso']
};

const $ = id => document.getElementById(id);
const els = {
    loginPanel: $('loginPanel'), loginForm: $('loginForm'), password: $('passwordInput'), loginError: $('loginError'),
    app: $('accessApp'), metrics: $('metrics'), search: $('searchInput'), client: $('clientFilter'), dept: $('deptFilter'),
    status: $('statusFilter'), sync: $('syncLabel'), refresh: $('refreshButton'), loadError: $('loadError'),
    analystsCount: $('analystsCount'), analystsList: $('analystsList'), clientsCount: $('clientsCount'), clientsList: $('clientsList')
};

let data = null;
let loading = false;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const statusClass = status => STATUS_STYLE[status] || 'st-outro';
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const extractEmails = text => [...new Set((String(text).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map(email => email.toLowerCase()))];

const getPassword = () => { try { return sessionStorage.getItem(PASSWORD_KEY) || ''; } catch { return ''; } };
const setPassword = value => { try { value ? sessionStorage.setItem(PASSWORD_KEY, value) : sessionStorage.removeItem(PASSWORD_KEY); } catch { /* sem armazenamento */ } };

function showLogin(message = '') {
    els.app.hidden = true;
    els.loginPanel.hidden = false;
    showNotice(els.loginError, message);
    els.password.focus();
}

async function load({ force = false, password = getPassword() } = {}) {
    if (loading) return;
    if (!password) return showLogin();
    loading = true;
    els.refresh.disabled = true;
    els.sync.textContent = 'Atualizando…';

    try {
        const response = await fetch(`/api/acessos${force ? '?atualizar=1' : ''}`, { headers: { 'x-acessos-senha': password } });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
            setPassword('');
            return showLogin(body.error || 'Senha incorreta.');
        }
        if (!response.ok) throw new Error(body.error || `Erro ao carregar (HTTP ${response.status}).`);

        setPassword(password);
        data = body;
        els.loginPanel.hidden = true;
        els.app.hidden = false;
        showNotice(els.loadError, '');
        fillFilters();
        render();
    } catch (error) {
        if (!data) { els.loginPanel.hidden = true; els.app.hidden = false; }
        showNotice(els.loadError, error.message === 'Failed to fetch' ? 'Não foi possível conectar ao servidor.' : error.message);
    } finally {
        loading = false;
        els.refresh.disabled = false;
        els.sync.textContent = data ? `Planilha lida às ${new Date(data.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
    }
}

function fillSelect(select, values) {
    const current = select.value;
    select.innerHTML = '<option value="">Todos</option>' + values.map(value => `<option>${escapeHtml(value)}</option>`).join('');
    select.value = values.includes(current) ? current : '';
}

function fillFilters() {
    const unique = key => [...new Set(data.acessos.map(item => item[key]).filter(Boolean))].sort(collator.compare);
    const clients = [...new Set([...unique('cliente'), ...data.contatos.map(item => item.cliente)])].sort(collator.compare);
    fillSelect(els.client, clients);
    fillSelect(els.dept, unique('depto'));
    const statuses = unique('status').sort((a, b) => (STATUS_ORDER.indexOf(a) + 1 || 99) - (STATUS_ORDER.indexOf(b) + 1 || 99));
    fillSelect(els.status, statuses);
}

function filters() {
    return { text: fold(els.search.value.trim()), client: els.client.value, dept: els.dept.value, status: els.status.value };
}

/** Acessos que passam nos filtros de cliente, depto e status (a busca é aplicada em cada visão). */
function filteredAccesses(f) {
    return data.acessos.filter(item =>
        (!f.client || item.cliente === f.client) &&
        (!f.dept || item.depto === f.dept) &&
        (!f.status || item.status === f.status));
}

function renderMetrics(list) {
    const people = new Set(list.map(item => item.email || item.nome)).size;
    const count = status => list.filter(item => item.status === status).length;
    const blocked = count('Inativo') + count('Não deve ter acesso');
    const cards = [
        ['Analistas', people, ''],
        ['Acessos ativos', count('Ativo'), 'st-ativo'],
        ['Aguardando reset de senha', count('Aguardando reset de senha'), 'st-reset'],
        ['Aguardando cliente', count('Aguardando cliente'), 'st-cliente'],
        ['Inativos ou sem acesso', blocked, 'st-bloqueado']
    ];
    els.metrics.innerHTML = cards.map(([label, value, cls]) =>
        `<div class="access-metric ${cls}"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderAnalysts(list, f) {
    const groups = new Map();
    for (const item of list) {
        const key = item.email || fold(item.nome);
        if (!groups.has(key)) groups.set(key, { nome: item.nome, email: item.email, deptos: new Set(), acessos: [] });
        const group = groups.get(key);
        if (item.depto) group.deptos.add(item.depto);
        group.acessos.push(item);
    }

    const analysts = [...groups.values()]
        .filter(group => !f.text || fold(`${group.nome} ${group.email} ${group.acessos.map(item => item.cliente).join(' ')}`).includes(f.text))
        .sort((a, b) => collator.compare(a.nome, b.nome));

    els.analystsCount.textContent = plural(analysts.length, 'analista', 'analistas');
    if (!analysts.length) {
        els.analystsList.innerHTML = '<p class="access-empty">Nenhum analista encontrado com esses filtros.</p>';
        return;
    }

    els.analystsList.innerHTML = `
        <div class="access-row access-head" aria-hidden="true"><span>Analista</span><span>Depto</span><span>Clientes</span></div>
        ${analysts.map(group => `
            <div class="access-row">
                <div class="access-person">
                    <strong>${escapeHtml(group.nome)}</strong>
                    ${group.email ? `<button type="button" class="link-button copy-email" data-copy="${escapeHtml(group.email)}" title="Copiar e-mail">${escapeHtml(group.email)}</button>` : ''}
                </div>
                <span class="access-dept">${escapeHtml([...group.deptos].join(', ') || '—')}</span>
                <div class="access-chips">${group.acessos
                    .sort((a, b) => collator.compare(a.cliente, b.cliente))
                    .map(item => `<span class="access-chip ${statusClass(item.status)}" title="${escapeHtml(item.status)}"><i aria-hidden="true"></i>${escapeHtml(item.cliente || 'Sem cliente')}<span class="visually-hidden">: ${escapeHtml(item.status)}</span></span>`)
                    .join('')}</div>
            </div>`).join('')}`;
}

function renderClients(list, f) {
    const contacts = new Map(data.contatos.map(item => [fold(item.cliente), item]));
    const groups = new Map();
    const ensure = name => {
        const key = fold(name);
        if (!groups.has(key)) groups.set(key, { nome: name, contato: contacts.get(key), acessos: [] });
        return groups.get(key);
    };
    for (const item of list) ensure(item.cliente || 'Sem cliente').acessos.push(item);
    // Sem filtro de depto ou status, mostra também clientes que só têm contato cadastrado.
    if (!f.dept && !f.status) data.contatos.filter(item => !f.client || item.cliente === f.client).forEach(item => ensure(item.cliente));

    const clients = [...groups.values()]
        .filter(group => !f.text || fold([group.nome, group.contato?.contato, ...group.acessos.map(item => `${item.nome} ${item.email}`)].join(' ')).includes(f.text))
        .sort((a, b) => b.acessos.length - a.acessos.length || collator.compare(a.nome, b.nome));

    els.clientsCount.textContent = plural(clients.length, 'cliente', 'clientes');
    if (!clients.length) {
        els.clientsList.innerHTML = '<p class="access-empty">Nenhum cliente encontrado com esses filtros.</p>';
        return;
    }

    els.clientsList.innerHTML = clients.map(group => {
        const c = group.contato || {};
        const emails = extractEmails(c.contato || '');
        const counts = STATUS_ORDER
            .map(status => [status, group.acessos.filter(item => item.status === status).length])
            .filter(([, count]) => count);
        const people = [...group.acessos].sort((a, b) => collator.compare(a.nome, b.nome));
        const nonNominal = /nao nominal/.test(fold(c.criacao));

        return `
        <article class="client-card">
            <header class="client-head">
                <h3>${escapeHtml(group.nome)}</h3>
                <span class="count-badge">${plural(group.acessos.length, 'acesso', 'acessos')}</span>
            </header>
            ${counts.length ? `<div class="client-status">${counts.map(([status, count]) =>
                `<span class="access-chip ${statusClass(status)}" title="${escapeHtml(status)}"><i aria-hidden="true"></i>${count} ${STATUS_COUNT_LABEL[status][count === 1 ? 0 : 1]}</span>`).join('')}</div>` : ''}
            <dl class="client-info">
                ${nonNominal ? '<div><dt>Acesso</dt><dd>Não nominal</dd></div>' : `
                <div><dt>Cria o acesso</dt><dd>${escapeHtml(c.criacao || '—')}</dd></div>
                <div><dt>Exclui o acesso</dt><dd>${escapeHtml(c.exclusao || '—')}</dd></div>`}
                ${c.teams ? `<div><dt>Tem Teams</dt><dd>${escapeHtml(c.teams)}</dd></div>` : ''}
                ${c.contato ? `<div class="client-wide"><dt>Contato</dt><dd>${emails.length
                    ? emails.map(email => `<span class="client-email">${escapeHtml(email)}</span>`).join('')
                    : escapeHtml(c.contato)}</dd></div>` : ''}
                ${c.observacao ? `<div class="client-wide"><dt>Observação</dt><dd class="client-note">${escapeHtml(c.observacao)}</dd></div>` : ''}
                ${!group.contato ? '<div class="client-wide"><dt>Contato</dt><dd class="client-missing">Cliente sem linha na aba Contatos Clientes</dd></div>' : ''}
            </dl>
            <div class="client-actions">
                ${emails.length ? `<button type="button" class="button button-small copy-emails" data-copy="${escapeHtml(emails.join('; '))}">${ICON_COPY}<span>Copiar e-mails</span></button>` : ''}
            </div>
            ${people.length ? `
            <details class="client-people">
                <summary>Ver ${plural(people.length, 'analista', 'analistas')}</summary>
                <ul>${people.map(item => `<li><span>${escapeHtml(item.nome)}<small>${escapeHtml(item.depto)}</small></span><span class="access-chip ${statusClass(item.status)}"><i aria-hidden="true"></i>${escapeHtml(item.status)}</span></li>`).join('')}</ul>
            </details>` : ''}
        </article>`;
    }).join('');
}

function render() {
    if (!data) return;
    const f = filters();
    const list = filteredAccesses(f);
    renderMetrics(list);
    renderAnalysts(list, f);
    renderClients(list, f);
}

// Abas
const tabs = [...document.querySelectorAll('.access-tabs [role="tab"]')];
function selectTab(tab) {
    for (const item of tabs) {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        $(item.getAttribute('aria-controls')).hidden = !selected;
    }
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next);
        next.focus();
    });
});

// Filtros
let searchTimer;
els.search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 120); });
[els.client, els.dept, els.status].forEach(select => select.addEventListener('change', render));

// Copiar e-mails
document.addEventListener('click', event => {
    const many = event.target.closest('.copy-emails');
    if (many) return copyWithFeedback(many, many.dataset.copy, 'Copiar e-mails');
    const one = event.target.closest('.copy-email');
    if (!one) return;
    copyToClipboard(one.dataset.copy).then(() => {
        one.classList.add('copied');
        setTimeout(() => one.classList.remove('copied'), 1200);
    }).catch(() => {});
});

// Login e atualização
els.loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = els.password.value.trim();
    if (!value) return showNotice(els.loginError, 'Informe a senha.');
    showNotice(els.loginError, '');
    load({ password: value }).then(() => { els.password.value = ''; });
});
els.refresh.addEventListener('click', () => load({ force: true }));
setInterval(() => { if (data && document.visibilityState === 'visible') load(); }, AUTO_REFRESH_MS);
document.addEventListener('visibilitychange', () => {
    if (data && document.visibilityState === 'visible' && Date.now() - new Date(data.atualizadoEm) > AUTO_REFRESH_MS) load();
});

load();
