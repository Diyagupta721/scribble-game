package com.example.scribble.service;

import com.example.scribble.model.Player;
import com.example.scribble.model.Room;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final List<String> avatarColors = List.of(
            "#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7", "#00B894",
            "#FD79A8", "#0984E3", "#E17055", "#A29BFE", "#00CEC9"
    );

    public Room createRoom(int maxRounds, int maxPlayers) {
        String code = generateUniqueCode();
        Room room = new Room(code, maxRounds, maxPlayers);
        rooms.put(code, room);
        return room;
    }

    public Player addHost(Room room, String hostName) {
        Player player = new Player(UUID.randomUUID().toString(), sanitizeName(hostName), pickAvatarColor(room), true);
        room.getPlayers().put(player.getId(), player);
        return player;
    }

    public Player addPlayer(Room room, String name) {
        Player player = new Player(UUID.randomUUID().toString(), sanitizeName(name), pickAvatarColor(room), room.getPlayers().isEmpty());
        room.getPlayers().put(player.getId(), player);
        return player;
    }

    public Room getRoom(String roomId) {
        if (roomId == null) return null;
        return rooms.get(roomId.toUpperCase());
    }

    public void removePlayer(String roomId, String playerId) {
        Room room = getRoom(roomId);
        if (room == null) return;
        synchronized (room.getPlayers()) {
            room.getPlayers().remove(playerId);
            if (room.getPlayers().isEmpty()) {
                rooms.remove(room.getRoomId());
                return;
            }
            // reassign host if the host left
            boolean hasHost = room.getPlayers().values().stream().anyMatch(Player::isHost);
            if (!hasHost) {
                room.getPlayers().values().iterator().next().setHost(true);
            }
        }
    }

    public void removeRoom(String roomId) {
        rooms.remove(roomId);
    }

    private String pickAvatarColor(Room room) {
        int used = room.getPlayers().size();
        return avatarColors.get(used % avatarColors.size());
    }

    private String sanitizeName(String name) {
        if (name == null || name.isBlank()) return "Player";
        String trimmed = name.trim();
        return trimmed.length() > 16 ? trimmed.substring(0, 16) : trimmed;
    }

    private String generateUniqueCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (rooms.containsKey(code));
        return code;
    }
}
