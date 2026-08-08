-- =========================================================================
-- FortunIQ OS — Seed Data
-- Run this AFTER schema.sql, once, to populate starter data so the app
-- looks identical to the version you saw — except now every row is real
-- and editable.
-- =========================================================================

insert into employees (name, role, dept, type, status, start_date) values
('Thabo Mokoena', 'Chief Operations Officer', 'Operations', 'Employee', 'Active', '2019-03-01'),
('Lerato Ndlovu', 'Tender & Compliance Manager', 'Tenders', 'Employee', 'Active', '2021-06-14'),
('Sipho Khumalo', 'Financial Manager', 'Finance', 'Employee', 'Active', '2020-01-20'),
('Jane Mokoena', 'Fleet & Logistics Supervisor', 'Operations', 'Employee', 'Active', '2022-09-05'),
('Katlego Dube', 'Sales Executive', 'Sales', 'Employee', 'Active', '2023-02-11'),
('Naledi Sithole', 'Intern — Finance', 'Finance', 'Intern', 'Active', '2026-07-01'),
('Mpho Radebe', 'Intern — Operations', 'Operations', 'Intern', 'Onboarding', '2026-08-01'),
('Zanele Mahlangu', 'Intern — Marketing', 'Sales', 'Intern', 'Active', '2026-06-01');

insert into courses (title, category, modules, duration, enrolled, completion) values
('FortunIQ Onboarding', 'Onboarding', 6, '2h 10m', 38, 92),
('POPIA Awareness', 'Compliance', 4, '1h 05m', 38, 78),
('Health & Safety at Depots', 'Compliance', 5, '1h 40m', 22, 65),
('Consultative Selling for Fuel Accounts', 'Sales', 8, '3h 20m', 6, 40),
('Tender Writing Fundamentals', 'Tenders', 5, '2h 00m', 4, 55),
('AI Tools for Everyday Work', 'General', 3, '0h 50m', 30, 34);

insert into learning_paths (title, course_count, for_role) values
('New Intern Onboarding', 4, 'All interns'),
('Sales Executive Path', 5, 'Sales'),
('Depot & Fleet Safety Path', 3, 'Operations'),
('Manager Essentials', 4, 'People Managers');

insert into documents (name, category, version, owner, updated_at) values
('Employee & Intern Handbook', 'Policy', 'v1.0', 'People', '2026-07-26'),
('Advisory Board Confidentiality Agreement', 'Legal', 'v2.0', 'Legal', '2026-07-16'),
('Brand Identity Manual', 'Brand', 'v1.0', 'Marketing', '2026-07-16'),
('B-BBEE Certificate', 'Certificate', '2026', 'Compliance', '2026-02-01'),
('Petroleum Wholesale Licence', 'Licence', 'W/2026/0032', 'Compliance', '2026-01-15'),
('Tax Clearance Certificate', 'Tax', '2026', 'Finance', '2026-03-10'),
('Fleet Insurance Certificate', 'Insurance', '2026', 'Operations', '2026-04-01'),
('SOP — Bulk Fuel Loading Procedure', 'SOP', 'v3.1', 'Operations', '2026-05-20'),
('Company Profile', 'Company Profile', 'v4.0', 'Marketing', '2026-06-01');

insert into tenders (ref, title, closing_date, status, stage, value, compliance) values
('GDOH-2026-114', 'Bulk Diesel Supply — Gauteng Dept. of Health', '2026-08-20', 'Open', 'Drafting response', 4200000, 80),
('TSHW-2026-087', 'Fuel Supply — Tshwane Metro Fleet', '2026-08-12', 'Open', 'Documents review', 2900000, 95),
('SANRAL-2026-033', 'Diesel Supply — Road Maintenance Depots', '2026-09-05', 'Open', 'Registered', 6500000, 40),
('MINE-2026-021', 'On-Site Fuel Supply — Rustenburg Mining Group', '2026-08-30', 'Open', 'AI review complete', 8100000, 88),
('CPT-2025-210', 'Municipal Fleet Fuel Contract', '2025-11-15', 'Awarded', 'Closed — Won', 3400000, 100),
('AGRI-2025-198', 'Seasonal Diesel Supply — Agri Co-op', '2025-09-01', 'Lost', 'Closed — Lost', 1200000, 100);

insert into tender_checklist_items (tender_id, item, done)
select id, item, done from tenders,
  (values
    ('B-BBEE Certificate (valid)', true),
    ('Tax Clearance Certificate', true),
    ('Petroleum Wholesale Licence', true),
    ('Company Registration (CIPC)', true),
    ('Audited Financial Statements (2 years)', true),
    ('Proof of Fleet / Delivery Capacity', false),
    ('References — 3 similar contracts', false),
    ('Signed Declaration of Interest', false)
  ) as checklist(item, done)
where tenders.ref = 'GDOH-2026-114';

insert into tasks (title, due_label, priority, owner) values
('Follow up with Kgomotso Logistics on Q-0412', 'Today', 'High', 'Thabo M.'),
('Submit compliance docs — Tshwane Metro tender', 'Tomorrow', 'High', 'Lerato N.'),
('Review Q3 supplier invoices', 'This week', 'Medium', 'Sipho K.'),
('Onboard new intern — Operations', 'This week', 'Medium', 'Jane M.'),
('Renew fleet insurance — 3 vehicles', '12 Aug', 'Low', 'Finance Team');

insert into notifications (text, type) values
('New tender published: Gauteng Dept. of Health — bulk diesel supply', 'tender'),
('Invoice INV-2451 marked overdue (14 days)', 'finance'),
('Delivery POD confirmed — Riversands Depot, Load #8821', 'operations'),
('3 employees completed "POPIA Awareness" course', 'academy');

insert into fuel_prices (product, price, change) values
('Diesel 50ppm', 25.16, -3.59),
('Petrol 95 (ULP)', 26.10, -1.96),
('Petrol 93 (ULP)', 25.94, -2.01),
('Illuminating Paraffin', 22.18, -6.97);
