// src/ui.js
// Этот модуль отвечает за все манипуляции с DOM и отрисовку интерфейса.

import { state } from './state.js';
import { getData } from './db.js';

// Объекты для хранения ссылок на DOM-элементы страниц и кнопок навигации
const views = {};
const navButtons = {};

/**
 * Инициализирует HTML-структуру для всех "страниц" приложения.
 * Вызывается один раз после успешного входа.
 */
export function setupViews() {
    // Наполняем объекты views и navButtons ссылками на элементы
    ['dashboard', 'workspace', 'inventory', 'reports'].forEach(key => {
        views[key] = document.getElementById(`${key}-view`);
        navButtons[key] = document.getElementById(`nav-${key}`);
    });

    // --- HTML для страницы "Рабочая область" (Заказы) ---
    views.workspace.innerHTML = `
        <div class="main-grid">
            <div class="column">
                <h2>Клиенты</h2>
                <div class="column-controls"><input type="search" id="client-search" placeholder="Поиск по ФИО, телефону..."></div>
                <div class="list-container"><ul id="clients-list"></ul></div>
                <div id="client-details" class="details-panel hidden"></div>
                <form id="client-form"></form>
            </div>
            <div class="column">
                <h2>Автомобили</h2>
                <div id="cars-section" class="hidden">
                    <div class="column-controls"><input type="search" id="car-search" placeholder="Поиск по марке, модели, VIN..."></div>
                    <div class="list-container"><ul id="cars-list"></ul></div>
                    <div id="car-details" class="details-panel hidden"></div>
                    <form id="car-form"></form>
                </div>
            </div>
            <div class="column">
                <h2>Заказы</h2>
                <div id="orders-section" class="hidden">
                    <div class="column-controls">
                        <input type="search" id="order-search" placeholder="Поиск в заказах...">
                        <select id="order-filter"></select>
                        <select id="order-sort"></select>
                    </div>
                    <div class="list-container"><ul id="orders-list"></ul></div>
                    <form id="order-form"></form>
                </div>
            </div>
        </div>`;

    // --- HTML для страницы "Склад" ---
    views.inventory.innerHTML = `
        <h2 class="view-title">Склад запчастей</h2>
        <div id="inventory-view-grid">
            <div class="card">
                <h3 id="inventory-form-title">Добавить запчасть</h3>
                <form id="inventory-form">
                    <input type="text" id="part-name" placeholder="Название" required>
                    <input type="text" id="part-article" placeholder="Артикул (уникальный)">
                    <input type="number" id="part-quantity" placeholder="Количество на складе" required min="0">
                    <input type="number" id="part-price" placeholder="Цена закупки, ₽" required min="0" step="0.01">
                    <div class="form-buttons">
                        <button type="submit" class="submit-btn" id="part-submit-btn">Добавить</button>
                        <button type="button" class="cancel-btn hidden" data-action="cancel-edit">Отмена</button>
                    </div>
                </form>
            </div>
            <div class="card">
                <h3>Список запчастей</h3>
                <input type="search" id="inventory-search" placeholder="Поиск по названию или артикулу...">
                <div class="list-container" style="max-height: 65vh;">
                    <ul id="inventory-list"></ul>
                </div>
            </div>
        </div>`;

    // --- HTML для страницы "Отчеты" ---
    views.reports.innerHTML = `
        <h2 class="view-title">Отчеты</h2>
        <div id="report-controls" class="card">
            <label>С:</label><input type="date" id="report-date-from">
            <label>По:</label><input type="date" id="report-date-to">
            <button class="submit-btn" data-action="generate-report">Сформировать отчет по выручке</button>
        </div>
        <div id="report-results" class="card hidden"></div>`;
    
    // --- HTML для форм внутри "Рабочей области" ---
    setupWorkspaceForms();
}

/**
 * Вспомогательная функция для генерации HTML-кода форм на странице "Заказы".
 */
