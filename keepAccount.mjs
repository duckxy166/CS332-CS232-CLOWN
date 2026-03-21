import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const s3 = new S3Client({});
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognitoClient = new CognitoIdentityProviderClient({});

// --- ใส่ Table Name กับ User Pool ID ที่สร้างไว้ตรงนี้ ---
const TABLE_USER = "User";         // ตารางเช็ครหัสซ้ำ (PK: UserID)
const TABLE_ROSTER = "ClassRoster"; // ตารางเก็บวิชาเรียน (PK: email, SK: classID)
const USER_POOL_ID = "us-east-1_6hK8DBK6W"; // ใส่ User Pool ID 

export const handler = async (event) => {
    try {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
        console.log(`กำลังประมวลผลไฟล์: ${key}`);

        const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const lines = (await Body.transformToString()).split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) return { statusCode: 200, body: 'Empty file' };

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const [idxUserID, idxClassID, idxSection, idxEmail, idxRole] = ['userid', 'classid', 'section', 'email', 'role'].map(h => headers.indexOf(h));

        for (let i = 1; i < lines.length; i++) { 
            const currentline = lines[i].split(',');
            if (currentline.length < 4) continue;

            const userEmail = currentline[idxEmail]?.trim() || "";
            const userRole = currentline[idxRole]?.trim() || "Student";
            let rawUserID = (idxUserID !== -1 && currentline[idxUserID]) ? currentline[idxUserID].trim() : "";

            // จัดการกรณีเป็น TA แต่ไม่มี UserID
            if (!rawUserID) {
                if (userRole.toLowerCase() === 'ta') {
                    rawUserID = "TA-" + (Math.floor(10000 + Math.random() * 90000) + Date.now().toString().slice(-2));
                } else {
                    continue; 
                }
            }

            //ส่วนที่ส่งให้ Table User
            try {
                await dynamoDb.send(new PutCommand({
                    TableName: TABLE_USER,
                    Item: { UserID: rawUserID, email: userEmail, Role: userRole },
                    // กฎเหล็ก: ยอมให้บันทึกก็ต่อเมื่อรหัสนี้ยังว่าง หรือเป็นอีเมลเดิม
                    ConditionExpression: "attribute_not_exists(UserID) OR email = :email",
                    ExpressionAttributeValues: { ":email": userEmail }
                }));
            } catch (error) {
                if (error.name === 'ConditionalCheckFailedException') {
                    console.error(`ทิ้งบรรทัดที่ ${i + 1}: รหัส ${rawUserID} ถูกใช้ผูกกับอีเมลอื่นไปแล้ว!`);
                    continue; //ข้ามบรรทัดนี้ ไม่ไปต่อ
                }
                throw error;
            }

            //ส่วนที่ส่งให้ Table ClassRoster
            await dynamoDb.send(new PutCommand({
                TableName: TABLE_ROSTER,
                Item: { 
                    email: userEmail, 
                    classID: currentline[idxClassID]?.trim(), 
                    UserID: rawUserID, 
                    section: currentline[idxSection]?.trim() 
                }
            }));

            //ส่วนที่ส่งให้ Cognito
            try {
                await cognitoClient.send(new AdminCreateUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: rawUserID, 
                    UserAttributes: [
                        { Name: "email", Value: userEmail },
                        { Name: "email_verified", Value: "true" }, //เสกให้ verify มาแล้ว
                        { Name: "custom:role", Value: userRole }
                    ],
                    TemporaryPassword: `test1234`, // ตั้งรหัสผ่านแรกเข้า 
                    MessageAction: "SUPPRESS" 
                }));
                console.log(`สร้างบัญชีสำเร็จ: ไอดี ${rawUserID} (รหัสผ่าน: test1234`);
                
            } catch (error) {
                if (error.name === 'UsernameExistsException') {
                    console.log(`เลขไอดี ${rawUserID} มีบัญชีอยู่แล้ว (อัปเดตวิชาเรียนเรียบร้อย)`);
                } else if (error.name === 'AliasExistsException' || (error.message && error.message.includes('email already exists'))) {
                    // เคสแอดมินใส่อีเมลซ้ำให้เด็ก 2 คน (กรณีเปิดตั้งค่า Email Alias ไว้)
                    console.error(`ข้ามการสร้างบัญชีให้ ${rawUserID}: อีเมล ${userEmail} นี้มีคนอื่นใช้ไปแล้ว!`);
                } else {
                    console.error(`Error สร้างบัญชี ${rawUserID}:`, error);
                }
            }
        }
        
        console.log("ประมวลผลไฟล์ CSV เสร็จสมบูรณ์");
        return { statusCode: 200, body: 'Success' };

    } catch (error) {
        console.error("เกิดข้อผิดพลาดหลัก:", error);
        throw error;
    }
};
