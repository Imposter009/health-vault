package com.healthvault.ingestion.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    // 1 partition for local dev.
    // NOTE: increase partition count before horizontal scaling — more partitions
    // allow more parallel consumer instances to process documents concurrently.
    // Replication factor must stay ≤ broker count (1 here).

    @Bean
    public NewTopic documentUploadedTopic() {
        return TopicBuilder.name("document.uploaded")
            .partitions(1)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic documentProcessedTopic() {
        return TopicBuilder.name("document.processed")
            .partitions(1)
            .replicas(1)
            .build();
    }
}
