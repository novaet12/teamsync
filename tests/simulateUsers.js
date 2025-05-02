const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { faker } = require('@faker-js/faker');

const BASE_URL = 'http://localhost:3000/api';
const NUM_USERS = 10;

async function signupUser() {
    const user = {
        email: faker.internet.email(),
        password: 'password123',
        username: faker.internet.userName(),
        role: faker.helpers.arrayElement(['Developer', 'Designer', 'Manager'])
    };
    try {
        const response = await axios.post(`${BASE_URL}/signup`, user);
        console.log(`Signed up ${user.email}`);
        return { user, token: response.data.token, userId: response.data.userId };
    } catch (err) {
        console.error(`Signup error for ${user.email}:`, err.response?.data || err.message);
        return null;
    }
}

async function createRoom(token) {
    try {
        const response = await axios.post(
            `${BASE_URL}/rooms`,
            { name: faker.company.name(), description: faker.lorem.sentence() },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Created room: ${response.data.name}`);
        return response.data._id;
    } catch (err) {
        console.error('Room creation error:', err.response?.data || err.message);
        return null;
    }
}

async function createTask(token, roomId, userId) {
    try {
        const response = await axios.post(
            `${BASE_URL}/rooms/${roomId}/tasks`,
            {
                title: faker.lorem.words(3),
                description: faker.lorem.sentence(),
                status: 'To Do',
                assignedTo: userId
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Created task: ${response.data.title}`);
    } catch (err) {
        console.error('Task creation error:', err.response?.data || err.message);
    }
}

async function sendMessage(token, roomId) {
    try {
        const response = await axios.post(
            `${BASE_URL}/rooms/${roomId}/messages`,
            { content: faker.lorem.sentence() },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Sent message in room ${roomId}`);
    } catch (err) {
        console.error('Message error:', err.response?.data || err.message);
    }
}

async function sendPrivateMessage(token, senderId, recipientId) {
    try {
        const response = await axios.post(
            `${BASE_URL}/private-messages`,
            { recipientId, content: faker.lorem.sentence() },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`Sent private message from ${senderId} to ${recipientId}`);
    } catch (err) {
        console.error('Private message error:', err.response?.data || err.message);
    }
}

async function uploadProfilePicture(token) {
    try {
        const form = new FormData();
        const imagePath = '/home/nahom/test.jpg';
        if (!fs.existsSync(imagePath)) {
            fs.writeFileSync(imagePath, 'test image content');
        }
        form.append('profilePicture', fs.createReadStream(imagePath));
        const response = await axios.post(
            `${BASE_URL}/upload-profile-picture`,
            form,
            { headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` } }
        );
        console.log(`Uploaded profile picture: ${response.data.url}`);
    } catch (err) {
        console.error('Upload error:', err.response?.data || err.message);
    }
}

async function simulateUsers() {
    const users = [];
    for (let i = 0; i < NUM_USERS; i++) {
        const userData = await signupUser();
        if (userData) users.push(userData);
    }

    for (let i = 0; i < users.length; i++) {
        const { user, token, userId } = users[i];
        const roomId = await createRoom(token);
        if (roomId) {
            await createTask(token, roomId, userId);
            await sendMessage(token, roomId);
            if (i + 1 < users.length) {
                const recipientId = users[i + 1].userId;
                await sendPrivateMessage(token, userId, recipientId);
            }
        }
        await uploadProfilePicture(token);
    }
}

simulateUsers().catch(err => {
    console.error('Simulation error:', err);
    process.exit(1);
});