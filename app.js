/**
 * GW2 Toolbox - Complete Application Logic
 * Features: Daily checklists, Crafting with material tracking, Trading, Todo
 */

// ===== Storage Layer =====
const Storage = {
    prefix: 'gw2_toolbox_v2_',

    get(key) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage read error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage write error:', e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }
};

// ===== State Management =====
const AppState = {
    currentPage: 'dashboard',
    currentProjectId: null,
    projects: Storage.get('projects') || [],
    trades: Storage.get('trades') || [],
    todos: Storage.get('todos') || [],
    dailyProgress: Storage.get('daily_progress') || {},
    todoFilter: 'all',
    dailyData: null,
    activityData: null,
    timerData: null,
    lastDailyFetch: 0,
    lastActivityFetch: 0,
    lastTimerFetch: 0
};

// ===== Theme Manager =====
const Theme = {
    current: Storage.get('theme') || 'auto',

    init() {
        this.apply();
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggle());
    },

    apply() {
        const html = document.documentElement;
        let theme = this.current;

        if (theme === 'auto') {
            // Follow system preference or time (6:00 - 18:00 = light)
            const hour = new Date().getHours();
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            theme = (hour >= 6 && hour < 18) ? 'light' : 'dark';
            // If system explicitly prefers dark, respect it
            if (prefersDark && hour >= 6 && hour < 18) {
                theme = 'dark';
            }
        }

        html.setAttribute('data-theme', theme);
    },

    toggle() {
        const html = document.documentElement;
        // Cycle: auto -> light -> dark -> auto
        const cycle = ['auto', 'light', 'dark'];
        const currentIndex = cycle.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % cycle.length;
        const next = cycle[nextIndex];

        this.current = next;
        html.setAttribute('data-theme', next === 'auto' ? this.getAutoTheme() : next);
        Storage.set('theme', next);

        const labels = { auto: '自动', light: '浅色', dark: '深色' };
        Toast.show(`主题: ${labels[next]}`, 'success', 1500);
    },

    getAutoTheme() {
        const hour = new Date().getHours();
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        let theme = (hour >= 6 && hour < 18) ? 'light' : 'dark';
        if (prefersDark && hour >= 6 && hour < 18) {
            theme = 'dark';
        }
        return theme;
    }
};

// ===== Utilities =====
const Utils = {
    uuid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    },

    formatNumber(num) {
        if (num === undefined || num === null) return '0';
        const n = Number(num);
        if (isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
        return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    },

    formatGold(copper) {
        if (!copper) return '0';
        const gold = Math.floor(copper / 10000);
        const silver = Math.floor((copper % 10000) / 100);
        const c = copper % 100;
        let result = '';
        if (gold > 0) result += `<span style="color:var(--warning)">${gold}</span>金 `;
        if (silver > 0 || gold > 0) result += `<span style="color:var(--text-secondary)">${silver}</span>银 `;
        result += `<span style="color:var(--danger)">${c}</span>铜`;
        return result;
    },

    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    },

    isToday(dateStr) {
        return dateStr === this.getTodayKey();
    },

    isOverdue(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
    },

    animateValue(el, from, to, duration = 600) {
        const start = performance.now();
        const diff = to - from;
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = from + diff * ease;
            if (Number.isInteger(to)) {
                el.textContent = Math.round(current);
            } else {
                el.textContent = current.toFixed(2);
            }
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    debounce(fn, ms = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }
};

// ===== Toast Notifications =====
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
    },

    show(message, type = 'success', duration = 2500) {
        if (!this.container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        toast.innerHTML = `${icon}<span>${Utils.escapeHtml(message)}</span>`;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px) scale(0.95)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }
};

// ===== API Service =====
const ApiService = {
    baseUrl: 'https://gw2.wishingstarmoye.com/gw2api',
    cacheDuration: 5 * 60 * 1000,

    async fetchDaily(force = false) {
        const now = Date.now();
        if (!force && AppState.dailyData && (now - AppState.lastDailyFetch) < this.cacheDuration) {
            return AppState.dailyData;
        }
        try {
            const response = await fetch(`${this.baseUrl}/daily`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.fractal || data.raid) {
                AppState.dailyData = data;
                AppState.lastDailyFetch = now;
                return data;
            }
            if (data.code === 200 && data.data) {
                AppState.dailyData = data.data;
                AppState.lastDailyFetch = now;
                return data.data;
            }
            throw new Error(data.msg || 'Invalid data');
        } catch (error) {
            console.error('Daily fetch error:', error);
            throw error;
        }
    },

    async fetchActivity(params = {}, force = false) {
        const now = Date.now();
        if (!force && AppState.activityData && (now - AppState.lastActivityFetch) < this.cacheDuration) {
            return AppState.activityData;
        }
        const query = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}/activity${query ? '?' + query : ''}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.activitys || data.disactivitys) {
                AppState.activityData = data;
                AppState.lastActivityFetch = now;
                return data;
            }
            if (data.code === 200 && data.data) {
                AppState.activityData = data.data;
                AppState.lastActivityFetch = now;
                return data.data;
            }
            throw new Error(data.msg || 'Invalid data');
        } catch (error) {
            console.error('Activity fetch error:', error);
            throw error;
        }
    },

    async fetchTimer() {
        const now = Date.now();
        if (AppState.timerData && (now - AppState.lastTimerFetch) < this.cacheDuration) {
            return AppState.timerData;
        }
        try {
            const response = await fetch(`${this.baseUrl}/timer`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.events) {
                AppState.timerData = data;
                AppState.lastTimerFetch = now;
                return data;
            }
            if (data.code === 200 && data.data) {
                AppState.timerData = data.data;
                AppState.lastTimerFetch = now;
                return data.data;
            }
            throw new Error(data.msg || 'Invalid data');
        } catch (error) {
            console.error('Timer fetch error:', error);
            throw error;
        }
    }
};

// ===== Navigation =====
const Navigation = {
    init() {
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                const page = el.dataset.page;
                if (page) {
                    e.preventDefault();
                    this.navigate(page);
                }
            });
        });

        window.addEventListener('popstate', () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            this.navigate(hash, false);
        });

        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('mobileDrawer').classList.add('open');
        });
        document.getElementById('closeDrawer').addEventListener('click', () => {
            document.getElementById('mobileDrawer').classList.remove('open');
        });
        document.getElementById('drawerOverlay').addEventListener('click', () => {
            document.getElementById('mobileDrawer').classList.remove('open');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('mobileDrawer').classList.remove('open');
            }
        });
    },

    async navigate(page, pushState = true) {
        if (!page) return;

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const view = document.getElementById(`${page}-view`);
        if (view) view.classList.add('active');

        document.querySelectorAll('.nav-link, .drawer-link').forEach(l => {
            l.classList.toggle('active', l.dataset.page === page);
        });

        AppState.currentPage = page;
        if (pushState) history.pushState(null, '', `#${page}`);

        document.getElementById('mobileDrawer').classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 50));
        this.loadPageData(page);
    },

    loadPageData(page) {
        switch (page) {
            case 'dashboard': Dashboard.load(); break;
            case 'daily': Daily.load(); break;
            case 'timer': break;
            case 'crafting': Crafting.load(); break;
            case 'trading': Trading.load(); break;
            case 'todo': Todo.load(); break;
        }
    }
};

