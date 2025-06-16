// src/db.js

export async function initDB(data) {
    const SQL = await initSqlJs({ locateFile: file => `../${file}` });
    const db = data ? new SQL.Database(data) : new SQL.Database();
    db.exec("PRAGMA foreign_keys = ON;");
    if (!data) createTables(db);
    return db;
}

function createTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, fio TEXT NOT NULL, phone TEXT NOT NULL, email TEXT UNIQUE);`);
    db.run(`CREATE TABLE IF NOT EXISTS cars (id INTEGER PRIMARY KEY, client_id INTEGER, brand TEXT NOT NULL, model TEXT NOT NULL, vin TEXT UNIQUE NOT NULL, FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE);`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, car_id INTEGER, description TEXT NOT NULL, labor_cost REAL DEFAULT 0, status TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE);`);
    db.run(`CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, name TEXT NOT NULL, article TEXT UNIQUE, quantity INTEGER NOT NULL, price REAL NOT NULL);`);
    db.run(`CREATE TABLE IF NOT EXISTS order_parts (order_id INTEGER, part_id INTEGER, quantity INTEGER NOT NULL, price_at_sale REAL NOT NULL, PRIMARY KEY(order_id, part_id), FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY(part_id) REFERENCES inventory(id) ON DELETE RESTRICT);`);
}

// Функции-геттеры
export function getData(db, query, params = []) {
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Транзакция для сохранения заказа
export function saveOrderTransaction(db, orderData, parts) {
    try {
        db.exec("BEGIN TRANSACTION;");

        // 1. Сохраняем основной заказ
        let orderId = orderData.id;
        if (orderId) { // Обновление
            db.run("UPDATE orders SET car_id=?, description=?, labor_cost=?, status=? WHERE id=?", [orderData.car_id, orderData.description, orderData.labor_cost, orderData.status, orderId]);
            // Возвращаем старые запчасти на склад и удаляем их из заказа
            const oldParts = getData(db, "SELECT part_id, quantity FROM order_parts WHERE order_id=?", [orderId]);
            oldParts.forEach(p => db.run("UPDATE inventory SET quantity = quantity + ? WHERE id=?", [p.quantity, p.part_id]));
            db.run("DELETE FROM order_parts WHERE order_id=?", [orderId]);
        } else { // Создание
            db.run("INSERT INTO orders (car_id, description, labor_cost, status) VALUES (?,?,?,?)", [orderData.car_id, orderData.description, orderData.labor_cost, orderData.status]);
            orderId = db.exec("SELECT last_insert_rowid();")[0].values[0][0];
        }

        // 2. Добавляем новые запчасти и списываем со склада
        parts.forEach(part => {
            db.run("INSERT INTO order_parts (order_id, part_id, quantity, price_at_sale) VALUES (?,?,?,?)", [orderId, part.id, part.quantity, part.price]);
            db.run("UPDATE inventory SET quantity = quantity - ? WHERE id=?", [part.quantity, part.id]);
        });

        db.exec("COMMIT;");
        return { success: true };
    } catch (e) {
        db.exec("ROLLBACK;");
        console.error("Ошибка транзакции сохранения заказа:", e);
        return { success: false, error: e.message };
    }
}
