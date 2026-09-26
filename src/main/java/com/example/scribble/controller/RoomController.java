package com.example.scribble.controller;

import com.example.scribble.model.Player;
import com.example.scribble.model.Room;
import com.example.scribble.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    public static class CreateRoomRequest {
        public String hostName;
        public int maxRounds = 3;
        public int maxPlayers = 8;
    }

    public static class JoinRoomRequest {
        public String name;
    }

    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody CreateRoomRequest req) {
        if (req.hostName == null || req.hostName.isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("Please enter your name."));
        }
        int rounds = Math.min(Math.max(req.maxRounds, 2), 10);
        int players = Math.min(Math.max(req.maxPlayers, 2), 8);

        Room room = roomService.createRoom(rounds, players);
        Player host = roomService.addHost(room, req.hostName);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("roomId", room.getRoomId());
        body.put("playerId", host.getId());
        body.put("playerName", host.getName());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable String roomId, @RequestBody JoinRoomRequest req) {
        if (req.name == null || req.name.isBlank()) {
            return ResponseEntity.badRequest().body(errorBody("Please enter your name."));
        }
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return ResponseEntity.badRequest().body(errorBody("Room not found. Check the code and try again."));
        }
        if (room.isFull()) {
            return ResponseEntity.badRequest().body(errorBody("This room is full."));
        }
        if (room.getStatus() != Room.Status.LOBBY) {
            return ResponseEntity.badRequest().body(errorBody("This game has already started."));
        }

        Player player = roomService.addPlayer(room, req.name);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("roomId", room.getRoomId());
        body.put("playerId", player.getId());
        body.put("playerName", player.getName());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<?> checkRoom(@PathVariable String roomId) {
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return ResponseEntity.badRequest().body(errorBody("Room not found."));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("roomId", room.getRoomId());
        body.put("playerCount", room.getPlayers().size());
        body.put("maxPlayers", room.getMaxPlayers());
        body.put("status", room.getStatus().name());
        return ResponseEntity.ok(body);
    }

    private Map<String, String> errorBody(String message) {
        return Map.of("error", message);
    }
}
