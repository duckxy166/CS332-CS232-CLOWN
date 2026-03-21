*handling csv file to add account*
1. สร้าง bucket พร้อมตั้งชื่อ　bucket นั้น config อื่นๆตอนสร้างให้ default ได้เลย
2. สร้าง table 2 ตัว ใน dynamoDB, name table1 = ClassRoster, partition key = email :string, Sort key = classID :string, อื่นๆ ให้ default ไปละสร้างตารางได้เลย
3. name Table2 = User, partition key = UserID :string, อื่นๆ ให้ default ไปละสร้างตารางได้เลย
4. create user pool in Cognito, เลือก Single-page application (SPA), Options for sign-in identifiers ติ๊ก email & username, ติ๊กออก Enable self-registration, select required attribute = email แล้วกด create user directory
5. ใน nav bar ด้านซ้ายกด Sign-up, เพิ่ม custom attributes, Name = role, other = default, save 
6. สร้าง lambda function, name, type node.js 20.x, execution role = labrole, กดสร้าง function เลย แล้วก็ copy ＆ pastecode จากไฟล์ keepAccount.mjs　ที่ลงไว้
7. ในแท็บ configuration ของ lambda fuction นั้น set timeout 1m, เมนูด้านซ้ายกด trigger แล้วเพิ่มด้วย s3 bucket ที่สร้างไว้ 
**Note CSV file must contain header = UserID, Role, email, classID, section
