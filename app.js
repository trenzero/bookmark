class BookmarkApp {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentCategory = 'all';
    this.currentTag = null;
    this.searchQuery = '';
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadCategories();
    await this.loadTags();
    await this.loadBookmarks();
    this.setupEventListeners();
    this.setupPWA();
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/user-settings');
      if (response.ok) {
        const settings = await response.json();
        this.applySettings(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  applySettings(settings) {
    // 应用主题
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
      this.updateThemeToggle(settings.theme);
    }

    // 应用 Bing 背景
    if (settings.use_bing_bg) {
      this.loadBingBackground();
    }

    // 应用分页设置
    if (settings.items_per_page) {
      this.itemsPerPage = settings.items_per_page;
    }
  }

  async loadBingBackground() {
    try {
      const response = await fetch('/api/bing-image');
      if (response.ok) {
        const imageData = await response.json();
        document.documentElement.style.setProperty('--bing-bg-image', `url(${imageData.url})`);
      }
    } catch (error) {
      console.error('Failed to load Bing image:', error);
    }
  }

  async loadCategories() {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        this.renderCategories(data.categories);
        this.renderCategorySelect(data.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async loadTags() {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const data = await response.json();
        this.renderTags(data.tags);
        this.renderTagSelector(data.tags);
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  async loadBookmarks() {
    try {
      let url = `/api/bookmarks?page=${this.currentPage}&limit=${this.itemsPerPage}`;
      
      if (this.currentCategory !== 'all') {
        url += `&categoryId=${this.currentCategory}`;
      }
      
      if (this.currentTag) {
        url += `&tagId=${this.currentTag}`;
      }
      
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        this.renderBookmarks(data.bookmarks);
        this.renderPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }

  renderBookmarks(bookmarks) {
    const grid = document.getElementById('bookmarks-grid');
    
    if (bookmarks.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>暂无书签</h3>
          <p>点击"添加书签"按钮开始添加您的第一个书签</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = bookmarks.map(bookmark => `
      <div class="bookmark-card" data-id="${bookmark.id}">
        <div class="bookmark-header">
          <div>
            <h3 class="bookmark-title">${this.escapeHtml(bookmark.title)}</h3>
            <a href="${this.escapeHtml(bookmark.url)}" 
               target="_blank" 
               rel="noopener" 
               class="bookmark-url">
              ${this.truncateUrl(bookmark.url)}
            </a>
          </div>
          <div class="bookmark-actions">
            <button class="btn-icon edit-bookmark" title="编辑">✏️</button>
            <button class="btn-icon delete-bookmark" title="删除">🗑️</button>
          </div>
        </div>
        
        ${bookmark.description ? `
          <p class="bookmark-description">${this.escapeHtml(bookmark.description)}</p>
        ` : ''}
        
        <div class="bookmark-meta">
          <div class="bookmark-tags">
            ${bookmark.tags ? bookmark.tags.split(',').map((tag, index) => {
              const colors = bookmark.tag_colors ? bookmark.tag_colors.split(',') : [];
              const color = colors[index] || '#3498db';
              return `<span class="tag" style="background-color: ${color}20; color: ${color}">${tag}</span>`;
            }).join('') : ''}
          </div>
          <div class="bookmark-stats">
            <small>点击: ${bookmark.click_count || 0}</small>
          </div>
        </div>
      </div>
    `).join('');

    // 添加事件监听器
    this.attachBookmarkEventListeners();
  }

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    
    if (pagination.pages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    // 上一页
    if (pagination.page > 1) {
      html += `<button class="page-btn" data-page="${pagination.page - 1}">上一页</button>`;
    }
    
    // 页码
    for (let i = 1; i <= pagination.pages; i++) {
      if (i === pagination.page) {
        html += `<span class="page-current">${i}</span>`;
      } else {
        html += `<button class="page-btn" data-page="${i}">${i}</button>`;
      }
    }
    
    // 下一页
    if (pagination.page < pagination.pages) {
      html += `<button class="page-btn" data-page="${pagination.page + 1}">下一页</button>`;
    }
    
    container.innerHTML = html;
    
    // 添加分页事件监听
    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.loadBookmarks();
      });
    });
  }

  setupEventListeners() {
    // 主题切换
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // 添加书签按钮
    document.getElementById('add-bookmark-btn').addEventListener('click', () => {
      this.showBookmarkModal();
    });

    // 搜索功能
    document.getElementById('search-btn').addEventListener('click', () => {
      this.performSearch();
    });

    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // 模态框关闭
    document.querySelector('.close-btn').addEventListener('click', () => {
      this.hideBookmarkModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.hideBookmarkModal();
    });

    // 表单提交
    document.getElementById('bookmark-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveBookmark();
    });

    // 导入导出
    document.getElementById('import-export-btn').addEventListener('click', () => {
      this.showImportExportModal();
    });
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    this.updateThemeToggle(newTheme);
    this.saveUserSetting('theme', newTheme);
  }

  updateThemeToggle(theme) {
    const toggleBtn = document.getElementById('theme-toggle');
    toggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  performSearch() {
    this.searchQuery = document.getElementById('search-input').value;
    this.currentPage = 1;
    this.loadBookmarks();
  }

  async saveBookmark() {
    const formData = new FormData(document.getElementById('bookmark-form'));
    const data = {
      title: document.getElementById('bookmark-title').value,
      url: document.getElementById('bookmark-url').value,
      description: document.getElementById('bookmark-description').value,
      categoryId: document.getElementById('bookmark-category').value || null,
      isPublic: document.getElementById('bookmark-public').checked,
      tags: this.getSelectedTagIds()
    };

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        this.hideBookmarkModal();
        this.loadBookmarks();
        this.showNotification('书签添加成功', 'success');
      } else {
        throw new Error('Failed to save bookmark');
      }
    } catch (error) {
      console.error('Error saving bookmark:', error);
      this.showNotification('保存书签失败', 'error');
    }
  }

  setupPWA() {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    // 监听 beforeinstallprompt 事件
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallPrompt();
    });

    // 添加至主屏幕成功
    window.addEventListener('appinstalled', () => {
      this.hideInstallPrompt();
    });
  }

  showInstallPrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'app-install-prompt';
    prompt.innerHTML = `
      <p>将应用安装到主屏幕？</p>
      <button id="install-btn" class="btn-primary">安装</button>
      <button id="dismiss-btn" class="btn-secondary">稍后</button>
    `;
    
    document.body.appendChild(prompt);

    document.getElementById('install-btn').addEventListener('click', () => {
      deferredPrompt.prompt();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
      prompt.remove();
    });
  }

  // 工具函数
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  truncateUrl(url, maxLength = 40) {
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
  }

  showNotification(message, type = 'info') {
    // 实现通知系统
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkApp();
});