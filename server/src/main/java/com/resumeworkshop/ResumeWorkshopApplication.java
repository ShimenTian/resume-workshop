package com.resumeworkshop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class ResumeWorkshopApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeWorkshopApplication.class, args);
    }
}
