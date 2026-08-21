-- V7: Demo / test users for local development and demo environments.
-- Passwords are bcrypt cost-10 hashes — never stored in plain text.
--
--   admin@healthvault.local   /  Admin@1234
--   demo@healthvault.local    /  Demo@1234
--   patient@healthvault.local /  Patient@1234
--
-- This migration is safe to run in production (hashed passwords, no secrets),
-- but you should remove or disable these accounts before going live.

INSERT INTO healthvault.users (id, full_name, email, password_hash, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'Admin User',
        'admin@healthvault.local',
        '$2a$10$f9cvRr0o.0YIZyr4B4tn4e04wTcbzPdA8YOZnaTuOAeeXqlo.4GaO',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'Demo User',
        'demo@healthvault.local',
        '$2a$10$OBwqJJ4Lw8IcjRr/KaMfeeT3qPn96qnkYWZIQsvEbDNPZsXSQA6OO',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'Patient User',
        'patient@healthvault.local',
        '$2a$10$i1xuDB1fP91/CmffW8BDleJeBvo6m5mVDnos7T.sFizmkS6NOSDqS',
        NOW(),
        NOW()
    )
ON CONFLICT (email) DO NOTHING;
