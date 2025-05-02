console.log('scripts.js loaded');
const token = localStorage.getItem('token');
let currentRoomId = null;
let currentMemberId = null;

function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    } else {
        console.error('Section not found:', sectionId);
        showSection('fallback');
    }
}

function toggleAuth() {
    const isSignup = document.getElementById('auth-title').textContent === 'Sign Up';
    document.getElementById('auth-title').textContent = isSignup ? 'Log In' : 'Sign Up';
    document.getElementById('auth-toggle').innerHTML = isSignup
        ? 'Don’t have an account? <a href="#" onclick="toggleAuth()">Sign Up</a>'
        : 'Already have an account? <a href="#" onclick="toggleAuth()">Log In</a>';
    document.getElementById('username').style.display = isSignup ? 'none' : 'block';
    document.getElementById('profile-picture').style.display = isSignup ? 'none' : 'block';
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    const profilePicture = document.getElementById('profile-picture').files[0];
    const isSignup = document.getElementById('auth-title').textContent === 'Sign Up';

    if (isSignup && profilePicture) {
        if (profilePicture.size > 5 * 1024 * 1024) {
            alert('Profile picture must be less than 5MB');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/gif'].includes(profilePicture.type)) {
            alert('Profile picture must be an image (JPEG, PNG, or GIF)');
            return;
        }
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    if (isSignup) {
        formData.append('username', username);
        if (profilePicture) formData.append('profilePicture', profilePicture);
    }

    const url = isSignup ? '/api/signup' : '/api/login';
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.token) {
            localStorage.setItem('token', data.token);
            showSection(data.role ? (data.role === 'manager' ? 'admin-home-section' : 'member-home-section') : 'role-selection-section');
            if (!data.role) loadRoleSelection();
            else if (data.role === 'manager') loadAdminHome();
            else loadMemberHome();
        } else {
            alert(data.error || 'Authentication failed');
        }
    } catch (err) {
        console.error('Auth error:', err.message);
        alert(`Failed to authenticate: ${err.message}`);
    }
});

function showMemberForm() {
    document.getElementById('member-form').style.display = 'block';
}

async function setRole(role) {
    const referralCode = role === 'member' ? document.getElementById('referral-code').value : null;
    try {
        const response = await fetch('/api/set-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ role, referralCode })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.referralCode) {
            document.getElementById('referral-code-value').textContent = data.referralCode;
            document.getElementById('referral-display').style.display = 'block';
            setTimeout(() => {
                showSection('admin-home-section');
                loadAdminHome();
            }, 2000);
        } else if (data.message) {
            showSection('member-home-section');
            loadMemberHome();
        } else {
            alert(data.error || 'Role selection failed');
        }
    } catch (err) {
        console.error('Set role error:', err.message);
        alert(`Failed to set role: ${err.message}`);
    }
}

async function loadAdminHome() {
    try {
        const [roomsResponse, membersResponse, referralResponse] = await Promise.all([
            fetch('/api/rooms', { headers: { 'Authorization': token } }),
            fetch('/api/team-members', { headers: { 'Authorization': token } }),
            fetch('/api/referral-code', { headers: { 'Authorization': token } })
        ]);
        if (!roomsResponse.ok || !membersResponse.ok || !referralResponse.ok) {
            const errorData = await Promise.all([
                roomsResponse.ok ? {} : roomsResponse.json(),
                membersResponse.ok ? {} : membersResponse.json(),
                referralResponse.ok ? {} : referralResponse.json()
            ]);
            throw new Error(errorData.map(d => d.error).filter(Boolean).join('; ') || 'Failed to fetch admin data');
        }
        const rooms = await roomsResponse.json();
        const members = await membersResponse.json();
        const referral = await referralResponse.json();

        const roomList = document.getElementById('room-list');
        roomList.innerHTML = rooms.length ? '' : '<p>No rooms available.</p>';
        rooms.forEach(room => {
            const item = document.createElement('div');
            item.className = 'room-item';
            item.innerHTML = `
                <span>${room.name}</span>
                <button onclick="removeRoom('${room._id}')">Delete</button>
                <button onclick="loadAdminChat('${room._id}')">Chat</button>
            `;
            roomList.appendChild(item);
        });

        const teamList = document.getElementById('team-members-list');
        teamList.innerHTML = members.length ? '' : '<p>No team members.</p>';
        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'member-item';
            item.innerHTML = `
                <img src="${member.profilePicture}" alt="${member.username}'s profile">
                <span>${member.username}</span>
                <button onclick="loadPrivateChat('${member._id}')">Chat</button>
            `;
            teamList.appendChild(item);
        });

        document.getElementById('admin-referral-code').textContent = referral.referralCode;
    } catch (err) {
        console.error('Load admin home error:', err.message);
        alert(`Failed to load admin dashboard: ${err.message}`);
    }
}

