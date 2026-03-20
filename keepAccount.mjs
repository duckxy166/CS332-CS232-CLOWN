import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

// --- ใส่ Table Name ที่สร้างไว้ใน DynamoDB กับ UserPool ID ของ Cognito ที่สร้างไว้
const TABLE_NAME = "User"; 
const USER_POOL_ID = "us-east-1_xxxxxxxxx"; 
// -------------------------

export const handler = async (event) => {
    try {
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        console.log(`กำลังอ่านไฟล์ ${key} จาก S3 Bucket: ${bucket}`);

        const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const csvString = await Body.transformToString();

        const lines = csvString.split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            return { statusCode: 200, body: 'Empty file' };
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const idxUserID = headers.indexOf('userid'); 
        const idxClassID = headers.indexOf('classid');
        const idxSection = headers.indexOf('section');
        const idxEmail = headers.indexOf('email');
        const idxRole = headers.indexOf('role');

        if ([idxClassID, idxSection, idxEmail, idxRole].includes(-1)) {
             throw new Error(`CSV ขาดคอลัมน์ที่จำเป็น (ต้องมี classID, section, email, Role)`);
        }

        for (let i = 1; i < lines.length; i++) { 
            const currentline = lines[i].split(',');
            
            if (currentline.length >= 4) {
                
                const userEmail = currentline[idxEmail] ? currentline[idxEmail].trim() : "";
                const userRole = currentline[idxRole] ? currentline[idxRole].trim() : "Student";
                
                // 1. ดึง UserID (ถ้าในไฟล์ CSV มีและไม่ว่าง)
                let rawUserID = "";
                if (idxUserID !== -1 && currentline[idxUserID]) {
                    rawUserID = currentline[idxUserID].trim();
                }

                // 2. ถ้าไม่มี UserID (หรือเว้นว่างมา)
                if (!rawUserID) {
                    if (userRole.toLowerCase() === 'ta') {
                        // ถ้าเป็น TA -> สุ่มให้
                        const uniqueNumber = Math.floor(10000 + Math.random() * 90000) + Date.now().toString().slice(-2);
                        rawUserID = "TA-" + uniqueNumber; 
                    } else {
                        // 
                        console.error(`ข้ามบรรทัดที่ ${i + 1}: อีเมล ${userEmail} เป็น Student แต่ไม่มี UserID (รหัสนักศึกษา)`);
                        continue; 
                    }
                }

                const user = {
                    UserID: rawUserID,
                    classID: currentline[idxClassID] ? currentline[idxClassID].trim() : "",
                    section: currentline[idxSection] ? currentline[idxSection].trim() : "",
                    email: userEmail,
                    Role: userRole
                };

                // ส่งไปให้ DynamoDB
                const dynamoParams = {
                    TableName: TABLE_NAME,
                    Item: {
                        email: user.email,       
                        classID: user.classID,   
                        UserID: user.UserID,
                        section: user.section,
                        Role: user.Role
                    }
                };
                await dynamoDb.send(new PutCommand(dynamoParams));

                // ส่งไปให้ Cognito
                const cognitoParams = {
                    UserPoolId: USER_POOL_ID,
                    Username: user.email,
                    UserAttributes: [
                        { Name: "email", Value: user.email },
                        { Name: "email_verified", Value: "true" },
                        { Name: "custom:role", Value: user.Role } 
                    ],
                    DesiredDeliveryMediums: ["EMAIL"],
                };

                try {
                    await cognitoClient.send(new AdminCreateUserCommand(cognitoParams));
                    console.log(`สร้างบัญชีสำเร็จ: ${user.email}`);
                } catch (error) {
                    if (error.name === 'UsernameExistsException') {
                        console.log(`บัญชี ${user.email} มีอยู่แล้ว (อัปเดตข้อมูลวิชาเรียบร้อย)`);
                    } else {
                        console.error(`Error สร้างบัญชี ${user.email}:`, error);
                    }
                }
            }
        }
        
        console.log("=== ประมวลผลไฟล์ CSV เสร็จสมบูรณ์ ===");
        return { statusCode: 200, body: 'Success' };

    } catch (error) {
        console.error("เกิดข้อผิดพลาดหลัก:", error);
        throw error;
    }
};
