package com.example.scribble.controller;

import com.example.scribble.model.*;
import com.example.scribble.service.GameService;
import com.example.scribble.service.RoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.context.event.EventListener;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class GameWebSocketController {

    private static final Logger log =
            LoggerFactory.getLogger(GameWebSocketController.class);

    private final RoomService roomService;
    private final GameService gameService;

    // websocket session id -> [roomId, playerId]
    private final Map<String, String[]> sessionRegistry =
            new ConcurrentHashMap<>();

    public GameWebSocketController(
            RoomService roomService,
            GameService gameService
    ) {
        this.roomService = roomService;
        this.gameService = gameService;
    }

    public static class JoinPayload {
        public String roomId;
        public String playerId;
    }

    @MessageMapping("/player/join")
    public void playerJoin(
            @Payload JoinPayload payload,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        Room room = roomService.getRoom(payload.roomId);

        if (room == null) return;

        Player player =
                room.getPlayers().get(payload.playerId);

        if (player == null) return;

        player.setConnected(true);

        String sessionId =
                headerAccessor.getSessionId();

        player.setSessionId(sessionId);

        sessionRegistry.put(
                sessionId,
                new String[]{
                        room.getRoomId(),
                        player.getId()
                }
        );

        log.info(
                "[room {}] player {} joined (session {})",
                room.getRoomId(),
                player.getName(),
                sessionId
        );

        gameService.broadcast(
                "/topic/room/" + room.getRoomId(),
                new GameMessage(
                        "PLAYER_JOINED",
                        Map.of(
                                "playerId",
                                player.getId(),
                                "playerName",
                                player.getName()
                        )
                )
        );

        gameService.broadcastState(room);

        /*
         * FIX 1:
         *
         * The original ROUND_STARTED message may have been sent before
         * this game-page WebSocket subscribed to the room topic.
         *
         * If the game is already running, send the current round
         * information again so the newly connected player receives it.
         *
         * The frontend already checks artistId, so only the artist
         * displays the actual secret word.
         */
        if (room.getStatus() == Room.Status.PLAYING) {
            gameService.sendCurrentRound(room);
        }
    }

    @MessageMapping("/draw")
    public void draw(@Payload DrawingMessage message) {
        Room room =
                roomService.getRoom(message.getRoomId());

        if (room == null) return;

        // only the current artist may broadcast strokes
        if (!isCurrentArtist(room, message.getPlayerId())) return;

        gameService.broadcast(
                "/topic/room/" + room.getRoomId() + "/draw",
                message
        );
    }

    @MessageMapping("/clear")
    public void clear(@Payload DrawingMessage message) {
        Room room =
                roomService.getRoom(message.getRoomId());

        if (room == null) return;

        if (!isCurrentArtist(room, message.getPlayerId())) return;

        message.setType("clear");

        gameService.broadcast(
                "/topic/room/" + room.getRoomId() + "/draw",
                message
        );
    }

    private boolean isCurrentArtist(
            Room room,
            String playerId
    ) {
        return playerId != null
                && playerId.equals(room.getCurrentArtistId());
    }

    @MessageMapping("/chat")
    public void chat(@Payload ChatMessage message) {
        Room room =
                roomService.getRoom(message.getRoomId());

        if (room == null) return;

        Player sender =
                room.getPlayers().get(message.getPlayerId());

        if (sender == null) return;

        message.setPlayerName(sender.getName());
        message.setTimestamp(System.currentTimeMillis());

        log.info(
                "[room {}] chat from {}: '{}'",
                room.getRoomId(),
                sender.getName(),
                message.getText()
        );

        if (
                room.getStatus() == Room.Status.PLAYING
                        && !sender.getId()
                        .equals(room.getCurrentArtistId())
        ) {
            boolean correct =
                    gameService.handleGuess(
                            room,
                            sender,
                            message.getText()
                    );

            if (correct) {
                message.setType("correct");

                message.setText(
                        sender.getName()
                                + " guessed the word!"
                );

                gameService.broadcast(
                        "/topic/room/" + room.getRoomId(),
                        message
                );

                return;
            }
        }

        message.setType("chat");

        gameService.broadcast(
                "/topic/room/" + room.getRoomId(),
                message
        );
    }

    @MessageMapping("/game/start")
    public void startGame(@Payload JoinPayload payload) {
        Room room =
                roomService.getRoom(payload.roomId);

        if (room == null) return;

        Player requester =
                room.getPlayers().get(payload.playerId);

        if (
                requester == null
                        || !requester.isHost()
        ) {
            return;
        }

        gameService.startGame(room);
    }

    @MessageMapping("/game/restart")
    public void restartGame(@Payload JoinPayload payload) {
        Room room =
                roomService.getRoom(payload.roomId);

        if (room == null) return;

        Player requester =
                room.getPlayers().get(payload.playerId);

        if (
                requester == null
                        || !requester.isHost()
        ) {
            return;
        }

        gameService.restartGame(room);
    }

    @EventListener
    public void handleDisconnect(
            SessionDisconnectEvent event
    ) {
        SimpMessageHeaderAccessor accessor =
                SimpMessageHeaderAccessor.wrap(event.getMessage());

        String sessionId =
                accessor.getSessionId();

        String[] info =
                sessionRegistry.remove(sessionId);

        if (info == null) return;

        String roomId = info[0];
        String playerId = info[1];

        Room room =
                roomService.getRoom(roomId);

        if (room == null) return;

        Player player =
                room.getPlayers().get(playerId);

        if (player == null) return;

        log.info(
                "[room {}] session {} disconnected for player {}",
                roomId,
                sessionId,
                player.getName()
        );

        // Not an immediate removal — see GameService.handlePlayerDisconnected()
        // for why.
        gameService.handlePlayerDisconnected(
                room,
                player,
                sessionId
        );
    }
}