-- Invoice + quotation workspace.
--
-- One shared workspace (no accounts): documents, saved customers and the
-- letterhead profile all live here. Deployed apps get Neon; the live preview
-- uses the in-process PGLite database with the same schema.
--
-- `updated_at` / `deleted_at` are epoch milliseconds, written by the app so a
-- device's edits win only when they are newer. `deleted_at is not null` means
-- the document sits in Trash and can still be restored.

create table if not exists documents (
  id            text primary key,
  kind          text not null default 'invoice',
  doc_date      text not null default '',
  number        text not null default '',
  customer_id   text not null default '',
  customer_name text not null default '',
  buyer         text not null default '',
  phone         text not null default '',
  state         text not null default '',
  code          text not null default '',
  advance       text not null default '',
  lines         jsonb not null default '[]'::jsonb,
  deleted_at    bigint,
  created_at    timestamptz not null default now(),
  updated_at    bigint not null default 0
);

create index if not exists documents_updated_idx
  on documents (updated_at desc);

create index if not exists documents_trash_idx
  on documents (deleted_at);

create table if not exists customers (
  id         text primary key,
  name       text not null default '',
  address    text not null default '',
  phone      text not null default '',
  state      text not null default '',
  code       text not null default '',
  created_at timestamptz not null default now(),
  updated_at bigint not null default 0
);

create index if not exists customers_name_idx
  on customers (name);

create table if not exists workspace_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at bigint not null default 0
);
