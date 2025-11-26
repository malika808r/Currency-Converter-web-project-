document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);

    // === ELEMENTS ===
    const convertBtn = $('convert');
    const amountInput = $('amount');
    const resultSpan = $('convertedAmount');
    const rateSpan = $('currentRate');
    const fromSelect = $('fromCurrency');
    const toSelect = $('toCurrency');
    const hamburger = $('hamburger');
    const mobileMenu = $('mobile-menu');
    const themeToggle = $('theme-toggle');
    const mobileThemeToggle = $('mobile-theme');
    const mobileHistoryBtn = $('mobile-history');
    const body = document.body;

    // History controls
    const historyToggle = $('conversion-history');
    const historyPanel = $('history-panel');
    const historyList = $('history-list');
    const clearHistoryBtn = $('clear-history');
    const historyEmpty = $('history-empty');

    const API_KEY = 'fca_live_cluqvwMYeGacQ0kPfQaGguC5o0LCqYwDCvXHj474';
    const API_BASE = 'https://api.freecurrencyapi.com/v1/latest';

   
    async function fetchWithTimeout(url, timeout = 9000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    
    async function getRateFromFreeCurrencyAPI(base, target) {
        if (base === target) return { rate: 1, raw: { data: { [target]: 1 } } };

        const url = `${API_BASE}?apikey=${encodeURIComponent(API_KEY)}&base_currency=${encodeURIComponent(base)}&currencies=${encodeURIComponent(target)}`;
        console.log('Fetching rate from:', url);
        const res = await fetchWithTimeout(url, 9000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log('API Response:', json);
        const rate = json?.data?.[target] ?? null;
        return { rate, raw: json };
    }

    // ----- HISTORY -----
    const HISTORY_KEY = 'conversionHistory';
    const HISTORY_MAX = 5;

    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.warn('Failed to load history', e);
            return [];
        }
    }

    function saveHistory(arr) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, HISTORY_MAX)));
        } catch (e) {
            console.warn('Failed to save history', e);
        }
    }

    function addHistoryEntry(entry) {
        const cur = loadHistory();
        
        const key = `${entry.from}-${entry.to}-${entry.amount}-${entry.result}`;
        const filtered = cur.filter(i => `${i.from}-${i.to}-${i.amount}-${i.result}` !== key);
        filtered.unshift(entry);
        saveHistory(filtered);
        renderHistory();
    }

    function clearHistory() {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    }

    function formatDate(ts) {
        const d = new Date(ts);
        return d.toLocaleString();
    }

    function renderHistory() {
        if (!historyList || !historyEmpty) return;
        const items = loadHistory();
        historyList.innerHTML = '';
        if (!items.length) {
            historyEmpty.style.display = 'block';
            return;
        }
        historyEmpty.style.display = 'none';
        items.forEach((it) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `<div><strong>${Number(it.amount).toFixed(2)} ${it.from} → ${Number(it.result).toFixed(2)} ${it.to}</strong></div>
                            <div class="history-meta">rate: ${Number(it.rate).toFixed(6)} · ${formatDate(it.ts)}</div>`;
            li.addEventListener('click', () => {
                if (fromSelect) fromSelect.value = it.from;
                if (toSelect) toSelect.value = it.to;
                if (amountInput) amountInput.value = it.amount;
                handleConvert();
                closeHistoryPanel();
                closeMobileMenu();
            });
            historyList.appendChild(li);
        });
    }

    function closeHistoryPanel() {
        if (!historyPanel || !historyToggle) return;
        historyPanel.setAttribute('aria-hidden', 'true');
        historyToggle.setAttribute('aria-expanded', 'false');
    }

    function openHistoryPanel() {
        if (!historyPanel || !historyToggle) return;
        historyPanel.setAttribute('aria-hidden', 'false');
        historyToggle.setAttribute('aria-expanded', 'true');
        renderHistory();
    }

    function toggleHistory() {
        if (!historyPanel) return;
        const open = historyPanel.getAttribute('aria-hidden') === 'false';
        if (open) closeHistoryPanel();
        else openHistoryPanel();
    }

    
    async function handleConvert() {
        if (!fromSelect || !toSelect || !amountInput || !resultSpan || !rateSpan) {
            console.error('Missing DOM elements');
            if (resultSpan) resultSpan.textContent = 'Error: missing elements';
            return;
        }

        const from = fromSelect.value;
        const to = toSelect.value;
        const amount = parseFloat(amountInput.value);

        if (!from || !to) {
            resultSpan.textContent = 'Select currencies';
            rateSpan.textContent = '-';
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            resultSpan.textContent = 'Enter valid amount';
            rateSpan.textContent = '-';
            return;
        }

        resultSpan.textContent = 'Loading...';
        rateSpan.textContent = 'Loading...';

        try {
            const { rate } = await getRateFromFreeCurrencyAPI(from, to);

            if (rate === null || isNaN(rate)) {
                throw new Error('Rate not available');
            }

            const converted = amount * Number(rate);
            resultSpan.textContent = `${Number(converted).toFixed(2)} ${to}`;
            rateSpan.textContent = `1 ${from} = ${Number(rate).toFixed(6)} ${to}`;

            addHistoryEntry({
                ts: Date.now(),
                from,
                to,
                amount: Number(amount),
                result: Number(converted),
                rate: Number(rate)
            });

        } catch (err) {
            console.error('Conversion error:', err);
            resultSpan.textContent = `Error: ${err.message || 'Failed to convert'}`;
            rateSpan.textContent = '-';
        }
    }

    // ----- HELPER FUNCTIONS -----
    function closeMobileMenu() {
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
        if (mobileMenu) mobileMenu.setAttribute('aria-hidden', 'true');
    }

    // State for mobile menu history view
    let showHistoryInMenu = false;

    // ----- BINDINGS -----
    if (convertBtn) convertBtn.addEventListener('click', handleConvert);

    if (amountInput) {
        amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleConvert();
        });
    }

    // Desktop History Toggle (кнопка в шапке)
    if (historyToggle) {
        historyToggle.addEventListener('click', () => {
            toggleHistory();
            closeMobileMenu();
        });
    }

    // Mobile History Button (в мобильном меню) - показывает историю внутри меню
    if (mobileHistoryBtn) {
        mobileHistoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showHistoryInMenu = !showHistoryInMenu;
            renderMobileMenuHistory();
        });
    }

    function renderMobileMenuHistory() {
        // Переключаем отображение истории в мобильном меню
        if (!mobileMenu) return;
        
        // Скрываем обычные пункты меню, показываем историю
        const menuItems = mobileMenu.querySelectorAll('.menu-item');
        const backBtn = mobileMenu.querySelector('.history-back-btn');
        const historyContainer = mobileMenu.querySelector('.mobile-history-container');
        
        if (showHistoryInMenu) {
            menuItems.forEach(item => item.style.display = 'none');
            if (backBtn) backBtn.style.display = 'block';
            if (historyContainer) historyContainer.style.display = 'block';
            renderMobileHistoryList();
        } else {
            menuItems.forEach(item => item.style.display = 'block');
            if (backBtn) backBtn.style.display = 'none';
            if (historyContainer) historyContainer.style.display = 'none';
        }
    }

    function renderMobileHistoryList() {
        let historyContainer = mobileMenu.querySelector('.mobile-history-container');
        if (!historyContainer) {
            // Создаём контейнер если его нет
            historyContainer = document.createElement('div');
            historyContainer.className = 'mobile-history-container';
            historyContainer.style.display = 'none';
            mobileMenu.appendChild(historyContainer);
        }

        const items = loadHistory();
        historyContainer.innerHTML = '';

        if (!items.length) {
            historyContainer.innerHTML = '<div style="text-align:center; color:#999; padding:15px;">History is empty</div>';
            return;
        }

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        ul.style.margin = '0';

        items.forEach(it => {
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
            li.style.cursor = 'pointer';
            li.style.transition = 'background 0.2s';
            li.innerHTML = `<div style="font-weight:600; font-size:13px;">${Number(it.amount).toFixed(2)} ${it.from} → ${Number(it.result).toFixed(2)} ${it.to}</div>
                            <div style="font-size:11px; color:#666; margin-top:4px;">rate: ${Number(it.rate).toFixed(6)}</div>`;
            li.addEventListener('click', () => {
                if (fromSelect) fromSelect.value = it.from;
                if (toSelect) toSelect.value = it.to;
                if (amountInput) amountInput.value = it.amount;
                handleConvert();
                closeMobileMenu();
                showHistoryInMenu = false;
            });
            li.addEventListener('mouseenter', () => li.style.background = 'rgba(41,98,255,0.05)');
            li.addEventListener('mouseleave', () => li.style.background = 'transparent');
            ul.appendChild(li);
        });

        historyContainer.appendChild(ul);
    }

    // Create back button in mobile menu if it doesn't exist
    if (mobileMenu && !mobileMenu.querySelector('.history-back-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'menu-item history-back-btn';
        backBtn.textContent = '← Back';
        backBtn.style.display = 'none';
        backBtn.addEventListener('click', () => {
            showHistoryInMenu = false;
            renderMobileMenuHistory();
        });
        mobileMenu.insertBefore(backBtn, mobileMenu.firstChild);
    }

    // Create history container in mobile menu
    if (mobileMenu && !mobileMenu.querySelector('.mobile-history-container')) {
        const historyContainer = document.createElement('div');
        historyContainer.className = 'mobile-history-container';
        historyContainer.style.display = 'none';
        historyContainer.style.maxHeight = '400px';
        historyContainer.style.overflowY = 'auto';
        mobileMenu.appendChild(historyContainer);
    }

    // Clear history button
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
    }

    // === THEME TOGGLE ===
    function toggleTheme() {
        body.classList.toggle('dark');
        const isDark = body.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const text = isDark ? ' Light mode' : ' Dark mode';
        if (themeToggle) themeToggle.textContent = text;
        if (mobileThemeToggle) mobileThemeToggle.textContent = text;
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.add('dark');
        if (themeToggle) themeToggle.textContent = ' Light mode';
        if (mobileThemeToggle) mobileThemeToggle.textContent = ' Light mode';
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', () => {
            toggleTheme();
            closeMobileMenu();
        });
    }

    // === HAMBURGER MENU ===
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
            // Закрываем историю если она открыта
            if (!isOpen) {
                closeHistoryPanel();
                showHistoryInMenu = false;
                const items = mobileMenu.querySelectorAll('.menu-item');
                items.forEach(item => item.style.display = 'block');
                const backBtn = mobileMenu.querySelector('.history-back-btn');
                if (backBtn) backBtn.style.display = 'none';
                const historyContainer = mobileMenu.querySelector('.mobile-history-container');
                if (historyContainer) historyContainer.style.display = 'none';
            }
            
            hamburger.setAttribute('aria-expanded', String(!isOpen));
            mobileMenu.setAttribute('aria-hidden', String(isOpen));
        });
    }
    
    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
        // Закрываем мобильное меню при клике вне его
        if (mobileMenu && mobileMenu.getAttribute('aria-hidden') === 'false' && 
            hamburger && !hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
            closeMobileMenu();
        }

        // Закрываем историю при клике вне её (кроме кнопки History)
        if (historyPanel && historyPanel.getAttribute('aria-hidden') === 'false' &&
            historyToggle && !historyPanel.contains(e.target) && !historyToggle.contains(e.target)) {
            closeHistoryPanel();
        }
    });

    // Initial history render
    renderHistory();

    // Load initial rate
    (async function loadInitialRate() {
        if (!fromSelect || !toSelect || !rateSpan) return;
        try {
            const f = fromSelect.value || 'USD';
            const t = toSelect.value || 'EUR';
            const { rate } = await getRateFromFreeCurrencyAPI(f, t);
            if (rate !== null && !isNaN(rate)) {
                rateSpan.textContent = `1 ${f} = ${Number(rate).toFixed(6)} ${t}`;
            }
        } catch (err) {
            console.warn('Initial rate load failed', err);
        }
    })();
});