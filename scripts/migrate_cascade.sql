-- Run this on your PostgreSQL database to add ON DELETE CASCADE to existing FK constraints
-- This allows deleting a user to automatically delete all related data
--
-- Usage: psql -U your_user -d your_db -f scripts/migrate_cascade.sql

-- To promote a user to SUPERADMIN (replace with your email):
-- UPDATE users SET role = 'SUPERADMIN' WHERE email = 'your@email.com';

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey,
  ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey,
  ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey,
  ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_user_id_fkey,
  ADD CONSTRAINT quotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_client_id_fkey,
  ADD CONSTRAINT quotations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE payment_settings DROP CONSTRAINT IF EXISTS payment_settings_user_id_fkey,
  ADD CONSTRAINT payment_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey,
  ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_invoice_id_fkey,
  ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
