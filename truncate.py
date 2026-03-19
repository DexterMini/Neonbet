with open(r'c:\Users\volde\Desktop\Casino\casino\services\vip_system.py', encoding='utf-8') as f:
    lines = f.readlines()
with open(r'c:\Users\volde\Desktop\Casino\casino\services\vip_system.py', 'w', encoding='utf-8') as f:
    f.writelines(lines[:675])
print(f"Done, kept {min(675, len(lines))} lines")
