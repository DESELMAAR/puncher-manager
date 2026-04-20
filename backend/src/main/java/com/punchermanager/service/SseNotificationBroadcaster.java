package com.punchermanager.service;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class SseNotificationBroadcaster {

  private static final Logger log = LoggerFactory.getLogger(SseNotificationBroadcaster.class);

  private final Map<UUID, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

  public SseEmitter subscribe(UUID userId) {
    SseEmitter emitter = new SseEmitter(0L);
    subscribers.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);
    emitter.onCompletion(() -> remove(userId, emitter));
    emitter.onTimeout(() -> remove(userId, emitter));
    emitter.onError(e -> remove(userId, emitter));
    return emitter;
  }

  public void publish(UUID userId, String eventName, Object payload) {
    CopyOnWriteArrayList<SseEmitter> list = subscribers.get(userId);
    if (list == null) {
      return;
    }
    for (SseEmitter emitter : list) {
      try {
        emitter.send(SseEmitter.event().name(eventName).data(payload));
      } catch (IOException e) {
        log.debug("SSE send failed, removing subscriber", e);
        remove(userId, emitter);
      }
    }
  }

  private void remove(UUID userId, SseEmitter emitter) {
    CopyOnWriteArrayList<SseEmitter> list = subscribers.get(userId);
    if (list != null) {
      list.remove(emitter);
      if (list.isEmpty()) {
        subscribers.remove(userId);
      }
    }
  }
}
