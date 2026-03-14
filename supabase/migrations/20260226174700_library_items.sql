-- Create the Library Items table
create table if not exists public.library_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id), -- Links the item to a specific user/company
  category text not null, -- e.g., 'Substructure', 'Superstructure', 'Finishes'
  description text not null, -- e.g., 'Face brickwork in cement mortar'
  unit text not null, -- e.g., 'm2', 'lin m', 'nr'
  unit_cost numeric not null default 0, -- The cost rate
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint library_items_pkey primary key (id)
);

-- Turn on Row Level Security (RLS) so users only see their own library items
alter table public.library_items enable row level security;

-- Create policy so users can only view and edit their own items
drop policy if exists "Users can manage their own library items" on public.library_items;
create policy "Users can manage their own library items"
  on public.library_items
  for all
  using (auth.uid() = user_id);
