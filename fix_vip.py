#!/usr/bin/env python
# Read the file
with open(r'c:\Users\volde\Desktop\Casino\casino\services\vip_system.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the second class VIPService:
count = 0
second_class_line = None
for i, line in enumerate(lines):
    if line.strip().startswith('class VIPService:'):
        count += 1
        if count == 2:
            second_class_line = i
            break

if second_class_line is not None:
    # Keep everything up to (but not including) the second class definition
    new_content = ''.join(lines[:second_class_line])
    
    # Remove excessive trailing newlines but keep one
    new_content = new_content.rstrip() + '\n'
    
    # Write back to file
    with open(r'c:\Users\volde\Desktop\Casino\casino\services\vip_system.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f'File fixed! Removed duplicate class starting at line {second_class_line + 1}')
    print(f'File now ends after line 673')
else:
    print('Second class VIPService not found!')
