// API client for Bakery E-Commerce
const API = {
    baseUrl: '',

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Attach current user ID for admin verification if available
        try {
            const savedUser = localStorage.getItem('bakery_user');
            if (savedUser) {
                const userObj = JSON.parse(savedUser);
                if (userObj && userObj._id) {
                    headers['X-User-Id'] = userObj._id;
                }
            }
        } catch (e) {}

        const config = {
            headers,
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const res = await fetch(`${this.baseUrl}${endpoint}`, config);
            const contentType = res.headers.get('content-type') || '';
            let data;
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                data = { success: res.ok, message: text };
            }
            if (!res.ok) {
                throw new Error(data.message || `Request failed with status ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error on ${endpoint}:`, err);
            throw err;
        }
    },

    // System Status
    getStatus() {
        return this.request('/api/status');
    },

    // Products
    getProducts(category = 'all') {
        const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
        return this.request(`/api/products${query}`);
    },

    getProduct(id) {
        return this.request(`/api/products/${id}`);
    },

    // Orders (with mandatory address validation)
    createOrder(orderPayload) {
        return this.request('/api/orders', {
            method: 'POST',
            body: orderPayload
        });
    },

    getOrder(orderId) {
        return this.request(`/api/orders/${orderId}`);
    },

    // Auth (Mandatory Email + Password & OTP Verification)
    login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: { email, password }
        });
    },

    sendOtp(otpData) {
        return this.request('/api/auth/send-otp', {
            method: 'POST',
            body: otpData
        });
    },

    verifyOtpRegister(verificationData) {
        return this.request('/api/auth/verify-otp-register', {
            method: 'POST',
            body: verificationData
        });
    },

    getUserProfile(userId) {
        return this.request(`/api/auth/user/${userId}`);
    },

    getUserOrders(userId) {
        return this.request(`/api/user/${userId}/orders`);
    },

    promoteUserToAdmin(userId) {
        return this.request(`/api/user/${userId}/make-admin`, {
            method: 'POST'
        });
    },

    // Admin Stock, Users & Orders
    getAdminUsers() {
        return this.request('/api/admin/users');
    },

    toggleUserAdmin(userId) {
        return this.request(`/api/admin/users/${userId}/toggle-admin`, {
            method: 'POST'
        });
    },

    getAdminProducts() {
        return this.request('/api/admin/products');
    },

    updateStock(productId, stockValue) {
        return this.request(`/api/admin/products/${productId}/stock`, {
            method: 'PUT',
            body: { stock: stockValue }
        });
    },

    getAdminOrders() {
        return this.request('/api/admin/orders');
    },

    updateOrderStatus(orderId, status, outOfStockItems = []) {
        const payload = { status };
        if (outOfStockItems && outOfStockItems.length > 0) {
            payload.out_of_stock_items = outOfStockItems;
        }
        return this.request(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            body: payload
        });
    },

    addNewProduct(productData) {
        return this.request('/api/admin/products', {
            method: 'POST',
            body: productData
        });
    }
};

window.API = API;
