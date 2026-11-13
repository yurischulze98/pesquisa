// Análise de dossiê com texto e prints intercalados.
// Lógica portada do projeto AnalisadorChamados (componente DossieEditor + página).

const MAX_IMAGES = 8;
const MAX_TOTAL_IMAGE_CHARS = 3_000_000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const SUPPORTED = ['image/png', 'image/jpeg', 'image/webp'];
const MARKER_REGEX = /\[Imagem #(\d+)\]/g;
const marker = id => `[Imagem #${id}]`;

const el = id => document.getElementById(id);
const textarea = el('historico');
const chamadoInput = el('chamadoId');
const complementoInput = el('complemento');
const counter = el('dossieCount');
const dropTarget = el('dropTarget');
const fileInput = el('fileInput');
const attachButton = el('attachButton');
const attachmentsSection = el('attachments');
const attachmentsTitle = el('attachmentsTitle');
const attachmentsGrid = el('attachmentsGrid');
const detailGroup = el('detailGroup');
const errorBox = el('dossieError');
const submitButton = el('dossieSubmit');
const submitIdle = submitButton.innerHTML;
const clearButton = el('dossieClear');
const resultEmpty = el('resultEmpty');
const resultLoading = el('resultLoading');
const resultContent = el('resultContent');
const copyAllButton = el('copyAll');

let attachments = []; // { id, nome, status: 'carregando' | 'pronto' | 'erro', dataUrl?, erro? }
let nextId = 1;
let cursor = { start: 0, end: 0 };
let busy = false;
let lastResult = null;

const svg = d => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_TRASH = svg('<path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>');

// ------------------------------------------------------------------ Imagens

function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(blob);
    });
}

