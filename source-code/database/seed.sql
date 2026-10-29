INSERT INTO categories(code,name,description) VALUES
('CAT-SKIN','Chăm sóc da','Sữa rửa mặt, serum, kem dưỡng'),
('CAT-MAKE','Trang điểm','Sản phẩm trang điểm hằng ngày'),
('CAT-HAIR','Chăm sóc tóc','Dầu gội, dầu xả, dưỡng tóc'),
('CAT-BODY','Chăm sóc cơ thể','Sữa tắm và dưỡng thể') ON CONFLICT DO NOTHING;
INSERT INTO brands(code,name,country,website) VALUES
('BR-CERA','CeraVe','Hoa Kỳ','https://www.cerave.com'),
('BR-LOREAL','L’Oréal Paris','Pháp','https://www.loreal-paris.com'),
('BR-SIMPLE','Simple','Vương quốc Anh','https://www.simple.co.uk'),
('BR-ORD','The Ordinary','Canada','https://theordinary.com') ON CONFLICT DO NOTHING;
INSERT INTO suppliers(code,name,contact_name,phone,email,address) VALUES
('SUP-001','Công ty TNHH Mỹ phẩm Á Châu','Nguyễn Minh Anh','0901001001','sales@asia-cosmetic.local','Quận 1, TP. Hồ Chí Minh'),
('SUP-002','Nhà phân phối Beauty Việt','Trần Hải Yến','0902002002','contact@beauty-viet.local','Ninh Kiều, Cần Thơ') ON CONFLICT DO NOTHING;
INSERT INTO products(sku,name,category_id,brand_id,supplier_id,description,volume_label,cost_price,sale_price,reorder_level) VALUES
('CRM-001','Sữa rửa mặt dịu nhẹ 236ml',(SELECT id FROM categories WHERE code='CAT-SKIN'),(SELECT id FROM brands WHERE code='BR-CERA'),(SELECT id FROM suppliers WHERE code='SUP-001'),'Làm sạch dịu nhẹ cho da thường đến da khô','236 ml',145000,189000,5),
('SER-002','Serum Niacinamide 10%',(SELECT id FROM categories WHERE code='CAT-SKIN'),(SELECT id FROM brands WHERE code='BR-ORD'),(SELECT id FROM suppliers WHERE code='SUP-001'),'Serum hỗ trợ cải thiện bề mặt da','30 ml',125000,179000,4),
('MAKE-003','Son dưỡng có màu',(SELECT id FROM categories WHERE code='CAT-MAKE'),(SELECT id FROM brands WHERE code='BR-LOREAL'),(SELECT id FROM suppliers WHERE code='SUP-002'),'Son dưỡng dùng hằng ngày','3.5 g',68000,99000,8),
('HAIR-004','Dầu gội dịu nhẹ',(SELECT id FROM categories WHERE code='CAT-HAIR'),(SELECT id FROM brands WHERE code='BR-SIMPLE'),(SELECT id FROM suppliers WHERE code='SUP-002'),'Dầu gội dùng thường xuyên','400 ml',92000,129000,6)
ON CONFLICT DO NOTHING;
INSERT INTO customers(code,full_name,phone,email,points) VALUES
('CUS-001','Nguyễn Thị Minh','0912345678','minh@example.local',20),
('CUS-002','Trần Gia Hân','0987654321','han@example.local',5) ON CONFLICT DO NOTHING;
INSERT INTO product_batches(product_id,supplier_id,batch_code,manufactured_on,expires_on,received_on,quantity_received,quantity_remaining,unit_cost,note)
SELECT p.id,p.supplier_id,'DEMO-'||p.sku,DATE '2026-01-01',DATE '2028-12-31',CURRENT_DATE,25,25,p.cost_price,'Lô dữ liệu mẫu phục vụ demo đồ án'
FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_batches b WHERE b.product_id=p.id);
