-- Add sermon notes and scripture references to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS sermon_notes JSONB,
ADD COLUMN IF NOT EXISTS scripture_references JSONB;

-- Create indexes for better performance on JSONB columns
CREATE INDEX IF NOT EXISTS idx_videos_sermon_notes ON public.videos USING GIN (sermon_notes);
CREATE INDEX IF NOT EXISTS idx_videos_scripture_references ON public.videos USING GIN (scripture_references);

-- Update existing videos with sample sermon notes and scripture references
UPDATE public.videos 
SET 
  sermon_notes = jsonb_build_array(
    'God''s love is unconditional and eternal',
    'Faith requires action, not just belief',
    'Prayer is our direct line to God''s heart',
    'Forgiveness transforms both giver and receiver',
    'Hope anchors the soul in difficult times'
  ),
  scripture_references = jsonb_build_array(
    jsonb_build_object('book', 'John', 'chapter', 3, 'verse', 16, 'text', 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.'),
    jsonb_build_object('book', 'Romans', 'chapter', 8, 'verse', 28, 'text', 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.'),
    jsonb_build_object('book', 'Philippians', 'chapter', 4, 'verse', 13, 'text', 'I can do all this through him who gives me strength.')
  )
WHERE sermon_notes IS NULL OR scripture_references IS NULL;