function setupWorkspaceForms() {
    document.getElementById('client-form').innerHTML = `<h3 id="client-form-title">Добавить клиента</h3><input type="text" id="client-fio" placeholder="ФИО" required><input type="tel" id="client-phone" placeholder="Телефон" required><input type="email" id="client-email" placeholder="Email"><div class="form-buttons"><button type="submit" class="submit-btn" id="client-submit-btn">OK</button><button type="button" class="cancel-btn hidden" data-action="cancel-edit">Отмена</button></div>`;
    document.getElementById('car-form').innerHTML = `<h3 id="car-form-title">Добавить авто</h3><input type="text" id="car-brand" placeholder="Марка" required><input type="text" id="car-model" placeholder="Модель" required><input type="text" id="car-vin" placeholder="VIN" required><div class="form-buttons"><button type="submit" class="submit-btn" id="car-submit-btn">OK</button><button type="button" class="cancel-btn hidden" data-action="cancel-edit">Отмена</button></div>`;
    document.getElementById('order-form').innerHTML = `<h3 id="order-form-title">Добавить заказ</h3><input type="text" id="order-description" placeholder="Описание работ" required><input type="number" id="order-labor-cost" placeholder="Стоимость работ, ₽" min="0" step="0.01"><select id="order-status"></select><div id="order-parts-management"><h4>Запчасти</h4><div style="display:flex; gap: 5px;"><select id="order-part-select" style="flex-grow:1;"></select><input type="number" id="order-part-quantity" placeholder="Кол-во" min="1" value="1" style="width: 70px;"><button type="button" data-action="add-part-to-order">+</button></div><ul id="order-parts-list"></ul></div><div class="form-buttons"><button type="submit" class="submit-btn" id="order-submit-btn">OK</button><button type="button" class="cancel-btn hidden" data-action="cancel-edit">Отмена</button></div>`;
    document.getElementById('order-filter').innerHTML = `<option value="all">Все статусы</option><option value="Новый">Новый</option><option value="В работе">В работе</option><option value="Готов">Готов</option><option value="Выдан">Выдан</option>`;
    document.getElementById('order-sort').innerHTML = `<option value="date_desc">Сначала новые</option><option value="date_asc">Сначала старые</option><option value="cost_desc">Сначала дорогие</option><option value="cost_asc">Сначала дешевые</option>`;
    document.getElementById('order-status').innerHTML = `<option value="Новый">Новый</option><option value="В работе">В работе</option><option value="Готов">Готов</option><option value="Выдан">Выдан</option>`;
}

// --- Функции управления видимостью ---
export function showView(viewKey) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    Object.values(navButtons).forEach(b => b.classList.remove('active'));
    if (views[viewKey]) views[viewKey].classList.remove('hidden');
    if (navButtons[viewKey]) navButtons[viewKey].classList.add('active');
}
export function hideLoginScreen() { document.getElementById('login-screen').classList.add('hidden'); }
export function showAppContainer() { document.getElementById('app-container').classList.remove('hidden'); }
export function showLoginError(message) { document.getElementById('login-error').textContent = message; }

// --- Функции отрисовки (Render) ---
export function fullRender() {
    renderClientsList();
    renderCarsList();
    renderOrdersList();
    document.getElementById('cars-section').classList.toggle('hidden', !state.state.selectedClientId);
    document.getElementById('orders-section').classList.toggle('hidden', !state.state.selectedCarId);
}
export function renderClientsList() { /* ... код из предыдущего ответа ... */ }
export function renderClientDetails() { /* ... код из предыдущего ответа ... */ }
export function renderCarsList() { /* ... код из предыдущего ответа ... */ }
export function renderCarDetails() { /* ... код из предыдущего ответа ... */ }
export function renderOrdersList() { /* ... код из предыдущего ответа ... */ }
export function renderInventoryView() { /* ... код из предыдущего ответа ... */ }
export function renderReportsView() { /* ... код из предыдущего ответа ... */ }
export function renderDashboard() { /* ... код из предыдущего ответа ... */ }
export function renderOrderFormParts() { /* ... код из предыдущего ответа ... */ }

// --- Функции для работы с формами ---

/**
 * Заполняет форму данными существующей записи для редактирования.
 * @param {string} type - Тип сущности ('client', 'car', 'part', 'order').
 * @param {number} id - ID записи.
 */
