// src/events.js
// Этот модуль отвечает за обработку всех действий пользователя.

import * as state from './state.js';
import * as db from './db.js';
import * as ui from './ui.js';

/**
 * Главная функция, которая настраивает все обработчики событий.
 * Вызывается один раз при запуске приложения.
 */
export function setupEventListeners() {
    // 1. Обработчик для формы входа (он должен работать всегда)
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // 2. Навигация по "страницам" приложения
    document.getElementById('nav-dashboard').addEventListener('click', () => handleNavClick('dashboard'));
    document.getElementById('nav-workspace').addEventListener('click', () => handleNavClick('workspace'));
    document.getElementById('nav-inventory').addEventListener('click', () => handleNavClick('inventory'));
    document.getElementById('nav-reports').addEventListener('click', () => handleNavClick('reports'));

    // 3. Сохранение и загрузка базы данных
    document.getElementById('save-db').addEventListener('click', handleSaveDb);
    document.getElementById('load-db-input').addEventListener('change', handleLoadDb);

    // 4. Делегирование событий для динамического контента (клики)
    // Один обработчик на все тело документа для отлова кликов по кнопкам и элементам списков
    document.body.addEventListener('click', handleBodyClick);

    // 5. Делегирование событий для отправки форм
    document.body.addEventListener('submit', handleBodySubmit);

    // 6. Делегирование для полей ввода (поиск)
    document.body.addEventListener('input', handleBodyInput);
}

/**
 * Обрабатывает успешный вход в систему и инициализирует основное приложение.
 * @param {Event} e - Событие отправки формы.
 */
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;

    if (user === 'admin' && pass === 'admin') {
        ui.hideLoginScreen();
        ui.showAppContainer();
        
        try {
            const database = await db.initDB();
            state.setDb(database);
            ui.setupViews(); // Создаем HTML-структуру для всех страниц
            handleNavClick('dashboard'); // Показываем первую страницу
        } catch (err) {
            console.error("Критическая ошибка инициализации БД:", err);
            alert("Не удалось запустить базу данных. Приложение не может работать.");
        }
    } else {
        ui.showLoginError('Неверный логин или пароль');
    }
}

/**
 * Обрабатывает клики по кнопкам навигации.
 * @param {string} viewKey - Ключ страницы для отображения ('dashboard', 'workspace', etc.).
 */
function handleNavClick(viewKey) {
    ui.showView(viewKey);
    const renderFunction = {
        'dashboard': ui.renderDashboard,
        'workspace': ui.fullRender,
        'inventory': ui.renderInventoryView,
        'reports': ui.renderReportsView,
    }[viewKey];
    
    if (renderFunction) {
        renderFunction();
    }
}

/**
 * Главный обработчик кликов, использующий делегирование.
 * @param {Event} e - Событие клика.
 */
function handleBodyClick(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    const li = e.target.closest('li');
    const id = li ? parseInt(li.dataset.id) : null;

    // Используем switch для чистоты кода
    switch (action) {
        // --- Выбор элементов ---
        case 'select-client':
            state.setSelectedClient(id);
            ui.fullRender();
            break;
        case 'select-car':
            state.setSelectedCar(id);
            ui.fullRender();
            break;

        // --- Редактирование ---
        case 'edit-client':
        case 'edit-car':
        case 'edit-order':
        case 'edit-part':
            const type = action.split('-')[1]; // 'client', 'car', 'order', 'part'
            state.setEditing(type, id);
            ui.populateFormForEdit(type, id);
            break;
        
        // --- Удаление ---
        case 'delete-client':
        case 'delete-car':
        case 'delete-order':
        case 'delete-part':
            const deleteType = action.split('-')[1];
            if (confirm(`Вы уверены, что хотите удалить этот элемент?`)) {
                const tableName = deleteType === 'part' ? 'inventory' : `${deleteType}s`;
                try {
                    state.state.db.run(`DELETE FROM ${tableName} WHERE id=?`, [id]);
                    ui.showAlert('Элемент успешно удален.', 'success');
                    // Перерисовываем нужные части интерфейса
                    if (deleteType === 'part') ui.renderInventoryView();
                    else {
                        ui.fullRender();
                        ui.renderDashboard();
                    }
                } catch (err) {
                    ui.showAlert('Не удалось удалить элемент. Возможно, он используется в других записях.', 'error');
                }
            }
            break;

        // --- Логика формы заказа ---
        case 'add-part-to-order':
            e.preventDefault();
            const partSelect = document.getElementById('order-part-select');
            const quantityInput = document.getElementById('order-part-quantity');
            const partId = parseInt(partSelect.value);
            const quantity = parseInt(quantityInput.value);

            if (!partId || !quantity || quantity < 1) return;

            const partData = db.getData(state.state.db, "SELECT * FROM inventory WHERE id=?", [partId])[0];
            if (partData.quantity < quantity) {
                ui.showAlert(`На складе недостаточно "${partData.name}". Осталось: ${partData.quantity} шт.`, 'error');
                return;
            }
            state.addPartToCurrentOrder({ id: partId, name: partData.name, quantity, price: partData.price });
            ui.renderOrderFormParts();
            break;

        case 'remove-part-from-order':
            const partToRemoveId = parseInt(e.target.dataset.partId);
            state.removePartFromCurrentOrder(partToRemoveId);
            ui.renderOrderFormParts();
            break;
        
        // --- Отчеты и печать ---
        case 'generate-report':
            ui.renderFinancialReport();
            break;
        
        case 'print-order':
            ui.printWorkOrder();
            break;
        
        // --- Кнопки "Отмена" в формах ---
        case 'cancel-edit':
            state.resetAllEditing();
            ui.resetAllForms();
            break;
    }
}

