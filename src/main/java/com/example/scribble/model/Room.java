package com.example.scribble.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class Room {

    public enum Status { LOBBY, PLAYING, ROUND_END, FINISHED }

    private String roomId;
    private int maxRounds;
    private int maxPlayers;
    private int roundDurationSeconds = 80;

    // Synchronized: multiple threads (STOMP request threads for join/leave, the
    // scheduler thread for round transitions, the single broadcast thread for
    // state snapshots) can all read or mutate this map. A plain LinkedHashMap
    // is not safe under that kind of concurrent access.
    private Map<String, Player> players = Collections.synchronizedMap(new LinkedHashMap<>());
    private Status status = Status.LOBBY;

    private int currentRound = 0;
    private int currentArtistIndex = -1;
    private String currentArtistId;
    private String currentWord;
    private long roundStartedAtEpochMs;
    private Set<String> correctGuessersThisRound = ConcurrentHashMap.newKeySet();
    private java.util.List<String> wordChoices;

    public Room() {}

    public Room(String roomId, int maxRounds, int maxPlayers) {
        this.roomId = roomId;
        this.maxRounds = maxRounds;
        this.maxPlayers = maxPlayers;
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public int getMaxRounds() { return maxRounds; }
    public void setMaxRounds(int maxRounds) { this.maxRounds = maxRounds; }

    public int getMaxPlayers() { return maxPlayers; }
    public void setMaxPlayers(int maxPlayers) { this.maxPlayers = maxPlayers; }

    public int getRoundDurationSeconds() { return roundDurationSeconds; }
    public void setRoundDurationSeconds(int roundDurationSeconds) { this.roundDurationSeconds = roundDurationSeconds; }

    public Map<String, Player> getPlayers() { return players; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public int getCurrentRound() { return currentRound; }
    public void setCurrentRound(int currentRound) { this.currentRound = currentRound; }

    public int getCurrentArtistIndex() { return currentArtistIndex; }
    public void setCurrentArtistIndex(int currentArtistIndex) { this.currentArtistIndex = currentArtistIndex; }

    public String getCurrentArtistId() { return currentArtistId; }
    public void setCurrentArtistId(String currentArtistId) { this.currentArtistId = currentArtistId; }

    public String getCurrentWord() { return currentWord; }
    public void setCurrentWord(String currentWord) { this.currentWord = currentWord; }

    public long getRoundStartedAtEpochMs() { return roundStartedAtEpochMs; }
    public void setRoundStartedAtEpochMs(long roundStartedAtEpochMs) { this.roundStartedAtEpochMs = roundStartedAtEpochMs; }

    public Set<String> getCorrectGuessersThisRound() { return correctGuessersThisRound; }

    public java.util.List<String> getWordChoices() { return wordChoices; }
    public void setWordChoices(java.util.List<String> wordChoices) { this.wordChoices = wordChoices; }

    public boolean isFull() { return players.size() >= maxPlayers; }
}
