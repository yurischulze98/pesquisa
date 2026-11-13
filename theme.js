// Tema claro/escuro. Carregado no <head> para aplicar o tema antes de desenhar a página.
(function () {
    var KEY = 'tema';
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* armazenamento bloqueado */ }
    if (saved !== 'light' && saved !== 'dark') {
        saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    root.dataset.theme = saved;

    function label(button) {
        var next = root.dataset.theme === 'light' ? 'escuro' : 'claro';
        button.setAttribute('aria-label', 'Mudar para o tema ' + next);
        button.title = 'Tema ' + next;
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.theme-toggle').forEach(label);
    });
    document.addEventListener('click', function (event) {
        var button = event.target.closest && event.target.closest('.theme-toggle');
        if (!button) return;
        root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) { /* segue sem salvar */ }
        label(button);
    });
})();
