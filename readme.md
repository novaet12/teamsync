# TeamSync - Team Collaboration Platform

![TeamSync Logo](https://via.placeholder.com/150) <!-- Replace with actual logo if available -->

TeamSync is a modern, full-stack team collaboration platform designed to enhance team productivity and communication. Built with scalability and user experience in mind, it provides a comprehensive suite of features for effective team management and collaboration.

## 🚀 Features

- **Secure Authentication System**
  - JWT-based authentication
  - Role-based access control
  - Secure password hashing with bcrypt

- **Team Management**
  - Manager and member roles
  - Referral code system for team expansion
  - Profile management with image uploads

- **Collaboration Tools**
  - Real-time chat functionality
  - Task management with progress tracking
  - Private messaging capabilities
  - Message pinning for important announcements

- **User Experience**
  - Dark-themed, responsive interface
  - Intuitive navigation
  - Real-time updates

## 🛠️ Technology Stack

- **Frontend**
  - HTML5, CSS3, JavaScript (ES6+)
  - Responsive design principles
  - Modern UI/UX practices

- **Backend**
  - Node.js with Express.js
  - RESTful API architecture
  - JWT for authentication
  - Multer for file handling

- **Database**
  - MongoDB for flexible data storage
  - Mongoose for schema management

- **Infrastructure**
  - Docker for containerization
  - Docker Compose for orchestration
  - Environment-based configuration

## 📦 Project Structure

```
teamsync/
├── public/              # Frontend assets
│   ├── index.html      # Main application entry
│   ├── styles.css      # Global styles
│   ├── scripts.js      # Client-side logic
│   └── uploads/        # User uploads directory
├── backend/            # Backend services
│   ├── server.js       # Express server setup
│   ├── routes/         # API routes
│   ├── models/         # Database models
│   └── middleware/     # Custom middleware
├── .env                # Environment configuration
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Service orchestration
└── package.json        # Project dependencies
```

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for development)
- MongoDB (for local development)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/teamsync.git
   cd teamsync
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the Application**
   ```bash
   docker-compose up --build
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - MongoDB: localhost:27017

## 🔧 Configuration

### Environment Variables

- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `PORT`: Application port (default: 3000)

### Security Considerations

- Use strong JWT secrets in production
- Implement rate limiting
- Enable HTTPS in production
- Regular security audits

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection**
   - Verify MongoDB service is running
   - Check connection string in .env
   - Ensure proper network configuration

2. **Authentication Issues**
   - Clear browser localStorage
   - Verify JWT secret configuration
   - Check token expiration

3. **File Uploads**
   - Verify uploads directory permissions
   - Check file size limits
   - Validate file types

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

Built with ❤️ by the TeamSync Development Team