export function populateFormForEdit(type, id) {
    resetAllForms();
    const tableName = type === 'part' ? 'inventory' : `${type}s`;
    const form = document.getElementById(`${type === 'part' ? 'inventory' : type}-form`);
    const formTitle = document.getElementById(`${type === 'part' ? 'inventory' : type}-form-title`);
    const submitBtn = form.querySelector('.submit-btn');
    const cancelBtn = form.querySelector('.cancel-btn');

    formTitle.textContent = `Редактировать ${type}`;
    submitBtn.textContent = 'Сохранить';
    cancelBtn.classList.remove('hidden');

    const data = getData(state.state.db, `SELECT * FROM ${tableName} WHERE id=?`, [id])[0];
    if (!data) return;

    switch (type) {
        case 'client':
            document.getElementById('client-fio').value = data.fio;
            document.getElementById('client-phone').value = data.phone;
            document.getElementById('client-email').value = data.email || '';
            break;
        case 'car':
            document.getElementById('car-brand').value = data.brand;
            document.getElementById('car-model').value = data.model;
            document.getElementById('car-vin').value = data.vin;
            break;
        case 'part':
            document.getElementById('part-name').value = data.name;
            document.getElementById('part-article').value = data.article || '';
            document.getElementById('part-quantity').value = data.quantity;
            document.getElementById('part-price').value = data.price;
            break;
        case 'order':
            document.getElementById('order-description').value = data.description;
            document.getElementById('order-labor-cost').value = data.labor_cost || '';
            document.getElementById('order-status').value = data.status;
            // Загружаем запчасти для этого заказа
            const partsInOrder = getData(state.state.db, 
                "SELECT i.id, i.name, op.quantity, op.price_at_sale as price FROM order_parts op JOIN inventory i ON op.part_id = i.id WHERE op.order_id = ?", 
                [id]
            );
            state.state.currentOrderParts = partsInOrder;
            renderOrderFormParts();
            break;
    }
}

/**
 * Сбрасывает все формы в приложении в состояние "Добавление".
 */
export function resetAllForms() {
    ['client', 'car', 'order', 'inventory'].forEach(type => {
        const form = document.getElementById(`${type}-form`);
        if (form) {
            form.reset();
            const titleId = `${type === 'inventory' ? 'inventory' : type}-form-title`;
            const title = document.getElementById(titleId);
            if(title) title.textContent = type === 'inventory' ? 'Добавить запчасть' : `Добавить ${type}`;
            const submitBtn = form.querySelector('.submit-btn');
            if(submitBtn) submitBtn.textContent = 'OK';
            const cancelBtn = form.querySelector('.cancel-btn');
            if(cancelBtn) cancelBtn.classList.add('hidden');
        }
    });
    state.clearCurrentOrderParts();
    if(document.getElementById('order-parts-list')) renderOrderFormParts();
}

/**
 * Собирает данные из формы клиента.
 * @returns {object} - Объект с данными клиента.
 */
export function getClientFormData() {
    return {
        id: state.state.editingClientId,
        fio: document.getElementById('client-fio').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        email: document.getElementById('client-email').value.trim()
    };
}

/**
 * Собирает данные из формы автомобиля.
 * @returns {object} - Объект с данными автомобиля.
 */
export function getCarFormData() {
    return {
        id: state.state.editingCarId,
        client_id: state.state.selectedClientId,
        brand: document.getElementById('car-brand').value.trim(),
        model: document.getElementById('car-model').value.trim(),
        vin: document.getElementById('car-vin').value.trim()
    };
}

/**
 * Собирает данные из формы заказа (без запчастей).
 * @returns {object} - Объект с данными заказа.
 */
export function getOrderFormData() {
    return {
        id: state.state.editingOrderId,
        car_id: state.state.selectedCarId,
        description: document.getElementById('order-description').value.trim(),
        labor_cost: parseFloat(document.getElementById('order-labor-cost').value) || 0,
        status: document.getElementById('order-status').value
    };
}

/**
 * Собирает данные из формы запчасти.
 * @returns {object} - Объект с данными запчасти.
 */
export function getInventoryFormData() {
    return {
        id: state.state.editingPartId,
        name: document.getElementById('part-name').value.trim(),
        article: document.getElementById('part-article').value.trim() || null,
        quantity: parseInt(document.getElementById('part-quantity').value),
        price: parseFloat(document.getElementById('part-price').value)
    };
}

// --- Функции для уведомлений и печати ---

