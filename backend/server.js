const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const secretKey = process.env.JWT_SECRET || 'your-secret-key'; // Use env variable in production

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Multer setup for file uploads
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalName)}`)
});
const upload = multer({ storage });

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/teamsync_db';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

// Schemas
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true },
    profilePicture: { type: String, default: 'https://via.placeholder.com/50' },
    role: { type: String, enum: ['manager', 'member'] },
    referralCode: String,
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
const Room = mongoose.model('Room', roomSchema);

const taskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    completed: { type: Boolean, default: false }
});
const Task = mongoose.model('Task', taskSchema);

const messageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    profilePicture: String,
    pinned: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

const privateMessageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    profilePicture: String,
    pinned: { type: Boolean, default: false }
});
const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        console.warn('No token provided in request');
        return res.status(401).json({ error: 'No token provided' });
    }
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            console.warn('Invalid token:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// API Endpoints
app.post('/api/signup', upload.single('profilePicture'), async (req, res) => {
    const { email, password, username } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/50';
    try {
        if (!email || !password || !username) throw new Error('Email, password, and username are required');
        const existingUser = await User.findOne({ email });
        if (existingUser) throw new Error('Email already in use');
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, username, profilePicture });
        await user.save();
        const token = jwt.sign({ id: user._id, email, username }, secretKey);
        res.json({ message: 'Signup successful', userId: user._id, token });
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).json({ error: err.message || 'Signup failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) throw new Error('Invalid credentials');
        const token = jwt.sign({ id: user._id, email: user.email, username: user.username, role: user.role }, secretKey);
        res.json({ token, role: user.role });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(401).json({ error: err.message || 'Login failed' });
    }
});

app.post('/api/set-role', authenticateToken, async (req, res) => {
    const { role, referralCode } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) throw new Error('User not found');
        if (role === 'manager') {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            user.role = role;
            user.referralCode = code;
            await user.save();
            res.json({ referralCode: code });
        } else if (role === 'member') {
            const manager = await User.findOne({ referralCode });
            if (!manager) throw new Error('Invalid referral code');
            user.role = role;
            user.managerId = manager._id;
            await user.save();
            res.json({ message: 'Role set successfully' });
        } else {
            throw new Error('Invalid role specified');
        }
    } catch (err) {
        console.error('Set role error:', err.message);
        res.status(400).json({ error: err.message || 'Failed to set role' });
    }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
    try {
        const rooms = await Room.find().populate('managerId', 'username');
        res.json(rooms);
    } catch (err) {
        console.error('Fetch rooms error:', err.message);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    const { name } = req.body;
    try {
        if (!name) throw new Error('Room name is required');
        const room = new Room({ name, managerId: req.user.id });
        await room.save();
        res.json({ message: 'Room added', roomId: room._id });
    } catch (err) {
        console.error('Add room error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to add room' });
    }
});

app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    try {
        await Room.findByIdAndDelete(req.params.id);
        await Task.deleteMany({ roomId: req.params.id });
        await Message.deleteMany({ roomId: req.params.id });
        res.json({ message: 'Room removed' });
    } catch (err) {
        console.error('Remove room error:', err.message);
        res.status(500).json({ error: 'Failed to remove room' });
    }
});

app.get('/api/team-members', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const members = await User.find({ role: 'member', managerId: req.user.id });
        res.json(members);
    } catch (err) {
        console.error('Fetch team members error:', err.message);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

app.get('/api/referral-code', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.referralCode) throw new Error('Referral code not found');
        res.json({ referralCode: user.referralCode });
    } catch (err) {
        console.error('Fetch referral code error:', err.message);
        res.status(404).json({ error: err.message || 'Failed to fetch referral code' });
    }
});

app.get('/api/rooms/:roomId/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find({ roomId: req.params.roomId });
        res.json(tasks);
    } catch (err) {
        console.error('Fetch tasks error:', err.message);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.post('/api/rooms/:roomId/tasks', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    const { name } = req.body;
    try {
        if (!name) throw new Error('Task name is required');
        const task = new Task({ name, roomId: req.params.roomId });
        await task.save();
        res.json({ message: 'Task added', taskId: task._id });
    } catch (err) {
        console.error('Add task error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to add task' });
    }
});

app.delete('/api/rooms/:roomId/tasks/:taskId', authenticateToken, async (req, res) => {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Unauthorized' });
    try {
        await Task.findByIdAndDelete(req.params.taskId);
        res.json({ message: 'Task removed' });
    } catch (err) {
        console.error('Remove task error:', err.message);
        res.status(500).json({ error: 'Failed to remove task' });
    }
});

app.put('/api/rooms/:roomId/tasks/:taskId', authenticateToken, async (req, res) => {
    const { completed } = req.body;
    try {
        if (typeof completed !== 'boolean') throw new Error('Completed status must be a boolean');
        await Task.findByIdAndUpdate(req.params.taskId, { completed });
        res.json({ message: 'Task updated' });
    } catch (err) {
        console.error('Update task error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update task' });
    }
});

app.get('/api/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({ roomId: req.params.roomId }).populate('userId', 'username profilePicture');
        res.json(messages);
    } catch (err) {
        console.error('Fetch messages error:', err.message);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    const { content } = req.body;
    try {
        if (!content) throw new Error('Message content is required');
        const user = await User.findById(req.user.id);
        const message = new Message({
            content,
            roomId: req.params.roomId,
            userId: req.user.id,
            username: user.username,
            profilePicture: user.profilePicture
        });
        await message.save();
        res.json({ message: 'Message sent', messageId: message._id });
    } catch (err) {
        console.error('Send message error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to send message' });
    }
});

app.put('/api/rooms/:roomId/messages/:messageId/pin', authenticateToken, async (req, res) => {
    const { pinned } = req.body;
    try {
        if (typeof pinned !== 'boolean') throw new Error('Pinned status must be a boolean');
        await Message.findByIdAndUpdate(req.params.messageId, { pinned });
        res.json({ message: 'Message pin updated' });
    } catch (err) {
        console.error('Pin message error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update pin' });
    }
});

app.get('/api/private-messages/:memberId', authenticateToken, async (req, res) => {
    try {
        const messages = await PrivateMessage.find({
            $or: [
                { senderId: req.user.id, receiverId: req.params.memberId },
                { senderId: req.params.memberId, receiverId: req.user.id }
            ]
        }).populate('senderId', 'username profilePicture');
        res.json(messages);
    } catch (err) {
        console.error('Fetch private messages error:', err.message);
        res.status(500).json({ error: 'Failed to fetch private messages' });
    }
});

app.post('/api/private-messages/:memberId', authenticateToken, async (req, res) => {
    const { content } = req.body;
    try {
        if (!content) throw new Error('Message content is required');
        const user = await User.findById(req.user.id);
        const message = new PrivateMessage({
            content,
            senderId: req.user.id,
            receiverId: req.params.memberId,
            username: user.username,
            profilePicture: user.profilePicture
        });
        await message.save();
        res.json({ message: 'Private message sent', messageId: message._id });
    } catch (err) {
        console.error('Send private message error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to send private message' });
    }
});

app.put('/api/private-messages/:messageId/pin', authenticateToken, async (req, res) => {
    const { pinned } = req.body;
    try {
        if (typeof pinned !== 'boolean') throw new Error('Pinned status must be a boolean');
        await PrivateMessage.findByIdAndUpdate(req.params.messageId, { pinned });
        res.json({ message: 'Private message pin updated' });
    } catch (err) {
        console.error('Pin private message error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update pin' });
    }
});

app.get('/api/list/:collection', authenticateToken, async (req, res) => {
    const collectionName = req.params.collection;
    const validCollections = ['users', 'rooms', 'tasks', 'messages', 'privateMessages'];
    if (!validCollections.includes(collectionName)) {
        console.warn('Invalid collection name:', collectionName);
        return res.status(400).json({ error: 'Invalid collection name' });
    }
    try {
        const Model = {
            users: User,
            rooms: Room,
            tasks: Task,
            messages: Message,
            privateMessages: PrivateMessage
        }[collectionName];
        const data = await Model.find();
        res.json(data);
    } catch (err) {
        console.error(`Fetch ${collectionName} error:`, err.message);
        res.status(500).json({ error: `Failed to fetch ${collectionName}` });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});