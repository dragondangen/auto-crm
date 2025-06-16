// src/state.js

export const state = {
    db: null,
    // Текущий выбор пользователя
    selectedClientId: null,
    selectedCarId: null,
    
    // Состояния редактирования
    editingClientId: null,
    editingCarId: null,
    editingOrderId: null,
    editingPartId: null,
    
    // Временное хранилище для запчастей в форме заказа
    currentOrderParts: [],
    
    // Состояния поиска и фильтров
    clientSearchTerm: '',
    carSearchTerm: '',
    orderSearchTerm: '',
    inventorySearchTerm: '',
    orderSort: 'date_desc',
    orderFilter: 'all',
};

// Функции для изменения состояния (мутации)
export function setDb(database) {
    state.db = database;
}

export function setSelectedClient(id) {
    state.selectedClientId = id;
    state.selectedCarId = null; // Сброс при смене клиента
    state.editingOrderId = null; // Сброс редактирования заказа
    state.currentOrderParts = []; // Очистка запчастей в форме
}

export function setSelectedCar(id) {
    state.selectedCarId = id;
    state.editingOrderId = null;
    state.currentOrderParts = [];
}

export function setEditing(type, id) {
    state.editingClientId = type === 'client' ? id : null;
    state.editingCarId = type === 'car' ? id : null;
    state.editingOrderId = type === 'order' ? id : null;
    state.editingPartId = type === 'part' ? id : null;
}

export function resetAllEditing() {
    state.editingClientId = null;
    state.editingCarId = null;
    state.editingOrderId = null;
    state.editingPartId = null;
}

export function addPartToCurrentOrder(part) {
    // Проверяем, есть ли уже такая запчасть в заказе
    const existingPart = state.currentOrderParts.find(p => p.id === part.id);
    if (existingPart) {
        existingPart.quantity += part.quantity;
    } else {
        state.currentOrderParts.push(part);
    }
}

export function removePartFromCurrentOrder(partId) {
    state.currentOrderParts = state.currentOrderParts.filter(p => p.id !== partId);
}

export function clearCurrentOrderParts() {
    state.currentOrderParts = [];
}