/**
 * Показывает временное уведомление в углу экрана.
 * @param {string} message - Текст сообщения.
 * @param {'success'|'error'} type - Тип уведомления.
 */
export function showAlert(message, type = 'success') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert-box ${type}`;
    alertBox.textContent = message;
    
    Object.assign(alertBox.style, {
        position: 'fixed', bottom: '20px', right: '20px', padding: '15px 20px',
        borderRadius: '5px', color: 'white',
        backgroundColor: type === 'success' ? '#28a745' : '#dc3545',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: '2000',
        opacity: '0', transition: 'opacity 0.5s'
    });
    
    document.body.appendChild(alertBox);
    setTimeout(() => { alertBox.style.opacity = '1'; }, 10);
    setTimeout(() => {
        alertBox.style.opacity = '0';
        setTimeout(() => { alertBox.remove(); }, 500);
    }, 3000);
}

/**
 * Формирует и выводит на печать заказ-наряд для выбранного автомобиля.
 */
export function printWorkOrder() {
    if (!state.state.selectedCarId) return;

    try {
        const client = getData(state.state.db, "SELECT cl.* FROM clients cl JOIN cars c ON cl.id = c.client_id WHERE c.id = ?", [state.state.selectedCarId])[0];
        const car = getData(state.state.db, "SELECT * FROM cars WHERE id = ?", [state.state.selectedCarId])[0];
        
        const ordersQuery = `
            SELECT o.id, o.description, o.status, o.labor_cost, strftime('%d.%m.%Y', o.created_at) as date
            FROM orders o
            WHERE o.car_id = ? ORDER BY o.created_at DESC`;
        const orders = getData(state.state.db, ordersQuery, [state.state.selectedCarId]);

        let ordersHtml = '<h3>Выполненные работы и запчасти</h3>';
        let grandTotal = 0;

        orders.forEach(order => {
            const parts = getData(state.state.db, "SELECT i.name, op.quantity, op.price_at_sale FROM order_parts op JOIN inventory i ON op.part_id = i.id WHERE op.order_id = ?", [order.id]);
            let partsHtml = '';
            let partsCost = 0;
            if (parts.length > 0) {
                partsHtml = '<ul>';
                parts.forEach(p => {
                    partsHtml += `<li>${p.name} - ${p.quantity} шт. x ${p.price_at_sale.toFixed(2)} ₽</li>`;
                    partsCost += p.quantity * p.price_at_sale;
                });
                partsHtml += '</ul>';
            }
            const orderTotal = (order.labor_cost || 0) + partsCost;
            grandTotal += orderTotal;

            ordersHtml += `
                <div class="print-order-item">
                    <h4>Заказ от ${order.date} (Статус: ${order.status})</h4>
                    <p><strong>Описание работ:</strong> ${order.description}</p>
                    <p><strong>Стоимость работ:</strong> ${order.labor_cost.toFixed(2)} ₽</p>
                    <p><strong>Запчасти:</strong></p>
                    ${parts.length > 0 ? partsHtml : '<p>Без запчастей</p>'}
                    <p><strong>Сумма по заказу: ${orderTotal.toFixed(2)} ₽</strong></p>
                </div>
                <hr>`;
        });

        const printContent = `
            <h1>Заказ-наряд от ${new Date().toLocaleDateString()}</h1>
            <hr>
            <h2>Информация о клиенте</h2>
            <p><strong>ФИО:</strong> ${client.fio}</p>
            <p><strong>Телефон:</strong> ${client.phone}</p>
            <p><strong>Email:</strong> ${client.email || 'Не указан'}</p>
            <hr>
            <h2>Информация об автомобиле</h2>
            <p><strong>Марка/Модель:</strong> ${car.brand} ${car.model}</p>
            <p><strong>VIN:</strong> ${car.vin}</p>
            <hr>
            ${ordersHtml}
            <h2 style="text-align: right;">Итого по всем заказам: ${grandTotal.toFixed(2)} ₽</h2>
            <br><br>
            <p>Подпись клиента: _______________________</p>
            <p>Подпись мастера: _______________________</p>
        `;
        
        document.getElementById('print-area').innerHTML = printContent;
        window.print();
    } catch (e) {
        console.error("Ошибка подготовки к печати:", e);
        showAlert("Не удалось сформировать заказ-наряд для печати.", 'error');
    }
}