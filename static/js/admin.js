// Admin / Owner Dashboard Management: Orders Management & Live Stock Control
const AdminManager = {
    products: [],
    orders: [],
    users: [],
    activeAdminSection: 'orders', // 'orders' or 'users'
    currentOrderFilter: 'In Progress', // 'In Progress' (default), 'Out of Stock', 'Finished', 'all'
    stockActiveCategory: 'all',
    stockSearchQuery: '',
    currentOOSOrder: null,
    selectedOOSItems: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Stock category chips filter
        document.querySelectorAll('.cat-chip.stock-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.cat-chip.stock-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.stockActiveCategory = chip.getAttribute('data-stock-cat') || 'all';
                this.renderStockList();
            });
        });

        // Stock search input filter
        const stockSearch = document.getElementById('admin-stock-search');
        if (stockSearch) {
            stockSearch.value = '';
            this.stockSearchQuery = '';
            stockSearch.addEventListener('input', (e) => {
                this.stockSearchQuery = e.target.value.toLowerCase().trim();
                this.renderStockList();
            });
        }

        // Users search input filter
        const userSearch = document.getElementById('admin-user-search');
        if (userSearch) {
            userSearch.value = '';
            this.userSearchQuery = '';
            userSearch.addEventListener('input', (e) => {
                this.userSearchQuery = e.target.value.toLowerCase().trim();
                this.renderUsersList();
            });
        }
    },

    async load() {
        await Promise.all([this.loadOrders(), this.loadProducts(), this.loadUsers()]);
        this.updateTallies();
    },

    async loadUsers() {
        const container = document.getElementById('admin-users-page-list') || document.getElementById('admin-users-list');
        if (!container) return;

        try {
            const data = await API.getAdminUsers();
            this.users = data.users || [];
            this.renderUsersList();
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); padding: 14px;">Error loading users: ${err.message}</div>`;
        }
    },

    renderUsersList() {
        const container = document.getElementById('admin-users-page-list') || document.getElementById('admin-users-list');
        if (!container) return;

        let filtered = this.users;
        if (this.userSearchQuery) {
            const q = this.userSearchQuery.toLowerCase();
            filtered = filtered.filter(u => 
                (u.name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.phone || '').includes(q)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 32px 14px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <div style="font-size: 28px; margin-bottom: 6px;">👥</div>
                <div style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: #fff;">NO USERS FOUND</div>
                <div style="font-size: 11px; margin-top: 4px;">No registered accounts match your search query.</div>
            </div>`;
            return;
        }

        container.innerHTML = filtered.map(u => {
            const initial = (u.name || 'U').charAt(0).toUpperCase();
            const isAdmin = Boolean(u.is_admin || u.role === 'admin');
            const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active Member';
            const phone = u.phone || '';
            const addr = u.last_address || {};

            return `
            <div class="admin-user-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 42px; height: 42px; border-radius: 50%; background: #261e18; border: 2px solid ${isAdmin ? 'var(--accent-gold)' : 'var(--border-strong)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
                            ${initial}
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 15px; color: #fff;">${u.name}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${u.email || 'No email registered'}</div>
                        </div>
                    </div>
                    <span class="role-badge ${isAdmin ? 'admin' : 'customer'}" style="font-size: 10px; padding: 3px 8px;">
                        ${isAdmin ? '👑 Store Admin' : '🥖 Customer'}
                    </span>
                </div>

                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span>📞 Phone: ${phone ? `<a href="tel:${phone}" style="color: var(--accent-gold-light); font-weight: 700; text-decoration: none;">${phone}</a>` : '<span style="color: var(--text-muted);">None</span>'}</span>
                        <span style="color: #fff; font-weight: 600;">🛍️ ${u.orders_count || 0} orders placed</span>
                    </div>
                    ${addr.street ? `
                    <div style="font-size: 11px; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px; margin-top: 6px;">
                        📍 ${addr.street}, ${addr.city || ''} ${addr.pincode || ''}
                    </div>` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">
                    <span style="font-size: 11px; color: var(--text-muted);">Role Permission:</span>
                    <button class="btn-quick-fill ${isAdmin ? 'admin' : ''}" onclick="AdminManager.toggleUserRole('${u._id}')" style="font-size: 11px; font-weight: 700; padding: 5px 12px;">
                        ${isAdmin ? 'Demote to Customer 🥖' : 'Promote to Store Admin 👑'}
                    </button>
                </div>
            </div>`;
        }).join('');
    },

    async toggleUserRole(userId) {
        try {
            const res = await API.toggleUserAdmin(userId);
            App.showToast(res.message || 'User role updated in MongoDB!', 'success');
            await this.loadUsers();
            if (App.currentUser && App.currentUser._id === userId) {
                App.currentUser.is_admin = res.is_admin;
                App.currentUser.role = res.role;
                localStorage.setItem('bakery_user', JSON.stringify(App.currentUser));
                App.updateAdminNavVisibility();
                App.renderProfileView();
            }
        } catch (err) {
            App.showToast(`Failed to update user role: ${err.message}`, 'error');
        }
    },

    // ==========================================
    // ORDERS & DELIVERY MANAGEMENT
    // ==========================================
    async loadOrders() {
        const container = document.getElementById('admin-orders-list');
        if (!container) return;

        try {
            const data = await API.getAdminOrders();
            this.orders = data.orders || [];
            this.updateTallies();
            this.renderFilteredOrders();
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); padding: 14px;">Error loading orders: ${err.message}</div>`;
        }
    },

    filterOrders(filterStatus) {
        this.currentOrderFilter = filterStatus;

        // Update active filter pill
        document.querySelectorAll('.order-filter-pill').forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('data-filter') === filterStatus);
        });

        // Update active tally card outline
        const map = {
            'all': 'card-tally-all',
            'In Progress': 'card-tally-progress',
            'Out of Stock': 'card-tally-outofstock',
            'Finished': 'card-tally-finished'
        };
        document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('active-filter'));
        const activeCardId = map[filterStatus];
        if (activeCardId) {
            const card = document.getElementById(activeCardId);
            if (card) card.classList.add('active-filter');
        }

        this.renderFilteredOrders();
    },

    renderFilteredOrders() {
        const container = document.getElementById('admin-orders-list');
        if (!container) return;

        let filtered = this.orders;

        if (this.currentOrderFilter !== 'all') {
            filtered = this.orders.filter(ord => {
                const status = (ord.status || 'In Progress');
                return status.toLowerCase() === this.currentOrderFilter.toLowerCase();
            });
        }

        if (filtered.length === 0) {
            const label = this.currentOrderFilter === 'all' ? 'No orders placed yet' : `No orders currently ${this.currentOrderFilter}`;
            container.innerHTML = `
            <div style="text-align: center; padding: 36px 14px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
                <div style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px;">${label.toUpperCase()}</div>
                <div style="font-size: 12px;">New customer bake orders will update tallies in real-time.</div>
            </div>`;
            return;
        }

        container.innerHTML = filtered.map(ord => {
            const addr = ord.shipping_address || {};
            const items = ord.items || [];
            const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Recent';
            const status = ord.status || 'In Progress';
            const oosItems = ord.out_of_stock_items || [];

            const statusBadgeColor = 
                status === 'Finished' ? 'var(--accent-green)' : 
                (status === 'Out of Stock' ? 'var(--accent-red)' : 'var(--accent-gold-light)');
            
            const statusBgColor = 
                status === 'Finished' ? 'rgba(16, 185, 129, 0.15)' : 
                (status === 'Out of Stock' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)');

            const phone = addr.phone || '';

            return `
            <div class="admin-order-card" id="admin-order-card-${ord._id}">
                <!-- Order Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">${ord.order_id || ord._id}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${dateStr} &bull; Fresh Oven Dispatch</div>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; background: ${statusBgColor}; color: ${statusBadgeColor}; padding: 4px 10px; border-radius: var(--radius-pill); text-transform: uppercase;">
                        ${status === 'Finished' ? '✅ Finished' : (status === 'Out of Stock' ? '⚠️ Out of Stock' : '⏳ In Progress')}
                    </span>
                </div>

                <!-- Customer Details & Mandatory Address -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.6; color: #e6ded8; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div><strong style="color: #fff;">Customer:</strong> ${addr.fullName || 'Guest Customer'}</div>
                        <div>
                            ${phone ? `
                            <a href="tel:${phone}" class="order-phone-link">📞 ${phone}</a>
                            <button class="btn-copy-phone" onclick="AdminManager.copyPhone('${phone}')" title="Copy phone number">Copy</button>
                            ` : '<span style="color: var(--text-muted);">No phone</span>'}
                        </div>
                    </div>
                    <div>
                        <strong style="color: #fff;">Delivery Address:</strong> 📍 ${addr.street || 'Address'}, ${addr.city || ''} - ${addr.pincode || ''}
                    </div>
                </div>

                <!-- Items Ordered -->
                <div style="font-size: 12px; color: #c9bfb8; margin-bottom: 10px;">
                    ${items.map(i => {
                        const isThisItemOOS = oosItems.some(o => (typeof o === 'string' ? o : o.name) === i.name);
                        return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.05); ${isThisItemOOS ? 'color: var(--accent-red); text-decoration: line-through;' : ''}">
                            <span>&bull; ${i.name} <strong>x${i.quantity}</strong> ${isThisItemOOS ? '<span style="font-size: 10px; text-decoration: none; display: inline-block; background: rgba(239,68,68,0.2); padding: 1px 6px; border-radius: 4px; margin-left: 4px;">OUT OF STOCK</span>' : ''}</span>
                            <span style="color: ${isThisItemOOS ? 'var(--accent-red)' : 'var(--accent-gold-light)'}; font-weight: 600;">₹${i.subtotal ? i.subtotal.toFixed(2) : (i.price * i.quantity).toFixed(2)}</span>
                        </div>`;
                    }).join('')}
                </div>

                <!-- Out of Stock Specific Alert Badge if recorded -->
                ${(status === 'Out of Stock' && oosItems.length > 0) ? `
                <div class="order-oos-badge">
                    <span>⚠️</span>
                    <div><strong>Out of Stock Items:</strong> ${oosItems.map(o => typeof o === 'string' ? o : o.name).join(', ')}</div>
                </div>` : ''}

                <!-- Total Amount -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0 10px 0;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Total Order Value</span>
                    <span style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: var(--accent-gold-light);">₹${(ord.total_amount || 0).toFixed(2)}</span>
                </div>

                <!-- 3 Status Actions (Owner Controls) -->
                <div class="order-status-actions">
                    <button class="btn-status-act in-progress ${status === 'In Progress' ? 'active' : ''}" onclick="AdminManager.updateStatus('${ord._id}', 'In Progress')">
                        ⏳ In Progress
                    </button>
                    <button class="btn-status-act out-of-stock ${status === 'Out of Stock' ? 'active' : ''}" onclick="AdminManager.openOutOfStockModal('${ord._id}')">
                        ⚠️ Out of Stock
                    </button>
                    <button class="btn-status-act finished ${status === 'Finished' ? 'active' : ''}" onclick="AdminManager.updateStatus('${ord._id}', 'Finished')">
                        ✅ Finished
                    </button>
                </div>
            </div>
            `;
        }).join('');
    },

    async updateStatus(orderId, newStatus) {
        try {
            const res = await API.updateOrderStatus(orderId, newStatus);
            App.showToast(`Order #${orderId} marked as ${newStatus}!`, newStatus === 'Finished' ? 'success' : 'info');

            // Update order object in local array
            const ord = this.orders.find(o => o._id === orderId || o.order_id === orderId);
            if (ord) ord.status = newStatus;

            // Recalculate tallies with new status
            this.updateTallies();

            // If owner marked as 'Finished' and view is 'In Progress', animate and remove from view
            if (newStatus === 'Finished' && this.currentOrderFilter === 'In Progress') {
                const card = document.getElementById(`admin-order-card-${orderId}`);
                if (card) {
                    card.classList.add('fade-out');
                    setTimeout(() => {
                        this.renderFilteredOrders();
                    }, 240);
                    return;
                }
            }

            // Otherwise re-render list
            this.renderFilteredOrders();
        } catch (err) {
            App.showToast(`Failed to update status: ${err.message}`, 'error');
        }
    },

    // ==========================================
    // ITEM-SPECIFIC OUT OF STOCK SELECTOR MODAL
    // ==========================================
    openOutOfStockModal(orderId) {
        const ord = this.orders.find(o => o._id === orderId || o.order_id === orderId);
        if (!ord) return;

        this.currentOOSOrder = ord;
        // Default: select all items in order
        this.selectedOOSItems = (ord.items || []).map(i => i.name);

        const metaEl = document.getElementById('oos-modal-order-meta');
        if (metaEl) {
            metaEl.textContent = `Order #${ord.order_id || ord._id} • ${ord.shipping_address?.fullName || 'Customer'}`;
        }

        this.renderOOSChecklist();

        // Open sheet
        const sheet = document.getElementById('sheet-out-of-stock');
        const overlay = document.getElementById('sheet-overlay');
        if (sheet && overlay) {
            overlay.classList.add('active');
            sheet.classList.add('active');
        }
    },

    renderOOSChecklist() {
        const container = document.getElementById('oos-items-checklist');
        const toggleAllBtn = document.getElementById('oos-btn-toggle-all');
        if (!container || !this.currentOOSOrder) return;

        const items = this.currentOOSOrder.items || [];
        const isAllSelected = items.length > 0 && this.selectedOOSItems.length === items.length;

        if (toggleAllBtn) {
            toggleAllBtn.textContent = isAllSelected ? 'Deselect All' : 'Select All';
        }

        container.innerHTML = items.map((i, idx) => {
            const isChecked = this.selectedOOSItems.includes(i.name);
            const subtotal = i.subtotal ? i.subtotal.toFixed(2) : (i.price * i.quantity).toFixed(2);

            return `
            <div class="oos-item-row ${isChecked ? 'selected' : ''}" onclick="AdminManager.toggleOOSItem('${i.name}')">
                <input type="checkbox" class="oos-checkbox" id="chk-oos-${idx}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); AdminManager.toggleOOSItem('${i.name}')" />
                <div class="oos-item-info">
                    <div class="oos-item-name">${i.name}</div>
                    <div class="oos-item-meta">Quantity in order: ${i.quantity} &bull; ₹${i.price.toFixed(2)} each</div>
                </div>
                <div class="oos-item-subtotal">₹${subtotal}</div>
            </div>
            `;
        }).join('');
    },

    toggleOOSItem(itemName) {
        if (!this.selectedOOSItems) this.selectedOOSItems = [];
        const idx = this.selectedOOSItems.indexOf(itemName);
        if (idx >= 0) {
            this.selectedOOSItems.splice(idx, 1);
        } else {
            this.selectedOOSItems.push(itemName);
        }
        this.renderOOSChecklist();
    },

    toggleSelectAllOOS() {
        if (!this.currentOOSOrder) return;
        const items = this.currentOOSOrder.items || [];
        if (this.selectedOOSItems.length === items.length) {
            this.selectedOOSItems = [];
        } else {
            this.selectedOOSItems = items.map(i => i.name);
        }
        this.renderOOSChecklist();
    },

    closeOutOfStockModal() {
        const sheet = document.getElementById('sheet-out-of-stock');
        const overlay = document.getElementById('sheet-overlay');
        if (sheet) sheet.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        this.currentOOSOrder = null;
        this.selectedOOSItems = [];
    },

    async confirmOutOfStock() {
        if (!this.currentOOSOrder) return;

        if (!this.selectedOOSItems || this.selectedOOSItems.length === 0) {
            App.showToast('Please check at least one item that is out of stock.', 'error');
            return;
        }

        const confirmBtn = document.getElementById('oos-btn-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'UPDATING INVENTORY...';
        }

        try {
            const orderId = this.currentOOSOrder._id;
            const res = await API.updateOrderStatus(orderId, 'Out of Stock', this.selectedOOSItems);

            App.showToast(`Order marked Out of Stock! Selected bakery items zeroed out.`, 'info');
            this.closeOutOfStockModal();

            // Refresh orders and products in store and admin
            await Promise.all([this.loadOrders(), this.loadProducts()]);
            if (window.App && typeof window.App.loadProducts === 'function') {
                window.App.loadProducts();
            }
        } catch (err) {
            App.showToast(`Failed to update out of stock status: ${err.message}`, 'error');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'CONFIRM OUT OF STOCK →';
            }
        }
    },

    updateTallies() {
        const totalCount = this.orders.length;
        let totalRev = 0;

        let inProgressCount = 0;
        let inProgressRev = 0;

        let outOfStockCount = 0;

        let finishedCount = 0;
        let finishedRev = 0;

        this.orders.forEach(ord => {
            const amt = ord.total_amount || 0;
            totalRev += amt;

            const st = ord.status || 'In Progress';
            if (st === 'In Progress') {
                inProgressCount++;
                inProgressRev += amt;
            } else if (st === 'Out of Stock') {
                outOfStockCount++;
            } else if (st === 'Finished') {
                finishedCount++;
                finishedRev += amt;
            }
        });

        // Update tally counts & revenues
        const totalCountEl = document.getElementById('tally-total-count');
        const totalRevEl = document.getElementById('tally-total-rev');

        const progCountEl = document.getElementById('tally-progress-count');
        const progRevEl = document.getElementById('tally-progress-rev');

        const oosCountEl = document.getElementById('tally-outofstock-count');

        const finCountEl = document.getElementById('tally-finished-count');
        const finRevEl = document.getElementById('tally-finished-rev');

        if (totalCountEl) totalCountEl.textContent = totalCount;
        if (totalRevEl) totalRevEl.textContent = `₹${totalRev.toFixed(2)} total`;

        if (progCountEl) progCountEl.textContent = inProgressCount;
        if (progRevEl) progRevEl.textContent = `₹${inProgressRev.toFixed(2)} active`;

        if (oosCountEl) oosCountEl.textContent = outOfStockCount;

        if (finCountEl) finCountEl.textContent = finishedCount;
        if (finRevEl) finRevEl.textContent = `₹${finishedRev.toFixed(2)} done`;
    },

    copyPhone(phone) {
        if (!phone) return;
        navigator.clipboard.writeText(phone).then(() => {
            App.showToast(`Phone ${phone} copied to clipboard!`, 'info');
        }).catch(() => {
            App.showToast(`Phone: ${phone}`, 'info');
        });
    },

    // ==========================================
    // DEDICATED LIVE STOCK INVENTORY MANAGEMENT
    // ==========================================
    async loadProducts() {
        const container = document.getElementById('admin-products-list');
        if (!container) return;

        try {
            const data = await API.getAdminProducts();
            this.products = data.products || [];
            this.renderStockList();
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); padding: 14px;">Error loading products: ${err.message}</div>`;
        }
    },

    renderStockList() {
        const container = document.getElementById('admin-products-list');
        if (!container) return;

        let filtered = this.products;

        // Category filter
        if (this.stockActiveCategory !== 'all') {
            filtered = filtered.filter(p => (p.category || '').toLowerCase().includes(this.stockActiveCategory.toLowerCase()));
        }

        // Search filter
        if (this.stockSearchQuery) {
            filtered = filtered.filter(p =>
                (p.name || '').toLowerCase().includes(this.stockSearchQuery) ||
                (p.category || '').toLowerCase().includes(this.stockSearchQuery)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 36px 14px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <div style="font-size: 28px; margin-bottom: 6px;">🍞</div>
                <div style="font-family: var(--font-heading); font-size: 14px; font-weight: 700; color: #fff;">NO BAKES FOUND</div>
                <div style="font-size: 11px; margin-top: 4px;">Try selecting another category or clear search.</div>
            </div>`;
            return;
        }

        container.innerHTML = filtered.map(p => {
            const isLow = p.stock > 0 && p.stock <= 5;
            const isOut = p.stock <= 0;

            // Bigger image markup matching customer view
            const imageMarkup = p.image && p.image.trim() !== '' ?
                `<img src="${p.image}" alt="${p.name}" loading="lazy" />` :
                `<div class="product-img-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M4 10C4 6.5 7 4 12 4C17 4 20 6.5 20 10V14C20 17 18 19 12 19C6 19 4 17 4 14V10Z" />
                        <path d="M9 10V14M15 10V14" />
                    </svg>
                    <span class="stock-banner-tag">BAKERY ITEM</span>
                </div>`;

            const statusClass = isOut ? 'out' : (isLow ? 'low' : 'ok');
            const statusLabel = isOut ? 'OUT OF STOCK' : (isLow ? `LOW STOCK (${p.stock})` : `${p.stock} IN OVEN`);

            return `
            <div class="stock-item-row ${isOut ? 'is-out-of-stock' : ''}" id="stock-row-${p._id}">
                <!-- Bigger Image Header (Visual identification for fastness) -->
                <div class="stock-photo-banner">
                    <span class="stock-badge-cat">${p.category}</span>
                    <span class="stock-badge-status ${statusClass}">${statusLabel}</span>
                    ${imageMarkup}
                </div>

                <!-- Product Content: Clearly Readable Name & Price -->
                <div class="stock-card-body">
                    <div class="stock-card-top">
                        <div class="stock-item-name">${p.name}</div>
                        <div class="stock-item-price">₹${p.price.toFixed(2)}</div>
                    </div>
                    <div class="stock-item-desc">${p.description || 'Artisan daily oven bake.'}</div>

                    <!-- Fast Stock Editing Controls -->
                    <div class="stock-controls">
                        <div class="stock-stepper-group">
                            <button class="stepper-btn" onclick="AdminManager.stepStock('${p._id}', -1)" title="Decrease stock">-</button>
                            <input type="number" id="input-stock-${p._id}" class="stock-input-field" value="${p.stock}" min="0" />
                            <button class="stepper-btn" onclick="AdminManager.stepStock('${p._id}', 1)" title="Increase stock">+</button>
                        </div>

                        <div class="stock-actions-group">
                            <button class="btn-stock-quick oos" onclick="AdminManager.quickSetOOS('${p._id}')" title="Instantly mark as Out of Stock">Set 0 (OOS)</button>
                            <button class="btn-stock-quick" onclick="AdminManager.quickRestock('${p._id}', 10)" title="Quickly add 10 units to batch">+10 Restock</button>
                            <button class="stock-save-btn" onclick="AdminManager.saveStock('${p._id}')">
                                Save Stock
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    stepStock(productId, delta) {
        const input = document.getElementById(`input-stock-${productId}`);
        if (!input) return;
        let current = parseInt(input.value) || 0;
        current = Math.max(0, current + delta);
        input.value = current;
    },

    async quickSetOOS(productId) {
        const input = document.getElementById(`input-stock-${productId}`);
        if (input) input.value = 0;
        await this.saveStock(productId);
    },

    async quickRestock(productId, qty = 10) {
        const input = document.getElementById(`input-stock-${productId}`);
        if (!input) return;
        let current = parseInt(input.value) || 0;
        input.value = current + qty;
        await this.saveStock(productId);
    },

    async saveStock(productId) {
        const input = document.getElementById(`input-stock-${productId}`);
        if (!input) return;

        const newStock = parseInt(input.value);
        if (isNaN(newStock) || newStock < 0) {
            App.showToast('Please enter a valid non-negative number.', 'error');
            return;
        }

        try {
            const res = await API.updateStock(productId, newStock);
            App.showToast(res.message || 'Stock updated successfully!', 'success');
            
            await this.loadProducts();
            if (window.App && typeof window.App.loadProducts === 'function') {
                window.App.loadProducts();
            }
        } catch (err) {
            App.showToast(`Failed to update stock: ${err.message}`, 'error');
        }
    }
};

window.AdminManager = AdminManager;
