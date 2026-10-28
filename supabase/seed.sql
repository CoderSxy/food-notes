insert into public.cuisines (name, slug) values
  ('川菜', 'sichuan'),
  ('粤菜', 'cantonese'),
  ('湘菜', 'hunan'),
  ('江浙菜', 'jiangzhe'),
  ('日料', 'japanese'),
  ('韩料', 'korean'),
  ('西餐', 'western'),
  ('火锅', 'hotpot'),
  ('烧烤', 'bbq'),
  ('小吃', 'snacks')
on conflict (name) do nothing;