/**
 * Главный обработчик отправки форм, использующий делегирование.
 * @param {Event} e - Событие отправки.
 */
function handleBodySubmit(e) {
    e.preventDefault();
    const formId = e.target.id;

    switch (formId) {
        case 'client-form':
            const clientData = ui.getClientFormData();
            if (!clientData.fio || !clientData.phone) { ui.showAlert('ФИО и телефон обязательны.', 'error'); return; }
            db.getData(state.state.db, state.state.editingClientId ? "UPDATE clients SET fio=?, phone=?, email=? WHERE id=?" : "INSERT INTO clients (fio, phone, email) VALUES (?,?,?)", [clientData.fio, clientData.phone, clientData.email, state.state.editingClientId || null]);
            ui.showAlert('Клиент сохранен.', 'success');
            break;
        
        case 'car-form':
            const carData = ui.getCarFormData();
            if (!carData.brand || !carData.model || !carData.vin) { ui.showAlert('Все поля автомобиля обязательны.', 'error'); return; }
            db.getData(state.state.db, state.state.editingCarId ? "UPDATE cars SET brand=?, model=?, vin=? WHERE id=?" : "INSERT INTO cars (client_id, brand, model, vin) VALUES (?,?,?,?)", [state.state.selectedClientId, carData.brand, carData.model, carData.vin, state.state.editingCarId || null]);
            ui.showAlert('Автомобиль сохранен.', 'success');
            break;

        case 'inventory-form':
            const partData = ui.getInventoryFormData();
            if (!partData.name || partData.quantity < 0 || partData.price < 0) { ui.showAlert('Название, количество и цена обязательны.', 'error'); return; }
            try {
                if (state.state.editingPartId) {
                    state.state.db.run("UPDATE inventory SET name=?, article=?, quantity=?, price=? WHERE id=?", [partData.name, partData.article, partData.quantity, partData.price, state.state.editingPartId]);
                } else {
                    state.state.db.run("INSERT INTO inventory (name, article, quantity, price) VALUES (?,?,?,?)", [partData.name, partData.article, partData.quantity, partData.price]);
                }
                ui.showAlert('Запчасть сохранена.', 'success');
                ui.renderInventoryView();
            } catch (err) { ui.showAlert('Ошибка сохранения. Возможно, такой артикул уже существует.', 'error'); }
            break;

        case 'order-form':
            const orderData = ui.getOrderFormData();
            const result = db.saveOrderTransaction(state.state.db, orderData, state.state.currentOrderParts);
            if (result.success) {
                ui.showAlert('Заказ успешно сохранен!', 'success');
            } else {
                ui.showAlert(`Ошибка сохранения заказа: ${result.error}`, 'error');
            }
            break;
    }
    
    // Общие действия после отправки любой формы
    state.resetAllEditing();
    ui.resetAllForms();
    ui.fullRender();
    ui.renderDashboard();
}

/**
 * Обработчик для полей ввода (поиск).
 * @param {Event} e - Событие ввода.
 */
function handleBodyInput(e) {
    const inputId = e.target.id;
    const value = e.target.value;

    switch (inputId) {
        case 'client-search':
            state.state.clientSearchTerm = value;
            ui.renderClientsList();
            break;
        case 'car-search':
            state.state.carSearchTerm = value;
            ui.renderCarsList();
            break;
        case 'order-search':
            state.state.orderSearchTerm = value;
            ui.renderOrdersList();
            break;
        case 'inventory-search':
            state.state.inventorySearchTerm = value;
            ui.renderInventoryList();
            break;
    }
}

/**
 * Обрабатывает сохранение БД в файл.
 */
function handleSaveDb() {
    if (!state.state.db) return;
    const data = state.state.db.export();
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autoservice.db";
    a.click();
    URL.revokeObjectURL(url);
    ui.showAlert('База данных сохранена.', 'success');
}

/**
 * Обрабатывает загрузку БД из файла.
 * @param {Event} e 
 */
function handleLoadDb(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            ui.showAppContainer();
            ui.hideLoginScreen();
            const database = await db.initDB(new Uint8Array(reader.result));
            state.setDb(database);
            ui.setupViews();
            handleNavClick('dashboard');
            ui.showAlert('База данных успешно загружена.', 'success');
        } catch(err) {
            ui.showAlert('Не удалось загрузить файл базы данных. Возможно, он поврежден или имеет неверный формат.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Сбрасываем input
}