async function optimizeImage(blob) {
    if (!SUPPORTED.includes(blob.type)) throw new Error('Formato não suportado. Utilize PNG, JPG ou WebP.');
    if (blob.size > MAX_FILE_BYTES) throw new Error('Imagem acima de 12 MB.');
    if (blob.size <= 500_000) return toDataUrl(blob);

    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const dimension = Math.max(image.naturalWidth, image.naturalHeight);
        if (!dimension) throw new Error('Arquivo de imagem inválido.');

        const convert = (limit, quality) => {
            const scale = Math.min(1, limit / dimension);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Falha ao preparar a imagem no navegador.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const webp = canvas.toDataURL('image/webp', quality);
            return webp.startsWith('data:image/webp;base64,') ? webp : canvas.toDataURL('image/jpeg', quality);
        };

        let data = convert(2000, 0.9);
        if (data.length > 1_000_000) data = convert(1600, 0.84);
        if (data.length > 1_000_000) data = convert(1200, 0.78);
        return data;
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function loadImage(piece) {
    if (piece.file) return optimizeImage(piece.file);
    const src = piece.src?.trim() || '';
    if (!src) throw new Error('A página copiada não disponibilizou os dados da imagem.');

    if (/^data:image\//i.test(src)) return optimizeImage(await (await fetch(src)).blob());

    // A busca acontece só no navegador. Prints privados do Seven Suite podem exigir login ou bloquear CORS.
    if (/^https?:\/\//i.test(src) || /^blob:/i.test(src)) {
        const url = new URL(src, window.location.href);
        const response = await fetch(url.toString(), {
            credentials: url.origin === window.location.origin ? 'same-origin' : 'omit',
            signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error(`Imagem não acessível (HTTP ${response.status}).`);
        return optimizeImage(await response.blob());
    }
    throw new Error('Link privado ou formato de imagem inacessível nesta colagem.');
}

// ------------------------------------------------------------------ Colagem

/** Extrai texto e <img> do HTML colado, sem inserir HTML de terceiros na página. */
function parsePastedHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    const blocks = new Set(['DIV', 'P', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE']);
    const ignore = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'VIDEO', 'AUDIO', 'HEAD', 'META', 'LINK']);

    const addText = text => {
        if (!text) return;
        const last = items[items.length - 1];
        if (last?.type === 'text') last.text += text;
        else items.push({ type: 'text', text });
    };
    const lineBreak = () => {
        if (!items.length) return;
        const last = items[items.length - 1];
        if (last.type !== 'text' || !last.text.endsWith('\n')) addText('\n');
    };
    const walk = node => {
        if (node.nodeType === Node.TEXT_NODE) {
            addText((node.textContent || '').replace(/ /g, ' '));
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (ignore.has(node.tagName)) return;
        if (node.tagName === 'BR' || node.tagName === 'HR') { lineBreak(); return; }
        if (node.tagName === 'IMG') {
            if (node.getAttribute('width') === '1' && node.getAttribute('height') === '1') return;
            items.push({ type: 'image', src: node.getAttribute('src') || node.getAttribute('data-src') || '', name: node.getAttribute('alt') || undefined });
            return;
        }
        if (blocks.has(node.tagName)) lineBreak();
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'TD' && child !== node.firstElementChild) addText('\t');
            walk(child);
        }
        if (blocks.has(node.tagName)) lineBreak();
    };
    for (const node of Array.from(doc.body.childNodes)) walk(node);
    if (items[0]?.type === 'text') items[0].text = items[0].text.replace(/^\n+/, '');
    const last = items[items.length - 1];
    if (last?.type === 'text') last.text = last.text.replace(/\n+$/, '');
    return items.filter(item => item.type === 'image' || item.text.length > 0);
}

/** Troca cada marcador pelo conteúdo da imagem, na posição exata do texto. */
function buildParts(text) {
    const parts = [];
    const map = new Map(attachments.map(a => [a.id, a]));
    let start = 0;
    for (const match of text.matchAll(MARKER_REGEX)) {
        const attachment = map.get(Number(match[1]));
        if (!attachment) continue; // marcador digitado sem anexo vira texto comum
        const position = match.index;
        if (position > start) parts.push({ tipo: 'texto', texto: text.slice(start, position) });
        if (attachment.status === 'pronto' && attachment.dataUrl) {
            parts.push({ tipo: 'imagem', nome: attachment.nome, dataUrl: attachment.dataUrl });
        } else {
            parts.push({ tipo: 'texto', texto: `[Imagem #${attachment.id} indisponível]` });
        }
        start = position + match[0].length;
    }
    if (start < text.length) parts.push({ tipo: 'texto', texto: text.slice(start) });
    return parts.filter(part => part.tipo === 'imagem' || part.texto.length > 0);
}

function stats() {
    const text = textarea.value;
    const parts = buildParts(text);
    return {
        imagens: parts.filter(p => p.tipo === 'imagem').length,
        pendentes: attachments.filter(a => a.status === 'carregando').length,
        falhas: attachments.filter(a => a.status === 'erro').length,
        semMarcador: attachments.filter(a => !text.includes(marker(a.id))).length,
        parts
    };
}

function saveCursor() {
    cursor = { start: textarea.selectionStart, end: textarea.selectionEnd };
}

function insertAtCursor(snippet) {
    const value = textarea.value;
    textarea.value = value.slice(0, cursor.start) + snippet + value.slice(cursor.end);
    const position = cursor.start + snippet.length;
    textarea.focus();
    textarea.setSelectionRange(position, position);
    cursor = { start: position, end: position };
}

function setError(message, type = 'error') {
    showNotice(errorBox, message, type);
}

async function prepareAttachment(id, piece) {
    try {
        const dataUrl = await loadImage(piece);
        if (!attachments.some(a => a.id === id)) return; // removido enquanto carregava
        const total = attachments.reduce((sum, a) => sum + (a.id !== id ? (a.dataUrl?.length || 0) : 0), 0);
        if (total + dataUrl.length > MAX_TOTAL_IMAGE_CHARS) throw new Error('Limite de tamanho das imagens atingido; remova ou reduza alguns prints.');
        attachments = attachments.map(a => a.id === id ? { ...a, status: 'pronto', dataUrl, erro: undefined } : a);
    } catch (error) {
        if (!attachments.some(a => a.id === id)) return;
        const reason = error instanceof Error ? error.message : 'Erro desconhecido ao carregar a imagem.';
        attachments = attachments.map(a => a.id === id ? { ...a, status: 'erro', erro: reason } : a);
        setError(`Não foi possível carregar a imagem #${id}: ${reason}. Confira a lista de anexos.`);
    }
    render();
}

function insertPieces(pieces) {
    if (busy || !pieces.length) return false;
    const newImages = pieces.filter(p => p.type === 'image').length;
    if (attachments.length + newImages > MAX_IMAGES) {
        setError(`O limite é de ${MAX_IMAGES} imagens por análise. A colagem foi cancelada para evitar perder evidências.`);
        return false;
    }
    const tasks = [];
    let snippet = '';
    for (const piece of pieces) {
        if (piece.type === 'text') {
            snippet += piece.text;
        } else {
            const id = nextId++;
            attachments.push({ id, nome: (piece.name || piece.file?.name || `Captura ${id}`).slice(0, 150), status: 'carregando' });
            tasks.push({ id, piece });
            snippet += `\n${marker(id)}\n`; // o marcador é texto simples; a imagem não entra no campo
        }
    }
    insertAtCursor(snippet);
    setError('');
    render();
    for (const task of tasks) prepareAttachment(task.id, task.piece);
    return true;
}

textarea.addEventListener('paste', event => {
    event.preventDefault();
    if (busy) return;
    saveCursor();
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    const files = Array.from(event.clipboardData.files).filter(f => SUPPORTED.includes(f.type));
    let pieces = html ? parsePastedHtml(html) : [];
    const htmlImages = pieces.filter(p => p.type === 'image');
    let unknownPosition = false;

    if (htmlImages.length && htmlImages.length === files.length) {
        // Correspondência 1:1: usa os bytes do clipboard nas posições das tags <img>.
        let i = 0;
        pieces = pieces.map(p => p.type === 'image' ? { ...p, file: files[i++] } : p);
    } else if (!htmlImages.length) {
        if (!pieces.length && plain) pieces = [{ type: 'text', text: plain }];
        if (files.length) {
            unknownPosition = pieces.some(p => p.type === 'text' && p.text.trim().length > 0);
            pieces.push(...files.map(file => ({ type: 'image', file })));
        }
    } else if (files.length !== htmlImages.length) {
        // Quantidades diferentes: não associa arquivos a posições arbitrárias; usa o src de cada <img>.
        unknownPosition = files.length > 0;
    }

    const inserted = insertPieces(pieces);
    if (inserted && unknownPosition) {
        setError('A área de transferência não informou a posição de todas as imagens. Os marcadores foram incluídos conforme os dados disponíveis; revise a ordem antes de analisar.', 'warning');
    }
});

['select', 'click', 'keyup'].forEach(type => textarea.addEventListener(type, saveCursor));
textarea.addEventListener('input', () => { saveCursor(); render(); });

attachButton.addEventListener('mousedown', event => event.preventDefault());
attachButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []).filter(f => SUPPORTED.includes(f.type));
    if (files.length) insertPieces(files.map(file => ({ type: 'image', file })));
    fileInput.value = '';
});

