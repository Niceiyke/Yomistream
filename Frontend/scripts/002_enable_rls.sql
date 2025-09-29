-- Enable Row Level Security on all tables
ALTER TABLE public.preachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_videos ENABLE ROW LEVEL SECURITY;

-- Preachers policies (public read, no write for regular users)
CREATE POLICY "preachers_select_all" ON public.preachers FOR SELECT USING (true);

-- Videos policies (public read, no write for regular users)
CREATE POLICY "videos_select_all" ON public.videos FOR SELECT USING (true);

-- Profiles policies (users can only access their own profile)
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- User favorites policies (users can only access their own favorites)
CREATE POLICY "user_favorites_select_own" ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_favorites_insert_own" ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_favorites_delete_own" ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);

-- User collections policies (users can only access their own collections)
CREATE POLICY "user_collections_select_own" ON public.user_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_collections_insert_own" ON public.user_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_collections_update_own" ON public.user_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_collections_delete_own" ON public.user_collections FOR DELETE USING (auth.uid() = user_id);

-- Collection videos policies (users can only access videos in their own collections)
CREATE POLICY "collection_videos_select_own" ON public.collection_videos FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_collections 
  WHERE id = collection_id AND user_id = auth.uid()
));

CREATE POLICY "collection_videos_insert_own" ON public.collection_videos FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_collections 
  WHERE id = collection_id AND user_id = auth.uid()
));

CREATE POLICY "collection_videos_delete_own" ON public.collection_videos FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.user_collections 
  WHERE id = collection_id AND user_id = auth.uid()
));
