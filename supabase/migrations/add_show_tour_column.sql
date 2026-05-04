-- Add show_tour column to control tour display
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_tour BOOLEAN DEFAULT TRUE;

-- Add tour_step column to save tour progress
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tour_step INTEGER DEFAULT 0;

-- Mark existing users as having seen the tour
UPDATE public.profiles SET show_tour = FALSE;
