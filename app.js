document.addEventListener('DOMContentLoaded', async () => {
    let db;
    let selectedClientId = null, selectedCarId = null;
    let editingClientId = null, editingCarId = null, editingOrderId = null;
    let clientSearchTerm = '', carSearchTerm = '', orderSearchTerm = '';
    let orderSort = 'date_desc', orderFilter = 'all';

    // --- DOM Элементы ---
    const dashboardView = document.getElementById('dashboard');
    const workspaceView = document.getElementById('workspace');
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navWorkspaceBtn = document.getElementById('nav-workspace');
    const clientsList = document.getElementById('clients-list');
    const carsList = document.getElementById('cars-list');
    const ordersList = document.getElementById('orders-list');
    const clientDetails = document.getElementById('client-details');
    const carDetails = document.getElementById('car-details');
    const carsSection = document.getElementById('cars-section');
    const ordersSection = document.getElementById('orders-section');
    const clientForm = document.getElementById('client-form');
    const carForm = document.getElementById('car-form');
    const orderForm = document.getElementById('order-form');
    const saveDbButton = document.getElementById('save-db');
    const loadDbInput = document.getElementById('load-db-input');

    // --- Навигация ---
    function showView(view) {
        dashboardView.classList.add('hidden');
        workspaceView.classList.add('hidden');
        navDashboardBtn.classList.remove('active');
        navWorkspaceBtn.classList.remove('active');

        if (view === 'dashboard') {
            dashboardView.classList.remove('hidden');
            navDashboardBtn.classList.add('active');
            if (db) renderDashboard();
        } else {
            workspaceView.classList.remove('hidden');
            navWorkspaceBtn.classList.add('active');
            if (db) fullRender();
        }
    }
    navDashboardBtn.addEventListener('click', () => showView('dashboard'));
    navWorkspaceBtn.addEventListener('click', () => showView('workspace'));

    // --- Инициализация БД ---
    async function initDB(data) {
        try {
            const SQL = await initSqlJs({ locateFile: file => `${file}` });
            db = data ? new SQL.Database(data) : new SQL.Database();
            db.exec("PRAGMA foreign_keys = ON;");
            if (!data) createTables();
            showView('dashboard'); // Показываем дашборд при запуске
        } catch (err) { console.error("Ошибка инициализации БД:", err); }
    }

    function createTables() {
        db.run(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, fio TEXT NOT NULL, phone TEXT NOT NULL, email TEXT UNIQUE);`);
        db.run(`CREATE TABLE IF NOT EXISTS cars (id INTEGER PRIMARY KEY, client_id INTEGER, brand TEXT NOT NULL, model TEXT NOT NULL, vin TEXT UNIQUE NOT NULL, FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE);`);
        db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, car_id INTEGER, description TEXT NOT NULL, status TEXT NOT NULL, cost REAL DEFAULT 0, parts TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE);`);
    }

    // --- Функции отрисовки Дашборда ---
    function renderDashboard() {
        try {
            const inProgressRes = db.exec("SELECT COUNT(*) FROM orders WHERE status = 'В работе'");
            document.getElementById('kpi-in-progress').textContent = inProgressRes[0]?.values[0][0] || 0;
            
            const readyRes = db.exec("SELECT COUNT(*) FROM orders WHERE status = 'Готов'");
            document.getElementById('kpi-ready').textContent = readyRes[0]?.values[0][0] || 0;
            
            const revenueRes = db.exec("SELECT SUM(cost) FROM orders WHERE status = 'Выдан' AND created_at >= date('now', 'start of month')");
            const revenue = revenueRes[0]?.values[0][0] || 0;
            document.getElementById('kpi-revenue-month').textContent = `${revenue.toFixed(2)} ₽`;

            const recentOrdersRes = db.exec("SELECT o.description, c.brand, c.model FROM orders o JOIN cars c ON o.car_id = c.id ORDER BY o.created_at DESC LIMIT 5");
            const recentOrdersList = document.getElementById('dashboard-recent-orders');
            recentOrdersList.innerHTML = '';
            if (recentOrdersRes.length > 0 && recentOrdersRes[0].values.length > 0) {
                recentOrdersRes[0].values.forEach(([desc, brand, model]) => {
                    recentOrdersList.innerHTML += `<li>${desc} (${brand} ${model})</li>`;
                });
            } else { recentOrdersList.innerHTML = '<li>Нет данных</li>'; }

            const topClientsRes = db.exec("SELECT cl.fio, SUM(o.cost) as total_cost FROM clients cl JOIN cars c ON cl.id = c.client_id JOIN orders o ON c.id = o.car_id WHERE o.status = 'Выдан' GROUP BY cl.id ORDER BY total_cost DESC LIMIT 5");
            const topClientsList = document.getElementById('dashboard-top-clients');
            topClientsList.innerHTML = '';
            if (topClientsRes.length > 0 && topClientsRes[0].values.length > 0) {
                topClientsRes[0].values.forEach(([fio, total]) => {
                    topClientsList.innerHTML += `<li>${fio} - ${total.toFixed(2)} ₽</li>`;
                });
            } else { topClientsList.innerHTML = '<li>Нет данных</li>'; }
        } catch(e) { console.error("Ошибка рендеринга дашборда:", e); }
    }

    // --- Функции отрисовки Рабочей области ---
    function fullRender() { renderClients(); renderCars(); renderOrders(); updateSectionsVisibility(); }
    
    function renderClients() {
        clientsList.innerHTML = '';
        let query = "SELECT id, fio, phone, email FROM clients";
        const params = [];
        if (clientSearchTerm) {
            query += " WHERE LOWER(fio) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ?";
            const term = `%${clientSearchTerm.toLowerCase()}%`;
            params.push(term, term, term);
        }
        query += " ORDER BY fio";
        try {
            const res = db.exec(query, params);
            if (res.length > 0) { res[0].values.forEach(([id, fio, phone, email]) => { const li = createListItem(id, `${fio}`, () => selectClient(id), () => editClient(id, fio, phone, email), () => deleteClient(id)); if (id === selectedClientId) li.classList.add('selected'); clientsList.appendChild(li); }); }
        } catch(e) { console.error("Ошибка рендеринга клиентов:", e); }
        renderClientDetails();
    }
    
    function renderCars() {
        carsList.innerHTML = '';
        if (!selectedClientId) { renderCarDetails(); return; }
        let query = "SELECT id, brand, model, vin FROM cars WHERE client_id = ?";
        const params = [selectedClientId];
        if (carSearchTerm) {
            query += " AND (LOWER(brand) LIKE ? OR LOWER(model) LIKE ? OR LOWER(vin) LIKE ?)";
            const term = `%${carSearchTerm.toLowerCase()}%`;
            params.push(term, term, term);
        }
        query += " ORDER BY brand, model";
        try {
            const res = db.exec(query, params);
            if (res.length > 0) { res[0].values.forEach(([id, brand, model, vin]) => { const li = createListItem(id, `${brand} ${model}`, () => selectCar(id), () => editCar(id, brand, model, vin), () => deleteCar(id)); if (id === selectedCarId) li.classList.add('selected'); carsList.appendChild(li); }); }
        } catch(e) { console.error("Ошибка рендеринга авто:", e); }
        renderCarDetails();
    }

    function renderOrders() {
        ordersList.innerHTML = '';
        if (!selectedCarId) return;
        let query = "SELECT id, description, status, cost, parts, created_at FROM orders WHERE car_id = ?";
        const params = [selectedCarId];
        if (orderFilter !== 'all') { query += " AND status = ?"; params.push(orderFilter); }
        if (orderSearchTerm) { query += " AND (LOWER(description) LIKE ? OR LOWER(parts) LIKE ?)"; const term = `%${orderSearchTerm.toLowerCase()}%`; params.push(term, term); }
        const sortOptions = { 'date_desc': 'created_at DESC', 'date_asc': 'created_at ASC', 'cost_desc': 'cost DESC', 'cost_asc': 'cost ASC' };
        query += ` ORDER BY ${sortOptions[orderSort]}`;
        try {
            const res = db.exec(query, params);
            if (res.length > 0) { res[0].values.forEach(([id, description, status, cost, parts]) => { const costText = cost > 0 ? `${cost.toFixed(2)} руб.` : 'Цена не указана'; const displayText = `[${status}] ${description} - ${costText}`; const li = createListItem(id, displayText, null, () => editOrder(id, description, status, cost, parts), () => deleteOrder(id)); ordersList.appendChild(li); }); }
        } catch(e) { console.error("Ошибка рендеринга заказов:", e); }
    }

    // --- Функции отрисовки деталей с ИСТОРИЕЙ ---
    function renderClientDetails() {
        if (!selectedClientId) { clientDetails.classList.add('hidden'); return; }
        try {
            const res = db.exec("SELECT fio, phone, email FROM clients WHERE id = ?", [selectedClientId]);
            if (res.length === 0) { clientDetails.classList.add('hidden'); return; }
            
            const [fio, phone, email] = res[0].values[0];
            let historyHtml = '<h5>История заказов клиента:</h5><div class="details-history"><ul>';
            const historyRes = db.exec("SELECT o.description, o.status, o.cost, c.brand, c.model FROM orders o JOIN cars c ON o.car_id = c.id WHERE c.client_id = ? ORDER BY o.created_at DESC", [selectedClientId]);
            if (historyRes.length > 0 && historyRes[0].values.length > 0) {
                historyRes[0].values.forEach(([desc, status, cost, brand, model]) => { historyHtml += `<li>${brand} ${model}: ${desc} [${status}] - ${cost.toFixed(2)} ₽</li>`; });
            } else { historyHtml += '<li>Заказов не найдено.</li>'; }
            historyHtml += '</ul></div>';
            clientDetails.innerHTML = `<h4>Детали клиента</h4><p><strong>ФИО:</strong> ${fio}</p><p><strong>Телефон:</strong> ${phone}</p><p><strong>Email:</strong> ${email || 'Не указан'}</p>${historyHtml}`;
            clientDetails.classList.remove('hidden');
        } catch (e) { console.error("Ошибка рендеринга деталей клиента:", e); clientDetails.classList.add('hidden'); }
    }

    function renderCarDetails() {
        if (!selectedCarId) { carDetails.classList.add('hidden'); return; }
        try {
            const res = db.exec("SELECT brand, model, vin FROM cars WHERE id = ?", [selectedCarId]);
            if (res.length === 0) { carDetails.classList.add('hidden'); return; }
            const [brand, model, vin] = res[0].values[0];
            let historyHtml = '<h5>История заказов авто:</h5><div class="details-history"><ul>';
            const historyRes = db.exec("SELECT description, status, cost FROM orders WHERE car_id = ? ORDER BY created_at DESC", [selectedCarId]);
            if (historyRes.length > 0 && historyRes[0].values.length > 0) {
                historyRes[0].values.forEach(([desc, status, cost]) => { historyHtml += `<li>${desc} [${status}] - ${cost.toFixed(2)} ₽</li>`; });
            } else { historyHtml += '<li>Заказов не найдено.</li>'; }
            historyHtml += '</ul></div>';
            carDetails.innerHTML = `<h4>Детали автомобиля <button class="print-btn" onclick="window.printOrder()">Печать</button></h4><p><strong>Марка/Модель:</strong> ${brand} ${model}</p><p><strong>VIN:</strong> ${vin}</p>${historyHtml}`;
            carDetails.classList.remove('hidden');
        } catch(e) { console.error("Ошибка рендеринга деталей авто:", e); carDetails.classList.add('hidden'); }
    }

    // --- Функция ПЕЧАТИ ---
    window.printOrder = function() {
        if (!selectedCarId) return;
        try {
            const clientRes = db.exec("SELECT cl.fio, cl.phone, cl.email FROM clients cl JOIN cars c ON cl.id = c.client_id WHERE c.id = ?", [selectedCarId]);
            const carRes = db.exec("SELECT brand, model, vin FROM cars WHERE id = ?", [selectedCarId]);
            const ordersRes = db.exec("SELECT description, status, cost, parts, strftime('%d.%m.%Y', created_at) FROM orders WHERE car_id = ?", [selectedCarId]);
            if (carRes.length === 0) return;
            const [fio, phone, email] = clientRes[0].values[0];
            const [brand, model, vin] = carRes[0].values[0];
            let ordersHtml = '';
            let totalCost = 0;
            if (ordersRes.length > 0 && ordersRes[0].values.length > 0) {
                ordersHtml = '<h3>Выполненные работы и запчасти</h3><table><thead><tr><th>Описание</th><th>Запчасти</th><th>Статус</th><th>Стоимость, ₽</th></tr></thead><tbody>';
                ordersRes[0].values.forEach(([desc, status, cost, parts]) => { ordersHtml += `<tr><td>${desc || '-'}</td><td>${parts || '-'}</td><td>${status}</td><td>${cost.toFixed(2)}</td></tr>`; totalCost += cost; });
                ordersHtml += '</tbody></table>';
            }
            const printContent = `<h1>Заказ-наряд от ${new Date().toLocaleDateString()}</h1><hr><h2>Информация о клиенте</h2><p><strong>ФИО:</strong> ${fio}</p><p><strong>Телефон:</strong> ${phone}</p><p><strong>Email:</strong> ${email || 'Не указан'}</p><hr><h2>Информация об автомобиле</h2><p><strong>Марка/Модель:</strong> ${brand} ${model}</p><p><strong>VIN:</strong> ${vin}</p><hr>${ordersHtml}<hr><h2 style="text-align: right;">Итого: ${totalCost.toFixed(2)} ₽</h2><br><br><p>Подпись клиента: _______________________</p><p>Подпись мастера: _______________________</p>`;
            document.getElementById('print-area').innerHTML = printContent;
            window.print();
        } catch (e) { console.error("Ошибка подготовки к печати:", e); alert("Не удалось сформировать заказ-наряд для печати."); }
    }

    // --- Остальной код (CRUD, утилиты, события) ---
    function createListItem(id, text, onTextClick, onEdit, onDelete) { const li = document.createElement('li'); const itemText = document.createElement('div'); itemText.className = 'item-text'; itemText.textContent = text; if (onTextClick) itemText.addEventListener('click', onTextClick); const controls = document.createElement('div'); controls.className = 'item-controls'; const editBtn = document.createElement('button'); editBtn.className = 'edit-btn'; editBtn.textContent = '✎'; editBtn.title = 'Редактировать'; editBtn.addEventListener('click', onEdit); const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-btn'; deleteBtn.textContent = '✖'; deleteBtn.title = 'Удалить'; deleteBtn.addEventListener('click', onDelete); controls.append(editBtn, deleteBtn); li.append(itemText, controls); return li; }
    function updateSectionsVisibility() { carsSection.classList.toggle('hidden', !selectedClientId); ordersSection.classList.toggle('hidden', !selectedCarId); }
    function selectClient(id) { selectedClientId = id; selectedCarId = null; carSearchTerm = ''; document.getElementById('car-search').value = ''; orderSearchTerm = ''; document.getElementById('order-search').value = ''; fullRender(); }
    function selectCar(id) { selectedCarId = id; orderSearchTerm = ''; document.getElementById('order-search').value = ''; fullRender(); }
    clientForm.addEventListener('submit', e => { e.preventDefault(); const fioInput = document.getElementById('client-fio'); const phoneInput = document.getElementById('client-phone'); const emailInput = document.getElementById('client-email'); fioInput.classList.remove('invalid'); phoneInput.classList.remove('invalid'); emailInput.classList.remove('invalid'); const fio = fioInput.value.trim(); const phone = phoneInput.value.trim(); const email = emailInput.value.trim() || null; if (!fio) { alert('Поле ФИО не может быть пустым.'); fioInput.classList.add('invalid'); return; } const phoneRegex = /^\+?[0-9\s\(\)-]{7,18}$/; if (!phoneRegex.test(phone)) { alert('Неверный формат номера телефона.'); phoneInput.classList.add('invalid'); return; } const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; if (email && !emailRegex.test(email)) { alert('Неверный формат Email.'); emailInput.classList.add('invalid'); return; } try { if (editingClientId) { db.run("UPDATE clients SET fio = ?, phone = ?, email = ? WHERE id = ?", [fio, phone, email, editingClientId]); } else { db.run("INSERT INTO clients (fio, phone, email) VALUES (?, ?, ?)", [fio, phone, email]); } resetClientForm(); renderClients(); renderDashboard(); } catch (err) { if (err.message.includes("UNIQUE constraint failed")) { alert("Ошибка: Клиент с таким Email уже существует!"); emailInput.classList.add('invalid'); } else { alert("Произошла ошибка при сохранении клиента."); console.error(err); } } });
    function editClient(id, fio, phone, email) { editingClientId = id; document.getElementById('client-form-title').textContent = 'Редактировать клиента'; document.getElementById('client-fio').value = fio; document.getElementById('client-phone').value = phone; document.getElementById('client-email').value = email || ''; document.getElementById('client-submit-btn').textContent = 'Сохранить'; document.getElementById('client-cancel-btn').classList.remove('hidden'); }
    function deleteClient(id) { if (confirm('Вы уверены, что хотите удалить этого клиента? Все его автомобили и заказы также будут удалены!')) { db.run("DELETE FROM clients WHERE id = ?", [id]); if (selectedClientId === id) { selectedClientId = null; selectedCarId = null; } fullRender(); renderDashboard(); } }
    function resetClientForm() { editingClientId = null; clientForm.reset(); document.getElementById('client-fio').classList.remove('invalid'); document.getElementById('client-phone').classList.remove('invalid'); document.getElementById('client-email').classList.remove('invalid'); document.getElementById('client-form-title').textContent = 'Добавить клиента'; document.getElementById('client-submit-btn').textContent = 'Добавить'; document.getElementById('client-cancel-btn').classList.add('hidden'); }
    clientForm.querySelector('#client-cancel-btn').addEventListener('click', resetClientForm);
    carForm.addEventListener('submit', e => { e.preventDefault(); if (!selectedClientId) { alert("Сначала выберите клиента!"); return; } const brand = document.getElementById('car-brand').value; const model = document.getElementById('car-model').value; const vin = document.getElementById('car-vin').value; try { if (editingCarId) { db.run("UPDATE cars SET brand = ?, model = ?, vin = ? WHERE id = ?", [brand, model, vin, editingCarId]); } else { db.run("INSERT INTO cars (client_id, brand, model, vin) VALUES (?, ?, ?, ?)", [selectedClientId, brand, model, vin]); } resetCarForm(); renderCars(); } catch (err) { alert("Ошибка. Возможно, такой VIN уже существует."); } });
    function editCar(id, brand, model, vin) { editingCarId = id; document.getElementById('car-form-title').textContent = 'Редактировать автомобиль'; document.getElementById('car-brand').value = brand; document.getElementById('car-model').value = model; document.getElementById('car-vin').value = vin; document.getElementById('car-submit-btn').textContent = 'Сохранить'; document.getElementById('car-cancel-btn').classList.remove('hidden'); }
    function deleteCar(id) { if (confirm('Вы уверены, что хотите удалить этот автомобиль и все его заказы?')) { db.run("DELETE FROM cars WHERE id = ?", [id]); if (selectedCarId === id) { selectedCarId = null; } fullRender(); renderDashboard(); } }
    function resetCarForm() { editingCarId = null; carForm.reset(); document.getElementById('car-form-title').textContent = 'Добавить автомобиль'; document.getElementById('car-submit-btn').textContent = 'Добавить'; document.getElementById('car-cancel-btn').classList.add('hidden'); }
    carForm.querySelector('#car-cancel-btn').addEventListener('click', resetCarForm);
    orderForm.addEventListener('submit', e => { e.preventDefault(); if (!selectedCarId) { alert("Сначала выберите автомобиль!"); return; } const description = document.getElementById('order-description').value; const status = document.getElementById('order-status').value; const cost = parseFloat(document.getElementById('order-cost').value) || 0; const parts = document.getElementById('order-parts').value; if (editingOrderId) { db.run("UPDATE orders SET description = ?, status = ?, cost = ?, parts = ? WHERE id = ?", [description, status, cost, parts, editingOrderId]); } else { db.run("INSERT INTO orders (car_id, description, status, cost, parts) VALUES (?, ?, ?, ?, ?)", [selectedCarId, description, status, cost, parts]); } resetOrderForm(); renderOrders(); renderDashboard(); });
    function editOrder(id, description, status, cost, parts) { editingOrderId = id; document.getElementById('order-form-title').textContent = 'Редактировать заказ'; document.getElementById('order-description').value = description; document.getElementById('order-status').value = status; document.getElementById('order-cost').value = cost || ''; document.getElementById('order-parts').value = parts || ''; document.getElementById('order-submit-btn').textContent = 'Сохранить'; document.getElementById('order-cancel-btn').classList.remove('hidden'); }
    function deleteOrder(id) { if (confirm('Вы уверены, что хотите удалить этот заказ?')) { db.run("DELETE FROM orders WHERE id = ?", [id]); renderOrders(); renderDashboard(); } }
    function resetOrderForm() { editingOrderId = null; orderForm.reset(); document.getElementById('order-form-title').textContent = 'Добавить заказ'; document.getElementById('order-submit-btn').textContent = 'Добавить'; document.getElementById('order-cancel-btn').classList.add('hidden'); }
    orderForm.querySelector('#order-cancel-btn').addEventListener('click', resetOrderForm);
    document.getElementById('client-search').addEventListener('input', e => { clientSearchTerm = e.target.value; renderClients(); });
    document.getElementById('car-search').addEventListener('input', e => { carSearchTerm = e.target.value; renderCars(); });
    document.getElementById('order-search').addEventListener('input', e => { orderSearchTerm = e.target.value; renderOrders(); });
    document.getElementById('order-filter').addEventListener('change', e => { orderFilter = e.target.value; renderOrders(); });
    document.getElementById('order-sort').addEventListener('change', e => { orderSort = e.target.value; renderOrders(); });
    saveDbButton.addEventListener('click', () => { if(!db) return; const data = db.export(); const blob = new Blob([data], { type: "application/octet-stream" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "autoservice.db"; a.click(); URL.revokeObjectURL(url); });
    loadDbInput.addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { selectedClientId = null; selectedCarId = null; initDB(new Uint8Array(reader.result)); }; reader.readAsArrayBuffer(file); loadDbInput.value = ""; });

    // --- Запуск приложения ---
    initDB();
});