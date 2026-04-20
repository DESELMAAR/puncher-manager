package com.punchermanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PuncherManagerApplication {

  public static void main(String[] args) {
    SpringApplication.run(PuncherManagerApplication.class, args);
  }
}
