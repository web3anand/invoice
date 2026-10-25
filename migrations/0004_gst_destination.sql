-- The GST tax invoice prints a Destination in its top-right meta block.
-- Existing bills default to a blank value and fall back to the buyer state.

alter table documents
  add column if not exists destination text not null default '';
