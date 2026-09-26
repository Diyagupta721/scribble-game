package com.example.scribble.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {

        /*
         * Task scheduler used by the STOMP simple broker for
         * heartbeat messages.
         */
        ThreadPoolTaskScheduler heartbeatScheduler =
                new ThreadPoolTaskScheduler();

        heartbeatScheduler.setPoolSize(1);
        heartbeatScheduler.setThreadNamePrefix("scribble-heartbeat-");
        heartbeatScheduler.initialize();

        /*
         * Enable the existing /topic and /queue destinations.
         *
         * The broker will now also send STOMP heartbeats so that
         * active clients are not incorrectly considered disconnected.
         */
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{30000, 30000})
                .setTaskScheduler(heartbeatScheduler);

        /*
         * Messages sent from the browser to @MessageMapping
         * methods use /app.
         */
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(
            StompEndpointRegistry registry
    ) {
        registry.addEndpoint("/ws-scribble")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}