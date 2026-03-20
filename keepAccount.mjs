import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

// --- กำหนด ชื่อ Table ใน DynamoDB & UserPool ID ตรงนี้ !!!!!!!!!!!!!!!!!
const TABLE_NAME = "User"; 
const USER_POOL_ID = "us-east-1_zYQ70T0Jc"; 
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
            console.log("ไฟล์ว่างเปล่า หรือมีแค่หัวคอลัมน์");
            return { statusCode: 200, body: 'Empty file' };
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const idxUserID = headers.indexOf('userid');
        const idxClassID = headers.indexOf('classid');
        const idxSection = headers.indexOf('section');
        const idxEmail = headers.indexOf('email');
        const idxRole = headers.indexOf('role');

        if ([idxUserID, idxClassID, idxSection, idxEmail, idxRole].includes(-1)) {
             throw new Error(`CSV ขาดคอลัมน์ที่จำเป็น! : ${headers.join(', ')}`);
        }

        console.log("ตรวจสอบหัวคอลัมน์ผ่าน กำลังเริ่มดึงข้อมูล...");

        // วนลูปอ่านข้อมูลทีละบรรทัด 
        for (let i = 1; i < lines.length; i++) { 
            const currentline = lines[i].split(',');
            
            // เช็คว่าบรรทัดนี้มีข้อมูลครบตามจำนวนหัวคอลัมน์
            if (currentline.length >= 5) {
                
                // ดึงข้อมูลตามตำแหน่งที่หามาได้แบบอัตโนมัติ
                const user = {
                    UserID: currentline[idxUserID].trim(),
                    classID: currentline[idxClassID].trim(),
                    section: currentline[idxSection].trim(),
                    email: currentline[idxEmail].trim(),
                    Role: currentline[idxRole].trim()
                };

                // ใช้ตัวนี้ส่งให้ DynamoDB เก็บ
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

                // สร้าง User ใน Cognito
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
                        console.log(`บัญชี ${user.email} มีอยู่แล้ว (ข้ามการสร้างใหม่)`);
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
