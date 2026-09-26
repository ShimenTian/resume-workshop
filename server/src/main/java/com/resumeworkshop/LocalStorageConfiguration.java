package com.resumeworkshop;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/** The optional legacy API and its database belong to the local single-user mode. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "resume.storage", name = "api-enabled", havingValue = "true")
@Import(DataSourceAutoConfiguration.class)
public class LocalStorageConfiguration {
}
