package com.example.scribble.model;

public class GameMessage {
    // type examples: "STATE", "PLAYER_JOINED", "PLAYER_LEFT", "GAME_STARTED",
    // "ROUND_STARTED", "ROUND_ENDED", "TIMER", "SCORE_UPDATE", "GAME_OVER",
    // "TOAST", "WORD_REVEAL"
    private String type;
    private Object payload;

    public GameMessage() {}

    public GameMessage(String type, Object payload) {
        this.type = type;
        this.payload = payload;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Object getPayload() { return payload; }
    public void setPayload(Object payload) { this.payload = payload; }
}
