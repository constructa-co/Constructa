-- Create the Templates table (The "Kit" header)
CREATE TABLE public.templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT templates_pkey PRIMARY KEY (id)
);

-- Create the Template Items table (The "Recipe" within the kit)
CREATE TABLE public.template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1, -- Default multiplier for the kit
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT template_items_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

-- Policies for templates
CREATE POLICY "Users can create their own templates" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own templates" ON public.templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for template_items (inherited from template ownership)
CREATE POLICY "Users can manage items in their own templates" ON public.template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.templates
      WHERE templates.id = template_items.template_id
      AND templates.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_templates_user_id ON public.templates(user_id);
CREATE INDEX idx_template_items_template_id ON public.template_items(template_id);