dropTarget.addEventListener('dragover', event => { event.preventDefault(); dropTarget.classList.add('dragging'); });
dropTarget.addEventListener('dragleave', () => dropTarget.classList.remove('dragging'));
dropTarget.addEventListener('drop', event => {
    event.preventDefault();
    dropTarget.classList.remove('dragging');
    if (busy) return;
    const files = Array.from(event.dataTransfer.files).filter(f => SUPPORTED.includes(f.type));
    if (files.length) insertPieces(files.map(file => ({ type: 'image', file })));
});

function removeAttachment(id) {
    if (busy) return;
    const token = marker(id);
    textarea.value = textarea.value.replaceAll(`\n${token}\n`, '\n').replaceAll(token, '');
    attachments = attachments.filter(a => a.id !== id);
    setError('');
    render();
}

function reinsertMarker(id) {
    if (busy || !attachments.some(a => a.id === id)) return;
    insertAtCursor(`\n${marker(id)}\n`);
    render();
}

attachmentsGrid.addEventListener('mousedown', event => {
    if (event.target.closest('[data-reinsert]')) event.preventDefault(); // mantém o cursor do campo
});
attachmentsGrid.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]');
    if (remove) return removeAttachment(Number(remove.dataset.remove));
    const reinsert = event.target.closest('[data-reinsert]');
    if (reinsert) reinsertMarker(Number(reinsert.dataset.reinsert));
});

