// src/app.js
import { setupEventListeners } from './events.js';

// Это единственное, что делает главный файл -
// запускает настройку обработчиков событий.
// Все остальное будет инициировано после успешного входа.
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});