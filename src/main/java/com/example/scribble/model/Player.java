package com.example.scribble.model;

public class Player {
    private String id;          // stable player id (assigned at room create/join)
    private String name;
    private String avatarColor; // hex color used to render avatar
    private int score;
    private boolean host;
    private boolean connected;
    private int correctGuesses;
    private String sessionId;   // live STOMP/WebSocket session id, set on /app/player/join

    public Player() {}

    public Player(String id, String name, String avatarColor, boolean host) {
        this.id = id;
        this.name = name;
        this.avatarColor = avatarColor;
        this.host = host;
        this.score = 0;
        this.connected = true;
        this.correctGuesses = 0;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAvatarColor() { return avatarColor; }
    public void setAvatarColor(String avatarColor) { this.avatarColor = avatarColor; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public void addScore(int delta) { this.score += delta; }

    public boolean isHost() { return host; }
    public void setHost(boolean host) { this.host = host; }

    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }

    public int getCorrectGuesses() { return correctGuesses; }
    public void setCorrectGuesses(int correctGuesses) { this.correctGuesses = correctGuesses; }
    public void incrementCorrectGuesses() { this.correctGuesses++; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
}