async function addRoom() {
    const name = document.getElementById('room-name').value.trim();
    if (!name) {
        alert('Room name is required');
        return;
    }
    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        document.getElementById('room-name').value = '';
        loadAdminHome();
    } catch (err) {
        console.error('Add room error:', err.message);
        alert(`Failed to add room: ${err.message}`);
    }
}

async function removeRoom(roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        loadAdminHome();
    } catch (err) {
        console.error('Remove room error:', err.message);
        alert(`Failed to remove room: ${err.message}`);
    }
}

async function loadMemberHome() {
    try {
        const response = await fetch('/api/rooms', {
            headers: { 'Authorization': token }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        const rooms = await response.json();
        const roomList = document.getElementById('member-room-list');
        roomList.innerHTML = rooms.length ? '' : '<p>No rooms available.</p>';
        rooms.forEach(room => {
            const item = document.createElement('div');
            item.className = 'room-item';
            item.innerHTML = `
                <span>${room.name}</span>
                <button onclick="loadMemberChat('${room._id}')">Chat</button>
            `;
            roomList.appendChild(item);
        });
    } catch (err) {
        console.error('Load member home error:', err.message);
        alert(`Failed to load member dashboard: ${err.message}`);
    }
}

async function loadAdminChat(roomId) {
    currentRoomId = roomId;
    showSection('admin-chat-section');
    try {
        const [roomResponse, tasksResponse, messagesResponse] = await Promise.all([
            fetch('/api/rooms', { headers: { 'Authorization': token } }),
            fetch(`/api/rooms/${roomId}/tasks`, { headers: { 'Authorization': token } }),
            fetch(`/api/rooms/${roomId}/messages`, { headers: { 'Authorization': token } })
        ]);
        if (!roomResponse.ok || !tasksResponse.ok || !messagesResponse.ok) {
            const errorData = await Promise.all([
                roomResponse.ok ? {} : roomResponse.json(),
                tasksResponse.ok ? {} : tasksResponse.json(),
                messagesResponse.ok ? {} : messagesResponse.json()
            ]);
            throw new Error(errorData.map(d => d.error).filter(Boolean).join('; ') || 'Failed to fetch admin chat data');
        }
        const rooms = await roomResponse.json();
        const tasks = await tasksResponse.json();
        const messages = await messagesResponse.json();

        const room = rooms.find(r => r._id === roomId);
        document.getElementById('admin-chat-title').textContent = room ? room.name : 'Unnamed Room';

        const taskList = document.getElementById('admin-task-list');
        taskList.innerHTML = '<input type="text" id="task-name" placeholder="New Task"><button onclick="addTask()">Add Task</button>';
        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask('${task._id}', this.checked)">
                <label>${task.name}</label>
                <button onclick="removeTask('${task._id}')">Delete</button>
            `;
            taskList.appendChild(item);
        });
        updateProgress('admin', tasks);

        const messagesDiv = document.getElementById('admin-messages');
        messagesDiv.innerHTML = messages.length ? '' : '<p>No messages yet.</p>';
        let currentUserId;
        try {
            const payload = token.split('.')[1];
            if (!payload) throw new Error('Invalid token format');
            currentUserId = JSON.parse(atob(payload)).id;
        } catch (err) {
            console.error('Token parse error:', err.message);
            alert('Invalid token. Please log in again.');
            logout();
            return;
        }
        messages.forEach(msg => {
            const isSent = msg.userId === currentUserId;
            const item = document.createElement('div');
            item.className = `message ${isSent ? 'sent' : 'received'} ${msg.pinned ? 'pinned' : ''}`;
            item.innerHTML = `
                ${!isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
                <div class="user-info">
                    <span class="username">${msg.username}</span>
                    <div class="message-content">${msg.content}</div>
                </div>
                <button class="pin-btn" onclick="pinMessage('${msg._id}', ${!msg.pinned}, 'admin')">${msg.pinned ? 'Unpin' : 'Pin'}</button>
                ${isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
            `;
            messagesDiv.appendChild(item);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) {
        console.error('Load admin chat error:', err.message);
        alert(`Failed to load admin chat: ${err.message}`);
    }
}

async function loadMemberChat(roomId) {
    currentRoomId = roomId;
    showSection('member-chat-section');
    try {
        const [roomResponse, tasksResponse, messagesResponse] = await Promise.all([
            fetch('/api/rooms', { headers: { 'Authorization': token } }),
            fetch(`/api/rooms/${roomId}/tasks`, { headers: { 'Authorization': token } }),
            fetch(`/api/rooms/${roomId}/messages`, { headers: { 'Authorization': token } })
        ]);
        if (!roomResponse.ok || !tasksResponse.ok || !messagesResponse.ok) {
            const errorData = await Promise.all([
                roomResponse.ok ? {} : roomResponse.json(),
                tasksResponse.ok ? {} : tasksResponse.json(),
                messagesResponse.ok ? {} : messagesResponse.json()
            ]);
            throw new Error(errorData.map(d => d.error).filter(Boolean).join('; ') || 'Failed to fetch member chat data');
        }
        const rooms = await roomResponse.json();
        const tasks = await tasksResponse.json();
        const messages = await messagesResponse.json();

        const room = rooms.find(r => r._id === roomId);
        document.getElementById('member-chat-title').textContent = room ? room.name : 'Unnamed Room';

        const taskList = document.getElementById('member-task-list');
        taskList.innerHTML = tasks.length ? '' : '<p>No tasks available.</p>';
        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask('${task._id}', this.checked)">
                <label>${task.name}</label>
            `;
            taskList.appendChild(item);
        });
        updateProgress('member', tasks);

        const messagesDiv = document.getElementById('member-messages');
        messagesDiv.innerHTML = messages.length ? '' : '<p>No messages yet.</p>';
        let currentUserId;
        try {
            const payload = token.split('.')[1];
            if (!payload) throw new Error('Invalid token format');
            currentUserId = JSON.parse(atob(payload)).id;
        } catch (err) {
            console.error('Token parse error:', err.message);
            alert('Invalid token. Please log in again.');
            logout();
            return;
        }
        messages.forEach(msg => {
            const isSent = msg.userId === currentUserId;
            const item = document.createElement('div');
            item.className = `message ${isSent ? 'sent' : 'received'} ${msg.pinned ? 'pinned' : ''}`;
            item.innerHTML = `
                ${!isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
                <div class="user-info">
                    <span class="username">${msg.username}</span>
                    <div class="message-content">${msg.content}</div>
                </div>
                <button class="pin-btn" onclick="pinMessage('${msg._id}', ${!msg.pinned}, 'member')">${msg.pinned ? 'Unpin' : 'Pin'}</button>
                ${isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
            `;
            messagesDiv.appendChild(item);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) {
        console.error('Load member chat error:', err.message);
        alert(`Failed to load member chat: ${err.message}`);
    }
}

async function loadPrivateChat(memberId) {
    currentMemberId = memberId;
    showSection('private-chat-section');
    try {
        const [membersResponse, messagesResponse] = await Promise.all([
            fetch('/api/team-members', { headers: { 'Authorization': token } }),
            fetch(`/api/private-messages/${memberId}`, { headers: { 'Authorization': token } })
        ]);
        if (!membersResponse.ok || !messagesResponse.ok) {
            const errorData = await Promise.all([
                membersResponse.ok ? {} : membersResponse.json(),
                messagesResponse.ok ? {} : messagesResponse.json()
            ]);
            throw new Error(errorData.map(d => d.error).filter(Boolean).join('; ') || 'Failed to fetch private chat data');
        }
        const members = await membersResponse.json();
        const messages = await messagesResponse.json();

        const member = members.find(m => m._id === memberId);
        document.getElementById('private-chat-title').textContent = `Private Chat with ${member ? member.username : 'Unknown Member'}`;

        const messagesDiv = document.getElementById('private-messages');
        messagesDiv.innerHTML = messages.length ? '' : '<p>No messages yet.</p>';
        let currentUserId;
        try {
            const payload = token.split('.')[1];
            if (!payload) throw new Error('Invalid token format');
            currentUserId = JSON.parse(atob(payload)).id;
        } catch (err) {
            console.error('Token parse error:', err.message);
            alert('Invalid token. Please log in again.');
            logout();
            return;
        }
        messages.forEach(msg => {
            const isSent = msg.senderId === currentUserId;
            const item = document.createElement('div');
            item.className = `message ${isSent ? 'sent' : 'received'} ${msg.pinned ? 'pinned' : ''}`;
            item.innerHTML = `
                ${!isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
                <div class="user-info">
                    <span class="username">${msg.username}</span>
                    <div class="message-content">${msg.content}</div>
                </div>
                <button class="pin-btn" onclick="pinMessage('${msg._id}', ${!msg.pinned}, 'private')">${msg.pinned ? 'Unpin' : 'Pin'}</button>
                ${isSent ? `<img src="${msg.profilePicture}" alt="${msg.username}'s profile">` : ''}
            `;
            messagesDiv.appendChild(item);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (err) {
        console.error('Load private chat error:', err.message);
        alert(`Failed to load private chat: ${err.message}`);
    }
}

async function addTask() {
    const name = document.getElementById('task-name').value.trim();
    if (!name || !currentRoomId) {
        alert('Task name and room ID are required');
        return;
    }
    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        document.getElementById('task-name').value = '';
        loadAdminChat(currentRoomId);
    } catch (err) {
        console.error('Add task error:', err.message);
        alert(`Failed to add task: ${err.message}`);
    }
}

async function removeTask(taskId) {
    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        loadAdminChat(currentRoomId);
    } catch (err) {
        console.error('Remove task error:', err.message);
        alert(`Failed to remove task: ${err.message}`);
    }
}

async function updateTask(taskId, completed) {
    try {
        const response = await fetch(`/api/rooms/${currentRoomId}/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ completed })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        if (document.getElementById('admin-chat-section').style.display === 'block') {
            loadAdminChat(currentRoomId);
        } else {
            loadMemberChat(currentRoomId);
        }
    } catch (err) {
        console.error('Update task error:', err.message);
        alert(`Failed to update task: ${err.message}`);
    }
}

async function sendMessage(type) {
    const input = document.getElementById(`${type}-chat-input`);
    const content = input.value.trim();
    if (!content) {
        alert('Message content is required');
        return;
    }
    const url = type === 'private' ? `/api/private-messages/${currentMemberId}` : `/api/rooms/${currentRoomId}/messages`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ content })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        input.value = '';
        if (type === 'admin') loadAdminChat(currentRoomId);
        else if (type === 'member') loadMemberChat(currentRoomId);
        else loadPrivateChat(currentMemberId);
    } catch (err) {
        console.error('Send message error:', err.message);
        alert(`Failed to send message: ${err.message}`);
    }
}

async function pinMessage(messageId, pinned, type) {
    const url = type === 'private' ? `/api/private-messages/${messageId}/pin` : `/api/rooms/${currentRoomId}/messages/${messageId}/pin`;
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ pinned })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Zwstatus: ${response.status}`);
        }
        if (type === 'admin') loadAdminChat(currentRoomId);
        else if (type === 'member') loadMemberChat(currentRoomId);
        else loadPrivateChat(currentMemberId);
    } catch (err) {
        console.error('Pin message error:', err.message);
        alert(`Failed to pin/unpin message: ${err.message}`);
    }
}

function updateProgress(type, tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    const progressBar = document.getElementById(`${type}-progress`);
    const progressText = document.getElementById(`${type}-progress-text`);
    if (progressBar && progressText) {
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Progress: ${percentage}%`;
    } else {
        console.error('Progress elements not found for type:', type);
    }
}

function logout() {
    localStorage.removeItem('token');
    showSection('auth-section');
    toggleAuth();
}

function loadRoleSelection() {
    console.log('Loading role selection');
    // No additional logic needed; section is shown by showSection
}

if (token) {
    try {
        const payload = token.split('.')[1];
        if (!payload) throw new Error('Invalid token format');
        const user = JSON.parse(atob(payload));
        console.log('User from token:', user);
        showSection(user.role === 'manager' ? 'admin-home-section' : user.role === 'member' ? 'member-home-section' : 'role-selection-section');
        if (user.role === 'manager') loadAdminHome();
        else if (user.role === 'member') loadMemberHome();
        else loadRoleSelection();
    } catch (err) {
        console.error('Initial load error:', err.message);
        localStorage.removeItem('token');
        showSection('auth-section');
    }
} else {
    console.log('No token, showing auth section');
    showSection('auth-section');
}