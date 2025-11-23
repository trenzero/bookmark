class BookmarkApp {
    constructor() {
        this.apiBase = '/api';
        this.currentBookmarks = [];
        this.categories = new Set();
        this.isDarkMode = false;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadBookmarks();
        this.checkSystemTheme();
        this.registerServiceWorker();
        
        // 初始加载Bing背景
        this.updateBingBackground(this.isDarkMode);
    }

    bindEvents() {
        // 表单提交
        document.getElementById('bookmark-form').addEventListener('submit', (e) => this.handleAddBookmark(e));
        
        // 主题切换
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // 刷新背景
        document.getElementById('refresh-bg').addEventListener('click', () => this.refreshBackground());
        
        // 筛选
        document.getElementById('search').addEventListener('input', () => this.filterBookmarks());
        document.getElementById('category-filter').addEventListener('change', () => this.filterBookmarks());
        document.getElementById('privacy-filter').addEventListener('change', () => this.filterBookmarks());
        document.getElementById('clear-filters').addEventListener('click', () => this.clearFilters());
        
        // 导入导出
        document.getElementById('export-btn').addEventListener('click', () => this.exportBookmarks());
        document.getElementById('import-btn').addEventListener('click', () => this.triggerImport());
        document.getElementById('import-file').addEventListener('change', (e) => this.importBookmarks(e));
        
        // 模态框
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancel-edit').addEventListener('click', () => this.closeModal());
        document.getElementById('edit-form').addEventListener('submit', (e) => this.handleEditBookmark(e));
        document.getElementById('delete-bookmark').addEventListener('click', () => this.handleDeleteBookmark());
        
        // 点击模态框外部关闭
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') this.closeModal();
        });
    }

    async loadBookmarks() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/bookmarks`);
            if (response.ok) {
                this.currentBookmarks = await response.json();
                this.updateCategories();
                this.renderBookmarks(this.currentBookmarks);
            } else {
                throw new Error('Failed to load bookmarks');
            }
        } catch (error) {
            this.showError('加载书签失败: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updateCategories() {
        this.categories.clear();
        this.currentBookmarks.forEach(bookmark => {
            if (bookmark.category) {
                this.categories.add(bookmark.category);
            }
        });
        
        const categoryFilter = document.getElementById('category-filter');
        const currentValue = categoryFilter.value;
        
        // 清空现有选项（保留"所有分类"）
        categoryFilter.innerHTML = '<option value="all">所有分类</option>';
        
        // 添加分类选项
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        // 恢复之前的选择
        if (this.categories.has(currentValue)) {
            categoryFilter.value = currentValue;
        }
    }

    renderBookmarks(bookmarks) {
        const container = document.getElementById('bookmarks-list');
        const emptyState = document.getElementById('empty-state');
        
        if (bookmarks.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        container.innerHTML = bookmarks.map(bookmark => `
            <div class="bookmark-card ${bookmark.is_private ? 'private' : ''}" data-id="${bookmark.id}">
                <h3 class="bookmark-title">
                    <a href="${bookmark.url}" target="_blank" rel="noopener">${this.escapeHtml(bookmark.title)}</a>
                </h3>
                <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
                ${bookmark.description ? `<div class="bookmark-description">${this.escapeHtml(bookmark.description)}</div>` : ''}
                <div class="bookmark-meta">
                    <div>
                        ${bookmark.category ? `<span class="bookmark-category">${this.escapeHtml(bookmark.category)}</span>` : ''}
                        <span style="margin-left: 0.5rem; font-size: 0.7rem;">${new Date(bookmark.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="bookmark-actions">
                        <button class="btn btn-sm btn-outline" onclick="app.editBookmark(${bookmark.id})">编辑</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterBookmarks() {
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const category = document.getElementById('category-filter').value;
        const privacy = document.getElementById('privacy-filter').value;
        
        let filtered = this.currentBookmarks;
        
        // 搜索筛选
        if (searchTerm) {
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(searchTerm) ||
                bookmark.description.toLowerCase().includes(searchTerm) ||
                bookmark.url.toLowerCase().includes(searchTerm) ||
                (bookmark.category && bookmark.category.toLowerCase().includes(searchTerm))
            );
        }
        
        // 分类筛选
        if (category !== 'all') {
            filtered = filtered.filter(bookmark => bookmark.category === category);
        }
        
        // 隐私筛选
        if (privacy !== 'all') {
            filtered = filtered.filter(bookmark => bookmark.is_private.toString() === privacy);
        }
        
        this.renderBookmarks(filtered);
    }

    clearFilters() {
        document.getElementById('search').value = '';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('privacy-filter').value = 'all';
        this.filterBookmarks();
    }

    async handleAddBookmark(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const bookmarkData = {
            title: document.getElementById('title').value.trim(),
            url: document.getElementById('url').value.trim(),
            description: document.getElementById('description').value.trim(),
            category: document.getElementById('category').value.trim(),
            is_private: document.getElementById('is-private').checked
        };
        
        if (!bookmarkData.title || !bookmarkData.url) {
            this.showError('标题和URL是必填项');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/bookmarks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookmarkData)
            });
            
            if (response.ok) {
                event.target.reset();
                await this.loadBookmarks();
                this.showSuccess('书签添加成功！');
            } else {
                const error = await response.json();
                throw new Error(error.error || '添加失败');
            }
        } catch (error) {
            this.showError('添加书签失败: ' + error.message);
        }
    }

    async editBookmark(id) {
        try {
            const response = await fetch(`${this.apiBase}/bookmarks/${id}`);
            if (response.ok) {
                const bookmark = await response.json();
                this.openEditModal(bookmark);
            } else {
                throw new Error('获取书签详情失败');
            }
        } catch (error) {
            this.showError('编辑书签失败: ' + error.message);
        }
    }

    openEditModal(bookmark) {
        document.getElementById('edit-id').value = bookmark.id;
        document.getElementById('edit-title').value = bookmark.title;
        document.getElementById('edit-url').value = bookmark.url;
        document.getElementById('edit-description').value = bookmark.description || '';
        document.getElementById('edit-category').value = bookmark.category || '';
        document.getElementById('edit-is-private').checked = Boolean(bookmark.is_private);
        
        document.getElementById('edit-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }

    async handleEditBookmark(event) {
        event.preventDefault();
        
        const id = document.getElementById('edit-id').value;
        const bookmarkData = {
            title: document.getElementById('edit-title').value.trim(),
            url: document.getElementById('edit-url').value.trim(),
            description: document.getElementById('edit-description').value.trim(),
            category: document.getElementById('edit-category').value.trim(),
            is_private: document.getElementById('edit-is-private').checked
        };
        
        if (!bookmarkData.title || !bookmarkData.url) {
            this.showError('标题和URL是必填项');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/bookmarks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookmarkData)
            });
            
            if (response.ok) {
                this.closeModal();
                await this.loadBookmarks();
                this.showSuccess('书签更新成功！');
            } else {
                const error = await response.json();
                throw new Error(error.error || '更新失败');
            }
        } catch (error) {
            this.showError('更新书签失败: ' + error.message);
        }
    }

    async handleDeleteBookmark() {
        const id = document.getElementById('edit-id').value;
        
        if (!confirm('确定要删除这个书签吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/bookmarks/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.closeModal();
                await this.loadBookmarks();
                this.showSuccess('书签删除成功！');
            } else {
                const error = await response.json();
                throw new Error(error.error || '删除失败');
            }
        } catch (error) {
            this.showError('删除书签失败: ' + error.message);
        }
    }

    async exportBookmarks() {
        try {
            const response = await fetch(`${this.apiBase}/export`);
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bookmarks-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showSuccess('书签导出成功！');
            } else {
                throw new Error('导出失败');
            }
        } catch (error) {
            this.showError('导出书签失败: ' + error.message);
        }
    }

    triggerImport() {
        document.getElementById('import-file').click();
    }

    async importBookmarks(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!confirm(`确定要导入 ${data.bookmarks ? data.bookmarks.length : data.length} 个书签吗？这将覆盖现有书签。`)) {
                event.target.value = '';
                return;
            }
            
            const response = await fetch(`${this.apiBase}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: text
            });
            
            if (response.ok) {
                const result = await response.json();
                event.target.value = '';
                await this.loadBookmarks();
                this.showSuccess(`导入成功！导入 ${result.imported} 个书签，${result.errors} 个错误`);
            } else {
                const error = await response.json();
                throw new Error(error.error || '导入失败');
            }
        } catch (error) {
            this.showError('导入书签失败: ' + error.message);
            event.target.value = '';
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        localStorage.setItem('darkMode', this.isDarkMode);
        
        // 更新主题图标
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.isDarkMode ? '☀️' : '🌙';
        
        // 更新背景
        this.updateBingBackground(this.isDarkMode);
    }

    checkSystemTheme() {
        const saved = localStorage.getItem('darkMode');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        this.isDarkMode = saved !== null ? JSON.parse(saved) : systemDark;
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.isDarkMode ? '☀️' : '🌙';
    }

    async updateBingBackground(isDark) {
        try {
            const response = await fetch(`${this.apiBase}/bing-wallpaper?theme=${isDark ? 'dark' : 'light'}`);
            if (response.ok) {
                const data = await response.json();
                document.body.style.backgroundImage = `url(${data.url})`;
                
                // 缓存到本地存储
                const cacheKey = `bing-bg-${isDark ? 'dark' : 'light'}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    url: data.url,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('Failed to load Bing background:', error);
            this.useFallbackBackground(isDark);
        }
    }

    async refreshBackground() {
        // 清除本地缓存
        const cacheKey = `bing-bg-${this.isDarkMode ? 'dark' : 'light'}`;
        localStorage.removeItem(cacheKey);
        
        await this.updateBingBackground(this.isDarkMode);
        this.showSuccess('背景已刷新！');
    }

    useFallbackBackground(isDark) {
        const fallbacks = {
            dark: 'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?ixlib=rb-4.0.3&w=1200',
            light: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?ixlib=rb-4.0.3&w=1200'
        };
        
        document.body.style.backgroundImage = `url(${fallbacks[isDark ? 'dark' : 'light']})`;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // 移除现有通知
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            animation: slideIn 0.3s ease;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 初始化应用
const app = new BookmarkApp();