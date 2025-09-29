-- Add tags column to videos table for AI-generated categorization
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create preacher_favorites table for users to favorite preachers
CREATE TABLE IF NOT EXISTS preacher_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preacher_id UUID NOT NULL REFERENCES preachers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, preacher_id)
);

-- Add RLS policies for preacher_favorites
ALTER TABLE preacher_favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own preacher favorites
CREATE POLICY "Users can view own preacher favorites" ON preacher_favorites
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own preacher favorites
CREATE POLICY "Users can insert own preacher favorites" ON preacher_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preacher favorites
CREATE POLICY "Users can delete own preacher favorites" ON preacher_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_preacher_favorites_user_id ON preacher_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_preacher_favorites_preacher_id ON preacher_favorites(preacher_id);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);

-- Update existing videos with sample tags (AI will generate better ones later)
UPDATE videos SET tags = CASE 
    WHEN topic = 'gospel' THEN '["gospel", "salvation", "grace"]'::jsonb
    WHEN topic = 'theology' THEN '["theology", "doctrine", "biblical-study"]'::jsonb
    WHEN topic = 'faith' THEN '["faith", "trust", "belief"]'::jsonb
    WHEN topic = 'prayer' THEN '["prayer", "intercession", "worship"]'::jsonb
    WHEN topic = 'worship' THEN '["worship", "praise", "music"]'::jsonb
    ELSE '["sermon", "teaching", "christian"]'::jsonb
END
WHERE tags IS NULL OR tags = '[]'::jsonb;
