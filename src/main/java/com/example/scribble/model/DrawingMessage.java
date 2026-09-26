package com.example.scribble.model;

public class DrawingMessage {
    private String roomId;
    private String playerId;
    private String type;   // "start" | "draw" | "end" | "clear" | "undo" | "redo" | "snapshot"
    private double x;
    private double y;
    private double prevX;
    private double prevY;
    private String color;
    private double size;
    private String tool;   // "brush" | "pencil" | "eraser"
    private String snapshot; // full canvas data URL, used for undo/redo/late-join sync

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public double getPrevX() { return prevX; }
    public void setPrevX(double prevX) { this.prevX = prevX; }

    public double getPrevY() { return prevY; }
    public void setPrevY(double prevY) { this.prevY = prevY; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public double getSize() { return size; }
    public void setSize(double size) { this.size = size; }

    public String getTool() { return tool; }
    public void setTool(String tool) { this.tool = tool; }

    public String getSnapshot() { return snapshot; }
    public void setSnapshot(String snapshot) { this.snapshot = snapshot; }
}
