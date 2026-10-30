import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tables } from '../public/mock/engine.mjs';
test('35-table relational design executes and rejects cross-tenant references and negative stock', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((x) => x.name);
  assert.deepEqual(names, Object.values(tables).flat().sort());
  db.exec("INSERT INTO tenants VALUES ('t1','First','2026-10-30'),('t2','Second','2026-10-30')");
  db.exec(
    "INSERT INTO products(id,tenant_id,sku,name,quantity,price_cents,cost_cents) VALUES ('p1','t1','A-01','Sample',4,100,50)",
  );
  assert.throws(() => db.exec("UPDATE products SET quantity=-1 WHERE id='p1'"), /CHECK/);
  db.exec(
    "INSERT INTO roles VALUES ('r1','ADMIN'); INSERT INTO users(id,tenant_id,email,full_name,role_id) VALUES ('u2','t2','other@example.test','Other','r1'); INSERT INTO sales(id,tenant_id,user_id,number,total_cents,created_at) VALUES ('s2','t2','u2','SO-1',100,'2026-10-30')",
  );
  assert.throws(
    () =>
      db.exec(
        "INSERT INTO sale_lines(id,tenant_id,sale_id,product_id,product_name,quantity,price_cents,cost_cents) VALUES ('l1','t2','s2','p1','Sample',1,100,50)",
      ),
    /FOREIGN KEY/,
  );
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  db.close();
});
