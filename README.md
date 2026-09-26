# 🎨 Scribble Game

A real-time multiplayer drawing and guessing game built with **Java, Spring Boot, WebSocket, STOMP, SockJS, HTML, CSS, and JavaScript**.

Players can create or join a game room, take turns drawing a secret word, and guess the drawing in real time. The game includes synchronized drawing, live chat and guessing, scoring, round management, timers, and automatic WebSocket reconnection.

---

## ✨ Features

* 🎮 Real-time multiplayer drawing and guessing
* 🏠 Create and join game rooms
* 👥 Multiplayer room support
* 🎨 Turn-based drawing gameplay
* 🔐 Secret word shown to the current artist
* ⚡ Real-time drawing synchronization
* 🖌️ Drawing tools including brush, pencil, and eraser
* ↩️ Undo and redo functionality
* 🧹 Clear canvas functionality
* 💬 Real-time chat and word guessing
* ✅ Automatic correct-guess detection
* 🏆 Score calculation and score updates
* ⏱️ Round timer
* 🔄 Multiple rounds with rotating artists
* 🔌 Automatic WebSocket reconnection
* 🚪 Leave game functionality
* 📱 Responsive web interface

---

## 🛠️ Tech Stack

### Backend

* **Java 17**
* **Spring Boot 3.3.4**
* Spring Web
* Spring WebSocket
* STOMP
* SockJS
* Maven

### Frontend

* HTML5
* CSS3
* JavaScript
* STOMP.js
* SockJS

### Communication

The game uses **STOMP over SockJS** for real-time communication between players and the Spring Boot server.

---

## 🎯 How the Game Works

The game follows a turn-based multiplayer flow:

```text
Create Room
     ↓
Players Join
     ↓
Host Starts Game
     ↓
Artist Is Selected
     ↓
Artist Receives Secret Word
     ↓
Artist Draws
     ↓
Other Players Guess
     ↓
Correct Guess → Score Update
     ↓
Round Ends
     ↓
Next Artist
     ↓
Next Round
     ↓
Game Ends
```

Drawing actions and game events are synchronized between connected players using WebSocket communication.

---

## ⚡ Real-Time Architecture

The application uses Spring's WebSocket messaging support with STOMP and SockJS.

```text
                  ┌─────────────────────┐
                  │    Spring Boot      │
                  │      Server         │
                  └──────────┬──────────┘
                             │
                       WebSocket
                      STOMP / SockJS
                             │
            ┌────────────────┼────────────────┐
            │                │                │
        Player 1         Player 2         Player 3
            │                │                │
        Drawing           Guessing          Chat
```

### WebSocket Endpoint

```text
/ws-scribble
```

### Application Destination

```text
/app
```

### Message Broker Destinations

```text
/topic
/queue
```

The frontend uses a relative WebSocket endpoint, allowing the same application to communicate with the Spring Boot server both locally and after deployment.

---

## 📁 Project Structure

```text
scribble
├── src
│   └── main
│       ├── java
│       │   └── com.example.scribble
│       │       ├── config
│       │       ├── controller
│       │       ├── model
│       │       ├── service
│       │       └── ScribbleApplication.java
│       │
│       └── resources
│           ├── static
│           │   ├── css
│           │   ├── js
│           │   ├── game.html
│           │   ├── index.html
│           │   └── lobby.html
│           │
│           └── application.properties
│
├── pom.xml
├── Dockerfile
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed:

* Java 17
* Git
* IntelliJ IDEA or another Java IDE
* A modern web browser

### 1. Clone the Repository

```bash
git clone https://github.com/Diyagupta721/scribble-game.git
cd scribble-game
```

### 2. Run the Application

If Maven is installed globally, run:

```bash
mvn spring-boot:run
```

Alternatively, run:

```text
ScribbleApplication.java
```

from your IDE.

### 3. Open the Game

Once the application starts, open:

```text
http://localhost:8080
```

Open the game in multiple browser windows or devices to test multiplayer functionality.

---

## 🔨 Build the Application

To create the production JAR:

```bash
mvn clean package
```

The generated JAR will be available inside:

```text
target/
```

---

## ⚙️ Configuration

The main application configuration is located at:

```text
src/main/resources/application.properties
```

The application uses port:

```text
${PORT:8080}
```

This allows the application to use port **8080 locally** while automatically using the port provided by the cloud hosting platform after deployment.

The WebSocket endpoint is:

```text
/ws-scribble
```

---

## 🐳 Docker Deployment

The application includes a `Dockerfile` for containerized deployment.

The Docker image:

1. Builds the Spring Boot application using Maven and Java 17.
2. Creates a lightweight Java 17 runtime image.
3. Runs the generated Spring Boot JAR.

The same Docker configuration is used for the cloud deployment.

---

## 🧩 Technical Highlights

This project demonstrates practical implementation of:

* Spring Boot application development
* REST-based room management
* Real-time WebSocket communication
* STOMP messaging
* SockJS fallback communication
* Multiplayer game state management
* Server-side round and timer management
* Real-time drawing synchronization
* Player score tracking
* WebSocket reconnection handling
* Frontend-to-backend event communication
* Maven-based Java application builds
* Docker-based deployment

---

## 📌 Project Status

The core multiplayer game functionality is complete and the application has been successfully deployed.

Current functionality includes:

* Multiplayer rooms
* Real-time drawing
* Guessing and chat
* Score updates
* Timed rounds
* Artist rotation
* WebSocket communication
* Reconnection handling
* Leave game functionality
* Responsive game interface
* Cloud deployment

The deployed application has been tested with multiple players and the core multiplayer functionality is working correctly.

---

## 🌐 Deployment

The application is deployed as a **single Spring Boot application**, with the frontend served from the same application.

**Live Game:**

https://scribble-game-6qat.onrender.com

**GitHub Repository:**

https://github.com/Diyagupta721/scribble-game

---

## 👩‍💻 Author

### Diya Gupta

Information Technology Student

**GitHub:** https://github.com/Diyagupta721

---

## 📄 License

This project is created for learning, development, and portfolio purposes.