// ------------------------------------------------------------------ Renderização

function renderAttachments() {
    attachmentsSection.hidden = attachments.length === 0;
    attachmentsTitle.textContent = `Prints anexados (${attachments.length})`;
    const text = textarea.value;
    const cards = attachments.map(attachment => {
        const card = document.createElement('article');
        card.className = 'attachment';

        const head = document.createElement('div');
        head.className = 'attachment-head';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `Imagem #${attachment.id}`;
        const name = document.createElement('small');
        name.textContent = attachment.nome;
        name.title = attachment.nome;
        info.append(title, name);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-button';
        remove.dataset.remove = attachment.id;
        remove.disabled = busy;
        remove.title = 'Remover este anexo e seu marcador';
        remove.setAttribute('aria-label', `Remover imagem #${attachment.id}`);
        remove.innerHTML = ICON_TRASH;
        head.append(info, remove);

        const preview = document.createElement('div');
        preview.className = 'attachment-preview';
        if (attachment.status === 'pronto') {
            const image = document.createElement('img');
            image.src = attachment.dataUrl;
            image.alt = `Pré-visualização da imagem #${attachment.id}`;
            preview.append(image);
        } else if (attachment.status === 'carregando') {
            preview.innerHTML = '<span><span class="spinner"></span> Preparando…</span>';
        } else {
            preview.classList.add('is-error');
            preview.textContent = `Imagem indisponível. ${attachment.erro || ''}`;
        }

        const foot = document.createElement('div');
        foot.className = 'attachment-foot';
        const inText = text.includes(marker(attachment.id));
        const status = document.createElement('span');
        status.className = inText ? 'ok' : 'missing';
        status.textContent = inText ? 'Marcador no texto' : 'Sem marcador no texto';
        foot.append(status);
        if (!inText) {
            const reinsert = document.createElement('button');
            reinsert.type = 'button';
            reinsert.className = 'link-button';
            reinsert.dataset.reinsert = attachment.id;
            reinsert.disabled = busy;
            reinsert.textContent = 'Inserir no cursor';
            foot.append(reinsert);
        }

        card.append(head, preview, foot);
        return card;
    });
    attachmentsGrid.replaceChildren(...cards);
}

function render() {
    const current = stats();
    counter.textContent = `${textarea.value.length.toLocaleString('pt-BR')} caracteres · ${attachments.length}/${MAX_IMAGES} anexos`;
    detailGroup.hidden = current.imagens === 0;
    attachButton.disabled = busy || attachments.length >= MAX_IMAGES;
    submitButton.disabled = busy || current.pendentes > 0;
    clearButton.disabled = busy || current.pendentes > 0;
    renderAttachments();
}

function resultBlock(label, value) {
    const block = document.createElement('article');
    block.className = 'result-block';
    const head = document.createElement('div');
    head.className = 'result-head';
    const title = document.createElement('h3');
    title.textContent = label;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'button button-ghost button-small';
    copy.innerHTML = `${ICON_COPY}<span>Copiar</span>`;
    copy.addEventListener('click', () => copyWithFeedback(copy, value));
    head.append(title, copy);
    const text = document.createElement('p');
    text.className = 'result-text';
    text.textContent = value;
    block.append(head, text);
    return block;
}

function metric(label, value, tone) {
    const box = document.createElement('div');
    box.className = 'metric';
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.className = tone;
    strong.textContent = value;
    box.append(span, strong);
    return box;
}

