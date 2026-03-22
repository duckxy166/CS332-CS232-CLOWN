exports.handler = async (event) => {
    try {
        // Parse the incoming request body
        const body = JSON.parse(event.body || "{}");
        const { username, password } = body;

        // Retrieve Application-Key securely from environment variables
        const applicationKey = process.env.TU_APPLICATION_KEY || 'TU7ba945dfd7eab36cb292085fe2193cf101b2cb94388c2721d105e34eb6df0a7378f327eddfbee7820e251535fbb12593';

        if (!applicationKey) {
            return {
                statusCode: 500,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: 'Server configuration error: Missing TU_APPLICATION_KEY' })
            };
        }

        if (!username || !password) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: 'Username and password are required' })
            };
        }

        // Forward request to TU API
        const response = await fetch('https://restapi.tu.ac.th/api/v1/auth/Ad/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Application-Key': applicationKey
            },
            body: JSON.stringify({
                UserName: username,
                PassWord: password
            })
        });

        const data = await response.json();

        // Return appropriate response based on TU API status
        if (response.ok && data.status) {
            return {
                statusCode: 200,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify(data)
            };
        } else {
            return {
                statusCode: 401,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({
                    message: data.message || 'Invalid username or password',
                    status: false
                })
            };
        }
    } catch (error) {
        console.error('Login Error:', error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }
};
