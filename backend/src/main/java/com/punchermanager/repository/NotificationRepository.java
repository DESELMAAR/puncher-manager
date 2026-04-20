package com.punchermanager.repository;

import com.punchermanager.domain.NotificationEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

  List<NotificationEntity> findByReceiverIdOrderByCreatedAtDesc(UUID receiverId);
}