// ===== Dashboard =====
const Dashboard = {
    loaded: false,
    previewType: Storage.get('daily_preview_type') || 'fractal',

    async load() {
        if (!this.loaded) {
            this.bindEvents();
            this.loaded = true;
        }
        this.updateStats();
        await this.loadDailyPreview(true);
        await this.loadActivityPreview(true);
    },

    bindEvents() {
        // Segmented control for daily preview type
        const typeControl = document.getElementById('dailyPreviewTypeControl');
        if (typeControl) {
            typeControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    typeControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.previewType = btn.dataset.value;
                    Storage.set('daily_preview_type', this.previewType);
                    this.loadDailyPreview();
                });
            });
        }

        document.querySelectorAll('.stat-card[data-page]').forEach(card => {
            card.addEventListener('click', () => {
                Navigation.navigate(card.dataset.page);
            });
        });
    },

    updateStats() {
        const projectCount = AppState.projects.length;
        const tradeCount = AppState.trades.length;
        const activeTodos = AppState.todos.filter(t => !t.completed).length;

        const elProject = document.getElementById('projectCount');
        const elTrade = document.getElementById('tradeCount');
        const elTodo = document.getElementById('todoCount');

        if (elProject) Utils.animateValue(elProject, 0, projectCount);
        if (elTrade) Utils.animateValue(elTrade, 0, tradeCount);
        if (elTodo) Utils.animateValue(elTodo, 0, activeTodos);
    },

    async loadDailyPreview(force = false) {
        const container = document.getElementById('dailyPreview');
        const dateEl = document.getElementById('dailyDate');
        const countEl = document.getElementById('dailyCount');
        const titleEl = document.getElementById('dailyPreviewTitle');

        try {
            const data = await ApiService.fetchDaily(force);
            const todayKey = Utils.getTodayKey();
            const progress = AppState.dailyProgress[todayKey] || {};

            if (dateEl) dateEl.textContent = data.date || todayKey;
            if (titleEl) titleEl.textContent = this.previewType === 'fractal' ? '碎层' : '进攻任务';

            let items = [];
            let type = '';

            if (this.previewType === 'fractal' && data.fractal) {
                items = data.fractal;
                type = 'fractal';
            } else if (this.previewType === 'raid' && data.raid) {
                items = data.raid;
                type = 'raid';
            }

            let totalItems = 0;
            let completedItems = 0;
            let html = '';

            if (items.length > 0) {
                if (type === 'fractal') {
                    const recommended = items.filter(i => i.includes('-'));
                    const daily = items.filter(i => !i.includes('-'));
                    
                    if (recommended.length > 0) {
                        html += '<div class="fractal-group">';
                        html += '<div class="fractal-group-title">推荐碎层</div>';
                        html += '<div class="daily-list">';
                        recommended.forEach(item => {
                            const key = `${type}_${item}`;
                            const isDone = progress[key];
                            if (isDone) completedItems++;
                            totalItems++;

                            const tier = item.match(/^(\d+)/)?.[1] || '';
                            const name = item.replace(/^\d+\s*-\s*/, '');
                            const tagHtml = '<span class="daily-tag recommended">推荐</span>';

                            html += `
                                <div class="daily-item ${isDone ? 'completed' : ''}" data-key="${Utils.escapeHtml(key)}">
                                    <div class="daily-check ${isDone ? 'checked' : ''}" data-key="${Utils.escapeHtml(key)}"></div>
                                    ${tier ? `<div class="daily-tier">${tier}</div>` : ''}
                                    <span class="daily-name">${Utils.escapeHtml(name)}</span>
                                    ${tagHtml}
                                </div>
                            `;
                        });
                        html += '</div></div>';
                    }

                    if (daily.length > 0) {
                        html += '<div class="fractal-group">';
                        html += '<div class="fractal-group-title">日常碎层</div>';
                        html += '<div class="daily-list">';
                        daily.forEach(item => {
                            const key = `${type}_${item}`;
                            const isDone = progress[key];
                            if (isDone) completedItems++;
                            totalItems++;

                            const tier = item.match(/^(\d+)/)?.[1] || '';
                            const name = item.replace(/^\d+\s*-\s*/, '');
                            const tagHtml = '<span class="daily-tag daily">日常</span>';

                            html += `
                                <div class="daily-item ${isDone ? 'completed' : ''}" data-key="${Utils.escapeHtml(key)}">
                                    <div class="daily-check ${isDone ? 'checked' : ''}" data-key="${Utils.escapeHtml(key)}"></div>
                                    ${tier ? `<div class="daily-tier">${tier}</div>` : ''}
                                    <span class="daily-name">${Utils.escapeHtml(name)}</span>
                                    ${tagHtml}
                                </div>
                            `;
                        });
                        html += '</div></div>';
                    }
                } else {
                    // For raid
                    html += '<div class="daily-list">';
                    items.forEach(item => {
                        const key = `${type}_${item}`;
                        const isDone = progress[key];
                        if (isDone) completedItems++;
                        totalItems++;

                        html += `
                            <div class="strike-item ${isDone ? 'completed' : ''}" data-key="${Utils.escapeHtml(key)}">
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <div class="daily-check ${isDone ? 'checked' : ''}" data-key="${Utils.escapeHtml(key)}"></div>
                                    <span class="strike-name">${Utils.escapeHtml(item)}</span>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
            } else {
                html = '<div class="empty-small">暂无数据</div>';
            }

            if (container) container.innerHTML = html;
            if (countEl) {
                const display = totalItems > 0 ? `${completedItems}/${totalItems}` : '--';
                countEl.textContent = display;
            }
            const dashboardCount = document.getElementById('dailyCount');
            if (dashboardCount) dashboardCount.textContent = totalItems > 0 ? `${completedItems}/${totalItems}` : '--';

            this.bindPreviewChecks();
        } catch (error) {
            if (container) container.innerHTML = '<div class="empty-small">加载失败，请稍后重试</div>';
            if (countEl) countEl.textContent = '--';
        }
    },

    bindPreviewChecks() {
        document.querySelectorAll('#dailyPreview .daily-check').forEach(check => {
            check.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = check.dataset.key;
                const todayKey = Utils.getTodayKey();

                if (!AppState.dailyProgress[todayKey]) {
                    AppState.dailyProgress[todayKey] = {};
                }

                if (AppState.dailyProgress[todayKey][key]) {
                    delete AppState.dailyProgress[todayKey][key];
                } else {
                    AppState.dailyProgress[todayKey][key] = true;
                }

                Storage.set('daily_progress', AppState.dailyProgress);

                const item = check.closest('.daily-item');
                if (item) {
                    item.classList.toggle('completed');
                    check.classList.toggle('checked');
                }

                this.loadDailyPreview();
                if (AppState.currentPage === 'daily') {
                    Daily.render();
                }
            });
        });
    },



    async loadActivityPreview(force = false) {
        const container = document.getElementById('activityPreview');
        const badge = document.getElementById('activityPreviewBadge');
        if (!container) return;

        try {
            const data = await ApiService.fetchActivity({}, force);
            const activities = data.activitys || [];
            const disactivities = data.disactivitys || [];
            const now = new Date();

            if (activities.length === 0 && disactivities.length === 0) {
                container.innerHTML = '<div class="empty-small">暂无活动数据</div>';
                if (badge) badge.textContent = '0个';
                return;
            }

            const allActivities = [...activities, ...disactivities];
            if (badge) badge.textContent = `${allActivities.length}个活动`;

            let html = '<div class="activity-scroll-container"><div class="activity-list">';

            allActivities.forEach(activity => {
                const start = new Date(activity.starttime);
                const end = new Date(activity.endtime);
                const isActive = now >= start && now <= end;
                const statusClass = isActive ? '进行中' : '已结束';
                const statusColor = isActive ? 'green' : '';

                const url = activity.url || '#';
                html += `
                    <a href="${url}" target="_blank" rel="noopener" class="activity-item" style="text-decoration:none;display:block;">
                        <div class="activity-title">${Utils.escapeHtml(activity.title)}</div>
                        <div class="activity-meta">
                            <span class="activity-date">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ${activity.public_date}
                            </span>
                            <span class="activity-status ${statusColor}">${statusClass}</span>
                        </div>
                    </a>
                `;
            });

            html += '</div></div>';
            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = '<div class="empty-small">加载失败</div>';
            if (badge) badge.textContent = '--';
        }
    }
};

// ===== Daily (with checkboxes) =====
const Daily = {
    loaded: false,

    load() {
        if (this.loaded) return;
        this.loaded = true;
        this.render();
    },

    async render() {
        const fractalContainer = document.getElementById('fractalContainer');
        const strikeContainer = document.getElementById('strikeContainer');
        const activityContainer = document.getElementById('activityContainer');
        const fractalBadge = document.getElementById('fractalBadge');
        const strikeBadge = document.getElementById('strikeBadge');

        try {
            const [dailyData, activityData] = await Promise.all([
                ApiService.fetchDaily(),
                ApiService.fetchActivity()
            ]);

            const todayKey = Utils.getTodayKey();
            const progress = AppState.dailyProgress[todayKey] || {};

            // Render Fractals
            if (dailyData.fractal && dailyData.fractal.length > 0) {
                const recommended = dailyData.fractal.filter(f => f.includes('-'));
                const dailies = dailyData.fractal.filter(f => !f.includes('-'));

                let html = '';

                if (recommended.length > 0) {
                    html += '<div class="fractal-group">';
                    html += '<div class="fractal-group-title">推荐碎层</div>';
                    html += '<div class="daily-list">';
                    recommended.forEach(item => {
                        html += this.renderDailyItem('fractal', item, progress);
                    });
                    html += '</div></div>';
                }

                if (dailies.length > 0) {
                    html += '<div class="fractal-group">';
                    html += '<div class="fractal-group-title">日常碎层</div>';
                    html += '<div class="daily-list">';
                    dailies.forEach(item => {
                        html += this.renderDailyItem('fractal', item, progress);
                    });
                    html += '</div></div>';
                }

                if (fractalContainer) fractalContainer.innerHTML = html;
                if (fractalBadge) fractalBadge.textContent = `${dailyData.fractal.length}个`;
            } else {
                if (fractalContainer) fractalContainer.innerHTML = '<div class="empty-small">暂无碎层数据</div>';
            }

            // Render Raids
            if (dailyData.raid && dailyData.raid.length > 0) {
                let html = '<div class="daily-list">';
                dailyData.raid.forEach(item => {
                    html += this.renderStrikeItem(item, progress);
                });
                html += '</div>';
                if (strikeContainer) strikeContainer.innerHTML = html;
                if (strikeBadge) strikeBadge.textContent = `${dailyData.raid.length}个`;
            } else {
                if (strikeContainer) strikeContainer.innerHTML = '<div class="empty-small">暂无进攻任务数据</div>';
            }

            // Render Activities
            this.renderActivities(activityData, activityContainer);

            // Bind check events
            this.bindCheckEvents();

        } catch (error) {
            if (fractalContainer) fractalContainer.innerHTML = '<div class="empty-small">加载失败</div>';
            if (strikeContainer) strikeContainer.innerHTML = '<div class="empty-small">加载失败</div>';
            if (activityContainer) activityContainer.innerHTML = '<div class="empty-small">加载失败</div>';
        }
    },

    renderDailyItem(type, item, progress) {
        const key = `${type}_${item}`;
        const isDone = progress[key];
        const tier = item.match(/^(\d+)/)?.[1] || '';
        const name = item.replace(/^\d+\s*-\s*/, '');
        const tierClass = tier ? '' : 'daily';
        const checkClass = isDone ? 'checked' : '';
        const itemClass = isDone ? 'completed' : '';

        return `
            <div class="daily-item ${itemClass}" data-key="${Utils.escapeHtml(key)}">
                <div class="daily-check ${checkClass}" data-key="${Utils.escapeHtml(key)}"></div>
                ${tier ? `<div class="daily-tier ${tierClass}">${tier}</div>` : ''}
                <span class="daily-name">${Utils.escapeHtml(name)}</span>
            </div>
        `;
    },

    renderStrikeItem(item, progress) {
        const key = `raid_${item}`;
        const isDone = progress[key];
        const checkClass = isDone ? 'checked' : '';
        const itemClass = isDone ? 'completed' : '';

        return `
            <div class="strike-item ${itemClass}" data-key="${Utils.escapeHtml(key)}">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="daily-check ${checkClass}" data-key="${Utils.escapeHtml(key)}"></div>
                    <span class="strike-name">${Utils.escapeHtml(item)}</span>
                </div>
            </div>
        `;
    },

    renderActivities(data, container) {
        if (!container) return;
        const activities = data.activitys || [];
        const disactivities = data.disactivitys || [];
        const now = new Date();

        let html = '<div class="activity-list">';

        if (activities.length === 0 && disactivities.length === 0) {
            container.innerHTML = '<div class="empty-small">暂无活动数据</div>';
            return;
        }

        [...activities, ...disactivities].forEach(activity => {
            const start = new Date(activity.starttime);
            const end = new Date(activity.endtime);
            const isActive = now >= start && now <= end;
            const statusClass = isActive ? '进行中' : '已结束';
            const statusColor = isActive ? 'green' : '';

            html += `
                <div class="activity-item">
                    <div class="activity-title">${Utils.escapeHtml(activity.title)}</div>
                    <div class="activity-meta">
                        <span class="activity-date">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            ${activity.public_date}
                        </span>
                        <span class="activity-status ${statusColor}">${statusClass}</span>
                        ${activity.url ? `<a href="${activity.url}" target="_blank" rel="noopener" class="activity-link">查看详情</a>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    bindCheckEvents() {
        document.querySelectorAll('.daily-check').forEach(check => {
            check.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = check.dataset.key;
                const todayKey = Utils.getTodayKey();

                if (!AppState.dailyProgress[todayKey]) {
                    AppState.dailyProgress[todayKey] = {};
                }

                if (AppState.dailyProgress[todayKey][key]) {
                    delete AppState.dailyProgress[todayKey][key];
                } else {
                    AppState.dailyProgress[todayKey][key] = true;
                }

                Storage.set('daily_progress', AppState.dailyProgress);

                // Update UI
                const item = check.closest('.daily-item, .strike-item');
                if (item) {
                    item.classList.toggle('completed');
                    check.classList.toggle('checked');
                }

                // Update dashboard stats
                Dashboard.updateStats();
                Dashboard.loadDailyPreview();
            });
        });
    }
};

// ===== Crafting (with inventory tracking) =====
const Crafting = {
    loaded: false,

    load() {
        if (this.loaded) return;
        this.loaded = true;
        this.renderProjectList();
        if (AppState.currentProjectId) {
            this.renderProjectDetail(AppState.currentProjectId);
        }

        document.getElementById('addProjectBtn').addEventListener('click', () => {
            this.createProject();
        });
    },

    createProject() {
        const project = {
            id: Utils.uuid(),
            name: '新项目 ' + (AppState.projects.length + 1),
            materials: [],
            createdAt: Date.now()
        };
        AppState.projects.push(project);
        Storage.set('projects', AppState.projects);
        this.renderProjectList();
        this.selectProject(project.id);
        Toast.show('项目已创建');
    },

    deleteProject(id, event) {
        if (event) event.stopPropagation();
        if (!confirm('确定要删除这个项目吗？')) return;
        AppState.projects = AppState.projects.filter(p => p.id !== id);
        Storage.set('projects', AppState.projects);
        if (AppState.currentProjectId === id) {
            AppState.currentProjectId = null;
            document.getElementById('projectDetailPanel').style.display = 'none';
            document.getElementById('projectEmptyPanel').style.display = 'block';
        }
        this.renderProjectList();
        Toast.show('项目已删除');
    },

    selectProject(id) {
        AppState.currentProjectId = id;
        this.renderProjectList();
        this.renderProjectDetail(id);
        document.getElementById('projectDetailPanel').style.display = 'block';
        document.getElementById('projectEmptyPanel').style.display = 'none';
    },

    renderProjectList() {
        const container = document.getElementById('projectList');
        if (!container) return;

        if (AppState.projects.length === 0) {
            container.innerHTML = '<div class="empty-small">暂无项目</div>';
            return;
        }

        container.innerHTML = AppState.projects.map(project => {
            const materialCount = project.materials?.length || 0;
            const completedCount = project.materials?.filter(m => m.owned >= m.needed).length || 0;
            const isActive = project.id === AppState.currentProjectId;
            return `
                <div class="project-item ${isActive ? 'active' : ''}" data-id="${project.id}">
                    <div class="project-info">
                        <div class="project-item-name">${Utils.escapeHtml(project.name)}</div>
                        <div class="project-item-meta">${completedCount}/${materialCount} 材料已备齐</div>
                    </div>
                    <button class="project-delete" data-id="${project.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => this.selectProject(item.dataset.id));
        });
        container.querySelectorAll('.project-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteProject(btn.dataset.id, e));
        });
    },

    renderProjectDetail(projectId) {
        const project = AppState.projects.find(p => p.id === projectId);
        if (!project) return;

        const container = document.getElementById('projectDetail');
        if (!container) return;

        const materials = project.materials || [];
        const totalCost = materials.reduce((sum, m) => sum + (m.price || 0) * Math.max(0, (m.needed || 0) - (m.owned || 0)), 0);
        const totalNeeded = materials.reduce((sum, m) => sum + (m.needed || 0), 0);
        const totalOwned = materials.reduce((sum, m) => sum + Math.min(m.owned || 0, m.needed || 0), 0);
        const progress = totalNeeded > 0 ? Math.round((totalOwned / totalNeeded) * 100) : 0;

        let html = `
            <div class="project-detail-header">
                <input type="text" class="project-detail-name" value="${Utils.escapeHtml(project.name)}" data-id="${project.id}">
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-secondary" id="addMaterialBtn">+ 添加材料</button>
                    <button class="btn btn-sm btn-danger" id="deleteProjectBtn">删除项目</button>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:12px;color:var(--text-muted);">制作进度</span>
                    <span style="font-size:12px;color:var(--primary);font-weight:600;">${progress}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${progress >= 100 ? 'success' : ''}" style="width:${progress}%"></div>
                </div>
            </div>
        `;

        if (materials.length > 0) {
            html += `
                <div class="material-table-wrapper">
                    <table class="material-table">
                        <thead>
                            <tr>
                                <th>材料</th>
                                <th>需要</th>
                                <th>已有</th>
                                <th>缺少</th>
                                <th>单价</th>
                                <th>成本</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            materials.forEach((material, index) => {
                const missing = Math.max(0, (material.needed || 0) - (material.owned || 0));
                const cost = missing * (material.price || 0);
                const isComplete = missing === 0;

                html += `
                    <tr class="${isComplete ? 'complete' : ''}" data-index="${index}">
                        <td>${Utils.escapeHtml(material.name)}</td>
                        <td>${material.needed || 0}</td>
                        <td>
                            <input type="number" class="form-input" style="width:70px;padding:6px 8px;font-size:12px;"
                                value="${material.owned || 0}" min="0" data-index="${index}" data-field="owned">
                        </td>
                        <td class="missing">${missing}</td>
                        <td>${Utils.formatNumber(material.price || 0)}</td>
                        <td>${Utils.formatNumber(cost)}</td>
                        <td>
                            <div class="material-actions">
                                <button class="btn-icon" data-index="${index}" data-action="edit" title="编辑">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="btn-icon" data-index="${index}" data-action="delete" title="删除">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>

                <div class="cost-summary">
                    <div class="cost-box">
                        <div class="cost-box-label">总材料数</div>
                        <div class="cost-box-value">${materials.length}</div>
                    </div>
                    <div class="cost-box">
                        <div class="cost-box-label">已备齐</div>
                        <div class="cost-box-value" style="color:var(--success);">${materials.filter(m => (m.owned || 0) >= (m.needed || 0)).length}</div>
                    </div>
                    <div class="cost-box">
                        <div class="cost-box-label">待补齐</div>
                        <div class="cost-box-value" style="color:var(--danger);">${materials.filter(m => (m.owned || 0) < (m.needed || 0)).length}</div>
                    </div>
                    <div class="cost-box highlight">
                        <div class="cost-box-label">预估总成本</div>
                        <div class="cost-box-value">${Utils.formatNumber(totalCost)}</div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="empty-state">
                    <svg class="empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <p>点击"添加材料"开始追踪</p>
                </div>
            `;
        }

        container.innerHTML = html;

        // Bind events
        const nameInput = container.querySelector('.project-detail-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                const p = AppState.projects.find(pr => pr.id === projectId);
                if (p) {
                    p.name = nameInput.value;
                    Storage.set('projects', AppState.projects);
                    this.renderProjectList();
                    Toast.show('项目名称已更新');
                }
            });
        }

        container.querySelectorAll('[data-field="owned"]').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.index);
                const p = AppState.projects.find(pr => pr.id === projectId);
                if (p && p.materials[idx]) {
                    p.materials[idx].owned = parseInt(input.value) || 0;
                    Storage.set('projects', AppState.projects);
                    this.renderProjectDetail(projectId);
                    this.renderProjectList();
                    Toast.show('材料数量已更新');
                }
            });
        });

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                const action = btn.dataset.action;
                if (action === 'delete') {
                    this.deleteMaterial(projectId, idx);
                }
            });
        });

        document.getElementById('addMaterialBtn')?.addEventListener('click', () => {
            this.showMaterialForm(projectId);
        });

        document.getElementById('deleteProjectBtn')?.addEventListener('click', () => {
            this.deleteProject(projectId);
        });
    },

    showMaterialForm(projectId) {
        const container = document.getElementById('projectDetail');
        if (!container) return;

        const existingForm = container.querySelector('.material-form-container');
        if (existingForm) {
            existingForm.remove();
            return;
        }

        const form = document.createElement('div');
        form.className = 'material-form-container';
        form.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:20px;';
        form.innerHTML = `
            <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text);">添加材料</div>
            <div class="material-form" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:10px;align-items:end;">
                <div>
                    <label class="form-label">材料名称</label>
                    <input type="text" class="form-input" id="matName" placeholder="例如：星陨锭">
                </div>
                <div>
                    <label class="form-label">需要数量</label>
                    <input type="number" class="form-input" id="matNeeded" placeholder="0" min="1">
                </div>
                <div>
                    <label class="form-label">已有数量</label>
                    <input type="number" class="form-input" id="matOwned" placeholder="0" min="0">
                </div>
                <div>
                    <label class="form-label">单价</label>
                    <input type="number" class="form-input" id="matPrice" placeholder="0" step="0.01">
                </div>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-primary" id="confirmAddMaterial">添加</button>
                    <button class="btn btn-sm btn-ghost" id="cancelAddMaterial">取消</button>
                </div>
            </div>
        `;

        container.insertBefore(form, container.children[2]);

        document.getElementById('confirmAddMaterial').addEventListener('click', () => {
            const name = document.getElementById('matName').value.trim();
            const needed = parseInt(document.getElementById('matNeeded').value) || 0;
            const owned = parseInt(document.getElementById('matOwned').value) || 0;
            const price = parseFloat(document.getElementById('matPrice').value) || 0;

            if (!name) {
                Toast.show('请输入材料名称', 'error');
                return;
            }
            if (needed <= 0) {
                Toast.show('需要数量必须大于0', 'error');
                return;
            }

            const project = AppState.projects.find(p => p.id === projectId);
            if (project) {
                if (!project.materials) project.materials = [];
                project.materials.push({ name, needed, owned, price });
                Storage.set('projects', AppState.projects);
                this.renderProjectDetail(projectId);
                this.renderProjectList();
                Toast.show('材料已添加');
            }
        });

        document.getElementById('cancelAddMaterial').addEventListener('click', () => {
            form.remove();
        });

        document.getElementById('matName').focus();
    },

    deleteMaterial(projectId, index) {
        const project = AppState.projects.find(p => p.id === projectId);
        if (!project || !project.materials) return;
        project.materials.splice(index, 1);
        Storage.set('projects', AppState.projects);
        this.renderProjectDetail(projectId);
        this.renderProjectList();
        Toast.show('材料已删除');
    }
};

// ===== Trading =====
const Trading = {
    loaded: false,
    currentResult: null,
    selectedTrades: new Set(),

    load() {
        this.renderHistory();
        this.calculate();
        if (!this.loaded) {
            this.loaded = true;
            document.getElementById('saveTradeBtn').addEventListener('click', () => this.saveTrade());
            document.getElementById('clearTradesBtn').addEventListener('click', () => {
                if (!confirm('确定要清空所有交易记录吗？')) return;
                AppState.trades = [];
                this.selectedTrades.clear();
                Storage.set('trades', AppState.trades);
                this.renderHistory();
                Toast.show('交易记录已清空');
            });
            document.getElementById('deleteSelectedTradesBtn').addEventListener('click', () => {
                if (!confirm(`确定要删除选中的 ${this.selectedTrades.size} 条记录吗？`)) return;
                AppState.trades = AppState.trades.filter(t => !this.selectedTrades.has(t.id));
                this.selectedTrades.clear();
                Storage.set('trades', AppState.trades);
                this.renderHistory();
                Toast.show('选中记录已删除');
            });

            // Auto-calculate on input
            ['tradeName', 'tradeQuantity', 'tradeFee', 'tradeSellPrice', 'tradeBuyPrice'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', Utils.debounce(() => this.calculate(), 200));
            });
        }
    },

    calculate() {
        const name = document.getElementById('tradeName').value.trim() || '未命名';
        const buyPrice = parseFloat(document.getElementById('tradeBuyPrice').value) || 0;
        const quantity = parseInt(document.getElementById('tradeQuantity').value) || 1;
        const fee = parseFloat(document.getElementById('tradeFee').value) || 15;
        const sellPrice = parseFloat(document.getElementById('tradeSellPrice').value) || 0;

        const totalCost = buyPrice * quantity;
        const totalRevenue = sellPrice * quantity;
        const feeAmount = totalRevenue * (fee / 100);
        const netProfit = totalRevenue - feeAmount - totalCost;
        const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
        const unitProfit = sellPrice > 0 ? sellPrice - buyPrice - (sellPrice * fee / 100) : 0;

        this.currentResult = {
            name, buyPrice, quantity, fee, sellPrice,
            totalCost, totalRevenue, feeAmount, netProfit, profitPercent, unitProfit
        };

        const isProfit = netProfit >= 0;
        const highlightClass = isProfit ? 'highlight' : 'highlight negative';

        const html = `
            <div class="result-row">
                <div class="result-cell">
                    <span class="result-label">总成本</span>
                    <span class="result-value">${Utils.formatNumber(totalCost)}</span>
                </div>
                <div class="result-cell">
                    <span class="result-label">总收入</span>
                    <span class="result-value">${Utils.formatNumber(totalRevenue)}</span>
                </div>
            </div>
            <div class="result-row">
                <div class="result-cell">
                    <span class="result-label">手续费</span>
                    <span class="result-value">${Utils.formatNumber(feeAmount)} (${fee}%)</span>
                </div>
                <div class="result-cell">
                    <span class="result-label">单件利润</span>
                    <span class="result-value ${unitProfit >= 0 ? 'profit' : 'loss'}">${unitProfit >= 0 ? '+' : ''}${Utils.formatNumber(unitProfit)}</span>
                </div>
            </div>
            <div class="result-divider"></div>
            <div class="result-row ${highlightClass}">
                <div class="result-cell">
                    <span class="result-label">净利润</span>
                    <span class="result-value ${netProfit >= 0 ? 'profit' : 'loss'}">${netProfit >= 0 ? '+' : ''}${Utils.formatNumber(netProfit)}</span>
                </div>
                <div class="result-cell">
                    <span class="result-label">利润率</span>
                    <span class="result-value ${profitPercent >= 0 ? 'profit' : 'loss'}">${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%</span>
                </div>
            </div>
        `;

        document.getElementById('tradeResult').innerHTML = html;
    },

    saveTrade() {
        if (!this.currentResult) {
            Toast.show('请填写交易数据', 'error');
            return;
        }
        const trade = {
            id: Utils.uuid(),
            ...this.currentResult,
            createdAt: Date.now()
        };
        AppState.trades.unshift(trade);
        Storage.set('trades', AppState.trades);
        this.renderHistory();
        Toast.show('交易记录已保存');
    },

    toggleSelection(id) {
        if (this.selectedTrades.has(id)) {
            this.selectedTrades.delete(id);
        } else {
            this.selectedTrades.add(id);
        }
        this.renderHistory();
    },

    renderHistory() {
        const container = document.getElementById('tradeHistory');
        const deleteBtn = document.getElementById('deleteSelectedTradesBtn');
        if (!container) return;

        if (deleteBtn) {
            deleteBtn.style.display = this.selectedTrades.size > 0 ? 'inline-flex' : 'none';
        }

        const countBadge = document.getElementById('tradeCount');
        if (countBadge) {
            countBadge.textContent = AppState.trades.length;
        }

        if (AppState.trades.length === 0) {
            container.innerHTML = '<div class="empty-small">暂无交易记录</div>';
            return;
        }

        container.innerHTML = AppState.trades.map(trade => {
            const isSelected = this.selectedTrades.has(trade.id);
            const isProfit = trade.netProfit >= 0;
            return `
                <div class="trade-item ${isSelected ? 'selected' : ''}" data-id="${trade.id}">
                    <div class="trade-check" data-id="${trade.id}">
                        <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <div class="trade-main">
                        <div class="trade-name">${Utils.escapeHtml(trade.name)}</div>
                        <div class="trade-details">
                            <span class="trade-detail">${trade.quantity}个</span>
                            <span class="trade-separator">|</span>
                            <span class="trade-detail">买入 ${Utils.formatNumber(trade.totalCost)}</span>
                            <span class="trade-separator">|</span>
                            <span class="trade-detail">卖出 ${Utils.formatNumber(trade.totalRevenue)}</span>
                            <span class="trade-separator">|</span>
                            <span class="trade-detail profit-value ${isProfit ? 'profit' : 'loss'}">
                                利润 ${isProfit ? '+' : ''}${Utils.formatNumber(trade.netProfit)} (${isProfit ? '+' : ''}${trade.profitPercent.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events
        container.querySelectorAll('.trade-check').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(el.dataset.id);
            });
        });
        container.querySelectorAll('.trade-item').forEach(el => {
            el.addEventListener('click', () => {
                this.toggleSelection(el.dataset.id);
            });
        });
    }
};

// ===== Todo =====
const Todo = {
    loaded: false,

    load() {
        if (this.loaded) return;
        this.loaded = true;
        this.render();

        document.getElementById('addTodoBtn').addEventListener('click', () => this.add());
        document.getElementById('todoText').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.add();
        });

        // Due date toggle
        const noDueToggle = document.getElementById('todoNoDueDate');
        const dueDateInput = document.getElementById('todoDueDate');
        if (noDueToggle && dueDateInput) {
            dueDateInput.disabled = noDueToggle.checked;
            noDueToggle.addEventListener('change', () => {
                dueDateInput.disabled = noDueToggle.checked;
                if (!noDueToggle.checked) dueDateInput.focus();
            });
        }

        // Edit modal cancel
        document.getElementById('cancelEditTodo')?.addEventListener('click', () => {
            document.getElementById('editTodoModal').style.display = 'none';
        });
        document.getElementById('closeEditTodoModal')?.addEventListener('click', () => {
            document.getElementById('editTodoModal').style.display = 'none';
        });

        // Edit modal due date toggle
        const editNoDueToggle = document.getElementById('editTodoNoDueDate');
        const editDueDateInput = document.getElementById('editTodoDueDate');
        if (editNoDueToggle && editDueDateInput) {
            editDueDateInput.disabled = editNoDueToggle.checked;
            editNoDueToggle.addEventListener('change', () => {
                editDueDateInput.disabled = editNoDueToggle.checked;
                if (!editNoDueToggle.checked) editDueDateInput.focus();
            });
        }

        // Edit modal reminder toggle
        const editReminderToggle = document.getElementById('editTodoReminderToggle');
        const editReminderLabel = document.getElementById('editTodoReminderLabel');
        const editReminderCycleControl = document.getElementById('editTodoReminderCycleControl');
        if (editReminderToggle) {
            editReminderToggle.addEventListener('change', () => {
                const on = editReminderToggle.checked;
                if (editReminderLabel) editReminderLabel.textContent = on ? '开启' : '关闭';
                if (editReminderCycleControl) editReminderCycleControl.style.display = on ? 'flex' : 'none';
            });
        }

        // Edit modal reminder cycle segmented control
        if (editReminderCycleControl) {
            editReminderCycleControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    editReminderCycleControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }

        // Bind segmented controls
        ['todoCategoryControl', 'todoPriorityControl'].forEach(id => {
            const control = document.getElementById(id);
            if (control) {
                control.querySelectorAll('.segment-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        control.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });
            }
        });

        // Bind reminder toggle
        const reminderToggle = document.getElementById('todoReminderToggle');
        const reminderLabel = document.getElementById('todoReminderLabel');
        const reminderCycleControl = document.getElementById('todoReminderCycleControl');
        if (reminderToggle) {
            reminderToggle.addEventListener('change', () => {
                const on = reminderToggle.checked;
                reminderLabel.textContent = on ? '开启' : '关闭';
                if (reminderCycleControl) {
                    reminderCycleControl.style.display = on ? 'flex' : 'none';
                }
            });
        }

        // Bind reminder cycle segmented control
        if (reminderCycleControl) {
            reminderCycleControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    reminderCycleControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.todoFilter = tab.dataset.filter;
                this.render();
            });
        });

        // Check reminders on load
        Reminder.check();
    },

    add() {
        const text = document.getElementById('todoText').value.trim();
        if (!text) {
            Toast.show('请输入任务内容', 'error');
            return;
        }

        const category = Auth.getSegmentValue('todoCategoryControl') || 'general';
        const priority = Auth.getSegmentValue('todoPriorityControl') || 'medium';
        const dueDate = document.getElementById('todoDueDate').value;
        const reminderEnabled = document.getElementById('todoReminderToggle')?.checked || false;
        const reminderCycle = Auth.getSegmentValue('todoReminderCycleControl') || 'daily';

        const todo = {
            id: Utils.uuid(),
            text,
            category,
            priority,
            dueDate,
            completed: false,
            reminder: reminderEnabled ? {
                enabled: true,
                cycle: reminderCycle,
                lastReminded: null
            } : null,
            createdAt: Date.now()
        };

        AppState.todos.unshift(todo);
        Storage.set('todos', AppState.todos);

        document.getElementById('todoText').value = '';
        document.getElementById('todoDueDate').value = '';
        document.getElementById('todoReminderToggle').checked = false;
        document.getElementById('todoReminderLabel').textContent = '关闭';
        const reminderCycleControl = document.getElementById('todoReminderCycleControl');
        if (reminderCycleControl) {
            reminderCycleControl.style.display = 'none';
            reminderCycleControl.querySelectorAll('.segment-btn').forEach((b, i) => {
                b.classList.toggle('active', i === 0);
            });
        }

        this.render();
        Dashboard.updateStats();
        Reminder.updateBadges();
        Toast.show('任务已添加');
    },

    toggle(id) {
        const todo = AppState.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            Storage.set('todos', AppState.todos);
            this.render();
            Dashboard.updateStats();
        }
    },

    delete(id) {
        AppState.todos = AppState.todos.filter(t => t.id !== id);
        Storage.set('todos', AppState.todos);
        this.render();
        Dashboard.updateStats();
        Toast.show('任务已删除');
    },

    render() {
        const container = document.getElementById('todoList');
        if (!container) return;

        let filtered = AppState.todos;
        if (AppState.todoFilter === 'active') filtered = filtered.filter(t => !t.completed);
        if (AppState.todoFilter === 'completed') filtered = filtered.filter(t => t.completed);

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-small">暂无任务</div>';
            return;
        }

        container.innerHTML = filtered.map(todo => {
            const categoryLabels = {
                general: '通用', crafting: '制作', trading: '交易',
                raid: '进攻任务', fractal: '碎层', daily: '日常'
            };
            const priorityLabels = { low: '低', medium: '中', high: '高' };
            const isOverdue = !todo.completed && Utils.isOverdue(todo.dueDate);
            const reminderIcon = todo.reminder?.enabled
                ? `<span class="todo-reminder-icon" title="提醒: ${todo.reminder.cycle === 'daily' ? '每日' : todo.reminder.cycle === 'weekly' ? '每周' : '每' + todo.reminder.cycle.replace('days', '') + '天'}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                   </span>`
                : '';

            return `
                <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                    <div class="todo-check ${todo.completed ? 'checked' : ''}" data-id="${todo.id}"></div>
                    <div class="todo-content">
                        <div class="todo-text">${Utils.escapeHtml(todo.text)} ${reminderIcon}</div>
                        <div class="todo-meta">
                            <span class="todo-tag ${todo.priority}">${priorityLabels[todo.priority]}</span>
                            <span class="todo-tag cat">${categoryLabels[todo.category]}</span>
                            ${todo.dueDate ? `<span class="${isOverdue ? 'overdue' : ''}">${isOverdue ? '已逾期 ' : ''}${Utils.formatDate(todo.dueDate)}</span>` : ''}
                        </div>
                    </div>
                    <div class="todo-actions">
                        <button class="todo-edit" data-id="${todo.id}" title="编辑">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="todo-delete" data-id="${todo.id}" title="删除">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.todo-check').forEach(check => {
            check.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(check.dataset.id);
            });
        });

        container.querySelectorAll('.todo-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.delete(btn.dataset.id);
            });
        });

        container.querySelectorAll('.todo-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditModal(btn.dataset.id);
            });
        });
    },

    openEditModal(id) {
        const todo = AppState.todos.find(t => t.id === id);
        if (!todo) return;

        document.getElementById('editTodoText').value = todo.text;
        document.getElementById('editTodoDueDate').value = todo.dueDate || '';
        document.getElementById('editTodoNoDueDate').checked = !todo.dueDate;

        // Set category
        const categoryControl = document.getElementById('editTodoCategoryControl');
        if (categoryControl) {
            categoryControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === todo.category);
            });
        }

        // Set priority
        const priorityControl = document.getElementById('editTodoPriorityControl');
        if (priorityControl) {
            priorityControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === todo.priority);
            });
        }

        // Set reminder
        const reminderToggle = document.getElementById('editTodoReminderToggle');
        const reminderLabel = document.getElementById('editTodoReminderLabel');
        const reminderCycleControl = document.getElementById('editTodoReminderCycleControl');

        if (reminderToggle) {
            reminderToggle.checked = todo.reminder?.enabled || false;
            if (reminderLabel) reminderLabel.textContent = reminderToggle.checked ? '开启' : '关闭';
            if (reminderCycleControl) {
                reminderCycleControl.style.display = reminderToggle.checked ? 'flex' : 'none';
                if (todo.reminder?.cycle) {
                    reminderCycleControl.querySelectorAll('.segment-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.value === todo.reminder.cycle);
                    });
                }
            }
        }

        document.getElementById('editTodoModal').style.display = 'flex';

        // Save handler
        const saveBtn = document.getElementById('saveEditTodo');
        const saveHandler = () => {
            todo.text = document.getElementById('editTodoText').value.trim();
            todo.category = Auth.getSegmentValue('editTodoCategoryControl') || todo.category;
            todo.priority = Auth.getSegmentValue('editTodoPriorityControl') || todo.priority;
            todo.dueDate = document.getElementById('editTodoNoDueDate').checked ? '' : document.getElementById('editTodoDueDate').value;

            // Reset due date notification if date changed
            if (todo.dueDate) {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(23, 59, 59, 999);
                if (new Date() < dueDate) {
                    todo.dueDateNotified = false;
                }
            } else {
                todo.dueDateNotified = false;
            }

            const reminderEnabled = document.getElementById('editTodoReminderToggle')?.checked || false;
            const reminderCycle = Auth.getSegmentValue('editTodoReminderCycleControl') || 'daily';
            todo.reminder = reminderEnabled ? {
                enabled: true,
                cycle: reminderCycle,
                lastReminded: todo.reminder?.lastReminded || null
            } : null;

            Storage.set('todos', AppState.todos);
            this.render();
            Dashboard.updateStats();
            Reminder.updateBadges();
            document.getElementById('editTodoModal').style.display = 'none';
            saveBtn.removeEventListener('click', saveHandler);
            Toast.show('任务已更新');
        };
        saveBtn.addEventListener('click', saveHandler);
    }
};

// ===== Reminder System =====
const Reminder = {
    init() {
        // Check reminders periodically
        setInterval(() => this.check(), 60000); // Every minute
    },

    check() {
        const now = new Date();
        const today = Utils.getTodayKey();
        let triggered = false;

        AppState.todos.forEach(todo => {
            if (todo.completed) return;

            // Check cycle reminders
            if (todo.reminder?.enabled) {
                const reminder = todo.reminder;
                if (this.shouldRemind(reminder.cycle, reminder.lastReminded, now)) {
                    reminder.lastReminded = today;
                    triggered = true;
                    this.showNotification(todo, 'reminder');
                }
            }

            // Check due date reminders (separate from cycle reminders)
            if (todo.dueDate && !todo.dueDateNotified) {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(23, 59, 59, 999);
                if (now >= dueDate) {
                    todo.dueDateNotified = true;
                    triggered = true;
                    this.showNotification(todo, 'due');
                }
            }
        });

        if (triggered) {
            Storage.set('todos', AppState.todos);
            this.updateBadges();
        }
    },

    shouldRemind(cycle, lastReminded, now) {
        const today = Utils.getTodayKey();
        if (lastReminded === today) return false;

        const lastDate = lastReminded ? new Date(lastReminded) : null;
        if (!lastDate) return true;

        const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

        switch (cycle) {
            case 'daily': return daysDiff >= 1;
            case 'weekly': return daysDiff >= 7;
            case '3days': return daysDiff >= 3;
            case '7days': return daysDiff >= 7;
            case '14days': return daysDiff >= 14;
            case '30days': return daysDiff >= 30;
            default: return false;
        }
    },

    showNotification(todo, type) {
        const title = type === 'due' ? `截止日期提醒: ${todo.text}` : `循环提醒: ${todo.text}`;
        // Toast notification
        Toast.show(title, type === 'due' ? 'error' : 'warning', 5000);

        // Browser notification (if permitted)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('GW2 工具箱 - 待办提醒', {
                body: title,
                icon: type === 'due' ? '⏰' : '🔔',
                tag: todo.id
            });
        }
    },

    getPendingCount() {
        const now = new Date();
        const today = Utils.getTodayKey();

        return AppState.todos.filter(todo => {
            if (todo.completed) return false;

            // Count cycle reminders
            if (todo.reminder?.enabled && this.shouldRemind(todo.reminder.cycle, todo.reminder.lastReminded, now)) {
                return true;
            }

            // Count overdue due dates
            if (todo.dueDate && !todo.dueDateNotified) {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(23, 59, 59, 999);
                if (now >= dueDate) return true;
            }

            return false;
        }).length;
    },

    updateBadges() {
        const count = this.getPendingCount();

        // Dashboard stat card badge
        const dashboardBadge = document.getElementById('dashboardTodoBadge');
        if (dashboardBadge) {
            dashboardBadge.textContent = count;
            dashboardBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        // Header nav badge
        const navBadge = document.getElementById('navTodoBadge');
        if (navBadge) {
            navBadge.textContent = count;
            navBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        // Mobile drawer badge
        const drawerBadge = document.getElementById('drawerTodoBadge');
        if (drawerBadge) {
            drawerBadge.textContent = count;
            drawerBadge.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
};

// ===== Data Import/Export =====
const DataManager = {
    init() {
        document.getElementById('exportBtn').addEventListener('click', () => this.export());
        document.getElementById('importBtn').addEventListener('click', () => this.import());
    },

    export() {
        const data = {
            projects: AppState.projects,
            trades: AppState.trades,
            todos: AppState.todos,
            dailyProgress: AppState.dailyProgress,
            exportedAt: new Date().toISOString(),
            version: '2.0'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gw2_toolbox_backup_${Utils.getTodayKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('数据已导出');
    },

    import() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.projects) {
                        AppState.projects = data.projects;
                        Storage.set('projects', AppState.projects);
                    }
                    if (data.trades) {
                        AppState.trades = data.trades;
                        Storage.set('trades', AppState.trades);
                    }
                    if (data.todos) {
                        AppState.todos = data.todos;
                        Storage.set('todos', AppState.todos);
                    }
                    if (data.dailyProgress) {
                        AppState.dailyProgress = data.dailyProgress;
                        Storage.set('daily_progress', AppState.dailyProgress);
                    }
                    Dashboard.updateStats();
                    Crafting.renderProjectList();
                    Trading.renderHistory();
                    Todo.render();
                    Toast.show('数据已导入');
                } catch (err) {
                    Toast.show('导入失败，文件格式错误', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
};

// ===== Authentication & User Management =====
const Auth = {
    currentUser: null,
    users: Storage.get('system_users') || [],
    settings: Storage.get('system_settings') || { allowRegister: true },

    init() {
        // Create admin user if none exists
        if (this.users.length === 0) {
            this.register('admin', 'admin123', 'admin');
        }

        // Check for saved login
        const savedUser = Storage.get('current_user');
        if (savedUser) {
            this.currentUser = savedUser;
            this.showApp();
        }

        // Update auth UI based on register settings
        this.updateAuthUI();

        // Bind auth events
        document.getElementById('authSubmit').addEventListener('click', () => this.submit());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('addUserBtn')?.addEventListener('click', () => this.addUser());
        document.getElementById('updateAdminBtn')?.addEventListener('click', () => this.updateAdminInfo());
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('authSubmit').textContent = tab.dataset.auth === 'login' ? '登录' : '注册';
            });
        });

        // Brand home link
        document.getElementById('brandHome').addEventListener('click', () => {
            Navigation.navigate('dashboard');
        });
    },

    updateAuthUI() {
        const tabsContainer = document.querySelector('.auth-tabs');
        const registerTab = document.querySelector('.auth-tab[data-auth="register"]');
        const loginTab = document.querySelector('.auth-tab[data-auth="login"]');
        const submitBtn = document.getElementById('authSubmit');

        if (!this.settings.allowRegister) {
            // Hide register tab
            if (tabsContainer) tabsContainer.style.display = 'none';
            // Ensure login is active
            if (loginTab) loginTab.classList.add('active');
            if (registerTab) registerTab.classList.remove('active');
            if (submitBtn) submitBtn.textContent = '登录';
        } else {
            if (tabsContainer) tabsContainer.style.display = 'flex';
        }
    },

    submit() {
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value.trim();
        const isLogin = document.querySelector('.auth-tab.active').dataset.auth === 'login';
        const errorEl = document.getElementById('authError');

        errorEl.style.display = 'none';

        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            errorEl.style.display = 'block';
            return;
        }

        if (isLogin) {
            this.login(username, password);
        } else {
            // Check if registration is allowed
            if (!this.settings.allowRegister) {
                errorEl.textContent = '注册功能已关闭';
                errorEl.style.display = 'block';
                return;
            }
            this.register(username, password);
        }
    },

    login(username, password) {
        const user = this.users.find(u => u.username === username && u.password === password);
        if (user) {
            this.currentUser = user;
            Storage.set('current_user', user);
            this.loadUserData();
            this.showApp();
            Toast.show(`欢迎回来，${user.username}`);
        } else {
            document.getElementById('authError').textContent = '用户名或密码错误';
            document.getElementById('authError').style.display = 'block';
        }
    },

    register(username, password, role = 'user') {
        if (this.users.some(u => u.username === username)) {
            const errorEl = document.getElementById('authError');
            if (errorEl) {
                errorEl.textContent = '用户名已存在';
                errorEl.style.display = 'block';
            }
            return false;
        }

        const user = {
            id: Utils.uuid(),
            username,
            password,
            role,
            createdAt: Date.now()
        };

        this.users.push(user);
        Storage.set('system_users', this.users);

        if (role === 'admin') {
            return true; // Silent admin creation
        }

        const errorEl = document.getElementById('authError');
        if (errorEl) errorEl.style.display = 'none';
        const loginTab = document.querySelector('.auth-tab[data-auth="login"]');
        if (loginTab) loginTab.click();
        Toast.show('注册成功，请登录');
        return true;
    },

    logout() {
        this.saveUserData();
        Storage.remove('current_user');
        this.currentUser = null;
        document.getElementById('appHeader').style.display = 'none';
        document.getElementById('appMain').style.display = 'none';
        document.getElementById('authOverlay').style.display = 'flex';
        document.getElementById('authUsername').value = '';
        document.getElementById('authPassword').value = '';
        Toast.show('已退出登录');
    },

    showApp() {
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('appHeader').style.display = 'flex';
        document.getElementById('appMain').style.display = 'block';

        // Update user info
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userAvatar').textContent = this.currentUser.username.charAt(0).toUpperCase();

        // Show admin menu if admin
        const isAdmin = this.currentUser.role === 'admin';
        document.getElementById('adminNav').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('adminDrawerNav').style.display = isAdmin ? 'flex' : 'none';

        if (isAdmin) {
            Admin.load();
        }

        // Preload API data for dashboard
        Promise.all([
            ApiService.fetchDaily(true),
            ApiService.fetchActivity({}, true)
        ]).catch(() => {});

        // Navigate to dashboard on initial login
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        Navigation.navigate(hash, false);
    },

    loadUserData() {
        if (!this.currentUser) return;
        const userKey = `user_${this.currentUser.id}_`;
        AppState.projects = Storage.get(userKey + 'projects') || [];
        AppState.trades = Storage.get(userKey + 'trades') || [];
        AppState.todos = Storage.get(userKey + 'todos') || [];
        AppState.dailyProgress = Storage.get(userKey + 'daily_progress') || {};
    },

    saveUserData() {
        if (!this.currentUser) return;
        const userKey = `user_${this.currentUser.id}_`;
        Storage.set(userKey + 'projects', AppState.projects);
        Storage.set(userKey + 'trades', AppState.trades);
        Storage.set(userKey + 'todos', AppState.todos);
        Storage.set(userKey + 'daily_progress', AppState.dailyProgress);
    },

    addUser() {
        const username = document.getElementById('newUserName').value.trim();
        const password = document.getElementById('newUserPassword').value.trim();
        const role = this.getSegmentValue('newUserRoleControl') || 'user';

        if (!username || !password) {
            Toast.show('请输入用户名和密码', 'error');
            return;
        }

        const success = this.register(username, password, role);
        if (success) {
            Admin.renderUserList();
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserPassword').value = '';
            Toast.show('用户已添加');
        }
    },

    deleteUser(userId) {
        if (userId === this.currentUser.id) {
            Toast.show('不能删除当前登录用户', 'error');
            return;
        }
        this.users = this.users.filter(u => u.id !== userId);
        Storage.set('system_users', this.users);
        Admin.renderUserList();
        Toast.show('用户已删除');
    },

    updateAdminInfo() {
        const newName = document.getElementById('adminNameInput').value.trim();
        const newPass = document.getElementById('adminPassInput').value.trim();

        if (!newName && !newPass) {
            Toast.show('请输入新的用户名或密码', 'error');
            return;
        }

        const admin = this.users.find(u => u.id === this.currentUser.id);
        if (!admin) return;

        if (newName) {
            if (this.users.some(u => u.username === newName && u.id !== admin.id)) {
                Toast.show('用户名已存在', 'error');
                return;
            }
            admin.username = newName;
        }
        if (newPass) {
            admin.password = newPass;
        }

        Storage.set('system_users', this.users);
        this.currentUser = admin;
        Storage.set('current_user', admin);

        // Update UI
        document.getElementById('userName').textContent = admin.username;
        document.getElementById('userAvatar').textContent = admin.username.charAt(0).toUpperCase();
        document.getElementById('adminNameInput').value = '';
        document.getElementById('adminPassInput').value = '';
        Admin.renderUserList();
        Toast.show('管理员信息已更新');
    },

    getSegmentValue(controlId) {
        const control = document.getElementById(controlId);
        if (!control) return null;
        const active = control.querySelector('.segment-btn.active');
        return active ? active.dataset.value : null;
    }
};

// ===== Admin Panel =====
const Admin = {
    loaded: false,

    load() {
        if (this.loaded) return;
        this.loaded = true;
        this.renderUserList();
        this.bindEvents();
    },

    bindEvents() {
        // Register toggle
        const toggle = document.getElementById('registerToggle');
        if (toggle) {
            toggle.checked = Auth.settings.allowRegister;
            toggle.addEventListener('change', () => {
                Auth.settings.allowRegister = toggle.checked;
                Storage.set('system_settings', Auth.settings);
                Auth.updateAuthUI();
                Toast.show(toggle.checked ? '注册功能已开启' : '注册功能已关闭');
            });
        }

        // Role segmented control
        const roleControl = document.getElementById('newUserRoleControl');
        if (roleControl) {
            roleControl.querySelectorAll('.segment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    roleControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
    },

    renderUserList() {
        const container = document.getElementById('adminUserList');
        const badge = document.getElementById('userCountBadge');
        if (!container) return;

        if (badge) badge.textContent = Auth.users.length;

        if (Auth.users.length === 0) {
            container.innerHTML = '<div class="empty-small">暂无用户</div>';
            return;
        }

        container.innerHTML = Auth.users.map(user => {
            const isCurrent = user.id === Auth.currentUser?.id;
            return `
                <div class="admin-user-item">
                    <div class="admin-user-info">
                        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="admin-user-name">${Utils.escapeHtml(user.username)} ${isCurrent ? '<span style="color:var(--primary);font-size:11px;">(当前)</span>' : ''}</div>
                            <div class="admin-user-meta">${new Date(user.createdAt).toLocaleDateString('zh-CN')} 创建</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="role-badge ${user.role}">${user.role === 'admin' ? '管理员' : '用户'}</span>
                        ${!isCurrent ? `<button class="btn btn-sm btn-danger" onclick="Auth.deleteUser('${user.id}')">删除</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    Toast.init();
    Auth.init();
    Navigation.init();
    DataManager.init();
    Reminder.init();
    Reminder.requestPermission();

    // Only navigate if user is already logged in
    if (Auth.currentUser) {
        // Preload API data for dashboard
        Promise.all([
            ApiService.fetchDaily(true),
            ApiService.fetchActivity({}, true)
        ]).catch(() => {});
        
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        Navigation.navigate(hash, false);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1': e.preventDefault(); if (Auth.currentUser) Navigation.navigate('dashboard'); break;
                case '2': e.preventDefault(); if (Auth.currentUser) Navigation.navigate('daily'); break;
                case '3': e.preventDefault(); if (Auth.currentUser) Navigation.navigate('crafting'); break;
                case '4': e.preventDefault(); if (Auth.currentUser) Navigation.navigate('trading'); break;
                case '5': e.preventDefault(); if (Auth.currentUser) Navigation.navigate('todo'); break;
            }
        }
    });

    // Auto-save user data periodically
    setInterval(() => {
        if (Auth.currentUser) {
            Auth.saveUserData();
        }
    }, 30000);
});
