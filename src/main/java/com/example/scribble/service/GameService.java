package com.example.scribble.service;

import com.example.scribble.model.GameMessage;
import com.example.scribble.model.Player;
import com.example.scribble.model.Room;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;

@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final WordService wordService;
    private final RoomService roomService;

    private final Map<String, ScheduledFuture<?>> roomTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // ALL outbound broadcasts for ALL rooms are funneled through this single
    // thread. Spring's WebSocketSession does not support concurrent writes from
    // multiple threads — if a background scheduler thread (the per-second timer
    // tick) and a request-handling thread (join/chat/round-start) try to write to
    // the same client session at the same moment, one of those sends can be
    // silently dropped. Serializing every send through one thread eliminates that
    // race entirely, regardless of which thread originally triggered the event.
    private final ExecutorService broadcastExecutor = Executors.newSingleThreadExecutor();

    public GameService(
            SimpMessagingTemplate messagingTemplate,
            WordService wordService,
            RoomService roomService
    ) {
        this.messagingTemplate = messagingTemplate;
        this.wordService = wordService;
        this.roomService = roomService;
    }

    private String topic(String roomId) {
        return "/topic/room/" + roomId;
    }

    /** Every outbound message for a room — of any kind — must go through this
     *  method, never messagingTemplate.convertAndSend() directly, so that all
     *  sends for a given client session are strictly serialized. */
    public void broadcast(String destination, Object payload) {
        broadcastExecutor.execute(() -> {
            try {
                messagingTemplate.convertAndSend(destination, payload);
            } catch (Exception ex) {
                log.error("Failed to broadcast to {}", destination, ex);
            }
        });
    }

    public void broadcastState(Room room) {
        broadcast(
                topic(room.getRoomId()),
                new GameMessage("STATE", buildStatePayload(room))
        );
    }

    private Map<String, Object> buildStatePayload(Room room) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("roomId", room.getRoomId());
        payload.put("status", room.getStatus().name());
        payload.put("maxRounds", room.getMaxRounds());
        payload.put("currentRound", room.getCurrentRound());
        payload.put("maxPlayers", room.getMaxPlayers());
        payload.put("currentArtistId", room.getCurrentArtistId());
        payload.put(
                "wordLength",
                room.getCurrentWord() != null
                        ? room.getCurrentWord().length()
                        : 0
        );
        payload.put(
                "roundDurationSeconds",
                room.getRoundDurationSeconds()
        );

        List<Map<String, Object>> playerList = new ArrayList<>();

        synchronized (room.getPlayers()) {
            for (Player p : room.getPlayers().values()) {
                Map<String, Object> pMap = new LinkedHashMap<>();
                pMap.put("id", p.getId());
                pMap.put("name", p.getName());
                pMap.put("avatarColor", p.getAvatarColor());
                pMap.put("score", p.getScore());
                pMap.put("host", p.isHost());
                pMap.put("correctGuesses", p.getCorrectGuesses());
                pMap.put(
                        "hasGuessedCorrectly",
                        room.getCorrectGuessersThisRound().contains(p.getId())
                );
                playerList.add(pMap);
            }
        }

        payload.put("players", playerList);

        return payload;
    }

    public void startGame(Room room) {
        if (room.getPlayers().size() < 2) return;

        room.setStatus(Room.Status.PLAYING);
        room.setCurrentRound(0);
        room.setCurrentArtistIndex(-1);

        broadcast(
                topic(room.getRoomId()),
                new GameMessage("GAME_STARTED", null)
        );

        nextRound(room);
    }

    private List<Player> orderedPlayers(Room room) {
        synchronized (room.getPlayers()) {
            return new ArrayList<>(room.getPlayers().values());
        }
    }

    public void nextRound(Room room) {
        List<Player> players = orderedPlayers(room);

        if (players.isEmpty()) return;

        int nextArtistIndex = room.getCurrentArtistIndex() + 1;

        if (nextArtistIndex >= players.size()) {
            nextArtistIndex = 0;
            room.setCurrentRound(room.getCurrentRound() + 1);
        }

        if (room.getCurrentRound() == 0) {
            room.setCurrentRound(1);
        }

        if (room.getCurrentRound() > room.getMaxRounds()) {
            endGame(room);
            return;
        }

        room.setCurrentArtistIndex(nextArtistIndex);

        Player artist = players.get(nextArtistIndex);

        room.setCurrentArtistId(artist.getId());
        room.setCurrentWord(wordService.randomWord());
        room.getCorrectGuessersThisRound().clear();
        room.setStatus(Room.Status.PLAYING);
        room.setRoundStartedAtEpochMs(System.currentTimeMillis());

        log.info(
                "[room {}] round {} starting: artist={} ({}) word='{}'",
                room.getRoomId(),
                room.getCurrentRound(),
                artist.getName(),
                artist.getId(),
                room.getCurrentWord()
        );

        broadcastRoundStarted(room);

        broadcastState(room);

        scheduleTimer(room);

        log.info(
                "[room {}] round {} setup complete, timer scheduled",
                room.getRoomId(),
                room.getCurrentRound()
        );
    }

    /**
     * Sends the current round information again.
     *
     * This is important when a player connects after the original
     * ROUND_STARTED event was already broadcast.
     *
     * The frontend already checks artistId before displaying the word,
     * so only the current artist will actually show the secret word.
     */
    public void sendCurrentRound(Room room) {
        if (room == null) return;

        if (room.getStatus() != Room.Status.PLAYING) return;

        if (room.getCurrentArtistId() == null) return;

        if (room.getCurrentWord() == null) return;

        broadcastRoundStarted(room);
    }

    /**
     * Builds and broadcasts the current ROUND_STARTED message.
     */
    private void broadcastRoundStarted(Room room) {
        Player artist = room.getPlayers().get(room.getCurrentArtistId());

        if (artist == null) return;

        broadcast(
                topic(room.getRoomId()),
                new GameMessage(
                        "ROUND_STARTED",
                        Map.of(
                                "round", room.getCurrentRound(),
                                "artistId", artist.getId(),
                                "artistName", artist.getName(),
                                "word", room.getCurrentWord(),
                                "wordLength", room.getCurrentWord().length(),
                                "durationSeconds",
                                room.getRoundDurationSeconds()
                        )
                )
        );
    }

    private void scheduleTimer(Room room) {
        cancelTimer(room.getRoomId());

        final int[] remaining = {
                room.getRoundDurationSeconds()
        };

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(
                () -> {
                    try {
                        remaining[0]--;

                        broadcast(
                                topic(room.getRoomId()),
                                new GameMessage(
                                        "TIMER",
                                        Map.of(
                                                "remaining",
                                                Math.max(
                                                        remaining[0],
                                                        0
                                                )
                                        )
                                )
                        );

                        boolean allGuessed =
                                room.getPlayers().size() > 1
                                        && room.getCorrectGuessersThisRound().size()
                                        >= room.getPlayers().size() - 1;

                        if (remaining[0] <= 0 || allGuessed) {
                            cancelTimer(room.getRoomId());
                            endRound(room);
                        }

                    } catch (Exception ex) {
                        cancelTimer(room.getRoomId());

                        try {
                            endRound(room);
                        } catch (Exception ignored) {
                            // best effort
                        }
                    }
                },
                1,
                1,
                TimeUnit.SECONDS
        );

        roomTimers.put(room.getRoomId(), future);
    }

    private void cancelTimer(String roomId) {
        ScheduledFuture<?> f = roomTimers.remove(roomId);

        if (f != null) {
            f.cancel(false);
        }
    }

    public void endRound(Room room) {
        room.setStatus(Room.Status.ROUND_END);

        Player artist =
                room.getPlayers().get(room.getCurrentArtistId());

        log.info(
                "[room {}] round {} ended (artist={})",
                room.getRoomId(),
                room.getCurrentRound(),
                artist != null ? artist.getName() : "?"
        );

        List<Map<String, Object>> earners = new ArrayList<>();

        for (String pid : room.getCorrectGuessersThisRound()) {
            Player p = room.getPlayers().get(pid);

            if (p != null) {
                earners.add(
                        Map.of(
                                "id", p.getId(),
                                "name", p.getName(),
                                "score", p.getScore()
                        )
                );
            }
        }

        broadcast(
                topic(room.getRoomId()),
                new GameMessage(
                        "ROUND_ENDED",
                        Map.of(
                                "word",
                                room.getCurrentWord() == null
                                        ? ""
                                        : room.getCurrentWord(),

                                "artistId",
                                artist != null
                                        ? artist.getId()
                                        : "",

                                "artistName",
                                artist != null
                                        ? artist.getName()
                                        : "",

                                "earners",
                                earners
                        )
                )
        );

        broadcastState(room);

        boolean isLastArtistOfLastRound =
                room.getCurrentRound() >= room.getMaxRounds()
                        && room.getCurrentArtistIndex()
                        >= room.getPlayers().size() - 1;

        log.info(
                "[room {}] scheduling next step in 5s — " +
                        "isLastArtistOfLastRound={} (round={}/{}, artistIndex={}/{})",
                room.getRoomId(),
                isLastArtistOfLastRound,
                room.getCurrentRound(),
                room.getMaxRounds(),
                room.getCurrentArtistIndex(),
                room.getPlayers().size() - 1
        );

        scheduler.schedule(
                () -> {
                    try {
                        if (isLastArtistOfLastRound) {

                            log.info(
                                    "[room {}] transition timer fired -> ending game",
                                    room.getRoomId()
                            );

                            endGame(room);

                        } else {

                            log.info(
                                    "[room {}] transition timer fired -> starting next round",
                                    room.getRoomId()
                            );

                            nextRound(room);
                        }

                    } catch (Exception ex) {

                        log.error(
                                "[room {}] error during scheduled round transition " +
                                        "— ending game as a fallback",
                                room.getRoomId(),
                                ex
                        );

                        endGame(room);
                    }
                },
                5,
                TimeUnit.SECONDS
        );
    }

    public void endGame(Room room) {
        cancelTimer(room.getRoomId());

        room.setStatus(Room.Status.FINISHED);

        List<Player> ranked;

        synchronized (room.getPlayers()) {
            ranked = new ArrayList<>(room.getPlayers().values());
        }

        ranked.sort((a, b) -> b.getScore() - a.getScore());

        List<Map<String, Object>> results = new ArrayList<>();

        for (Player p : ranked) {
            results.add(
                    Map.of(
                            "id", p.getId(),
                            "name", p.getName(),
                            "score", p.getScore(),
                            "avatarColor", p.getAvatarColor()
                    )
            );
        }

        broadcast(
                topic(room.getRoomId()),
                new GameMessage(
                        "GAME_OVER",
                        Map.of("results", results)
                )
        );

        broadcastState(room);
    }

    public boolean handleGuess(
            Room room,
            Player guesser,
            String text
    ) {
        if (room.getStatus() != Room.Status.PLAYING) return false;

        if (guesser.getId().equals(room.getCurrentArtistId())) {
            return false;
        }

        if (room.getCorrectGuessersThisRound()
                .contains(guesser.getId())) {
            return false;
        }

        if (room.getCurrentWord() == null) return false;

        boolean correct =
                text.trim().equalsIgnoreCase(
                        room.getCurrentWord().trim()
                );

        if (correct) {

            long secondsElapsed =
                    (System.currentTimeMillis()
                            - room.getRoundStartedAtEpochMs())
                            / 1000;

            long secondsLeft =
                    Math.max(
                            0,
                            room.getRoundDurationSeconds()
                                    - secondsElapsed
                    );

            int points =
                    (int) Math.max(
                            20,
                            100
                                    - (
                                    room.getRoundDurationSeconds()
                                            - secondsLeft
                            )
                    );

            guesser.addScore(points);
            guesser.incrementCorrectGuesses();

            room.getCorrectGuessersThisRound()
                    .add(guesser.getId());

            Player artist =
                    room.getPlayers()
                            .get(room.getCurrentArtistId());

            if (artist != null) {
                artist.addScore(10);
            }

            broadcast(
                    topic(room.getRoomId()),
                    new GameMessage(
                            "SCORE_UPDATE",
                            Map.of(
                                    "playerId",
                                    guesser.getId(),
                                    "playerName",
                                    guesser.getName(),
                                    "points",
                                    points
                            )
                    )
            );

            broadcastState(room);
        }

        return correct;
    }

    public void restartGame(Room room) {
        synchronized (room.getPlayers()) {
            for (Player p : room.getPlayers().values()) {
                p.setScore(0);
                p.setCorrectGuesses(0);
            }
        }

        room.setCurrentRound(0);
        room.setCurrentArtistIndex(-1);
        room.setStatus(Room.Status.LOBBY);
        room.getCorrectGuessersThisRound().clear();

        broadcastState(room);
    }

    private static final int RECONNECT_GRACE_PERIOD_SECONDS = 20;

    public void handlePlayerDisconnected(
            Room room,
            Player player,
            String disconnectedSessionId
    ) {
        if (player == null) return;

        /*
         * IMPORTANT:
         *
         * A player can reconnect and receive a NEW WebSocket session
         * before the old session's disconnect event is processed.
         *
         * In that situation, the old disconnect event must NOT mark
         * the player's new/current connection as disconnected.
         */
        String currentSessionId = player.getSessionId();

        if (currentSessionId != null
                && !disconnectedSessionId.equals(currentSessionId)) {

            log.info(
                    "[room {}] ignoring stale disconnect for player {} " +
                            "(old session {}, current session {})",
                    room.getRoomId(),
                    player.getName(),
                    disconnectedSessionId,
                    currentSessionId
            );

            return;
        }

        player.setConnected(false);

        log.info(
                "[room {}] player {} disconnected (session {}) — " +
                        "starting {}s reconnect grace period",
                room.getRoomId(),
                player.getName(),
                disconnectedSessionId,
                RECONNECT_GRACE_PERIOD_SECONDS
        );

        scheduler.schedule(
                () -> {
                    try {

                        if (disconnectedSessionId.equals(
                                player.getSessionId())) {

                            log.info(
                                    "[room {}] player {} did not reconnect " +
                                            "within grace period — removing",
                                    room.getRoomId(),
                                    player.getName()
                            );

                            roomService.removePlayer(
                                    room.getRoomId(),
                                    player.getId()
                            );

                            Room stillExists =
                                    roomService.getRoom(
                                            room.getRoomId()
                                    );

                            if (stillExists != null) {

                                broadcast(
                                        topic(room.getRoomId()),
                                        new GameMessage(
                                                "PLAYER_LEFT",
                                                Map.of(
                                                        "playerId",
                                                        player.getId(),
                                                        "playerName",
                                                        player.getName()
                                                )
                                        )
                                );

                                broadcastState(stillExists);
                            }

                        } else {

                            log.info(
                                    "[room {}] player {} reconnected during " +
                                            "grace period — keeping them in the room",
                                    room.getRoomId(),
                                    player.getName()
                            );
                        }

                    } catch (Exception ex) {

                        log.error(
                                "[room {}] error during grace-period " +
                                        "disconnect cleanup",
                                room.getRoomId(),
                                ex
                        );
                    }
                },
                RECONNECT_GRACE_PERIOD_SECONDS,
                TimeUnit.SECONDS
        );
    }
}
