with roots as (
  insert into public.categories (name, slug, parent_id) values
    ('零食', 'snacks', null), ('酒水', 'alcohol', null),
    ('饮料', 'drinks', null), ('奶茶', 'milk-tea', null), ('咖啡', 'coffee', null)
  on conflict (slug) do update set name = excluded.name
  returning id, slug
)
insert into public.categories (name, slug, parent_id)
select v.name, v.slug, r.id from roots r
join (values
  ('白酒', 'baijiu', 'alcohol'), ('红酒', 'red-wine', 'alcohol'),
  ('啤酒', 'beer', 'alcohol'), ('黄酒', 'huangjiu', 'alcohol'), ('清酒', 'sake', 'alcohol'),
  ('饼干', 'biscuits', 'snacks'), ('汽水', 'soda', 'drinks'),
  ('珍珠奶茶', 'bubble-tea', 'milk-tea'), ('拿铁', 'latte', 'coffee')
) as v(name, slug, parent_slug) on r.slug = v.parent_slug
on conflict (slug) do nothing;
