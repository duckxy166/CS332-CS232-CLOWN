test
keepAccount.mjs = Lambda function code
after create s3bucket
1. create table in dynamoDB
2. name table, partition key = email :string, Sort key = classID :string, other - default then create table
4. create user pool in Cognito, choose SPA, Options for sign-in identifiers check email, uncheck Enable self-registration, select attribute = email then create user pool
6. in nav bar on left go to Sign-up, add custom attributes, Name = role, other = default, save
7. create lambda function, name, node.js 20.x, labrole then create function and copy pastecode in keepAccount.mjs
8. in that lambda function go to config tab set timeout 1m, on left click trigger add your s3 bucket to put .csv in
**Note CSV file must contain header = UserID, Role, email, classID, section