function showResult(result) {
    lastResult = result;
    const metrics = document.createElement('div');
    metrics.className = 'metrics';
    const tone = result.cobrar === 'Sim' ? 'is-warning' : result.cobrar === 'Talvez' ? '' : 'is-success';
    metrics.append(metric('Classificação', result.classificacao, 'is-accent'), metric('Cobrar?', result.cobrar, tone));

    const blocks = [
        ['CRM (Resumo do Caso)', result.resumo],
        ['CRM (Continuidade)', result.continuidade],
        ['Justificativa de SLA', result.sla],
        ...(result.cobranca ? [['Texto de cobrança', result.cobranca]] : [])
    ].map(([label, value]) => resultBlock(label, value));

    const nodes = [metrics, ...blocks];
    if (result.uso) {
        const usage = document.createElement('div');
        usage.className = 'usage';
        const n = value => Number(value).toLocaleString('pt-BR');
        usage.innerHTML = `<strong></strong><br>Entrada: ${n(result.uso.entrada)} tokens · Saída: ${n(result.uso.saida)} · Total: ${n(result.uso.total)}`
            + (typeof result.uso.custoEstimadoUSD === 'number' ? `<br>Custo aproximado da API: US$ ${result.uso.custoEstimadoUSD.toFixed(5)}` : '');
        usage.querySelector('strong').textContent = `Consumo desta análise (${result.uso.modelo})`;
        nodes.push(usage);
    }
    resultContent.replaceChildren(...nodes);
    resultContent.hidden = false;
    copyAllButton.hidden = false;
}

function setView(view) {
    resultEmpty.hidden = view !== 'empty';
    resultLoading.hidden = view !== 'loading';
    resultContent.hidden = view !== 'result';
    copyAllButton.hidden = view !== 'result';
}

// ------------------------------------------------------------------ Ações

submitButton.addEventListener('click', async () => {
    const current = stats();
    if (current.falhas) return setError('Uma ou mais imagens não puderam ser carregadas. Remova os anexos com erro ou cole as imagens diretamente antes de analisar.');
    if (current.semMarcador) return setError('Há anexos sem marcador no histórico. Insira os marcadores nas posições desejadas ou remova esses anexos.');
    if (current.pendentes) return setError('Ainda há imagens sendo preparadas. Aguarde a conclusão antes de analisar.');
    const textLength = current.parts.filter(p => p.tipo === 'texto').map(p => p.texto).join('').trim().length;
    if (textLength < 20 && !current.parts.some(p => p.tipo === 'imagem')) {
        return setError('Cole o histórico (mínimo de 20 caracteres) ou uma imagem no campo Descrição ou apontamento.');
    }

    busy = true;
    setError('');
    setView('loading');
    setButtonLoading(submitButton, true, submitIdle, 'Analisando…');
    render();
    try {
        const result = await postJson('/api/analisar-dossie', {
            chamado: chamadoInput.value,
            complemento: complementoInput.value,
            partes: current.parts,
            detalheImagem: document.querySelector('input[name="detail"]:checked')?.value || 'high'
        });
        showResult(result);
        setView('result');
    } catch (error) {
        setError(error.message);
        setView(lastResult ? 'result' : 'empty');
    } finally {
        busy = false;
        setButtonLoading(submitButton, false, submitIdle);
        render();
    }
});

clearButton.addEventListener('click', () => {
    textarea.value = '';
    chamadoInput.value = '';
    complementoInput.value = '';
    attachments = [];
    cursor = { start: 0, end: 0 };
    lastResult = null;
    document.querySelector('input[name="detail"][value="high"]').checked = true;
    setError('');
    resultContent.replaceChildren();
    setView('empty');
    render();
});

copyAllButton.addEventListener('click', () => {
    if (!lastResult) return;
    const r = lastResult;
    const text = `Classificação: ${r.classificacao}\n\nCRM (Resumo do Caso)\n${r.resumo}\n\nCRM (Continuidade)\n${r.continuidade}\n\nJustificativa de SLA\n${r.sla}\n\nCobrar? ${r.cobrar}${r.cobranca ? `\n\nCobrança\n${r.cobranca}` : ''}`;
    copyWithFeedback(copyAllButton, text, 'Copiar tudo');
});

render();
