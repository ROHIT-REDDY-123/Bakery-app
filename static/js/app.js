// Main Application Controller for The Artisan Drop Bakery E-Commerce
const App = {
    products: [],
    cart: [],
    currentUser: null,
    activeCategory: 'all',
    activeTab: 'shop', // 'shop', 'bag', 'admin', 'profile'
    searchQuery: '',
    pendingRegData: null,
    otpTimerInterval: null,

    init() {
        this.loadState();
        this.startClock();
        this.bindEvents();
        this.checkStatus();
        this.loadProducts();
        this.checkAuthGate();
    },

    loadState() {
        try {
            const savedCart = localStorage.getItem('bakery_hot_bag');
            if (savedCart) this.cart = JSON.parse(savedCart);

            const savedUser = localStorage.getItem('bakery_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.syncCurrentUser();
            }
        } catch (e) {
            console.error('Failed to load local state:', e);
        }
        this.updateBagBadge();
        this.updateAuthUI();
    },

    async syncCurrentUser() {
        if (!this.currentUser || !this.currentUser._id) return;
        try {
            const res = await API.getUserProfile(this.currentUser._id);
            if (res && res.user) {
                this.currentUser = res.user;
                localStorage.setItem('bakery_user', JSON.stringify(res.user));
                this.updateAuthUI();
                this.updateAdminNavVisibility();
                if (this.activeTab === 'profile') {
                    this.renderProfileView();
                }
            }
        } catch (e) {
            console.warn('Silent user sync failed:', e);
        }
    },

    checkAuthGate() {
        const gate = document.getElementById('auth-gate-modal');
        if (!this.currentUser) {
            if (gate) gate.style.display = 'flex';
        } else {
            if (gate) gate.style.display = 'none';
        }
        this.updateAdminNavVisibility();
    },

    updateAdminNavVisibility() {
        const isAdmin = Boolean(this.currentUser && (this.currentUser.is_admin === true || this.currentUser.role === 'admin'));

        // Customer navigation items: Shop and Hot Bag
        document.querySelectorAll('.nav-customer').forEach(el => {
            el.style.display = isAdmin ? 'none' : 'flex';
        });

        // Admin navigation items: Admin (Orders) and Stock
        document.querySelectorAll('.nav-admin').forEach(el => {
            el.style.display = isAdmin ? 'flex' : 'none';
        });

        // Header Hot Bag button is strictly hidden for admin
        const bagHeaderBtn = document.getElementById('btn-open-bag');
        if (bagHeaderBtn) {
            bagHeaderBtn.style.display = isAdmin ? 'none' : 'flex';
        }

        // Automatic routing based on role
        if (isAdmin) {
            if (this.activeTab === 'shop' || this.activeTab === 'bag') {
                this.switchTab('admin');
            }
        } else {
            if (this.activeTab === 'admin' || this.activeTab === 'stock' || this.activeTab === 'users') {
                this.switchTab('shop');
            }
        }
    },

    switchGateTab(tab) {
        const tabLogin = document.getElementById('gate-tab-login');
        const tabReg = document.getElementById('gate-tab-register');
        const secLogin = document.getElementById('gate-login-section');
        const secReg = document.getElementById('gate-register-section');
        const heading = document.getElementById('gate-main-heading');
        const subtext = document.getElementById('gate-main-subtext');

        if (tab === 'login') {
            tabLogin?.classList.add('active');
            tabReg?.classList.remove('active');
            if (secLogin) secLogin.style.display = 'block';
            if (secReg) secReg.style.display = 'none';
            if (heading) heading.textContent = 'SIGN IN TO ENTER';
            if (subtext) subtext.textContent = 'Sign in with your registered Email to browse fresh bakery drops & place orders.';
        } else {
            tabReg?.classList.add('active');
            tabLogin?.classList.remove('active');
            if (secReg) secReg.style.display = 'block';
            if (secLogin) secLogin.style.display = 'none';
            this.switchRegStep('details');
        }
    },

    switchRegStep(step) {
        const stepDetails = document.getElementById('gate-reg-step-details');
        const stepOtp = document.getElementById('gate-reg-step-otp');
        const tabsWrapper = document.getElementById('gate-tabs-wrapper');
        const heading = document.getElementById('gate-main-heading');
        const subtext = document.getElementById('gate-main-subtext');

        if (step === 'details') {
            if (stepDetails) stepDetails.style.display = 'block';
            if (stepOtp) stepOtp.style.display = 'none';
            if (tabsWrapper) tabsWrapper.style.display = 'flex';
            if (heading) heading.textContent = 'CREATE BAKERY ACCOUNT';
            if (subtext) subtext.textContent = 'Register with your Email. We will send a secure 6-digit OTP code to verify.';
            if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);
        } else if (step === 'otp') {
            if (stepDetails) stepDetails.style.display = 'none';
            if (stepOtp) stepOtp.style.display = 'block';
            if (tabsWrapper) tabsWrapper.style.display = 'none';
            if (heading) heading.textContent = 'VERIFY EMAIL OTP';
            if (subtext) subtext.textContent = 'Enter the 6-digit verification code sent to your email inbox.';
            const otpInput = document.getElementById('gate-reg-otp');
            if (otpInput) {
                otpInput.value = '';
                setTimeout(() => otpInput.focus(), 150);
            }
        }
    },

    async handleGateLogin() {
        const emailInput = document.getElementById('gate-login-email') || document.getElementById('gate-login-id');
        const email = (emailInput?.value || '').trim();
        const password = document.getElementById('gate-login-pass')?.value || '';

        if (!email || !email.includes('@')) {
            this.showToast('Registered Email Address is mandatory to sign in.', 'error');
            emailInput?.focus();
            return;
        }

        if (!password) {
            this.showToast('Password is required.', 'error');
            document.getElementById('gate-login-pass')?.focus();
            return;
        }

        try {
            const res = await API.login(email, password);
            this.currentUser = res.user;
            localStorage.setItem('bakery_user', JSON.stringify(res.user));
            
            this.checkAuthGate();
            this.updateAuthUI();
            this.renderProfileView();

            const isAdmin = Boolean(res.user.is_admin === true || res.user.role === 'admin');
            if (isAdmin) {
                this.showToast(`Welcome Admin ${res.user.name}! Admin panel unlocked.`, 'success');
                this.switchTab('admin');
            } else {
                this.showToast(`Welcome back, ${res.user.name}!`, 'success');
                this.switchTab('shop');
            }
        } catch (err) {
            this.showToast(err.message || 'Login failed. Please check your email and password.', 'error');
        }
    },

    async handleSendRegOtp() {
        const name = (document.getElementById('gate-reg-name')?.value || '').trim();
        const email = (document.getElementById('gate-reg-email')?.value || '').trim().toLowerCase();
        const phone = (document.getElementById('gate-reg-phone')?.value || '').trim();
        const password = document.getElementById('gate-reg-pass')?.value || '';
        const sendBtn = document.getElementById('gate-btn-send-otp');

        if (!name) {
            this.showToast('Please enter your Full Name.', 'error');
            document.getElementById('gate-reg-name')?.focus();
            return;
        }

        if (!email || !email.includes('@')) {
            this.showToast('Valid Email Address is mandatory to receive your OTP code.', 'error');
            document.getElementById('gate-reg-email')?.focus();
            return;
        }

        if (!password || password.length < 4) {
            this.showToast('Password must be at least 4 characters.', 'error');
            document.getElementById('gate-reg-pass')?.focus();
            return;
        }

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'DISPATCHING OTP CODE...';
        }

        try {
            const res = await API.sendOtp({ name, email });
            this.pendingRegData = { name, email, phone, password };

            const targetDisplay = document.getElementById('gate-otp-target-display');
            if (targetDisplay) targetDisplay.textContent = email;

            this.switchRegStep('otp');
            this.startOtpCountdown(60);
            this.showToast(res.message || `Verification OTP dispatched to ${email}!`, 'success');
        } catch (err) {
            this.showToast(err.message || 'Failed to send OTP code. Please verify your email.', 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'SEND OTP & VERIFY EMAIL →';
            }
        }
    },

    startOtpCountdown(seconds = 60) {
        if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);

        const timerText = document.getElementById('gate-otp-timer-text');
        const secondsEl = document.getElementById('gate-otp-seconds');
        const resendBtn = document.getElementById('gate-otp-resend-btn');

        let remaining = seconds;
        if (timerText) timerText.style.display = 'inline';
        if (resendBtn) resendBtn.style.display = 'none';
        if (secondsEl) secondsEl.textContent = remaining;

        this.otpTimerInterval = setInterval(() => {
            remaining -= 1;
            if (secondsEl) secondsEl.textContent = remaining;

            if (remaining <= 0) {
                clearInterval(this.otpTimerInterval);
                if (timerText) timerText.style.display = 'none';
                if (resendBtn) resendBtn.style.display = 'inline';
            }
        }, 1000);
    },

    async handleResendRegOtp() {
        if (!this.pendingRegData || !this.pendingRegData.email) {
            this.switchRegStep('details');
            return;
        }

        const resendBtn = document.getElementById('gate-otp-resend-btn');
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';
        }

        try {
            const res = await API.sendOtp({
                name: this.pendingRegData.name,
                email: this.pendingRegData.email
            });
            this.startOtpCountdown(60);
            const otpInput = document.getElementById('gate-reg-otp');
            if (otpInput) {
                otpInput.value = '';
                otpInput.focus();
            }
            this.showToast(res.message || 'A fresh OTP has been sent to your email.', 'success');
        } catch (err) {
            this.showToast(err.message || 'Could not resend OTP. Please try again.', 'error');
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend OTP Code';
            }
        }
    },

    async handleVerifyRegOtp() {
        const otpInput = document.getElementById('gate-reg-otp');
        const otp = (otpInput?.value || '').trim();
        const verifyBtn = document.getElementById('gate-btn-verify-otp');

        if (!otp || otp.length !== 6) {
            this.showToast('Please enter the complete 6-digit OTP code.', 'error');
            otpInput?.focus();
            return;
        }

        if (!this.pendingRegData || !this.pendingRegData.email) {
            this.showToast('Registration session lost. Please re-enter your details.', 'error');
            this.switchRegStep('details');
            return;
        }

        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'VERIFYING CODE & ADMITTING...';
        }

        try {
            const payload = {
                ...this.pendingRegData,
                otp: otp
            };

            const res = await API.verifyOtpRegister(payload);
            
            // Clean up timers and state
            if (this.otpTimerInterval) clearInterval(this.otpTimerInterval);
            this.pendingRegData = null;

            // Log user in and save state
            this.currentUser = res.user;
            localStorage.setItem('bakery_user', JSON.stringify(res.user));

            // Hide gatekeeper modal and send inside
            this.checkAuthGate();
            this.updateAuthUI();
            this.renderProfileView();

            this.showToast(`Email verified! Welcome to The Artisan Drop, ${res.user.name}!`, 'success');
            this.switchTab('shop');
        } catch (err) {
            this.showToast(err.message || 'Invalid or expired OTP code. Please try again.', 'error');
            otpInput?.focus();
        } finally {
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'VERIFY OTP & ENTER BAKERY →';
            }
        }
    },

    saveCart() {
        try {
            localStorage.setItem('bakery_hot_bag', JSON.stringify(this.cart));
        } catch (e) {
            console.error('Failed to save cart:', e);
        }
        this.updateBagBadge();
    },

    startClock() {
        const updateClock = () => {
            const el = document.getElementById('android-clock');
            if (el) {
                const now = new Date();
                el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        };
        updateClock();
        setInterval(updateClock, 1000);
    },

    async checkStatus() {
        try {
            const data = await API.getStatus();
            const pill = document.getElementById('db-status-pill');
            if (pill && data.db) {
                if (data.db.is_mongodb) {
                    pill.className = 'db-pill';
                    pill.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span> MongoDB Active`;
                } else {
                    pill.className = 'db-pill fallback';
                    pill.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span> Local Store (Ready for .env)`;
                }
            }
        } catch (err) {
            console.warn('Status check failed:', err);
        }
    },

    bindEvents() {
        // Device view switcher
        const btnPhone = document.getElementById('btn-phone-view');
        const btnFull = document.getElementById('btn-full-view');
        const phoneContainer = document.getElementById('android-container');

        if (btnPhone && btnFull && phoneContainer) {
            btnPhone.addEventListener('click', () => {
                phoneContainer.classList.remove('fullscreen-mode');
                btnPhone.classList.add('active');
                btnFull.classList.remove('active');
            });
            btnFull.addEventListener('click', () => {
                phoneContainer.classList.add('fullscreen-mode');
                btnFull.classList.add('active');
                btnPhone.classList.remove('active');
            });
        }

        // Bottom navigation buttons
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // Category pills
        document.querySelectorAll('.cat-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.activeCategory = chip.getAttribute('data-cat') || 'all';
                this.renderProducts();
            });
        });

        // Search input with clean reset and instant clear
        const searchInput = document.getElementById('product-search');
        const clearBtn = document.getElementById('product-search-clear');
        if (searchInput) {
            // Force clear any browser autofill on load
            searchInput.value = '';
            this.searchQuery = '';

            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                if (clearBtn) clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
                this.renderProducts();
            });

            // Guard against delayed browser autofill (e.g. Chrome phone autofill)
            setTimeout(() => {
                if (searchInput.value && !this.searchQuery) {
                    searchInput.value = '';
                    this.searchQuery = '';
                }
            }, 300);
        }

        // Hot Bag trigger in header
        const bagBtn = document.getElementById('btn-open-bag');
        if (bagBtn) {
            bagBtn.addEventListener('click', () => this.openHotBag());
        }

        // Checkout submit button with strict mandatory address validation
        const confirmOrderBtn = document.getElementById('btn-confirm-order');
        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => this.handleCheckoutSubmit());
        }
    },

    clearProductSearch() {
        const searchInput = document.getElementById('product-search');
        const clearBtn = document.getElementById('product-search-clear');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        if (clearBtn) clearBtn.style.display = 'none';
        this.searchQuery = '';
        this.renderProducts();
    },

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update nav item active states
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });

        // View sections
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

        if (tabName === 'shop') {
            document.getElementById('view-shop')?.classList.add('active');
        } else if (tabName === 'bag') {
            document.getElementById('view-shop')?.classList.add('active');
            this.openHotBag();
        } else if (tabName === 'admin') {
            document.getElementById('view-admin')?.classList.add('active');
            if (window.AdminManager) window.AdminManager.loadOrders();
        } else if (tabName === 'stock') {
            document.getElementById('view-stock')?.classList.add('active');
            if (window.AdminManager) window.AdminManager.loadProducts();
        } else if (tabName === 'users') {
            document.getElementById('view-users')?.classList.add('active');
            if (window.AdminManager) window.AdminManager.loadUsers();
        } else if (tabName === 'profile') {
            document.getElementById('view-profile')?.classList.add('active');
            this.syncCurrentUser();
            this.renderProfileView();
        }
    },

    async loadProducts() {
        const grid = document.getElementById('product-grid');
        if (grid) {
            grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px 10px; color: var(--text-muted);">
                <div style="font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 6px;">LOADING FRESH BATCH...</div>
                <div style="font-size: 12px;">Pulling artisan items from bakery oven.</div>
            </div>`;
        }

        try {
            const data = await API.getProducts();
            this.products = data.products || [];
            this.renderProducts();
        } catch (err) {
            if (grid) {
                grid.innerHTML = `<div style="grid-column: span 2; color: var(--accent-red); padding: 20px;">Failed to load items: ${err.message}</div>`;
            }
        }
    },

    renderProducts() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        let filtered = this.products;

        // Category filter
        if (this.activeCategory !== 'all') {
            filtered = filtered.filter(p => p.category.toLowerCase().includes(this.activeCategory.toLowerCase()));
        }

        // Search query filter
        if (this.searchQuery) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(this.searchQuery) ||
                p.description.toLowerCase().includes(this.searchQuery) ||
                p.category.toLowerCase().includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
            <div style="grid-column: span 2; text-align: center; padding: 40px 10px; color: var(--text-muted);">
                <div style="font-size: 32px; margin-bottom: 8px;">🥐</div>
                <div style="font-weight: 700; color: #fff; font-size: 16px;">NO BAKES FOUND</div>
                <div style="font-size: 12px; margin-top: 4px;">Try searching for another artisan pastry or bread.</div>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const isOutOfStock = p.stock <= 0;
            const badgeClass = p.badge === 'HOT BAKE' || p.badge === 'FRESH BAKE' ? 'hot' : (p.badge === 'LOW STOCK' ? 'low' : '');
            
            // Image rendering: if image exists, use <img>; otherwise render sleek warm graphic placeholder
            const imageMarkup = p.image && p.image.trim() !== '' ? 
                `<img src="${p.image}" alt="${p.name}" loading="lazy" />` :
                `<div class="product-img-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M4 10C4 6.5 7 4 12 4C17 4 20 6.5 20 10V14C20 17 18 19 12 19C6 19 4 17 4 14V10Z" />
                        <path d="M9 10V14M15 10V14" />
                    </svg>
                    <span class="empty-tag">TAP TO VIEW</span>
                </div>`;

            return `
            <div class="product-card" id="card-${p._id}" onclick="App.openProductModal('${p._id}')" title="Tap to view bake details">
                <div class="product-img-wrapper">
                    ${p.badge ? `<span class="product-badge ${badgeClass}">${p.badge}</span>` : ''}
                    <span class="stock-pill">${isOutOfStock ? 'SOLD OUT' : `${p.stock} LEFT`}</span>
                    ${imageMarkup}
                </div>
                <div class="product-details">
                    <div>
                        <div class="product-cat-label">${p.category}</div>
                        <div class="product-name">${p.name}</div>
                        <div class="product-desc">${p.description}</div>
                    </div>
                    <div class="product-bottom-row">
                        <div class="product-price">₹${p.price.toFixed(2)}</div>
                        <button class="add-bag-btn" ${isOutOfStock ? 'disabled' : ''} onclick="event.stopPropagation(); App.addToBag('${p._id}')">
                            ${isOutOfStock ? 'SOLD OUT' : '+ ADD'}
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    // ==========================================
    // PRODUCT DETAILS POP-UP MODAL (CARD CLICK)
    // ==========================================
    activeModalProduct: null,
    modalQty: 1,

    openProductModal(productId) {
        const prod = this.products.find(p => p._id === productId);
        if (!prod) return;

        this.activeModalProduct = prod;
        this.modalQty = 1;

        const modal = document.getElementById('modal-product-detail');
        const titleEl = document.getElementById('pop-title');
        const descEl = document.getElementById('pop-desc');
        const catEl = document.getElementById('pop-cat');
        const badgeEl = document.getElementById('pop-badge');
        const priceEl = document.getElementById('pop-price');
        const qtyEl = document.getElementById('pop-qty');
        const addBtn = document.getElementById('pop-add-btn');

        if (titleEl) titleEl.textContent = prod.name;
        if (descEl) descEl.textContent = prod.description;
        if (catEl) catEl.textContent = prod.category;
        if (badgeEl) {
            badgeEl.textContent = prod.badge || (prod.stock <= 5 ? 'LOW STOCK' : 'FRESH BAKE');
            badgeEl.className = `product-badge ${prod.badge === 'HOT BAKE' || prod.badge === 'FRESH BAKE' ? 'hot' : ''}`;
        }
        if (priceEl) priceEl.textContent = `₹${(prod.price * this.modalQty).toFixed(2)}`;
        if (qtyEl) qtyEl.textContent = this.modalQty;

        if (addBtn) {
            if (prod.stock <= 0) {
                addBtn.disabled = true;
                addBtn.textContent = 'SOLD OUT';
            } else {
                addBtn.disabled = false;
                addBtn.textContent = `ADD TO HOT BAG • ₹${(prod.price * this.modalQty).toFixed(2)}`;
            }
        }

        if (modal) modal.classList.add('active');
    },

    stepPopQty(delta) {
        if (!this.activeModalProduct) return;
        const maxStock = this.activeModalProduct.stock;
        const newQty = this.modalQty + delta;

        if (newQty >= 1 && newQty <= maxStock) {
            this.modalQty = newQty;
            const qtyEl = document.getElementById('pop-qty');
            const priceEl = document.getElementById('pop-price');
            const addBtn = document.getElementById('pop-add-btn');

            if (qtyEl) qtyEl.textContent = this.modalQty;
            const total = this.activeModalProduct.price * this.modalQty;
            if (priceEl) priceEl.textContent = `₹${total.toFixed(2)}`;
            if (addBtn) addBtn.textContent = `ADD TO HOT BAG • ₹${total.toFixed(2)}`;
        } else if (newQty > maxStock) {
            this.showToast(`Only ${maxStock} units available in oven batch!`, 'error');
        }
    },

    addFromModal() {
        if (!this.activeModalProduct) return;
        for (let i = 0; i < this.modalQty; i++) {
            this.addToBag(this.activeModalProduct._id, true);
        }
        this.closeProductModal();
        this.showToast(`Added ${this.modalQty}x "${this.activeModalProduct.name}" to Hot Bag!`, 'success');
    },

    closeProductModal(event) {
        if (event && event.target && event.target.closest && event.target.closest('.product-pop-card') && !event.target.classList.contains('pop-close-btn')) {
            return;
        }
        const modal = document.getElementById('modal-product-detail');
        if (modal) modal.classList.remove('active');
        this.activeModalProduct = null;
    },

    addToBag(productId, silent = false) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        if (product.stock <= 0) {
            this.showToast(`Sorry, ${product.name} is currently sold out!`, 'error');
            return;
        }

        const existing = this.cart.find(item => item.productId === productId);
        const currentQtyInBag = existing ? existing.quantity : 0;

        if (currentQtyInBag + 1 > product.stock) {
            this.showToast(`Max available stock (${product.stock}) reached for this item!`, 'error');
            return;
        }

        if (existing) {
            existing.quantity += 1;
        } else {
            this.cart.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image: product.image || ''
            });
        }

        this.saveCart();
        if (!silent) {
            this.showToast(`Added "${product.name}" to Hot Bag!`, 'success');
        }

        // Badge bounce animation
        const badge = document.getElementById('bag-badge-count');
        if (badge) {
            badge.style.transform = 'scale(1.4)';
            setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
        }
    },

    updateBagBadge() {
        const totalItems = this.cart.reduce((sum, i) => sum + i.quantity, 0);
        const badges = [document.getElementById('bag-badge-count'), document.getElementById('nav-bag-badge')];
        badges.forEach(b => {
            if (b) {
                b.textContent = totalItems;
                b.style.display = totalItems > 0 ? 'flex' : 'none';
            }
        });
    },

    openHotBag() {
        const overlay = document.getElementById('sheet-overlay');
        const sheet = document.getElementById('sheet-bag');
        if (overlay && sheet) {
            this.renderBagSheet();
            overlay.classList.add('active');
            sheet.classList.add('active');
        }
    },

    closeSheets() {
        const overlay = document.getElementById('sheet-overlay');
        document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active'));
        if (overlay) overlay.classList.remove('active');
    },

    renderBagSheet() {
        const container = document.getElementById('bag-items-list');
        const totalEl = document.getElementById('bag-total-amount');
        const checkoutBtn = document.getElementById('btn-bag-checkout');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
                <div style="font-size: 38px; margin-bottom: 8px;">🛍️</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;">YOUR HOT BAG IS EMPTY</div>
                <div style="font-size: 12px; margin-top: 4px;">Explore our oven-fresh sourdough, croissants & cakes.</div>
            </div>`;
            if (totalEl) totalEl.textContent = '₹0.00';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        let total = 0;
        container.innerHTML = this.cart.map((item, idx) => {
            const subtotal = item.price * item.quantity;
            total += subtotal;

            return `
            <div class="bag-item">
                <div class="bag-item-info">
                    <div class="bag-item-title">${item.name}</div>
                    <div class="bag-item-price">₹${item.price.toFixed(2)} each &bull; ₹${subtotal.toFixed(2)}</div>
                </div>
                <div class="bag-qty-stepper">
                    <button class="stepper-btn" onclick="App.changeBagQty(${idx}, -1)">-</button>
                    <span class="stepper-val">${item.quantity}</span>
                    <button class="stepper-btn" onclick="App.changeBagQty(${idx}, 1)">+</button>
                </div>
            </div>
            `;
        }).join('');

        if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
        if (checkoutBtn) checkoutBtn.disabled = false;
    },

    changeBagQty(index, delta) {
        if (!this.cart[index]) return;
        const item = this.cart[index];
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            this.cart.splice(index, 1);
        } else {
            // Check stock limit
            const product = this.products.find(p => p._id === item.productId);
            if (product && newQty > product.stock) {
                this.showToast(`Only ${product.stock} units available in oven batch!`, 'error');
                return;
            }
            item.quantity = newQty;
        }

        this.saveCart();
        this.renderBagSheet();
    },

    openCheckoutModal() {
        if (this.cart.length === 0) {
            this.showToast('Your Hot Bag is empty!', 'error');
            return;
        }

        // Close bag sheet and open address checkout sheet
        document.getElementById('sheet-bag').classList.remove('active');
        const checkoutSheet = document.getElementById('sheet-checkout');
        if (checkoutSheet) {
            // Pre-fill user details if logged in
            if (this.currentUser) {
                const nameInput = document.getElementById('input-addr-name');
                const phoneInput = document.getElementById('input-addr-phone');
                if (nameInput && !nameInput.value) nameInput.value = this.currentUser.name || '';
                if (phoneInput && !phoneInput.value) phoneInput.value = this.currentUser.phone || '';
                
                if (this.currentUser.addresses && this.currentUser.addresses.length > 0) {
                    const lastAddr = this.currentUser.addresses[0];
                    const streetInput = document.getElementById('input-addr-street');
                    const cityInput = document.getElementById('input-addr-city');
                    const pincodeInput = document.getElementById('input-addr-pincode');
                    if (streetInput && !streetInput.value) streetInput.value = lastAddr.street || '';
                    if (cityInput && !cityInput.value) cityInput.value = lastAddr.city || '';
                    if (pincodeInput && !pincodeInput.value) pincodeInput.value = lastAddr.pincode || '';
                }
            }

            checkoutSheet.classList.add('active');
        }
    },

    async handleCheckoutSubmit() {
        // Collect mandatory address form values
        const fullName = (document.getElementById('input-addr-name')?.value || '').trim();
        const phone = (document.getElementById('input-addr-phone')?.value || '').trim();
        const street = (document.getElementById('input-addr-street')?.value || '').trim();
        const city = (document.getElementById('input-addr-city')?.value || '').trim();
        const pincode = (document.getElementById('input-addr-pincode')?.value || '').trim();

        // Validate strictly mandatory fields
        let hasError = false;

        const validateField = (id, val, errorMsg) => {
            const input = document.getElementById(id);
            const errEl = document.getElementById(`err-${id}`);
            if (!val) {
                if (input) input.classList.add('error');
                if (errEl) {
                    errEl.textContent = errorMsg;
                    errEl.classList.add('show');
                }
                hasError = true;
            } else {
                if (input) input.classList.remove('error');
                if (errEl) errEl.classList.remove('show');
            }
        };

        validateField('input-addr-name', fullName, 'Full Name is required for delivery.');
        validateField('input-addr-phone', phone, 'Valid phone number is mandatory.');
        validateField('input-addr-street', street, 'Street Address is strictly required.');
        validateField('input-addr-city', city, 'City is strictly required.');
        validateField('input-addr-pincode', pincode, 'Postal code / Pincode is strictly required.');

        // Extra phone check
        const cleanPhone = phone.replace(/\D/g, '');
        if (phone && cleanPhone.length < 7) {
            const phoneInput = document.getElementById('input-addr-phone');
            const errEl = document.getElementById('err-input-addr-phone');
            phoneInput.classList.add('error');
            errEl.textContent = 'Phone number must be at least 7 digits.';
            errEl.classList.add('show');
            hasError = true;
        }

        if (hasError) {
            this.showToast('Please complete all mandatory delivery address fields!', 'error');
            return;
        }

        const btn = document.getElementById('btn-confirm-order');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'BAKING YOUR ORDER...';
        }

        const orderPayload = {
            items: this.cart,
            shippingAddress: {
                fullName,
                phone,
                street,
                city,
                pincode
            },
            userId: this.currentUser ? this.currentUser._id : null
        };

        try {
            const res = await API.createOrder(orderPayload);
            
            // Clear cart & storage
            this.cart = [];
            this.saveCart();
            
            // Refresh products & stock
            await this.loadProducts();

            // Display Success Screen with Unique Order ID
            this.showOrderSuccess(res.order_id, res.order);
        } catch (err) {
            this.showToast(`Order failed: ${err.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'CONFIRM & PLACE BAKE ORDER';
            }
        }
    },

    showOrderSuccess(orderId, orderDoc) {
        document.getElementById('sheet-checkout').classList.remove('active');
        const successSheet = document.getElementById('sheet-success');
        if (!successSheet) return;

        const orderIdDisplay = document.getElementById('success-order-id');
        const summaryDisplay = document.getElementById('success-order-summary');

        if (orderIdDisplay) orderIdDisplay.textContent = orderId;
        
        if (summaryDisplay && orderDoc) {
            const addr = orderDoc.shipping_address || {};
            summaryDisplay.innerHTML = `
                <div><strong style="color: #fff;">Delivery To:</strong> ${addr.fullName} (${addr.phone})</div>
                <div><strong style="color: #fff;">Address:</strong> ${addr.street}, ${addr.city} - ${addr.pincode}</div>
                <div style="margin-top: 6px;"><strong style="color: #fff;">Total:</strong> ₹${(orderDoc.total_amount || 0).toFixed(2)} &bull; Pay on Delivery</div>
                <div style="margin-top: 8px; color: var(--accent-green); font-weight: 700; font-size: 11px;">
                    &#x2714; Order alert dispatched to reddirohitabc@gmail.com
                </div>
            `;
        }

        successSheet.classList.add('active');
    },

    // User Profile & Authentication
    updateAuthUI() {
        const profileTabBtn = document.querySelector('.nav-item[data-tab="profile"]');
        if (this.currentUser && profileTabBtn) {
            const label = profileTabBtn.querySelector('span');
            if (label) label.textContent = this.currentUser.name.split(' ')[0];
        }
    },

    renderProfileView() {
        const container = document.getElementById('profile-content-area');
        if (!container) return;

        if (this.currentUser) {
            const isAdmin = Boolean(this.currentUser.is_admin === true || this.currentUser.role === 'admin');
            const initial = (this.currentUser.name || 'U').charAt(0).toUpperCase();

            container.innerHTML = `
            <div style="text-align: center; padding: 18px 0 14px 0;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: #221a14; border: 2px solid var(--accent-gold); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--font-heading); font-size: 26px; font-weight: 900; margin: 0 auto 10px auto; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.2);">
                    ${initial}
                </div>
                <h3 style="font-family: var(--font-heading); font-size: 20px; font-weight: 900; text-transform: uppercase; color: #fff;">${this.currentUser.name}</h3>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                    ${this.currentUser.email || ''} ${this.currentUser.phone ? `&bull; ${this.currentUser.phone}` : ''}
                </div>
                <div>
                    <span class="role-badge ${isAdmin ? 'admin' : 'customer'}">
                        ${isAdmin ? '👑 Store Administrator' : '🥖 Bakery Club Member'}
                    </span>
                </div>
            </div>

            ${isAdmin ? `
            <!-- Admin Quick Access for Store Owner -->
            <div class="profile-action-group" style="margin-top: 14px; margin-bottom: 16px;">
                <button class="btn-primary" onclick="App.switchTab('admin')">
                    🚀 ORDERS & DISPATCH MANAGER
                </button>
                <button class="btn-secondary" onclick="App.switchTab('stock')">
                    🌾 LIVE STOCK INVENTORY
                </button>
                <button class="btn-secondary" onclick="App.switchTab('users')">
                    👥 REGISTERED USERS & ROLES
                </button>
            </div>
            ` : ''}

            <!-- Previous Orders Section -->
            <div class="previous-orders-container" style="margin-top: 18px;">
                <div style="margin-bottom: 12px;">
                    <span style="font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--accent-gold);">ORDER HISTORY</span>
                    <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; color: #fff; margin-top: 2px;">MY PREVIOUS ORDERS</h3>
                </div>
                <div id="profile-user-orders-list">
                    <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">Loading past orders...</div>
                </div>
            </div>

            <button class="btn-secondary" onclick="App.logout()" style="margin-top: 14px; width: 100%;">LOGOUT</button>
            `;
            this.loadUserPreviousOrders();
        } else {
            container.innerHTML = `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px;">
                <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 900; text-transform: uppercase; margin-bottom: 14px;">MEMBER SIGN IN</h3>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="auth-email" class="form-input" placeholder="e.g. customer@bakery.com" />
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="auth-pass" class="form-input" placeholder="Password" />
                </div>
                <button class="btn-primary" onclick="App.loginSubmit()">SIGN IN</button>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
                <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 900; text-transform: uppercase; margin-bottom: 14px;">CREATE ACCOUNT</h3>
                <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input type="text" id="reg-name" class="form-input" placeholder="Jane Doe" />
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="reg-email" class="form-input" placeholder="jane@example.com" />
                </div>
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input type="tel" id="reg-phone" class="form-input" placeholder="9876543210" />
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="reg-pass" class="form-input" placeholder="Min 6 characters" />
                </div>
                <button class="btn-primary" onclick="App.registerSubmit()">CREATE ACCOUNT</button>
            </div>
            `;
        }
    },

    async loginSubmit() {
        const email = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-pass')?.value;

        if (!email || !password) {
            this.showToast('Please enter both email and password.', 'error');
            return;
        }

        try {
            const res = await API.login(email, password);
            this.currentUser = res.user;
            localStorage.setItem('bakery_user', JSON.stringify(res.user));
            this.updateAuthUI();
            this.renderProfileView();
            this.showToast(`Welcome, ${res.user.name}!`, 'success');

            // If admin, switch to admin tab
            if (res.user.role === 'admin') {
                this.switchTab('admin');
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async registerSubmit() {
        const name = document.getElementById('reg-name')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim();
        const phone = document.getElementById('reg-phone')?.value.trim();
        const password = document.getElementById('reg-pass')?.value;

        if (!name || !email || !password) {
            this.showToast('Full Name, Email, and Password are required.', 'error');
            return;
        }

        // Prefill modal and launch OTP flow
        const gateName = document.getElementById('gate-reg-name');
        const gateEmail = document.getElementById('gate-reg-email');
        const gatePhone = document.getElementById('gate-reg-phone');
        const gatePass = document.getElementById('gate-reg-pass');
        if (gateName) gateName.value = name;
        if (gateEmail) gateEmail.value = email;
        if (gatePhone) gatePhone.value = phone;
        if (gatePass) gatePass.value = password;

        this.checkAuthGate();
        this.switchGateTab('register');
        this.handleSendRegOtp();
    },

    async loadUserPreviousOrders() {
        const container = document.getElementById('profile-user-orders-list');
        if (!container || !this.currentUser) return;

        try {
            const data = await API.getUserOrders(this.currentUser._id);
            const orders = data.orders || [];

            if (orders.length === 0) {
                container.innerHTML = `
                <div style="text-align: center; padding: 24px 14px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
                    <div style="font-size: 26px; margin-bottom: 6px;">🥐</div>
                    <div style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">NO PREVIOUS ORDERS YET</div>
                    <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 12px;">Your artisan sourdough and fresh croissants await in the shop.</div>
                    <button class="btn-primary" onclick="App.switchTab('shop')" style="font-size: 11px; padding: 8px 16px;">BROWSE FRESH BAKES</button>
                </div>`;
                return;
            }

            container.innerHTML = orders.map(ord => {
                const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent Order';
                const status = ord.status || 'In Progress';
                const items = ord.items || [];
                const addr = ord.shipping_address || {};

                const statusBadgeColor = 
                    status === 'Finished' ? 'var(--accent-green)' : 
                    (status === 'Out of Stock' ? 'var(--accent-red)' : 'var(--accent-gold-light)');
                
                const statusBgColor = 
                    status === 'Finished' ? 'rgba(16, 185, 129, 0.15)' : 
                    (status === 'Out of Stock' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)');

                return `
                <div class="previous-order-card">
                    <div class="p-header">
                        <div>
                            <div style="font-family: var(--font-heading); font-size: 14px; font-weight: 800; color: #fff;">
                                #${ord.order_id || ord._id}
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted);">${dateStr}</div>
                        </div>
                        <span style="font-size: 10.5px; font-weight: 700; background: ${statusBgColor}; color: ${statusBadgeColor}; padding: 3px 8px; border-radius: var(--radius-pill); text-transform: uppercase;">
                            ${status === 'Finished' ? '✅ Finished' : (status === 'Out of Stock' ? '⚠️ Out of Stock' : '⏳ In Progress')}
                        </span>
                    </div>

                    <div class="p-items">
                        ${items.map(i => `
                            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                                <span>&bull; ${i.name} <strong style="color: #fff;">x${i.quantity}</strong></span>
                                <span style="color: var(--accent-gold-light); font-weight: 600;">₹${(i.subtotal || i.price * i.quantity).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>

                    ${addr.street ? `
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px;">
                        📍 <strong>Delivery:</strong> ${addr.street}, ${addr.city || ''} ${addr.pincode || ''}
                    </div>` : ''}

                    <div class="p-footer">
                        <div>
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); display: block;">Total Paid</span>
                            <span style="font-family: var(--font-heading); font-size: 16px; font-weight: 800; color: var(--accent-gold-light);">₹${(ord.total_amount || 0).toFixed(2)}</span>
                        </div>
                        <button class="btn-reorder" onclick="App.reorderPastOrder('${ord.order_id || ord._id}')">
                            🔄 Reorder (Add to Bag)
                        </button>
                    </div>
                </div>`;
            }).join('');
        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-red); font-size: 12px; padding: 12px;">Failed to load previous orders: ${err.message}</div>`;
        }
    },

    async reorderPastOrder(orderId) {
        try {
            const data = await API.getOrder(orderId);
            const ord = data.order;
            if (!ord || !ord.items || ord.items.length === 0) {
                this.showToast('Order details could not be retrieved.', 'error');
                return;
            }

            ord.items.forEach(item => {
                const existing = this.cart.find(c => c.productId === item.productId || c.name === item.name);
                if (existing) {
                    existing.quantity += item.quantity;
                    existing.subtotal = existing.quantity * existing.price;
                } else {
                    this.cart.push({
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        subtotal: item.quantity * item.price,
                        image: item.image || ''
                    });
                }
            });

            this.saveCart();
            this.showToast('Items re-added to your Hot Bag! 🥐', 'success');
            this.openHotBag();
        } catch (err) {
            this.showToast(`Could not reorder: ${err.message}`, 'error');
        }
    },

    async upgradeCurrentUserToAdmin() {
        if (!this.currentUser || !this.currentUser._id) return;
        try {
            const res = await API.promoteUserToAdmin(this.currentUser._id);
            this.currentUser.is_admin = true;
            this.currentUser.role = 'admin';
            localStorage.setItem('bakery_user', JSON.stringify(this.currentUser));
            this.updateAuthUI();
            this.updateAdminNavVisibility();
            this.renderProfileView();
            this.showToast('🎉 Account upgraded to Store Admin! Admin & Stock dashboards unlocked!', 'success');
            this.switchTab('admin');
        } catch (err) {
            this.showToast(`Upgrade failed: ${err.message}`, 'error');
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('bakery_user');
        this.checkAuthGate();
        this.updateAuthUI();
        this.switchTab('shop');
        this.showToast('Logged out successfully.', 'info');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    if (window.AdminManager) window.AdminManager.init();
});
