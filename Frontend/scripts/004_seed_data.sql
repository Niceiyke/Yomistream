-- Insert sample preachers
INSERT INTO public.preachers (id, name, bio, image_url) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'John MacArthur', 'Pastor-teacher of Grace Community Church and featured teacher with Grace to You ministry.', '/pastor-john-macarthur.jpg'),
  ('550e8400-e29b-41d4-a716-446655440002', 'R.C. Sproul', 'Founder of Ligonier Ministries and renowned Reformed theologian.', '/pastor-rc-sproul.jpg'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Charles Spurgeon', 'The Prince of Preachers, influential Baptist minister of the 19th century.', '/pastor-charles-spurgeon.jpg')
ON CONFLICT (id) DO NOTHING;

-- Insert sample videos
INSERT INTO public.videos (title, description, youtube_id, preacher_id, topic, duration, thumbnail_url) VALUES
  ('The Gospel of Grace', 'Understanding God''s amazing grace through Christ', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440001', 'Grace', 1800, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'),
  ('Faith and Works', 'The relationship between faith and good works in the Christian life', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440001', 'Faith', 2100, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'),
  ('The Holiness of God', 'Understanding the character and nature of our holy God', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440002', 'Holiness', 2400, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'),
  ('Chosen by God', 'The doctrine of election and God''s sovereign choice', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440002', 'Election', 2700, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'),
  ('Morning and Evening Devotions', 'Daily encouragement from the Word of God', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440003', 'Devotion', 1500, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'),
  ('The Sinner''s Friend', 'Christ as the friend of sinners and our great salvation', 'dQw4w9WgXcQ', '550e8400-e29b-41d4-a716-446655440003', 'Salvation', 1950, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
ON CONFLICT (youtube_id) DO NOTHING;
