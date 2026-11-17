export const categories = [
  { id: 'CPU', name: 'Bộ vi xử lý' }, { id: 'GPU', name: 'Card đồ họa' },
  { id: 'MAINBOARD', name: 'Bo mạch chủ' }, { id: 'RAM', name: 'Bộ nhớ RAM' },
  { id: 'SSD', name: 'Ổ cứng SSD' }, { id: 'PSU', name: 'Nguồn máy tính' },
];
export const products = [
 ['cpu-01','Intel Core i5-14400F','CPU','Intel',4590000,12,'Hiệu năng cân bằng cho gaming và làm việc.',{'Nhân / luồng':'10 / 16','Socket':'LGA1700'}],
 ['cpu-02','AMD Ryzen 7 7800X3D','CPU','AMD',9490000,6,'Bứt phá tốc độ khung hình với bộ nhớ 3D V-Cache.',{'Nhân / luồng':'8 / 16','Socket':'AM5'}],
 ['gpu-01','ASUS Dual GeForce RTX 4060 8GB','GPU','ASUS',8290000,10,'Chơi game Full HD mượt mà với DLSS 3.',{'VRAM':'8GB GDDR6','Giao tiếp':'PCIe 4.0'}],
 ['gpu-02','MSI GeForce RTX 4070 SUPER 12GB','GPU','MSI',17990000,4,'Sức mạnh đồ họa cho trải nghiệm 1440p.',{'VRAM':'12GB GDDR6X','Tản nhiệt':'2 quạt'}],
 ['mainboard-01','MSI PRO B760M-A WIFI DDR5','MAINBOARD','MSI',3690000,8,'Kết nối Wi-Fi và nền tảng DDR5 linh hoạt.',{'Socket':'LGA1700','Kích thước':'Micro ATX'}],
 ['mainboard-02','ASUS TUF GAMING B650-PLUS WIFI','MAINBOARD','ASUS',5590000,7,'Nền tảng AM5 bền bỉ cho bộ máy thế hệ mới.',{'Socket':'AM5','Kích thước':'ATX'}],
 ['ram-01','Kingston FURY Beast 32GB DDR5 6000','RAM','Kingston',2690000,20,'Đa nhiệm thoải mái cùng kit RAM hiệu năng cao.',{'Dung lượng':'2 × 16GB','Tốc độ':'6000 MT/s'}],
 ['ram-02','Corsair Vengeance RGB 32GB DDR5','RAM','Corsair',3190000,9,'Ánh sáng RGB nổi bật cho góc máy cá tính.',{'Dung lượng':'2 × 16GB','Tốc độ':'6000 MT/s'}],
 ['ssd-01','Samsung 990 PRO 1TB NVMe','SSD','Samsung',2590000,15,'Tải game và ứng dụng nhanh chóng.',{'Dung lượng':'1TB','Đọc tối đa':'7450 MB/s'}],
 ['ssd-02','WD Black SN770 1TB NVMe','SSD','Western Digital',1790000,0,'SSD PCIe 4.0 tối ưu cho game thủ.',{'Dung lượng':'1TB','Đọc tối đa':'5150 MB/s'}],
 ['psu-01','Corsair RM750e 750W 80 Plus Gold','PSU','Corsair',2790000,11,'Nguồn modular gọn gàng, vận hành ổn định.',{'Công suất':'750W','Hiệu suất':'80 Plus Gold'}],
 ['psu-02','Cooler Master MWE Gold 850 V2','PSU','Cooler Master',2990000,1,'Dự phòng công suất cho cấu hình mạnh mẽ.',{'Công suất':'850W','Hiệu suất':'80 Plus Gold'}],
] as const;
