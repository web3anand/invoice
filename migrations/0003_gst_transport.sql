-- GST invoices and transport copies.
--
-- A GST invoice prints as a tax invoice and carries the buyer's GSTIN plus the
-- vehicle used for dispatch. `copy_type` selects the printed copy label:
-- `original` for the recipient, `transport` (duplicate) for the transporter.

alter table documents
  add column if not exists buyer_gstin text not null default '';

alter table documents
  add column if not exists vehicle_number text not null default '';

alter table documents
  add column if not exists copy_type text not null default 'original';
